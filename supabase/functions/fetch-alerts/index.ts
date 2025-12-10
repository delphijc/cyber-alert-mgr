import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface AlertSource {
  id: string;
  name: string;
  url: string;
  source_type: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: sources, error: sourcesError } = await supabase
      .from('alert_sources')
      .select('*')
      .eq('is_active', true);

    if (sourcesError) throw sourcesError;

    const results = [];

    for (const source of sources as AlertSource[]) {
      try {
        let alerts = [];

        if (source.source_type === 'api' && source.name === 'NIST NVD') {
          alerts = await fetchNISTAlerts(source);
        } else if (source.source_type === 'scrape') {
          alerts = await fetchScrapedAlerts(source);
        }

        let newAlertsCount = 0;
        for (const alert of alerts) {
          const { error: insertError } = await supabase
            .from('alerts')
            .upsert(
              {
                source_id: source.id,
                external_id: alert.external_id,
                title: alert.title,
                description: alert.description,
                severity: alert.severity,
                published_date: alert.published_date,
                updated_date: alert.updated_date,
                url: alert.url,
                raw_data: alert.raw_data,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'source_id,external_id', ignoreDuplicates: false }
            );

          if (!insertError) newAlertsCount++;
        }

        await supabase.from('alert_sources').update({
          last_checked_at: new Date().toISOString(),
        }).eq('id', source.id);

        await supabase.from('processing_logs').insert({
          source_id: source.id,
          status: 'success',
          alerts_found: newAlertsCount,
          processed_at: new Date().toISOString(),
        });

        results.push({ source: source.name, alerts: newAlertsCount, status: 'success' });
      } catch (error) {
        await supabase.from('processing_logs').insert({
          source_id: source.id,
          status: 'error',
          alerts_found: 0,
          error_message: error.message,
          processed_at: new Date().toISOString(),
        });

        results.push({ source: source.name, status: 'error', error: error.message });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function fetchNISTAlerts(source: AlertSource) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startDate = sevenDaysAgo.toISOString().replace('Z', '');
  const endDate = now.toISOString().replace('Z', '');

  const url = `${source.url}?pubStartDate=${startDate}&pubEndDate=${endDate}`;

  const headers: Record<string, string> = {};
  const apiKey = Deno.env.get('NIST_API_KEY');
  if (apiKey) {
    headers['apiKey'] = apiKey;
  }

  const response = await fetch(url, { headers });
  const data = await response.json();

  const alerts = [];
  if (data.vulnerabilities) {
    for (const vuln of data.vulnerabilities.slice(0, 50)) {
      const cve = vuln.cve;
      const description = cve.descriptions?.find((d: { lang: string }) => d.lang === 'en')?.value || 'No description';

      let severity = 'info';
      const cvssMetrics = cve.metrics?.cvssMetricV31?.[0] || cve.metrics?.cvssMetricV2?.[0];
      if (cvssMetrics) {
        const score = cvssMetrics.cvssData?.baseScore || 0;
        if (score >= 9.0) severity = 'critical';
        else if (score >= 7.0) severity = 'high';
        else if (score >= 4.0) severity = 'medium';
        else severity = 'low';
      }

      alerts.push({
        external_id: cve.id,
        title: cve.id,
        description: description,
        severity: severity,
        published_date: cve.published,
        updated_date: cve.lastModified,
        url: `https://nvd.nist.gov/vuln/detail/${cve.id}`,
        raw_data: cve,
      });
    }
  }

  return alerts;
}

async function fetchScrapedAlerts(source: AlertSource) {
  return [];
}

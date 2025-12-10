import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: unprocessedAlerts, error: alertsError } = await supabase
      .from('alerts')
      .select('*')
      .eq('is_processed', false)
      .order('published_date', { ascending: false })
      .limit(10);

    if (alertsError) throw alertsError;

    const results = [];

    for (const alert of unprocessedAlerts || []) {
      try {
        const yaraRule = generateYaraRule(alert);
        const { data: yaraData, error: yaraError } = await supabase
          .from('yara_rules')
          .insert({
            alert_id: alert.id,
            rule_name: yaraRule.name,
            rule_content: yaraRule.content,
            description: yaraRule.description,
            tags: yaraRule.tags,
            generated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (yaraError && !yaraError.message.includes('duplicate')) {
          throw yaraError;
        }

        const mitreMapping = mapToMitre(alert);
        for (const mapping of mitreMapping) {
          const { data: techniqueData } = await supabase
            .from('mitre_attack_techniques')
            .select('id')
            .eq('technique_id', mapping.technique_id)
            .maybeSingle();

          if (!techniqueData) {
            const { data: newTechnique } = await supabase
              .from('mitre_attack_techniques')
              .insert({
                technique_id: mapping.technique_id,
                technique_name: mapping.technique_name,
                tactic: mapping.tactic,
                description: mapping.description,
                url: `https://attack.mitre.org/techniques/${mapping.technique_id}/`,
              })
              .select()
              .single();

            if (newTechnique) {
              await supabase.from('alert_mitre_mappings').insert({
                alert_id: alert.id,
                technique_id: newTechnique.id,
                confidence_score: mapping.confidence_score,
              });
            }
          } else {
            await supabase.from('alert_mitre_mappings').insert({
              alert_id: alert.id,
              technique_id: techniqueData.id,
              confidence_score: mapping.confidence_score,
            });
          }
        }

        await supabase
          .from('alerts')
          .update({ is_processed: true, updated_at: new Date().toISOString() })
          .eq('id', alert.id);

        results.push({ alert_id: alert.id, status: 'processed' });
      } catch (error) {
        results.push({ alert_id: alert.id, status: 'error', error: error.message });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateYaraRule(alert: any) {
  const sanitizedTitle = alert.title.replace(/[^a-zA-Z0-9_]/g, '_');
  const ruleName = `alert_${sanitizedTitle}_${alert.external_id.replace(/[^a-zA-Z0-9_]/g, '_')}`;
  
  const tags = [];
  if (alert.severity === 'critical' || alert.severity === 'high') tags.push('high_priority');
  tags.push(alert.severity);
  
  const description = alert.description || alert.title;
  const indicators = extractIndicators(description);
  
  let strings = '';
  let condition = 'any of them';
  
  if (indicators.hashes.length > 0) {
    indicators.hashes.forEach((hash, idx) => {
      strings += `        $hash${idx} = "${hash}"\n`;
    });
  }
  
  if (indicators.ips.length > 0) {
    indicators.ips.forEach((ip, idx) => {
      strings += `        $ip${idx} = "${ip}"\n`;
    });
  }
  
  if (indicators.domains.length > 0) {
    indicators.domains.forEach((domain, idx) => {
      strings += `        $domain${idx} = "${domain}"\n`;
    });
  }
  
  if (indicators.patterns.length > 0) {
    indicators.patterns.forEach((pattern, idx) => {
      strings += `        $pattern${idx} = "${pattern}" nocase\n`;
    });
  }
  
  if (!strings) {
    strings = `        $default = "${alert.external_id}" nocase\n`;
  }
  
  const cleanDesc = description.substring(0, 200).replace(/"/g, '\\"').replace(/\n/g, ' ');
  const cleanUrl = alert.url || '';
  
  const content = `rule ${ruleName} {
    meta:
        description = "${cleanDesc}"
        severity = "${alert.severity}"
        source = "${cleanUrl}"
        alert_id = "${alert.external_id}"
        generated = "${new Date().toISOString()}"
    strings:
${strings}
    condition:
        ${condition}
}`;

  return {
    name: ruleName,
    content: content,
    description: description.substring(0, 200),
    tags: tags,
  };
}

function extractIndicators(text: string) {
  const indicators = {
    hashes: [] as string[],
    ips: [] as string[],
    domains: [] as string[],
    patterns: [] as string[],
  };
  
  const md5Regex = /\b[a-f0-9]{32}\b/gi;
  const sha1Regex = /\b[a-f0-9]{40}\b/gi;
  const sha256Regex = /\b[a-f0-9]{64}\b/gi;
  const ipRegex = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g;
  const domainRegex = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]\b/gi;
  
  const md5Matches = text.match(md5Regex);
  const sha1Matches = text.match(sha1Regex);
  const sha256Matches = text.match(sha256Regex);
  const ipMatches = text.match(ipRegex);
  const domainMatches = text.match(domainRegex);
  
  if (md5Matches) indicators.hashes.push(...md5Matches.slice(0, 5));
  if (sha1Matches) indicators.hashes.push(...sha1Matches.slice(0, 5));
  if (sha256Matches) indicators.hashes.push(...sha256Matches.slice(0, 5));
  if (ipMatches) indicators.ips.push(...ipMatches.slice(0, 5));
  if (domainMatches) {
    const filtered = domainMatches.filter(d => 
      !d.endsWith('.com') && !d.endsWith('.org') && !d.includes('example')
    );
    indicators.domains.push(...filtered.slice(0, 5));
  }
  
  return indicators;
}

function mapToMitre(alert: any) {
  const mappings = [];
  const description = (alert.description || alert.title || '').toLowerCase();
  
  const patterns = [
    { keywords: ['remote code execution', 'rce', 'code execution'], technique_id: 'T1203', technique_name: 'Exploitation for Client Execution', tactic: 'Execution', confidence: 0.85 },
    { keywords: ['sql injection', 'sqli'], technique_id: 'T1190', technique_name: 'Exploit Public-Facing Application', tactic: 'Initial Access', confidence: 0.90 },
    { keywords: ['privilege escalation', 'elevate privileges'], technique_id: 'T1068', technique_name: 'Exploitation for Privilege Escalation', tactic: 'Privilege Escalation', confidence: 0.85 },
    { keywords: ['credential', 'password', 'authentication'], technique_id: 'T1078', technique_name: 'Valid Accounts', tactic: 'Defense Evasion', confidence: 0.70 },
    { keywords: ['phishing', 'spear phishing'], technique_id: 'T1566', technique_name: 'Phishing', tactic: 'Initial Access', confidence: 0.90 },
    { keywords: ['malware', 'trojan', 'backdoor'], technique_id: 'T1204', technique_name: 'User Execution', tactic: 'Execution', confidence: 0.75 },
    { keywords: ['vulnerability', 'buffer overflow', 'overflow'], technique_id: 'T1203', technique_name: 'Exploitation for Client Execution', tactic: 'Execution', confidence: 0.80 },
    { keywords: ['denial of service', 'dos', 'ddos'], technique_id: 'T1498', technique_name: 'Network Denial of Service', tactic: 'Impact', confidence: 0.85 },
    { keywords: ['command injection', 'command execution'], technique_id: 'T1059', technique_name: 'Command and Scripting Interpreter', tactic: 'Execution', confidence: 0.85 },
    { keywords: ['data exfiltration', 'data theft', 'exfiltrate'], technique_id: 'T1041', technique_name: 'Exfiltration Over C2 Channel', tactic: 'Exfiltration', confidence: 0.80 },
  ];
  
  for (const pattern of patterns) {
    if (pattern.keywords.some(keyword => description.includes(keyword))) {
      mappings.push({
        technique_id: pattern.technique_id,
        technique_name: pattern.technique_name,
        tactic: pattern.tactic,
        description: `Mapped based on alert content analysis`,
        confidence_score: pattern.confidence,
      });
    }
  }
  
  if (mappings.length === 0) {
    mappings.push({
      technique_id: 'T1190',
      technique_name: 'Exploit Public-Facing Application',
      tactic: 'Initial Access',
      description: 'Default mapping for vulnerability alerts',
      confidence_score: 0.50,
    });
  }
  
  return mappings;
}

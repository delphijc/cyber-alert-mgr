const fetch = import('node-fetch').then(mod => mod.default);
const crypto = require('crypto');
const Parser = require('rss-parser');
const parser = new Parser();

async function fetchAlerts(db) {
    console.log('Fetching alerts...');
    const sources = await db.all('SELECT * FROM alert_sources WHERE is_active = 1');
    const results = [];

    for (const source of sources) {
        try {
            let alerts = [];

            if (source.source_type === 'api' && source.name === 'NIST NVD') {
                alerts = await fetchNISTAlerts(source);
            } else if (source.source_type === 'rss') {
                alerts = await fetchRSSAlerts(source);
            } else if (source.source_type === 'scrape') {
                alerts = await fetchScrapedAlerts(source);
            }

            console.log(`Fetched ${alerts.length} alerts from ${source.name}`);

            let newAlertsCount = 0;

            await db.run('BEGIN TRANSACTION');
            try {
                for (const alert of alerts) {
                    try {
                        // Using UPSERT logic
                        await db.run(`
               INSERT INTO alerts (
                id, source_id, external_id, title, description, severity, 
                published_date, updated_date, url, raw_data, is_processed, updated_at
              ) VALUES (
                ?, ?, ?, ?, ?, ?, 
                ?, ?, ?, ?, 0, ?
              )
              ON CONFLICT(source_id, external_id) DO UPDATE SET
                title=excluded.title,
                description=excluded.description,
                severity=excluded.severity,
                updated_date=excluded.updated_date,
                updated_at=excluded.updated_at,
                is_processed=0
            `, [
                            crypto.randomUUID(),
                            source.id,
                            alert.external_id,
                            alert.title,
                            alert.description || '',
                            alert.severity,
                            alert.published_date,
                            alert.updated_date,
                            alert.url,
                            JSON.stringify(alert.raw_data),
                            new Date().toISOString()
                        ]);
                        newAlertsCount++;
                    } catch (err) {
                        console.error('Error inserting alert:', err);
                    }
                }
                await db.run('COMMIT');
            } catch (err) {
                await db.run('ROLLBACK');
                throw err;
            }

            // Update source last_checked_at
            await db.run('UPDATE alert_sources SET last_checked_at = ? WHERE id = ?', [new Date().toISOString(), source.id]);

            await db.run('INSERT INTO processing_logs (id, source_id, status, alerts_found) VALUES (?, ?, ?, ?)',
                [crypto.randomUUID(), source.id, 'success', alerts.length]);

            results.push({ source: source.name, alerts: alerts.length, status: 'success' });

        } catch (error) {
            console.error(`Error fetching from ${source.name}:`, error);

            await db.run('INSERT INTO processing_logs (id, source_id, status, error_message) VALUES (?, ?, ?, ?)',
                [crypto.randomUUID(), source.id, 'error', error.message]);

            results.push({ source: source.name, status: 'error', error: error.message });
        }
    }

    return results;
}

async function fetchNISTAlerts(source) {
    const fetchFunc = await fetch;
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const startDate = sevenDaysAgo.toISOString();
    const endDate = now.toISOString();

    const url = `${source.url}?pubStartDate=${startDate}&pubEndDate=${endDate}`;
    console.log(`Requesting NIST: ${url}`);

    const headers = {};
    if (process.env.NIST_API_KEY) {
        headers['apiKey'] = process.env.NIST_API_KEY;
    }

    const response = await fetchFunc(url, { headers });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`NIST API failed: ${response.status} ${response.statusText} - ${text.substring(0, 100)}`);
    }

    const data = await response.json();
    const alerts = [];

    if (data.vulnerabilities) {
        for (const vuln of data.vulnerabilities) {
            const cve = vuln.cve;
            const description = cve.descriptions?.find(d => d.lang === 'en')?.value || 'No description';

            let severity = 'info';
            const cvssMetrics = cve.metrics?.cvssMetricV31?.[0] || cve.metrics?.cvssMetricV2?.[0];
            if (cvssMetrics) {
                const score = (cvssMetrics.cvssData?.baseScore) || 0;
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

async function fetchRSSAlerts(source) {
    console.log(`Fetching RSS from ${source.url}`);
    try {
        const feed = await parser.parseURL(source.url);
        const alerts = [];

        for (const item of feed.items) {
            // Determine severity based on title/description if possible, else default
            let severity = 'medium';
            const text = (item.title + ' ' + (item.contentSnippet || item.content || '')).toLowerCase();
            if (text.includes('critical') || text.includes('0-day')) severity = 'critical';
            else if (text.includes('high')) severity = 'high';
            else if (text.includes('low')) severity = 'low';

            alerts.push({
                external_id: item.guid || item.link || crypto.randomUUID(),
                title: item.title,
                description: item.contentSnippet || item.content || 'No description',
                severity: severity,
                published_date: item.isoDate || new Date(item.pubDate).toISOString(),
                updated_date: new Date().toISOString(),
                url: item.link,
                raw_data: item
            });
        }
        return alerts;
    } catch (error) {
        console.error(`RSS fetch failed for ${source.name}:`, error);
        throw error;
    }
}

async function fetchScrapedAlerts(source) {
    console.warn(`Scraping not implemented/reliable for ${source.name} (${source.url}). Skipping.`);
    return [];
}

module.exports = fetchAlerts;

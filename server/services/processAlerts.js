const crypto = require('crypto');

async function processAlerts(db) {
    console.log('Processing alerts...');

    const unprocessedAlerts = await db.all(`
    SELECT * FROM alerts 
    WHERE is_processed = 0 
    ORDER BY published_date DESC 
    LIMIT 2000
  `);

    const results = [];

    for (const alert of unprocessedAlerts) {
        try {
            // 1. Clean up old artifacts (to prevent duplicates if re-processing)
            await db.run('DELETE FROM yara_rules WHERE alert_id = ?', [alert.id]);
            await db.run('DELETE FROM alert_mitre_mappings WHERE alert_id = ?', [alert.id]);

            // 2. Generate YARA Rule
            const yaraRule = generateYaraRule(alert);

            try {
                await db.run(`
          INSERT INTO yara_rules (id, alert_id, rule_name, rule_content, description, tags, generated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
                    crypto.randomUUID(),
                    alert.id,
                    yaraRule.name,
                    yaraRule.content,
                    yaraRule.description,
                    JSON.stringify(yaraRule.tags),
                    new Date().toISOString()
                ]);
            } catch (e) {
                // Log but continue if dup
                if (!e.message.includes('UNIQUE constraint failed')) {
                    console.warn(`Failed to insert YARA rule for ${alert.id}:`, e.message);
                }
            }

            // 2. Map to MITRE
            const mitreMapping = mapToMitre(alert);

            for (const mapping of mitreMapping) {
                let technique = await db.get('SELECT * FROM mitre_attack_techniques WHERE technique_id = ?', [mapping.technique_id]);

                if (!technique) {
                    const newId = crypto.randomUUID();
                    await db.run(`
            INSERT INTO mitre_attack_techniques (id, technique_id, technique_name, tactic, description, url)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [
                        newId,
                        mapping.technique_id,
                        mapping.technique_name,
                        mapping.tactic,
                        mapping.description,
                        `https://attack.mitre.org/techniques/${mapping.technique_id}/`
                    ]);
                    technique = { id: newId };
                }

                try {
                    await db.run(`
            INSERT INTO alert_mitre_mappings (id, alert_id, technique_id, confidence_score)
            VALUES (?, ?, ?, ?)
          `, [
                        crypto.randomUUID(),
                        alert.id,
                        technique.id,
                        mapping.confidence_score
                    ]);
                } catch (e) {
                    if (!e.message.includes('UNIQUE constraint failed')) {
                        console.warn(`Failed to map MITRE technique for ${alert.id}:`, e.message);
                    }
                }
            }

            // 3. Mark as Processed
            await db.run('UPDATE alerts SET is_processed = 1, updated_at = ? WHERE id = ?', [new Date().toISOString(), alert.id]);

            results.push({ alert_id: alert.id, status: 'processed' });

        } catch (error) {
            console.error(`Error processing alert ${alert.id}:`, error);
            results.push({ alert_id: alert.id, status: 'error', error: error.message });
        }
    }

    return results;
}

const ATTACK_SIGNATURES = {
    'sql_injection': {
        meta: { description: "Detects SQL Injection patterns" },
        strings: [
            '$sqli1 = "UNION SELECT" nocase',
            '$sqli2 = "OR 1=1" nocase',
            '$sqli3 = "information_schema" nocase',
            '$sqli4 = "xp_cmdshell" nocase',
            '$sqli5 = "--" wide ascii',
            '$sqli6 = "; DROP TABLE" nocase'
        ]
    },
    'xss': {
        meta: { description: "Detects Cross-Site Scripting patterns" },
        strings: [
            '$xss1 = "<script>" nocase',
            '$xss2 = "javascript:" nocase',
            '$xss3 = "onerror=" nocase',
            '$xss4 = "onload=" nocase',
            '$xss5 = "document.cookie" nocase'
        ]
    },
    'path_traversal': {
        meta: { description: "Detects Path Traversal patterns" },
        strings: [
            '$pt1 = "../" ascii',
            '$pt2 = "..%2f" nocase',
            '$pt3 = "/etc/passwd" nocase',
            '$pt4 = "C:\\\\Windows\\\\System32" nocase'
        ]
    },
    'command_injection': {
        meta: { description: "Detects Command Injection patterns" },
        strings: [
            '$cmd1 = "/bin/sh" nocase',
            '$cmd2 = "/bin/bash" nocase',
            '$cmd3 = "cmd.exe" nocase',
            '$cmd4 = "powershell" nocase',
            '$cmd5 = "&&" ascii',
            '$cmd6 = "|" ascii'
        ]
    },
    'rce': {
        meta: { description: "Detects Remote Code Execution patterns" },
        strings: [
            '$rce1 = "eval(" nocase',
            '$rce2 = "base64_decode" nocase',
            '$rce3 = "shell_exec" nocase',
            '$rce4 = "system(" nocase'
        ]
    }
};

function detectAttackType(text) {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('sql') || lowerText.includes('injection') || lowerText.includes('database')) {
        if (lowerText.includes('sql')) return 'sql_injection';
    }
    if (lowerText.includes('xss') || lowerText.includes('cross-site') || lowerText.includes('scripting')) return 'xss';
    if (lowerText.includes('traversal') || lowerText.includes('directory') || lowerText.includes('../')) return 'path_traversal';
    if (lowerText.includes('command') && (lowerText.includes('injection') || lowerText.includes('execution'))) return 'command_injection';
    if (lowerText.includes('rce') || lowerText.includes('remote code')) return 'rce';

    return null;
}

function generateYaraRule(alert) {
    const sanitizedTitle = alert.title.replace(/[^a-zA-Z0-9_]/g, '_');
    const ruleName = `alert_${sanitizedTitle}_${alert.external_id.replace(/[^a-zA-Z0-9_]/g, '_')}`;

    const tags = [];
    if (alert.severity === 'critical' || alert.severity === 'high') tags.push('high_priority');
    tags.push(alert.severity);

    const description = alert.description || alert.title;
    const indicators = extractIndicators(description);
    const attackType = detectAttackType(description + ' ' + alert.title);

    if (attackType) tags.push(attackType);

    const stringDefinitions = [];
    const conditions = [];

    // 1. Specific Indicators (Highest Priority)
    if (indicators.hashes.length > 0) {
        indicators.hashes.forEach((hash, idx) => {
            stringDefinitions.push(`        $hash${idx} = "${hash}"`);
        });
        conditions.push(`any of ($hash*)`);
    }

    if (indicators.ips.length > 0) {
        indicators.ips.forEach((ip, idx) => {
            stringDefinitions.push(`        $ip${idx} = "${ip}"`);
        });
        conditions.push(`any of ($ip*)`);
    }

    if (indicators.domains.length > 0) {
        indicators.domains.forEach((domain, idx) => {
            stringDefinitions.push(`        $domain${idx} = "${domain}"`);
        });
        conditions.push(`any of ($domain*)`);
    }

    // 2. Attack Signatures (Secondary)
    if (attackType && ATTACK_SIGNATURES[attackType]) {
        const sig = ATTACK_SIGNATURES[attackType];
        stringDefinitions.push(...sig.strings.map(s => '        ' + s));

        // Extract variable names from definitions like '$xss1 = ...'
        const vars = sig.strings.map(s => s.trim().split(' ')[0]); // ['$xss1', '$xss2'...]
        // We want 'any of ($xss*)' but since we might mix types, let's just match any of the vars
        // Actually, YARA supports `any of ($prefix*)`. Let's assume our prefixes are consistent.
        // Signatures use specific prefixes like $sqli, $xss.
        const prefix = vars[0].replace(/[0-9]+$/, '*'); // $xss1 -> $xss*
        conditions.push(`any of (${prefix})`);
    }

    // 3. Fallback
    if (stringDefinitions.length === 0) {
        stringDefinitions.push(`        $generic = "${alert.external_id}" nocase`);
        conditions.push(`$generic`);
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
        attack_type = "${attackType || 'unknown'}"
    strings:
${stringDefinitions.join('\n')}
    condition:
        ${conditions.join(' or ')}
}`;

    return {
        name: ruleName,
        content: content,
        description: description.substring(0, 200),
        tags: tags,
    };
}

function extractIndicators(text) {
    const indicators = {
        hashes: [],
        ips: [],
        domains: [],
        patterns: [],
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

function mapToMitre(alert) {
    const mappings = [];
    const description = (alert.description || alert.title || '').toLowerCase();

    const patterns = [
        { keywords: ['remote code execution', 'rce', 'code execution', 'arbitrary code', 'execute arbitrary'], technique_id: 'T1203', technique_name: 'Exploitation for Client Execution', tactic: 'Execution', confidence: 0.85 },
        { keywords: ['sql injection', 'sqli', 'sql'], technique_id: 'T1190', technique_name: 'Exploit Public-Facing Application', tactic: 'Initial Access', confidence: 0.90 },
        { keywords: ['privilege escalation', 'elevate privileges', 'gain privileges', 'root access', 'admin access'], technique_id: 'T1068', technique_name: 'Exploitation for Privilege Escalation', tactic: 'Privilege Escalation', confidence: 0.85 },
        { keywords: ['credential', 'password', 'authentication', 'login', 'bypass authentication'], technique_id: 'T1078', technique_name: 'Valid Accounts', tactic: 'Defense Evasion', confidence: 0.70 },
        { keywords: ['phishing', 'spear phishing', 'social engineering'], technique_id: 'T1566', technique_name: 'Phishing', tactic: 'Initial Access', confidence: 0.90 },
        { keywords: ['malware', 'trojan', 'backdoor', 'virus', 'ransomware', 'spyware'], technique_id: 'T1204', technique_name: 'User Execution', tactic: 'Execution', confidence: 0.75 },
        { keywords: ['vulnerability', 'buffer overflow', 'overflow', 'memory corruption', 'out of bounds'], technique_id: 'T1203', technique_name: 'Exploitation for Client Execution', tactic: 'Execution', confidence: 0.80 },
        { keywords: ['denial of service', 'dos', 'ddos', 'crash'], technique_id: 'T1498', technique_name: 'Network Denial of Service', tactic: 'Impact', confidence: 0.85 },
        { keywords: ['command injection', 'command execution', 'shell'], technique_id: 'T1059', technique_name: 'Command and Scripting Interpreter', tactic: 'Execution', confidence: 0.85 },
        { keywords: ['data exfiltration', 'data theft', 'exfiltrate', 'leak', 'disclosure', 'sensitive information'], technique_id: 'T1041', technique_name: 'Exfiltration Over C2 Channel', tactic: 'Exfiltration', confidence: 0.80 },
        { keywords: ['cross-site scripting', 'xss'], technique_id: 'T1190', technique_name: 'Exploit Public-Facing Application', tactic: 'Initial Access', confidence: 0.85 },
        { keywords: ['directory traversal', 'path traversal'], technique_id: 'T1190', technique_name: 'Exploit Public-Facing Application', tactic: 'Initial Access', confidence: 0.85 },
        { keywords: ['injection', 'inject'], technique_id: 'T1059', technique_name: 'Command and Scripting Interpreter', tactic: 'Execution', confidence: 0.70 },
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

module.exports = processAlerts;


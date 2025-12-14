const express = require('express');
const cors = require('cors');
const { initializeDatabase } = require('./db');
const fetchAlerts = require('./services/fetchAlerts');
const processAlerts = require('./services/processAlerts');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Job Lock State
const jobState = {
    isRunning: false,
    currentJob: null,
    startTime: null
};

const tryAcquireLock = (jobName) => {
    if (jobState.isRunning) {
        throw new Error(`Job '${jobState.currentJob}' is currently running (started at ${jobState.startTime})`);
    }
    jobState.isRunning = true;
    jobState.currentJob = jobName;
    jobState.startTime = new Date().toISOString();
    return true;
};

const releaseLock = () => {
    jobState.isRunning = false;
    jobState.currentJob = null;
    jobState.startTime = null;
};

let db;

// Initialize Database
initializeDatabase().then(database => {
    db = database;
    console.log('Database initialized');

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running at http://0.0.0.0:${PORT}`);
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});

// Middleware to check specific DB readiness
const withDb = (req, res, next) => {
    if (!db) return res.status(503).json({ error: 'Database initializing' });
    next();
};

app.use(withDb);

// Stats Route
app.get('/api/stats', async (req, res) => {
    try {
        const [totalAlerts, criticalAlerts, yaraRules, mitreTechniques] = await Promise.all([
            db.get('SELECT count(*) as count FROM alerts'),
            db.get('SELECT count(*) as count FROM alerts WHERE severity = ?', ['critical']),
            db.get('SELECT count(*) as count FROM yara_rules'),
            db.get('SELECT count(*) as count FROM mitre_attack_techniques')
        ]);

        res.json({
            totalAlerts: totalAlerts.count,
            criticalAlerts: criticalAlerts.count,
            yaraRules: yaraRules.count,
            mitreTechniques: mitreTechniques.count
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// MITRE Techniques Route
app.get('/api/mitre-techniques', async (req, res) => {
    try {
        const techniques = await db.all('SELECT * FROM mitre_attack_techniques ORDER BY technique_id');
        res.json(techniques);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Alert Sources Routes
app.get('/api/alert-sources', async (req, res) => {
    try {
        const sources = await db.all('SELECT * FROM alert_sources');
        res.json(sources);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Alerts Routes
app.get('/api/alerts', async (req, res) => {
    try {
        const { severity, limit = 50, offset = 0 } = req.query;
        let query = `
      SELECT a.*, s.name as source_name,
             GROUP_CONCAT(DISTINCT t.technique_id) as mitre_ids,
             GROUP_CONCAT(DISTINCT t.tactic) as mitre_tactics
      FROM alerts a 
      JOIN alert_sources s ON a.source_id = s.id
      LEFT JOIN alert_mitre_mappings amm ON a.id = amm.alert_id
      LEFT JOIN mitre_attack_techniques t ON amm.technique_id = t.id
    `;
        let countQuery = `SELECT count(*) as total FROM alerts a`;

        const params = [];
        const countParams = [];

        if (severity && severity !== 'all') {
            const condition = ` WHERE a.severity = ?`;
            query += condition;
            countQuery += condition;
            params.push(severity);
            countParams.push(severity);
        }

        query += ` GROUP BY a.id ORDER BY a.published_date DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [alerts, countResult] = await Promise.all([
            db.all(query, params),
            db.get(countQuery, countParams)
        ]);

        // Parse raw_data if it exists
        const parsedAlerts = alerts.map(alert => ({
            ...alert,
            raw_data: alert.raw_data ? JSON.parse(alert.raw_data) : null,
            // SQLite stores booleans as 0/1
            is_processed: Boolean(alert.is_processed),
            mitre_ids: alert.mitre_ids ? alert.mitre_ids.split(',') : [],
            mitre_tactics: alert.mitre_tactics ? alert.mitre_tactics.split(',') : []
        }));

        res.json({
            data: parsedAlerts,
            total: countResult ? countResult.total : 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// YARA Rules Routes
app.get('/api/yara-rules', async (req, res) => {
    try {
        const { severity, limit = 50, offset = 0 } = req.query;
        let query = `
            SELECT r.*,
                   GROUP_CONCAT(DISTINCT t.technique_id) as mitre_ids,
                   GROUP_CONCAT(DISTINCT t.tactic) as mitre_tactics
            FROM yara_rules r
            JOIN alerts a ON r.alert_id = a.id
            LEFT JOIN alert_mitre_mappings amm ON a.id = amm.alert_id
            LEFT JOIN mitre_attack_techniques t ON amm.technique_id = t.id
        `;
        let countQuery = `
            SELECT count(DISTINCT r.id) as total 
            FROM yara_rules r
            JOIN alerts a ON r.alert_id = a.id
        `;

        const params = [];
        const countParams = [];

        if (severity && severity !== 'all') {
            const condition = ` WHERE a.severity = ?`;
            query += condition;
            countQuery += condition;
            params.push(severity);
            countParams.push(severity);
        }

        query += ` GROUP BY r.id ORDER BY r.generated_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [rules, countResult] = await Promise.all([
            db.all(query, params),
            db.get(countQuery, countParams)
        ]);

        // Parse tags if it exists
        const parsedRules = rules.map(rule => ({
            ...rule,
            tags: rule.tags ? JSON.parse(rule.tags) : [],
            mitre_ids: rule.mitre_ids ? rule.mitre_ids.split(',') : [],
            mitre_tactics: rule.mitre_tactics ? rule.mitre_tactics.split(',') : []
        }));

        res.json({
            data: parsedRules,
            total: countResult ? countResult.total : 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// MITRE Routes
app.get('/api/mitre-mappings', async (req, res) => {
    try {
        const { severity } = req.query;
        let query = `
            SELECT m.*, t.technique_id, t.technique_name, t.tactic, a.title as alert_title, a.severity 
            FROM alert_mitre_mappings m
            JOIN mitre_attack_techniques t ON m.technique_id = t.id
            JOIN alerts a ON m.alert_id = a.id
        `;
        const params = [];

        if (severity && severity !== 'all') {
            query += ` WHERE a.severity = ?`;
            params.push(severity);
        }

        const mappings = await db.all(query, params);
        res.json(mappings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Trigger Sync Job
app.post('/api/jobs/sync', async (req, res) => {
    try {
        tryAcquireLock('sync');
        console.log('Starting sync job...');
        const fetchResults = await fetchAlerts(db);
        const processResults = await processAlerts(db);

        res.json({
            status: 'success',
            fetch: fetchResults,
            process: processResults
        });
    } catch (error) {
        if (error.message.includes('currently running')) {
            console.warn('Sync skipped:', error.message);
            return res.status(409).json({ error: error.message });
        }
        console.error('Sync job failed:', error);
        res.status(500).json({ error: error.message });
    } finally {
        if (jobState.currentJob === 'sync') releaseLock();
    }
});

const removeDuplicates = require('./services/deduplication');

// Trigger Deduplication
app.post('/api/jobs/deduplicate', async (req, res) => {
    try {
        tryAcquireLock('deduplicate');
        const stats = await removeDuplicates(db);
        res.json({ status: 'success', stats });
    } catch (error) {
        if (error.message.includes('currently running')) {
            return res.status(409).json({ error: error.message });
        }
        console.error('Deduplication failed:', error);
        res.status(500).json({ error: error.message });
    } finally {
        if (jobState.currentJob === 'deduplicate') releaseLock();
    }
});

// Trigger Reprocess
app.post('/api/jobs/reprocess', async (req, res) => {
    try {
        tryAcquireLock('reprocess');
        console.log('Starting reprocessing...');
        // Reset processed status
        await db.run('UPDATE alerts SET is_processed = 0');

        // Process alerts (this will regenerate rules/mappings)
        const processResults = await processAlerts(db);

        // Clean up any potential duplicates or orphans (e.g. if logic created extras or prior state was bad)
        const dedupeStats = await removeDuplicates(db);

        res.json({
            status: 'success',
            process: processResults,
            deduplication: dedupeStats
        });
    } catch (error) {
        if (error.message.includes('currently running')) {
            return res.status(409).json({ error: error.message });
        }
        console.error('Reprocessing failed:', error);
        res.status(500).json({ error: error.message });
    } finally {
        if (jobState.currentJob === 'reprocess') releaseLock();
    }
});

// Update YARA Rule (Edit/Lock)
app.put('/api/yara-rules/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { rule_content, is_locked } = req.body;

        // Verify rule exists
        const rule = await db.get('SELECT * FROM yara_rules WHERE id = ?', [id]);
        if (!rule) return res.status(404).json({ error: 'Rule not found' });

        await db.run(`
            UPDATE yara_rules 
            SET rule_content = COALESCE(?, rule_content), 
                is_locked = COALESCE(?, is_locked),
                generated_at = ?
            WHERE id = ?
        `, [rule_content, is_locked, new Date().toISOString(), id]);

        res.json({ status: 'success' });
    } catch (error) {
        console.error('Failed to update rule:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete YARA Rule
app.delete('/api/yara-rules/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const rule = await db.get('SELECT * FROM yara_rules WHERE id = ?', [id]);
        if (!rule) return res.status(404).json({ error: 'Rule not found' });

        if (rule.is_locked) {
            return res.status(403).json({ error: 'Cannot delete locked rule' });
        }

        await db.run('DELETE FROM yara_rules WHERE id = ?', [id]);
        res.json({ status: 'success' });
    } catch (error) {
        console.error('Failed to delete rule:', error);
        res.status(500).json({ error: error.message });
    }
});

// Reprocess Single Alert
app.post('/api/alerts/:id/reprocess', async (req, res) => {
    try {
        const { id } = req.params;
        await db.run('UPDATE alerts SET is_processed = 0 WHERE id = ?', [id]);

        // We trigger the full process batch, but since only this one is reset, effectively forces retry.
        // It skips locked rules, so safe.
        // Note: global lock check might be good here but since processAlerts doesn't strictly require it 
        // (it's resilient), we can skip strict locking for single item or check if big job running.
        // Let's check lock to be safe.
        if (jobState.isRunning) {
            return res.status(409).json({ error: `Job '${jobState.currentJob}' is running` });
        }

        const stats = await processAlerts(db);
        res.json({ status: 'success', stats });
    } catch (error) {
        console.error('Failed to reprocess alert:', error);
        res.status(500).json({ error: error.message });
    }
});

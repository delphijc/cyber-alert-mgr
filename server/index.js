const express = require('express');
const cors = require('cors');
const { initializeDatabase } = require('./db');
const fetchAlerts = require('./services/fetchAlerts');
const processAlerts = require('./services/processAlerts');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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
        console.log('Starting sync job...');
        const fetchResults = await fetchAlerts(db);
        const processResults = await processAlerts(db);

        res.json({
            status: 'success',
            fetch: fetchResults,
            process: processResults
        });
    } catch (error) {
        console.error('Sync job failed:', error);
        res.status(500).json({ error: error.message });
    }
});

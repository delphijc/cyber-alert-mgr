const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

class AsyncDatabase {
  constructor(dbPath) {
    this.db = new sqlite3.Database(dbPath);
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  exec(sql) {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

async function initializeDatabase() {
  const dbPath = path.join(__dirname, 'database.sqlite');
  const db = new AsyncDatabase(dbPath);

  // Enable WAL mode
  await db.run('PRAGMA journal_mode = WAL');

  // Create Tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS alert_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      source_type TEXT NOT NULL CHECK (source_type IN ('api', 'rss', 'scrape')),
      is_active INTEGER DEFAULT 1,
      last_checked_at TEXT,
      check_frequency_minutes INTEGER DEFAULT 60,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      source_id TEXT,
      external_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      severity TEXT CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
      published_date TEXT,
      updated_date TEXT,
      url TEXT,
      raw_data TEXT,
      is_processed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (source_id) REFERENCES alert_sources(id) ON DELETE CASCADE,
      UNIQUE(source_id, external_id)
    );

    CREATE TABLE IF NOT EXISTS yara_rules (
      id TEXT PRIMARY KEY,
      alert_id TEXT,
      rule_name TEXT NOT NULL UNIQUE,
      rule_content TEXT NOT NULL,
      description TEXT,
      tags TEXT,
      generated_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS mitre_attack_techniques (
      id TEXT PRIMARY KEY,
      technique_id TEXT NOT NULL UNIQUE,
      technique_name TEXT NOT NULL,
      tactic TEXT NOT NULL,
      description TEXT,
      url TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS alert_mitre_mappings (
      id TEXT PRIMARY KEY,
      alert_id TEXT,
      technique_id TEXT,
      confidence_score REAL CHECK (confidence_score >= 0 AND confidence_score <= 1),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE,
      FOREIGN KEY (technique_id) REFERENCES mitre_attack_techniques(id) ON DELETE CASCADE,
      UNIQUE(alert_id, technique_id)
    );

    CREATE TABLE IF NOT EXISTS processing_logs (
      id TEXT PRIMARY KEY,
      source_id TEXT,
      status TEXT NOT NULL CHECK (status IN ('success', 'error', 'warning')),
      alerts_found INTEGER DEFAULT 0,
      error_message TEXT,
      processed_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (source_id) REFERENCES alert_sources(id) ON DELETE SET NULL
    );
  `);

  // Seed Initial Data
  const seedSources = await db.get('SELECT count(*) as count FROM alert_sources');
  if (seedSources.count === 0) {
    const sources = [
      { id: crypto.randomUUID(), name: 'CISA Advisories', url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml', source_type: 'rss', check_frequency_minutes: 60 },
      { id: crypto.randomUUID(), name: 'FBI IC3 Alerts', url: 'https://www.ic3.gov/CSA/RSS', source_type: 'rss', check_frequency_minutes: 120 },
      { id: crypto.randomUUID(), name: 'NIST NVD', url: 'https://services.nvd.nist.gov/rest/json/cves/2.0', source_type: 'api', check_frequency_minutes: 60 },
      { id: crypto.randomUUID(), name: 'FBI Cyber Crime', url: 'https://www.fbi.gov/investigate/cyber', source_type: 'scrape', check_frequency_minutes: 180 }
    ];

    for (const source of sources) {
      await db.run(`
        INSERT INTO alert_sources (id, name, url, source_type, check_frequency_minutes) 
        VALUES (?, ?, ?, ?, ?)
      `, [source.id, source.name, source.url, source.source_type, source.check_frequency_minutes]);
    }
    console.log('Seeded alert sources.');
  } else {
    // Migration: Update existing sources to correct RSS URLs if they haven't been changed manually
    // This allows seamless transition for existing DBs
    await db.run(`
        UPDATE alert_sources 
        SET url = 'https://www.cisa.gov/cybersecurity-advisories/all.xml', source_type = 'rss' 
        WHERE name = 'CISA Advisories' AND source_type = 'scrape'
    `);

    await db.run(`
        UPDATE alert_sources 
        SET url = 'https://www.ic3.gov/CSA/RSS', source_type = 'rss' 
        WHERE name = 'FBI IC3 Alerts' AND source_type = 'scrape'
    `);
  }

  return db;
}

module.exports = { initializeDatabase };

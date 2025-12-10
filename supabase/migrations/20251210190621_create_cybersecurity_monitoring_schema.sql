/*
  # Cybersecurity Alert Monitoring System Schema

  ## Overview
  This migration creates the database schema for a comprehensive cybersecurity alert monitoring system
  that aggregates alerts from multiple U.S. government sources, generates YARA rules, and maps alerts
  to the MITRE ATT&CK framework.

  ## New Tables

  ### 1. alert_sources
  Tracks cybersecurity alert sources (CISA, FBI, NIST, CIS, etc.)
  - `id` (uuid, primary key) - Unique identifier
  - `name` (text) - Source name (e.g., "CISA", "FBI IC3")
  - `url` (text) - Source URL
  - `source_type` (text) - Type: 'api', 'rss', 'scrape'
  - `is_active` (boolean) - Whether source is currently monitored
  - `last_checked_at` (timestamptz) - Last successful check timestamp
  - `check_frequency_minutes` (integer) - How often to check this source
  - `created_at` (timestamptz) - Record creation timestamp

  ### 2. alerts
  Stores all cybersecurity alerts from various sources
  - `id` (uuid, primary key) - Unique identifier
  - `source_id` (uuid, foreign key) - Reference to alert_sources
  - `external_id` (text) - Original ID from source (e.g., CVE number)
  - `title` (text) - Alert title
  - `description` (text) - Full alert description
  - `severity` (text) - Severity level: 'critical', 'high', 'medium', 'low', 'info'
  - `published_date` (timestamptz) - When alert was published by source
  - `updated_date` (timestamptz) - When alert was last updated by source
  - `url` (text) - Link to original alert
  - `raw_data` (jsonb) - Complete original data from source
  - `is_processed` (boolean) - Whether YARA rules have been generated
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record update timestamp

  ### 3. yara_rules
  Stores generated YARA rules for detected threats
  - `id` (uuid, primary key) - Unique identifier
  - `alert_id` (uuid, foreign key) - Reference to alerts
  - `rule_name` (text) - YARA rule identifier name
  - `rule_content` (text) - Complete YARA rule code
  - `description` (text) - Rule description
  - `tags` (text[]) - Rule tags for categorization
  - `generated_at` (timestamptz) - When rule was generated
  - `created_at` (timestamptz) - Record creation timestamp

  ### 4. mitre_attack_techniques
  Reference table for MITRE ATT&CK framework techniques
  - `id` (uuid, primary key) - Unique identifier
  - `technique_id` (text) - MITRE technique ID (e.g., "T1059")
  - `technique_name` (text) - Technique name
  - `tactic` (text) - MITRE tactic category
  - `description` (text) - Technique description
  - `url` (text) - Link to MITRE ATT&CK page
  - `created_at` (timestamptz) - Record creation timestamp

  ### 5. alert_mitre_mappings
  Maps alerts to MITRE ATT&CK techniques (many-to-many relationship)
  - `id` (uuid, primary key) - Unique identifier
  - `alert_id` (uuid, foreign key) - Reference to alerts
  - `technique_id` (uuid, foreign key) - Reference to mitre_attack_techniques
  - `confidence_score` (numeric) - Mapping confidence (0.0-1.0)
  - `created_at` (timestamptz) - Record creation timestamp

  ### 6. processing_logs
  Tracks source checking and processing activities
  - `id` (uuid, primary key) - Unique identifier
  - `source_id` (uuid, foreign key) - Reference to alert_sources
  - `status` (text) - Status: 'success', 'error', 'warning'
  - `alerts_found` (integer) - Number of new alerts found
  - `error_message` (text) - Error details if status is 'error'
  - `processed_at` (timestamptz) - When processing occurred
  - `created_at` (timestamptz) - Record creation timestamp

  ## Security
  - Enable RLS on all tables
  - Public read access for viewing dashboard data
  - Restricted write access (system operations only)

  ## Indexes
  - Indexes on frequently queried fields for performance
  - Composite indexes for common query patterns
*/

-- Create alert_sources table
CREATE TABLE IF NOT EXISTS alert_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('api', 'rss', 'scrape')),
  is_active boolean DEFAULT true,
  last_checked_at timestamptz,
  check_frequency_minutes integer DEFAULT 60,
  created_at timestamptz DEFAULT now()
);

-- Create alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES alert_sources(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  title text NOT NULL,
  description text,
  severity text CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  published_date timestamptz,
  updated_date timestamptz,
  url text,
  raw_data jsonb,
  is_processed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(source_id, external_id)
);

-- Create yara_rules table
CREATE TABLE IF NOT EXISTS yara_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid REFERENCES alerts(id) ON DELETE CASCADE,
  rule_name text NOT NULL UNIQUE,
  rule_content text NOT NULL,
  description text,
  tags text[],
  generated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create mitre_attack_techniques table
CREATE TABLE IF NOT EXISTS mitre_attack_techniques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technique_id text NOT NULL UNIQUE,
  technique_name text NOT NULL,
  tactic text NOT NULL,
  description text,
  url text,
  created_at timestamptz DEFAULT now()
);

-- Create alert_mitre_mappings table
CREATE TABLE IF NOT EXISTS alert_mitre_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid REFERENCES alerts(id) ON DELETE CASCADE,
  technique_id uuid REFERENCES mitre_attack_techniques(id) ON DELETE CASCADE,
  confidence_score numeric(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  created_at timestamptz DEFAULT now(),
  UNIQUE(alert_id, technique_id)
);

-- Create processing_logs table
CREATE TABLE IF NOT EXISTS processing_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES alert_sources(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('success', 'error', 'warning')),
  alerts_found integer DEFAULT 0,
  error_message text,
  processed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_alerts_source_id ON alerts(source_id);
CREATE INDEX IF NOT EXISTS idx_alerts_published_date ON alerts(published_date DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_is_processed ON alerts(is_processed);
CREATE INDEX IF NOT EXISTS idx_yara_rules_alert_id ON yara_rules(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_mitre_mappings_alert_id ON alert_mitre_mappings(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_mitre_mappings_technique_id ON alert_mitre_mappings(technique_id);
CREATE INDEX IF NOT EXISTS idx_processing_logs_source_id ON processing_logs(source_id);
CREATE INDEX IF NOT EXISTS idx_processing_logs_processed_at ON processing_logs(processed_at DESC);

-- Enable Row Level Security
ALTER TABLE alert_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE yara_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE mitre_attack_techniques ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_mitre_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (dashboard viewing)
CREATE POLICY "Public can view alert sources"
  ON alert_sources FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can view alerts"
  ON alerts FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can view YARA rules"
  ON yara_rules FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can view MITRE techniques"
  ON mitre_attack_techniques FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can view alert MITRE mappings"
  ON alert_mitre_mappings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can view processing logs"
  ON processing_logs FOR SELECT
  TO anon, authenticated
  USING (true);

-- Insert initial alert sources
INSERT INTO alert_sources (name, url, source_type, check_frequency_minutes) VALUES
  ('CISA Advisories', 'https://www.cisa.gov/news-events/cybersecurity-advisories', 'scrape', 60),
  ('FBI IC3 Alerts', 'https://www.ic3.gov/CSA', 'scrape', 120),
  ('NIST NVD', 'https://services.nvd.nist.gov/rest/json/cves/2.0', 'api', 60),
  ('FBI Cyber Crime', 'https://www.fbi.gov/investigate/cyber', 'scrape', 180)
ON CONFLICT DO NOTHING;

# CyberWatch - Government Cybersecurity Alert Monitor

A comprehensive cybersecurity alert monitoring system that aggregates alerts from U.S. government sources (CISA, FBI, NIST), automatically generates YARA rules, and maps threats to the MITRE ATT&CK framework.

## Features

- **Multi-Source Alert Aggregation**: Monitors cybersecurity alerts from:
  - CISA (Cybersecurity and Infrastructure Security Agency)
  - FBI IC3 (Internet Crime Complaint Center)
  - NIST NVD (National Vulnerability Database)
  - FBI Cyber Crime Division

- **Automated YARA Rule Generation**: Automatically creates detection rules from alerts by:
  - Extracting indicators (IPs, domains, hashes)
  - Parsing alert content for threat patterns
  - Generating production-ready YARA rules

- **MITRE ATT&CK Mapping**: Maps cybersecurity alerts to MITRE ATT&CK techniques with:
  - Intelligent pattern matching
  - Confidence scoring
  - Tactic categorization

- **Interactive Dashboard**: Features include:
  - Real-time alert monitoring
  - Severity-based filtering
  - Trend visualization over time
  - YARA rule viewer with download capability
  - MITRE ATT&CK technique visualization

## Architecture

### Backend
- **Database**: Supabase PostgreSQL with Row Level Security
- **Edge Functions**: Serverless functions for:
  - `fetch-alerts`: Pulls alerts from government sources
  - `process-alerts`: Generates YARA rules and MITRE mappings

### Frontend
- **Framework**: React + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Real-time Updates**: Supabase real-time subscriptions

## Setup Instructions

### 1. Configure Supabase

The database schema is already created with the following tables:
- `alert_sources` - Source configurations
- `alerts` - Cybersecurity alerts
- `yara_rules` - Generated YARA rules
- `mitre_attack_techniques` - MITRE ATT&CK reference data
- `alert_mitre_mappings` - Alert-to-MITRE mappings
- `processing_logs` - Processing activity logs

### 2. Configure Environment Variables

Update the `.env` file with your Supabase credentials:

```env
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run the Application

The development server starts automatically. The dashboard will be available in your browser.

## Usage

### Updating Alerts

Click the "Update Alerts" button in the dashboard header to:
1. Fetch new alerts from all configured sources
2. Process alerts to generate YARA rules
3. Map alerts to MITRE ATT&CK techniques

### Viewing Alerts

- Navigate to the "Alerts Monitor" tab
- Filter by severity level
- Search by keywords
- Click "View Details" to see the original alert

### YARA Rules

- View all generated YARA rules in the "YARA Rules" tab
- Search for specific rules
- Copy individual rules to clipboard
- Download individual rules as `.yar` files
- Download all rules as a single bundle

### MITRE ATT&CK Analysis

- View mapped MITRE ATT&CK techniques in the "MITRE ATT&CK" tab
- Filter by tactic category
- See which alerts map to each technique
- View confidence scores for mappings
- Link directly to MITRE ATT&CK documentation

### Trend Analysis

- View alert trends over the last 30 days
- See distribution by severity
- Track alert volume over time

## Data Sources

### NIST National Vulnerability Database (NVD)
- **Type**: REST API
- **Frequency**: Checked hourly
- **Data**: CVE vulnerabilities with CVSS scores
- **API**: https://services.nvd.nist.gov/rest/json/cves/2.0

### CISA Cybersecurity Advisories
- **Type**: Web scraping (RSS feeds discontinued May 2025)
- **Frequency**: Checked hourly
- **Data**: Government cybersecurity alerts and advisories
- **URL**: https://www.cisa.gov/news-events/cybersecurity-advisories

### FBI IC3 Alerts
- **Type**: Web scraping
- **Frequency**: Checked every 2 hours
- **Data**: Cyber crime alerts and industry notifications
- **URL**: https://www.ic3.gov/CSA

### FBI Cyber Crime
- **Type**: Web scraping
- **Frequency**: Checked every 3 hours
- **Data**: FBI cyber investigation updates
- **URL**: https://www.fbi.gov/investigate/cyber

## YARA Rule Generation

The system automatically generates YARA rules by:

1. **Indicator Extraction**:
   - MD5, SHA1, SHA256 hashes
   - IP addresses
   - Domain names
   - Suspicious patterns

2. **Rule Structure**:
   - Meta section with alert details
   - Strings section with extracted indicators
   - Condition for detection

3. **Categorization**:
   - Severity-based tags
   - Priority markers
   - Source attribution

## MITRE ATT&CK Mapping

Alerts are mapped to MITRE ATT&CK techniques using:

- **Keyword Pattern Matching**: Detects common attack patterns
- **Confidence Scoring**: 0.0 to 1.0 based on match quality
- **Tactic Classification**: Groups by MITRE ATT&CK tactics
- **Default Mapping**: Assigns generic technique when no specific match found

### Supported Techniques

The system maps to 10+ common MITRE ATT&CK techniques including:
- T1203: Exploitation for Client Execution
- T1190: Exploit Public-Facing Application
- T1068: Exploitation for Privilege Escalation
- T1566: Phishing
- T1059: Command and Scripting Interpreter
- And more...

## Security Features

- **Row Level Security**: All database tables have RLS enabled
- **Public Read Access**: Dashboard data is viewable without authentication
- **Secure Processing**: Edge functions use service role for writes
- **No Secret Exposure**: All sensitive data handled server-side

## Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Icons**: Lucide React
- **Real-time**: Supabase Realtime subscriptions
- **Deployment**: Static hosting + serverless functions

## Data Retention

- Alerts are stored indefinitely for historical analysis
- YARA rules are versioned by generation date
- Processing logs are kept for audit trails
- Trend data is calculated dynamically from alerts

## Contributing

This system is designed to be extensible:

1. Add new alert sources by inserting into `alert_sources` table
2. Enhance YARA generation by modifying `process-alerts` function
3. Improve MITRE mapping by adding patterns in `mapToMitre()`
4. Extend dashboard with new visualizations

## License

This is a cybersecurity monitoring tool for authorized security operations.

## Resources

- [CISA Cybersecurity Advisories](https://www.cisa.gov/news-events/cybersecurity-advisories)
- [NIST NVD API Documentation](https://nvd.nist.gov/developers/vulnerabilities)
- [FBI IC3 Alerts](https://www.ic3.gov/CSA)
- [MITRE ATT&CK Framework](https://attack.mitre.org/)
- [YARA Documentation](https://yara.readthedocs.io/)

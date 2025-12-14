export interface AlertSource {
  id: string;
  name: string;
  url: string;
  source_type: string;
  is_active: boolean;
  last_checked_at: string | null;
  check_frequency_minutes: number;
  created_at: string;
}

export interface Alert {
  id: string;
  source_id: string;
  external_id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  published_date: string;
  updated_date: string;
  url: string;
  raw_data: any;
  is_processed: boolean;
  created_at: string;
  updated_at: string;
  alert_sources?: AlertSource;
  source_name?: string;
  mitre_ids?: string[];
  mitre_tactics?: string[];
  yara_rule_ids?: string[];
  yara_rule_names?: string[];
}

export interface YaraRule {
  id: string;
  alert_id: string;
  rule_name: string;
  rule_content: string;
  description?: string;
  tags?: string[];
  is_locked?: number;
  generated_at: string;
  created_at: string;
  alerts?: Alert;
  mitre_ids?: string[];
  mitre_tactics?: string[];
}

export interface MitreAttackTechnique {
  id: string;
  technique_id: string;
  technique_name: string;
  tactic: string;
  description: string;
  url: string;
  created_at: string;
}

export interface AlertMitreMapping {
  id: string;
  alert_id: string;
  technique_id: string;
  confidence_score: number;
  created_at: string;
  mitre_attack_techniques?: MitreAttackTechnique;
}

export interface ProcessingLog {
  id: string;
  source_id: string;
  status: 'success' | 'error' | 'warning';
  alerts_found: number;
  error_message: string | null;
  processed_at: string;
  created_at: string;
}

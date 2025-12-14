import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Shield, ExternalLink, ChevronDown, ChevronUp, Radio, FileCode } from 'lucide-react';
import { api } from '../services/api';
import { Alert } from '../types';
import Pagination from './common/Pagination';

interface AlertsMonitorProps {
  severity?: string;
  onSeverityChange: (severity: string) => void;
  onNavigateToYaraRule?: (ruleName: string) => void;
  targetAlertId?: string | null;
  onClearTargetAlert?: () => void;
}

export default function AlertsMonitor({
  severity = 'all',
  onSeverityChange,
  onNavigateToYaraRule,
  targetAlertId,
  onClearTargetAlert
}: AlertsMonitorProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [totalAlerts, setTotalAlerts] = useState(0);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);

  useEffect(() => {
    setPage(0); // Reset to first page when severity changes
  }, [severity]);

  // When targetAlertId changes, reset page and expand that alert if found
  useEffect(() => {
    if (targetAlertId) {
      setPage(0);
      setExpandedAlert(targetAlertId);
    }
  }, [targetAlertId]);

  useEffect(() => {
    loadAlerts();

    // Listen for custom event from Dashboard sync
    const handleUpdate = () => loadAlerts();
    window.addEventListener('alerts-updated', handleUpdate);
    return () => window.removeEventListener('alerts-updated', handleUpdate);
  }, [severity, page, pageSize, targetAlertId]);

  async function loadAlerts() {
    try {
      setLoading(true);
      // If targetAlertId is set, we fetch specifically that one (or filter by it) via API params if supported, 
      // or rely on the fact that we passed it. 
      // Note: passing undefined/null for id if not targeting.
      const response = await api.getAlerts(severity, page, pageSize, targetAlertId || undefined);
      setAlerts(response.data || []);
      setTotalAlerts(response.total || 0);

      // If we found the target alert and it's the only one (or in list), force expand it
      if (targetAlertId && response.data?.find(a => a.id === targetAlertId)) {
        setExpandedAlert(targetAlertId);
      }
    } catch (error) {
      console.error('Error loading alerts:', error);
    } finally {
      setLoading(false);
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'high': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      case 'low': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      default: return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded-lg border border-slate-700">
        <div className="flex items-center space-x-2">
          <Radio className="h-5 w-5 text-cyan-400" />
          <h2 className="text-lg font-semibold text-white">Live Monitor</h2>
        </div>
        <div className="flex items-center space-x-4">
          {targetAlertId && onClearTargetAlert ? (
            <button
              onClick={onClearTargetAlert}
              className="text-sm text-cyan-400 hover:text-cyan-300 underline"
            >
              Show All Alerts
            </button>
          ) : (
            <select
              value={severity}
              onChange={(e) => onSeverityChange(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg focus:ring-cyan-500 focus:border-cyan-500 block p-2.5"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-cyan-500 border-t-transparent"></div>
          <p className="mt-4 text-slate-400">Loading alerts...</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No alerts found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="bg-slate-900/50 border border-slate-700 rounded-lg overflow-hidden hover:border-slate-600 transition-colors"
            >
              <div className="p-4" onClick={() => setExpandedAlert(expandedAlert === alert.id ? null : alert.id)}>
                <div className="flex items-start justify-between cursor-pointer">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getSeverityColor(alert.severity)}`}>
                        {alert.severity.toUpperCase()}
                      </span>
                      <span className="text-slate-400 text-xs flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {new Date(alert.published_date).toLocaleDateString()}
                      </span>
                      <span className="text-slate-500 text-xs border border-slate-700 px-2 py-0.5 rounded">
                        {alert.source_name || alert.alert_sources?.name || 'Unknown Source'}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{alert.title}</h3>
                    <p className="text-slate-400 text-sm line-clamp-3 mb-3">
                      {alert.description || 'No description available'}
                    </p>

                    {((alert.mitre_ids?.length || 0) > 0 || (alert.mitre_tactics?.length || 0) > 0) && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {alert.mitre_tactics?.slice(0, 3).map(tactic => (
                          <span key={tactic} className="px-2 py-0.5 text-[10px] font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded">
                            {tactic}
                          </span>
                        ))}
                        {alert.mitre_ids?.slice(0, 5).map(id => (
                          <span key={id} className="px-2 py-0.5 text-[10px] font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded font-mono">
                            {id}
                          </span>
                        ))}
                        {((alert.mitre_ids?.length || 0) > 5 || (alert.mitre_tactics?.length || 0) > 3) && (
                          <span className="px-2 py-0.5 text-[10px] font-medium text-slate-500">
                            + more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {expandedAlert === alert.id ? (
                    <ChevronUp className="h-5 w-5 text-slate-500" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-slate-500" />
                  )}
                </div>
              </div>

              {expandedAlert === alert.id && (
                <div className="px-4 pb-4 pt-0 border-t border-slate-800/50 bg-slate-900/30">
                  <div className="mt-4 flex justify-end gap-3">
                    {onNavigateToYaraRule && alert.yara_rule_names && alert.yara_rule_names.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (alert.yara_rule_names && alert.yara_rule_names.length > 0) {
                            onNavigateToYaraRule(alert.yara_rule_names[0]);
                          }
                        }}
                        className="flex items-center space-x-2 text-purple-400 hover:text-purple-300 text-sm font-medium"
                      >
                        <FileCode className="h-4 w-4" />
                        <span>View YARA Rule</span>
                      </button>
                    )}
                    <a
                      href={alert.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-2 text-cyan-400 hover:text-cyan-300 text-sm font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span>View Full Alert</span>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          ))}

          <Pagination
            currentPage={page}
            totalItems={totalAlerts}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}
    </div>
  );
}

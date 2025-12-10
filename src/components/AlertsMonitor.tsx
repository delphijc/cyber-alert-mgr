import { useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink, Clock, Tag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Alert } from '../types';

export default function AlertsMonitor() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadAlerts();
    const subscription = supabase
      .channel('alerts_monitor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
        loadAlerts();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [filter]);

  async function loadAlerts() {
    try {
      setLoading(true);
      let query = supabase
        .from('alerts')
        .select('*, alert_sources(*)')
        .order('published_date', { ascending: false })
        .limit(50);

      if (filter !== 'all') {
        query = query.eq('severity', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAlerts(data || []);
    } catch (error) {
      console.error('Error loading alerts:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredAlerts = alerts.filter((alert) =>
    alert.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    alert.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const severityColors = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/50',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    info: 'bg-slate-500/20 text-slate-400 border-slate-500/50',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Search alerts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="info">Info</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-cyan-500 border-t-transparent"></div>
          <p className="mt-4 text-slate-400">Loading alerts...</p>
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No alerts found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className="bg-slate-900/50 border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <span
                      className={`px-3 py-1 text-xs font-semibold rounded-full border ${
                        severityColors[alert.severity]
                      }`}
                    >
                      {alert.severity.toUpperCase()}
                    </span>
                    <span className="px-3 py-1 text-xs font-medium bg-slate-700 text-slate-300 rounded-full">
                      {alert.alert_sources?.name || 'Unknown Source'}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{alert.title}</h3>
                  <p className="text-slate-400 text-sm line-clamp-3">
                    {alert.description || 'No description available'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                <div className="flex items-center space-x-4 text-xs text-slate-400">
                  <div className="flex items-center space-x-1">
                    <Clock className="h-3 w-3" />
                    <span>{new Date(alert.published_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Tag className="h-3 w-3" />
                    <span>{alert.external_id}</span>
                  </div>
                </div>
                {alert.url && (
                  <a
                    href={alert.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 text-cyan-400 hover:text-cyan-300 text-sm"
                  >
                    <span>View Details</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

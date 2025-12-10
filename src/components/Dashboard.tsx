import { useEffect, useState } from 'react';
import { Shield, AlertTriangle, TrendingUp, FileCode, Target, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Alert } from '../types';
import AlertsMonitor from './AlertsMonitor';
import TrendChart from './TrendChart';
import YaraRulesViewer from './YaraRulesViewer';
import MitreVisualization from './MitreVisualization';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('alerts');
  const [stats, setStats] = useState({
    totalAlerts: 0,
    criticalAlerts: 0,
    yaraRules: 0,
    mitreTechniques: 0,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStats();
    const subscription = supabase
      .channel('alerts_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
        loadStats();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function loadStats() {
    try {
      const [alertsRes, criticalRes, yaraRes, mitreRes] = await Promise.all([
        supabase.from('alerts').select('id', { count: 'exact', head: true }),
        supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('severity', 'critical'),
        supabase.from('yara_rules').select('id', { count: 'exact', head: true }),
        supabase.from('mitre_attack_techniques').select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        totalAlerts: alertsRes.count || 0,
        criticalAlerts: criticalRes.count || 0,
        yaraRules: yaraRes.count || 0,
        mitreTechniques: mitreRes.count || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  async function triggerFetch() {
    setLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      await fetch(`${supabaseUrl}/functions/v1/fetch-alerts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
      });

      await fetch(`${supabaseUrl}/functions/v1/process-alerts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
      });

      await loadStats();
    } catch (error) {
      console.error('Error triggering fetch:', error);
    } finally {
      setLoading(false);
    }
  }

  const tabs = [
    { id: 'alerts', label: 'Alerts Monitor', icon: AlertTriangle },
    { id: 'trends', label: 'Trends', icon: TrendingUp },
    { id: 'yara', label: 'YARA Rules', icon: FileCode },
    { id: 'mitre', label: 'MITRE ATT&CK', icon: Target },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Shield className="h-8 w-8 text-cyan-400" />
              <div>
                <h1 className="text-2xl font-bold text-white">CyberWatch</h1>
                <p className="text-sm text-slate-400">Government Cybersecurity Alert Monitor</p>
              </div>
            </div>
            <button
              onClick={triggerFetch}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Updating...' : 'Update Alerts'}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Alerts"
            value={stats.totalAlerts}
            icon={AlertTriangle}
            color="bg-blue-500"
          />
          <StatCard
            title="Critical Alerts"
            value={stats.criticalAlerts}
            icon={Shield}
            color="bg-red-500"
          />
          <StatCard
            title="YARA Rules"
            value={stats.yaraRules}
            icon={FileCode}
            color="bg-purple-500"
          />
          <StatCard
            title="MITRE Techniques"
            value={stats.mitreTechniques}
            icon={Target}
            color="bg-green-500"
          />
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden">
          <div className="border-b border-slate-700">
            <nav className="flex space-x-1 px-4">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 px-4 py-4 border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-cyan-400 text-cyan-400'
                        : 'border-transparent text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'alerts' && <AlertsMonitor />}
            {activeTab === 'trends' && <TrendChart />}
            {activeTab === 'yara' && <YaraRulesViewer />}
            {activeTab === 'mitre' && <MitreVisualization />}
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  icon: any;
  color: string;
}

function StatCard({ title, value, icon: Icon, color }: StatCardProps) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400 mb-1">{title}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
        </div>
        <div className={`${color} p-3 rounded-lg`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );
}

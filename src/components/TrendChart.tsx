import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { BarChart3 } from 'lucide-react';

interface TrendData {
  date: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export default function TrendChart() {
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrendData();
  }, []);

  async function loadTrendData() {
    try {
      setLoading(true);
      const data = await api.getTrendData();

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);


      const grouped: Record<string, TrendData> = {};

      data?.forEach((alert) => {
        const date = new Date(alert.published_date).toLocaleDateString();
        if (!grouped[date]) {
          grouped[date] = { date, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
        }
        grouped[date][alert.severity as keyof Omit<TrendData, 'date'>]++;
      });

      setTrendData(Object.values(grouped));
    } catch (error) {
      console.error('Error loading trend data:', error);
    } finally {
      setLoading(false);
    }
  }

  const maxValue = Math.max(
    ...trendData.map((d) => d.critical + d.high + d.medium + d.low + d.info),
    1
  );

  const severityStats = trendData.reduce(
    (acc, curr) => ({
      critical: acc.critical + curr.critical,
      high: acc.high + curr.high,
      medium: acc.medium + curr.medium,
      low: acc.low + curr.low,
      info: acc.info + curr.info,
    }),
    { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(severityStats).map(([severity, count]) => (
          <div
            key={severity}
            className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 text-center"
          >
            <p className="text-sm text-slate-400 mb-1 capitalize">{severity}</p>
            <p className="text-2xl font-bold text-white">{count}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-cyan-500 border-t-transparent"></div>
          <p className="mt-4 text-slate-400">Loading trend data...</p>
        </div>
      ) : trendData.length === 0 ? (
        <div className="text-center py-12">
          <BarChart3 className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No trend data available</p>
        </div>
      ) : (
        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Alert Trends (Last 30 Days)</h3>
          <div className="space-y-4">
            {trendData.map((data, index) => {
              const total = data.critical + data.high + data.medium + data.low + data.info;
              const percentage = (total / maxValue) * 100;

              return (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400">{data.date}</span>
                    <span className="text-sm font-medium text-white">{total} alerts</span>
                  </div>
                  <div className="h-8 bg-slate-800 rounded-lg overflow-hidden flex">
                    {data.critical > 0 && (
                      <div
                        className="bg-red-500 h-full flex items-center justify-center text-xs text-white font-medium"
                        style={{ width: `${(data.critical / total) * percentage}%` }}
                        title={`Critical: ${data.critical}`}
                      >
                        {data.critical > 0 && <span className="px-2">{data.critical}</span>}
                      </div>
                    )}
                    {data.high > 0 && (
                      <div
                        className="bg-orange-500 h-full flex items-center justify-center text-xs text-white font-medium"
                        style={{ width: `${(data.high / total) * percentage}%` }}
                        title={`High: ${data.high}`}
                      >
                        {data.high > 0 && <span className="px-2">{data.high}</span>}
                      </div>
                    )}
                    {data.medium > 0 && (
                      <div
                        className="bg-yellow-500 h-full flex items-center justify-center text-xs text-white font-medium"
                        style={{ width: `${(data.medium / total) * percentage}%` }}
                        title={`Medium: ${data.medium}`}
                      >
                        {data.medium > 0 && <span className="px-2">{data.medium}</span>}
                      </div>
                    )}
                    {data.low > 0 && (
                      <div
                        className="bg-blue-500 h-full flex items-center justify-center text-xs text-white font-medium"
                        style={{ width: `${(data.low / total) * percentage}%` }}
                        title={`Low: ${data.low}`}
                      >
                        {data.low > 0 && <span className="px-2">{data.low}</span>}
                      </div>
                    )}
                    {data.info > 0 && (
                      <div
                        className="bg-slate-500 h-full flex items-center justify-center text-xs text-white font-medium"
                        style={{ width: `${(data.info / total) * percentage}%` }}
                        title={`Info: ${data.info}`}
                      >
                        {data.info > 0 && <span className="px-2">{data.info}</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

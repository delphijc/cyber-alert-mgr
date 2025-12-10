import { useEffect, useState } from 'react';
import { Target, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { MitreAttackTechnique, AlertMitreMapping } from '../types';

interface TechniqueWithMappings extends MitreAttackTechnique {
  mappings_count: number;
  avg_confidence: number;
}

export default function MitreVisualization() {
  const [techniques, setTechniques] = useState<TechniqueWithMappings[]>([]);
  const [loading, setLoading] = useState(true);
  const [tacticFilter, setTacticFilter] = useState<string>('all');

  useEffect(() => {
    loadTechniques();
  }, []);

  async function loadTechniques() {
    try {
      setLoading(true);

      const { data: techniquesData, error: techniquesError } = await supabase
        .from('mitre_attack_techniques')
        .select('*')
        .order('technique_id');

      if (techniquesError) throw techniquesError;

      const { data: mappingsData, error: mappingsError } = await supabase
        .from('alert_mitre_mappings')
        .select('technique_id, confidence_score');

      if (mappingsError) throw mappingsError;

      const mappingsByTechnique: Record<string, { count: number; totalConfidence: number }> = {};
      mappingsData?.forEach((mapping) => {
        if (!mappingsByTechnique[mapping.technique_id]) {
          mappingsByTechnique[mapping.technique_id] = { count: 0, totalConfidence: 0 };
        }
        mappingsByTechnique[mapping.technique_id].count++;
        mappingsByTechnique[mapping.technique_id].totalConfidence += mapping.confidence_score;
      });

      const enrichedTechniques = techniquesData?.map((technique) => ({
        ...technique,
        mappings_count: mappingsByTechnique[technique.id]?.count || 0,
        avg_confidence: mappingsByTechnique[technique.id]
          ? mappingsByTechnique[technique.id].totalConfidence / mappingsByTechnique[technique.id].count
          : 0,
      })) || [];

      enrichedTechniques.sort((a, b) => b.mappings_count - a.mappings_count);

      setTechniques(enrichedTechniques);
    } catch (error) {
      console.error('Error loading MITRE techniques:', error);
    } finally {
      setLoading(false);
    }
  }

  const uniqueTactics = ['all', ...Array.from(new Set(techniques.map((t) => t.tactic)))];

  const filteredTechniques =
    tacticFilter === 'all'
      ? techniques
      : techniques.filter((t) => t.tactic === tacticFilter);

  const tacticColors: Record<string, string> = {
    'Initial Access': 'bg-red-500/20 text-red-400 border-red-500/50',
    'Execution': 'bg-orange-500/20 text-orange-400 border-orange-500/50',
    'Persistence': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    'Privilege Escalation': 'bg-green-500/20 text-green-400 border-green-500/50',
    'Defense Evasion': 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    'Credential Access': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50',
    'Discovery': 'bg-purple-500/20 text-purple-400 border-purple-500/50',
    'Lateral Movement': 'bg-pink-500/20 text-pink-400 border-pink-500/50',
    'Collection': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
    'Exfiltration': 'bg-teal-500/20 text-teal-400 border-teal-500/50',
    'Impact': 'bg-rose-500/20 text-rose-400 border-rose-500/50',
  };

  const tacticStats = techniques.reduce((acc, technique) => {
    if (!acc[technique.tactic]) {
      acc[technique.tactic] = 0;
    }
    acc[technique.tactic] += technique.mappings_count;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Object.entries(tacticStats)
          .sort((a, b) => b[1] - a[1])
          .map(([tactic, count]) => (
            <div
              key={tactic}
              className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 text-center hover:border-slate-600 transition-colors cursor-pointer"
              onClick={() => setTacticFilter(tactic)}
            >
              <p className="text-sm text-slate-400 mb-1">{tactic}</p>
              <p className="text-2xl font-bold text-white">{count}</p>
            </div>
          ))}
      </div>

      <select
        value={tacticFilter}
        onChange={(e) => setTacticFilter(e.target.value)}
        className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
      >
        {uniqueTactics.map((tactic) => (
          <option key={tactic} value={tactic}>
            {tactic === 'all' ? 'All Tactics' : tactic}
          </option>
        ))}
      </select>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-cyan-500 border-t-transparent"></div>
          <p className="mt-4 text-slate-400">Loading MITRE ATT&CK data...</p>
        </div>
      ) : filteredTechniques.length === 0 ? (
        <div className="text-center py-12">
          <Target className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No MITRE techniques found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTechniques.map((technique) => (
            <div
              key={technique.id}
              className="bg-slate-900/50 border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <span
                      className={`px-3 py-1 text-xs font-semibold rounded-full border ${
                        tacticColors[technique.tactic] || 'bg-slate-500/20 text-slate-400 border-slate-500/50'
                      }`}
                    >
                      {technique.tactic}
                    </span>
                    <span className="px-3 py-1 text-xs font-medium bg-slate-700 text-slate-300 rounded-full">
                      {technique.technique_id}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{technique.technique_name}</h3>
                  <p className="text-slate-400 text-sm">{technique.description}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                <div className="flex items-center space-x-6 text-sm">
                  <div>
                    <span className="text-slate-400">Mapped Alerts: </span>
                    <span className="font-semibold text-white">{technique.mappings_count}</span>
                  </div>
                  {technique.avg_confidence > 0 && (
                    <div>
                      <span className="text-slate-400">Avg. Confidence: </span>
                      <span className="font-semibold text-white">
                        {(technique.avg_confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>
                <a
                  href={technique.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 text-cyan-400 hover:text-cyan-300 text-sm"
                >
                  <span>View on MITRE</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {technique.mappings_count > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min((technique.mappings_count / Math.max(...filteredTechniques.map(t => t.mappings_count))) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

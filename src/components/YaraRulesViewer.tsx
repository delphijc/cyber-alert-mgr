import { useEffect, useState } from 'react';
import { Download, FileCode, Copy, Check, Lock, Unlock, Trash2, Edit2, RotateCw, X, Save, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { YaraRule } from '../types';
import Pagination from './common/Pagination';

interface YaraRulesViewerProps {
  severity?: string;
  initialSearch?: string;
  onNavigateToAlert?: (alertId: string) => void;
}

export default function YaraRulesViewer({ severity, initialSearch = '', onNavigateToAlert }: YaraRulesViewerProps) {
  const [rules, setRules] = useState<YaraRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(initialSearch);

  // ... (abbreviate unchanged parts in my mind, but have to be careful with replace_file_content so I will use multiple ReplaceFileContent calls or bigger chunk if needed)
  // Actually, I can just replace the Interface and then another chunk for the button.

  // Chunk 1: Interface and Component definition
  // Chunk 2: Button rendering

  // Wait, replace_file_content requires Single Contiguous Block.
  // I will use replace_file_content for the whole component or meaningful chunks.
  // Let's replace the Interface and Props first.
  /*
  interface YaraRulesViewerProps {
    severity?: string;
    initialSearch?: string;
    onNavigateToAlert?: (alertId: string) => void;
  }
  
  export default function YaraRulesViewer({ severity, initialSearch = '', onNavigateToAlert }: YaraRulesViewerProps) {
  */

  // Then adding the button.
  /*
                            <button
                              onClick={() => downloadRule(rule)}
                              className="p-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
                              title="Download rule"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                            
                            {onNavigateToAlert && rule.alert_id && (
                               <button
                                 onClick={() => onNavigateToAlert(rule.alert_id)}
                                 className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                                 title="View Source Alert"
                               >
                                 <AlertTriangle className="h-4 w-4 text-yellow-500" />
                               </button>
                            )}
  */

  // I need to import AlertTriangle too? It was available in other files, let's check imports.
  // Check existing imports: `import { Download, ... } from 'lucide-react';`
  // I need access to AlertTriangle.

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [totalRules, setTotalRules] = useState(0);

  // Edit State
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    setPage(0);
  }, [severity]);

  useEffect(() => {
    if (initialSearch) {
      setSearchTerm(initialSearch);
    }
  }, [initialSearch]);

  useEffect(() => {
    loadRules();
  }, [severity, page, pageSize]);

  async function loadRules() {
    try {
      setLoading(true);
      const response = await api.getYaraRules(severity, page, pageSize);
      setRules(response.data || []);
      setTotalRules(response.total || 0);
    } catch (error) {
      console.error('Error loading YARA rules:', error);
    } finally {
      setLoading(false);
    }
  }

  // Note: Filtering is restricted to the current page's data
  const filteredRules = rules.filter(
    (rule) =>
      rule.rule_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function downloadRule(rule: YaraRule) {
    const blob = new Blob([rule.rule_content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${rule.rule_name}.yar`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  function downloadAllRules() {
    const allRules = filteredRules.map((r) => r.rule_content).join('\n\n');
    const blob = new Blob([allRules], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yara_rules_page_${page + 1}.yar`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  async function copyToClipboard(rule: YaraRule) {
    await navigator.clipboard.writeText(rule.rule_content);
    setCopiedId(rule.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  /* Management Functions */
  const startEditing = (rule: YaraRule) => {
    setEditingRuleId(rule.id);
    setEditContent(rule.rule_content);
  };

  const cancelEditing = () => {
    setEditingRuleId(null);
    setEditContent('');
  };

  const saveRule = async (rule: YaraRule) => {
    try {
      setActionLoading(rule.id);
      await api.updateYaraRule(rule.id, { rule_content: editContent });
      await loadRules();
      setEditingRuleId(null);
    } catch (e) {
      console.error('Failed to save rule:', e);
      alert('Failed to save rule');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleLock = async (rule: YaraRule) => {
    try {
      setActionLoading(rule.id);
      // Toggle boolean-like integer 0/1 (or boolean if parsed)
      // Assuming DB returns 0 or 1, and we might treat it as number.
      // Let's coerce to boolean for toggle logic.
      const newLockState = rule.is_locked ? 0 : 1;
      await api.updateYaraRule(rule.id, { is_locked: newLockState });
      await loadRules();
    } catch (e) {
      console.error('Failed to lock/unlock rule:', e);
    } finally {
      setActionLoading(null);
    }
  };

  const deleteRule = async (rule: YaraRule) => {
    if (!confirm(`Are you sure you want to delete rule "${rule.rule_name}"?`)) return;
    try {
      setActionLoading(rule.id);
      await api.deleteYaraRule(rule.id);
      await loadRules();
    } catch (e: any) {
      console.error('Failed to delete rule:', e);
      alert(e.message || 'Failed to delete rule');
    } finally {
      setActionLoading(null);
    }
  };

  const reprocessAlert = async (rule: YaraRule) => {
    if (!rule.alert_id) return;
    if (!confirm('Reprocess the original alert? This may overwrite changes if rule is not locked.')) return;
    try {
      setActionLoading(rule.id);
      await api.reprocessAlert(rule.alert_id);
      await loadRules();
    } catch (e) {
      console.error('Failed to reprocess alert:', e);
      alert('Failed to reprocess alert');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <input
          type="text"
          placeholder="Search rules on this page..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        />
        <button
          onClick={downloadAllRules}
          disabled={filteredRules.length === 0}
          className="flex items-center space-x-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <Download className="h-4 w-4" />
          <span>Download Page</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-cyan-500 border-t-transparent"></div>
          <p className="mt-4 text-slate-400">Loading YARA rules...</p>
        </div>
      ) : filteredRules.length === 0 ? (
        <div className="text-center py-12">
          <FileCode className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No YARA rules found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRules.map((rule) => {
            const isEditing = editingRuleId === rule.id;
            const isLocked = !!rule.is_locked;
            const isLoading = actionLoading === rule.id;

            return (
              <div
                key={rule.id}
                className={`bg-slate-900/50 border rounded-lg overflow-hidden transition-colors ${isLocked ? 'border-orange-500/50' : 'border-slate-700 hover:border-slate-600'
                  }`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-white">{rule.rule_name}</h3>
                        {isLocked && <Lock className="h-4 w-4 text-orange-500" />}
                      </div>
                      <p className="text-slate-400 text-sm mb-3">{rule.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {rule.tags?.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-1 text-xs font-medium bg-slate-700 text-slate-300 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      {((rule.mitre_ids?.length || 0) > 0 || (rule.mitre_tactics?.length || 0) > 0) && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {rule.mitre_tactics?.slice(0, 3).map(tactic => (
                            <span key={tactic} className="px-2 py-0.5 text-[10px] font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded">
                              {tactic}
                            </span>
                          ))}
                          {rule.mitre_ids?.slice(0, 5).map(id => (
                            <span key={id} className="px-2 py-0.5 text-[10px] font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded font-mono">
                              {id}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      {/* Action Buttons */}
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveRule(rule)}
                            disabled={isLoading}
                            className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                            title="Save Changes"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            onClick={cancelEditing}
                            disabled={isLoading}
                            className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                            title="Cancel Edit"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => toggleLock(rule)}
                            className={`p-2 rounded-lg transition-colors ${isLocked ? 'bg-orange-500/20 text-orange-500 hover:bg-orange-500/30' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                              }`} // Fixed className formatting
                            title={isLocked ? "Unlock Rule" : "Lock Rule"}
                          >
                            {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                          </button>

                          <button
                            onClick={() => startEditing(rule)}
                            className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                            title="Edit Rule"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => reprocessAlert(rule)}
                            className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                            title="Reprocess Source Alert"
                          >
                            <RotateCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                          </button>

                          <button
                            onClick={() => deleteRule(rule)}
                            disabled={isLocked}
                            className={`p-2 rounded-lg transition-colors ${isLocked ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-red-900/50 hover:bg-red-800/50 text-red-400'
                              }`}
                            title="Delete Rule"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>

                          <div className="w-px h-6 bg-slate-700 mx-1"></div>

                          <button
                            onClick={() => copyToClipboard(rule)}
                            className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                            title="Copy to clipboard"
                          >
                            {copiedId === rule.id ? (
                              <Check className="h-4 w-4 text-green-400" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => downloadRule(rule)}
                            className="p-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
                            title="Download rule"
                          >
                            <Download className="h-4 w-4" />
                          </button>

                          {onNavigateToAlert && rule.alert_id && (
                            <button
                              onClick={() => onNavigateToAlert(rule.alert_id)}
                              className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                              title="View Source Alert"
                            >
                              <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-950 border border-slate-700 rounded-lg p-4 overflow-x-auto">
                    {isEditing ? (
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full h-64 bg-transparent text-sm text-slate-300 font-mono focus:outline-none resize-none"
                      />
                    ) : (
                      <pre className="text-sm text-slate-300 font-mono whitespace-pre">
                        {rule.rule_content}
                      </pre>
                    )}
                  </div>
                </div>

                <div className="px-6 py-3 bg-slate-800/50 border-t border-slate-700 flex justify-between items-center text-xs text-slate-400">
                  <span>Generated: {new Date(rule.generated_at).toLocaleString()}</span>
                  {isLocked && <span className="text-orange-500 flex items-center gap-1"><Lock className="h-3 w-3" /> Locked from automatic updates</span>}
                </div>
              </div>
            );
          })}

          <Pagination
            currentPage={page}
            totalItems={totalRules}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}
    </div>
  );
}

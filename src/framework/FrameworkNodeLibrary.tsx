import React, { useState, useEffect } from 'react';
import {
  Boxes, Globe, GitBranch, Bot, FileText, Columns, GitMerge, Sliders, Workflow,
  ToggleLeft, ToggleRight, Search, ChevronDown, Settings, CheckCircle2, XCircle,
  Building2, Save, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as api from '../TenantNodePlatform/tnpService';
import type { FrameworkNode, TenantNodeAccessItem, Tenant } from '../TenantNodePlatform/types';

// Icon map (matches backend seed)
const ICON_MAP: Record<string, React.ElementType> = {
  Globe, GitBranch, Bot, FileText, Columns, GitMerge, Sliders, Workflow,
  Box: Boxes,
};

const CategoryColors: Record<string, string> = {
  Integration: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  Logic: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  'AI/ML': 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  'Human-in-Loop': 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300',
  'Control Flow': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  Data: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
  Composition: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
};

// -------------------------------------------------------------------------
// Tenant Node Access Panel
// -------------------------------------------------------------------------
interface NodeAccessPanelProps {
  tenant: Tenant;
  onClose: () => void;
}

const NodeAccessPanel: React.FC<NodeAccessPanelProps> = ({ tenant, onClose }) => {
  const [accessItems, setAccessItems] = useState<TenantNodeAccessItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    api.getTenantNodeAccess(tenant.tenant_id)
      .then(items => setAccessItems(items))
      .catch(() => toast.error('Failed to load node access'))
      .finally(() => setLoading(false));
  }, [tenant.tenant_id]);

  const toggle = (nodeType: string) => {
    setAccessItems(prev =>
      prev.map(a => a.node_type === nodeType ? { ...a, is_enabled: !a.is_enabled } : a)
    );
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const enabled = accessItems.filter(a => a.is_enabled).map(a => a.node_type);
      await api.updateTenantNodeAccess(tenant.tenant_id, enabled);
      toast.success('Node access updated successfully');
      setDirty(false);
    } catch {
      toast.error('Failed to save node access');
    } finally {
      setSaving(false);
    }
  };

  const groupedByCategory = accessItems.reduce<Record<string, TenantNodeAccessItem[]>>((acc, item) => {
    (acc[item.category] ||= []).push(item);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-light-border dark:border-dark-border">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-light-border dark:border-dark-border">
          <div>
            <h2 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">
              Node Access — {tenant.tenant_name}
            </h2>
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
              Configure which framework nodes this tenant can use in their workflows
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-light-hover dark:hover:bg-dark-hover rounded-lg">✕</button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 rounded-xl bg-light-hover dark:bg-dark-hover animate-pulse" />
              ))}
            </div>
          ) : (
            Object.entries(groupedByCategory).map(([category, items]) => (
              <div key={category}>
                <p className={`text-xs font-bold uppercase tracking-widest mb-2 px-1 ${CategoryColors[category] ? '' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
                  {category}
                </p>
                <div className="space-y-2">
                  {items.map(item => {
                    const Icon = ICON_MAP[item.icon] || Boxes;
                    return (
                      <div
                        key={item.node_type}
                        className="flex items-center gap-4 p-3.5 rounded-xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface-alt hover:bg-light-hover dark:hover:bg-dark-hover transition-colors duration-150"
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${CategoryColors[item.category] || 'bg-slate-100 dark:bg-slate-800'}`}>
                          <Icon size={15} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">{item.display_name}</p>
                          <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{item.node_type}</p>
                        </div>
                        <button
                          onClick={() => toggle(item.node_type)}
                          className={`transition-colors duration-200 ${item.is_enabled ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`}
                        >
                          {item.is_enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-light-border dark:border-dark-border flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-hover dark:hover:bg-dark-hover rounded-xl transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-all duration-200"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            Save Access
          </button>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------------------
// Main Page
// -------------------------------------------------------------------------
export const FrameworkNodeLibrary: React.FC = () => {
  const [nodes, setNodes] = useState<FrameworkNode[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    Promise.all([
      api.listFrameworkNodes(),
      api.listTenants(),
    ]).then(([fnodes, tenantList]) => {
      setNodes(Array.isArray(fnodes) ? fnodes : []);
      setTenants(Array.isArray(tenantList) ? tenantList : []);
    }).catch(() => {
      toast.error('Failed to load data');
      setNodes([]);
      setTenants([]);
    }).finally(() => setLoading(false));
  }, []);

  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const filtered = safeNodes.filter(n =>
    (n.display_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (n.category || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const grouped = filtered.reduce<Record<string, FrameworkNode[]>>((acc, n) => {
    (acc[n.category] ||= []).push(n);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-bg p-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg">
              <Boxes size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-light-text-primary dark:text-dark-text-primary tracking-tight">
                Framework Node Library
              </h1>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                {nodes.length} registered node types · configure tenant access
              </p>
            </div>
          </div>
        </div>

        {/* Tenant Node Access Configurator */}
        <div className="bg-white dark:bg-dark-surface rounded-2xl border border-light-border dark:border-dark-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={16} className="text-violet-600" />
            <h2 className="font-bold text-light-text-primary dark:text-dark-text-primary text-sm">
              Configure Per-Tenant Node Access
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {tenants.map(t => (
              <button
                key={t.tenant_id}
                onClick={() => setSelectedTenant(t)}
                className="flex items-center gap-3 p-3 rounded-xl border border-light-border dark:border-dark-border hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all duration-200 text-left group"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {t.tenant_name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary truncate">{t.tenant_name}</p>
                  <p className="text-[10px] text-indigo-600 dark:text-indigo-400 group-hover:underline">Configure →</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search framework nodes..."
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-sm text-light-text-primary dark:text-dark-text-primary placeholder-light-text-secondary dark:placeholder-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
          />
        </div>

        {/* Node Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-40 rounded-2xl bg-white dark:bg-dark-surface border border-light-border dark:border-dark-border animate-pulse" />
            ))}
          </div>
        ) : (
          Object.entries(grouped).map(([category, categoryNodes]) => (
            <div key={category}>
              <div className="flex items-center gap-3 mb-4">
                <span className={`text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${CategoryColors[category] || 'bg-slate-100 text-slate-600'}`}>
                  {category}
                </span>
                <div className="flex-1 h-px bg-light-border dark:bg-dark-border" />
                <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{categoryNodes.length} node{categoryNodes.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryNodes.map(node => {
                  const Icon = ICON_MAP[node.icon] || Boxes;
                  const isActive = node.status === 'ACTIVE';
                  return (
                    <div
                      key={node.id}
                      className="group bg-white dark:bg-dark-surface rounded-2xl border border-light-border dark:border-dark-border p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${CategoryColors[node.category] || 'bg-slate-100 dark:bg-slate-800'}`}>
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-light-text-primary dark:text-dark-text-primary text-sm">{node.display_name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <code className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary font-mono">{node.node_type}</code>
                            <span className="text-[10px] text-slate-400">v{node.version}</span>
                          </div>
                        </div>
                        <div className={`flex items-center gap-1 ${isActive ? 'text-emerald-500' : 'text-slate-400'}`}>
                          {isActive ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                        </div>
                      </div>
                      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed line-clamp-2">
                        {node.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Node Access Panel Modal */}
      {selectedTenant && (
        <NodeAccessPanel
          tenant={selectedTenant}
          onClose={() => setSelectedTenant(null)}
        />
      )}
    </div>
  );
};

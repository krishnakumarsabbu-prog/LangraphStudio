import React, { useState, useEffect } from 'react';
import {
  Building2, Plus, Search, Eye, Ban, CheckCircle2,
  Trash2, Edit2, Users, Shield, ChevronRight, RefreshCw,
  Layers, UserCog, MoreVertical, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as api from '../TenantNodePlatform/tnpService';
import { useAuthStore } from '../TenantNodePlatform/authStore';
import type { Tenant } from '../TenantNodePlatform/types';

const TenantStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const cfg: Record<string, { icon: React.ElementType; label: string; cls: string }> = {
    active: { icon: CheckCircle2, label: 'Active', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' },
    suspended: { icon: Ban, label: 'Suspended', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800' },
    inactive: { icon: AlertTriangle, label: 'Inactive', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700' },
  };
  const s = cfg[status] || cfg.inactive;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase px-2 py-1 rounded-full tracking-wide ${s.cls}`}>
      <Icon size={10} />
      {s.label}
    </span>
  );
};

const categoryColors: Record<string, string> = {
  'Federal Agency': 'from-blue-600 to-indigo-700',
  'Logistics & Postal': 'from-amber-500 to-orange-600',
  'Financial Services': 'from-emerald-500 to-teal-600',
  'Healthcare & Life Sciences': 'from-pink-500 to-rose-600',
  'E-Commerce & Retail': 'from-violet-500 to-purple-600',
  'Enterprise Software': 'from-slate-600 to-slate-700',
  Sandbox: 'from-cyan-500 to-blue-500',
};

export const TenantManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { startImpersonation } = useAuthStore();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const loadTenants = async () => {
    try {
      setLoading(true);
      const items = await api.listTenants();
      setTenants(Array.isArray(items) ? items : []);
    } catch {
      toast.error('Failed to load tenants');
      setTenants([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
    // Check for impersonate param from dashboard shortcut
    const imp = searchParams.get('impersonate');
    if (imp) {
      // Will be handled after tenants load
    }
  }, []);

  const handleSuspend = async (t: Tenant) => {
    setActionLoading(t.tenant_id);
    try {
      await api.suspendTenant(t.tenant_id);
      toast.success(`${t.tenant_name} suspended`);
      loadTenants();
    } catch {
      toast.error('Failed to suspend tenant');
    } finally {
      setActionLoading(null);
      setOpenMenu(null);
    }
  };

  const handleActivate = async (t: Tenant) => {
    setActionLoading(t.tenant_id);
    try {
      await api.activateTenant(t.tenant_id);
      toast.success(`${t.tenant_name} activated`);
      loadTenants();
    } catch {
      toast.error('Failed to activate tenant');
    } finally {
      setActionLoading(null);
      setOpenMenu(null);
    }
  };

  const handleDelete = async (t: Tenant) => {
    if (!window.confirm(`Delete "${t.tenant_name}"? This is irreversible.`)) return;
    setActionLoading(t.tenant_id);
    try {
      await api.deleteTenant(t.tenant_id);
      toast.success(`${t.tenant_name} deleted`);
      loadTenants();
    } catch {
      toast.error('Failed to delete tenant');
    } finally {
      setActionLoading(null);
      setOpenMenu(null);
    }
  };

  const handleImpersonate = async (t: Tenant) => {
    await startImpersonation(t.tenant_id, t.tenant_name);
    toast.success(`Now impersonating ${t.tenant_name}`);
    navigate('/langgraph');
  };

  const safeTenants = Array.isArray(tenants) ? tenants : [];
  const filtered = safeTenants.filter(t =>
    (t.tenant_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.tenant_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.category || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: safeTenants.length,
    active: safeTenants.filter(t => t.status === 'active').length,
    suspended: safeTenants.filter(t => t.status === 'suspended').length,
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto space-y-7">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <Building2 size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-light-text-primary dark:text-dark-text-primary tracking-tight">
                Tenant Management
              </h1>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                {stats.total} tenants · {stats.active} active · {stats.suspended} suspended
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadTenants}
              disabled={loading}
              className="p-2.5 hover:bg-light-hover dark:hover:bg-dark-hover rounded-xl transition-colors border border-light-border dark:border-dark-border"
            >
              <RefreshCw size={16} className={`text-light-text-secondary dark:text-dark-text-secondary ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => navigate('/my-nodes')}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 rounded-xl shadow-md transition-all duration-200"
            >
              <Plus size={16} />
              New Tenant
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search tenants by name, ID, or category..."
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-sm text-light-text-primary dark:text-dark-text-primary placeholder-light-text-secondary dark:placeholder-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
          />
        </div>

        {/* Tenant Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-52 rounded-2xl bg-white dark:bg-dark-surface border border-light-border dark:border-dark-border animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-light-text-secondary dark:text-dark-text-secondary">
            <Building2 size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No tenants found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(t => {
              const gradient = categoryColors[t.category || ''] || 'from-slate-600 to-slate-700';
              const isLoading = actionLoading === t.tenant_id;

              return (
                <div
                  key={t.tenant_id}
                  className="group relative bg-white dark:bg-dark-surface rounded-2xl border border-light-border dark:border-dark-border overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                >
                  {/* Top gradient bar */}
                  <div className={`h-2 bg-gradient-to-r ${gradient}`} />

                  <div className="p-5">
                    {/* Tenant Identity */}
                    <div className="flex items-start gap-3 mb-4">
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-black text-lg flex-shrink-0 shadow-md`}>
                        {t.tenant_name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-light-text-primary dark:text-dark-text-primary text-base leading-tight truncate">
                          {t.tenant_name}
                        </p>
                        <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary font-mono truncate">
                          {t.tenant_id}
                        </p>
                      </div>
                      {/* Action Menu */}
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenu(openMenu === t.tenant_id ? null : t.tenant_id)}
                          className="p-1.5 hover:bg-light-hover dark:hover:bg-dark-hover rounded-lg transition-colors"
                        >
                          <MoreVertical size={16} className="text-light-text-secondary dark:text-dark-text-secondary" />
                        </button>
                        {openMenu === t.tenant_id && (
                          <div className="absolute right-0 top-8 z-20 bg-white dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl shadow-2xl py-1.5 w-44 min-w-max">
                            {t.status === 'active' ? (
                              <button
                                onClick={() => handleSuspend(t)}
                                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                              >
                                <Ban size={14} />
                                Suspend Tenant
                              </button>
                            ) : (
                              <button
                                onClick={() => handleActivate(t)}
                                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                              >
                                <CheckCircle2 size={14} />
                                Activate Tenant
                              </button>
                            )}
                            <button
                              onClick={() => handleImpersonate(t)}
                              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
                            >
                              <Eye size={14} />
                              Impersonate
                            </button>
                            <div className="h-px bg-light-border dark:bg-dark-border my-1.5" />
                            <button
                              onClick={() => handleDelete(t)}
                              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                            >
                              <Trash2 size={14} />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="flex items-center gap-2 mb-4">
                      <TenantStatusBadge status={t.status} />
                      {t.category && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-light-surface dark:bg-dark-surface-alt text-light-text-secondary dark:text-dark-text-secondary border border-light-border dark:border-dark-border">
                          {t.category}
                        </span>
                      )}
                    </div>

                    {t.description && (
                      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed mb-4 line-clamp-2">
                        {t.description}
                      </p>
                    )}

                    {/* Actions Row */}
                    <div className="flex gap-2 pt-2 border-t border-light-border dark:border-dark-border">
                      <button
                        onClick={() => handleImpersonate(t)}
                        disabled={t.status === 'suspended' || isLoading}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isLoading ? <RefreshCw size={12} className="animate-spin" /> : <Eye size={12} />}
                        Impersonate
                      </button>
                      <button
                        onClick={() => navigate(`/framework/nodes?tenant=${t.tenant_id}`)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-light-hover dark:hover:bg-dark-hover rounded-lg transition-colors"
                      >
                        <Layers size={12} />
                        Node Access
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Building2, Plus, Search, Eye, Ban, CheckCircle2,
  Trash2, Edit2, Users, Shield, ChevronRight, RefreshCw,
  Layers, UserCog, MoreVertical, AlertTriangle, X, Lock, Mail, User,
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

// -------------------------------------------------------------------------
// Provision Tenant & Initial Admin Modal
// -------------------------------------------------------------------------
interface CreateTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const CreateTenantModal: React.FC<CreateTenantModalProps> = ({ isOpen, onClose, onCreated }) => {
  const [formData, setFormData] = useState({
    tenant_name: '',
    category: 'Federal Agency',
    description: '',
    admin_name: '',
    admin_email: '',
    admin_password: '',
  });
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.tenant_name.trim()) {
      toast.error('Tenant organization name is required');
      return;
    }
    if (!formData.admin_name.trim() || !formData.admin_email.trim()) {
      toast.error('Initial Tenant Admin name and email are required');
      return;
    }

    setSaving(true);
    try {
      // 1. Create Tenant
      const slug = formData.tenant_name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const createdTenant = await api.createTenant({
        tenant_name: formData.tenant_name.trim(),
        slug: slug,
        category: formData.category,
        description: formData.description.trim() || undefined,
        metadata: { icon: 'Building2' },
      });

      // 2. Provision initial Tenant Admin
      await api.createUser({
        name: formData.admin_name.trim(),
        email: formData.admin_email.trim().toLowerCase(),
        password: formData.admin_password.trim() || 'password123',
        role: 'TENANT_ADMIN',
        tenant_id: createdTenant.tenant_id,
        title: `${formData.tenant_name} Admin`,
        avatar: '🛡️',
      });

      // 3. Set default node access
      try {
        const fnodes = await api.listFrameworkNodes();
        const allTypes = fnodes.map((f: any) => f.node_type);
        await api.updateTenantNodeAccess(createdTenant.tenant_id, allTypes);
      } catch {}

      toast.success(`Tenant "${formData.tenant_name}" and Admin "${formData.admin_email}" provisioned successfully!`);
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to provision tenant');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-2xl w-full max-w-xl border border-light-border dark:border-dark-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-light-border dark:border-dark-border bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
          <div className="flex items-center gap-2.5">
            <Building2 size={20} />
            <div>
              <h2 className="font-bold text-base">Provision New Tenant</h2>
              <p className="text-xs text-violet-100">Create organization and assign primary Tenant Admin</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Section 1: Tenant Details */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-3 flex items-center gap-1.5">
              <Building2 size={14} /> Organization Details
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1">
                  Tenant Organization Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.tenant_name}
                  onChange={(e) => setFormData({ ...formData, tenant_name: e.target.value })}
                  placeholder="e.g. Department of Transportation, Acme Corp"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface-alt text-sm text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface-alt text-sm text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Federal Agency">Federal Agency</option>
                    <option value="Financial Services">Financial Services</option>
                    <option value="Logistics & Postal">Logistics & Postal</option>
                    <option value="Healthcare & Life Sciences">Healthcare & Life Sciences</option>
                    <option value="E-Commerce & Retail">E-Commerce & Retail</option>
                    <option value="Enterprise Software">Enterprise Software</option>
                    <option value="Sandbox">Sandbox</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1">
                    Slug Preview
                  </label>
                  <input
                    type="text"
                    disabled
                    value={formData.tenant_name.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'auto-generated'}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-light-border dark:border-dark-border bg-slate-100 dark:bg-slate-800 text-xs font-mono text-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Summary of workflows, services, or business purpose..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface-alt text-sm text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-light-border dark:bg-dark-border" />

          {/* Section 2: Tenant Admin Provisioning */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-3 flex items-center gap-1.5">
              <Shield size={14} /> Initial Tenant Admin Account
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1">
                    Admin Full Name *
                  </label>
                  <div className="relative">
                    <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary" />
                    <input
                      type="text"
                      required
                      value={formData.admin_name}
                      onChange={(e) => setFormData({ ...formData, admin_name: e.target.value })}
                      placeholder="e.g. Alex Mercer"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface-alt text-sm text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1">
                    Admin Email *
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary" />
                    <input
                      type="email"
                      required
                      value={formData.admin_email}
                      onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                      placeholder="e.g. admin@dot.gov"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface-alt text-sm text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1">
                  Initial Password
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary" />
                  <input
                    type="password"
                    value={formData.admin_password}
                    onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })}
                    placeholder="Defaults to password123 if left blank"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface-alt text-sm text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-light-border dark:border-dark-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-hover dark:hover:bg-dark-hover rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 rounded-xl transition-all duration-200 shadow-md"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              Provision Tenant
            </button>
          </div>
        </form>
      </div>
    </div>
  );
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
  const [showCreateModal, setShowCreateModal] = useState(false);

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
              onClick={() => setShowCreateModal(true)}
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

      {/* Provision Tenant Modal */}
      {showCreateModal && (
        <CreateTenantModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={loadTenants}
        />
      )}
    </div>
  );
};

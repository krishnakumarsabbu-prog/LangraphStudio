import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  Plus,
  Trash2,
  Edit2,
  Shield,
  Sparkles,
  CheckCircle2,
  X,
  Search,
  LogIn,
  AlertCircle,
  Briefcase,
  Mail,
  Lock,
  Loader2,
  UserCheck,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTnpStore } from './tnpStore';
import { useAuthStore } from './authStore';
import type { Tenant, TenantCreate, TenantUpdate, UserProfile, UserCreate, UserUpdate, UserRole } from './types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'tenants' | 'users';
}

const roleBadges: Record<UserRole, { bg: string; text: string; label: string }> = {
  SUPER_ADMIN: { bg: 'bg-amber-500/10 text-amber-500 border-amber-500/30', text: 'text-amber-500', label: 'Super Admin' },
  TENANT_ADMIN: { bg: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/30', text: 'text-indigo-500', label: 'Tenant Admin' },
  TENANT_USER: { bg: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30', text: 'text-emerald-500', label: 'Business User' },
  TENANT_VIEWER: { bg: 'bg-slate-500/10 text-slate-400 border-slate-500/30', text: 'text-slate-400', label: 'Viewer' },
};

const categoryPresets = [
  'Federal Agency',
  'Logistics & Postal',
  'Financial Services',
  'Healthcare & Life Sciences',
  'E-Commerce & Retail',
  'Telecommunications',
  'Enterprise Software',
  'Sandbox',
];

export const TenantUserManagementModal: React.FC<Props> = ({ isOpen, onClose, defaultTab = 'tenants' }) => {
  const {
    tenants,
    users,
    selectedTenantId,
    loadTenants,
    loadUsers,
    createTenant,
    updateTenant,
    deleteTenant,
    createUser,
    updateUser,
    deleteUser,
    selectTenant,
  } = useTnpStore();

  const { currentUser, isSuperAdmin, isTenantAdmin, quickLogin, switchActiveTenant } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'tenants' | 'users'>(defaultTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTenant, setFilterTenant] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  // Tenant Creation / Edit State
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [tenantCategory, setTenantCategory] = useState('Enterprise');
  const [tenantDescription, setTenantDescription] = useState('');

  // User Creation / Edit State
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('TENANT_USER');
  const [userTenantId, setUserTenantId] = useState('');
  const [userTitle, setUserTitle] = useState('');
  const [userAvatar, setUserAvatar] = useState('👤');
  const [userPassword, setUserPassword] = useState('password123');

  useEffect(() => {
    if (isOpen) {
      loadTenants();
      loadUsers();
      if (selectedTenantId && selectedTenantId !== 'all') {
        setUserTenantId(selectedTenantId);
      }
    }
  }, [isOpen, loadTenants, loadUsers, selectedTenantId]);

  if (!isOpen) return null;

  // Handle Tenant Submit
  const handleSaveTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantName.trim()) {
      toast.error('Please enter a tenant organization name');
      return;
    }
    setLoading(true);
    try {
      if (editingTenant) {
        await updateTenant(editingTenant.tenant_id, {
          tenant_name: tenantName,
          slug: tenantSlug,
          category: tenantCategory,
          description: tenantDescription,
        });
        toast.success(`Updated tenant "${tenantName}"`);
      } else {
        await createTenant({
          tenant_name: tenantName,
          slug: tenantSlug,
          category: tenantCategory,
          description: tenantDescription,
        });
        toast.success(`Created tenant "${tenantName}"`);
      }
      setShowTenantModal(false);
      setEditingTenant(null);
      setTenantName('');
      setTenantSlug('');
      setTenantCategory('Enterprise');
      setTenantDescription('');
      await loadTenants();
      await loadUsers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save tenant');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditTenant = (t: Tenant) => {
    setEditingTenant(t);
    setTenantName(t.tenant_name);
    setTenantSlug(t.slug || '');
    setTenantCategory(t.category || 'Enterprise');
    setTenantDescription(t.description || '');
    setShowTenantModal(true);
  };

  const handleDeleteTenant = async (t: Tenant) => {
    if (window.confirm(`Are you sure you want to delete tenant "${t.tenant_name}"? All associated blueprints will be removed.`)) {
      setLoading(true);
      try {
        await deleteTenant(t.tenant_id);
        toast.success(`Deleted tenant "${t.tenant_name}"`);
        await loadTenants();
        await loadUsers();
      } catch (err: any) {
        toast.error(err.message || 'Failed to delete tenant');
      } finally {
        setLoading(false);
      }
    }
  };

  // Handle User Submit
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !userEmail.trim()) {
      toast.error('Name and Email are required');
      return;
    }
    setLoading(true);
    try {
      if (editingUser) {
        await updateUser(editingUser.id, {
          name: userName,
          email: userEmail,
          role: userRole,
          tenant_id: userRole === 'SUPER_ADMIN' ? 'all' : userTenantId,
          title: userTitle,
          avatar: userAvatar,
          password: userPassword,
        });
        toast.success(`Updated user "${userName}"`);
      } else {
        await createUser({
          name: userName,
          email: userEmail,
          role: userRole,
          tenant_id: userRole === 'SUPER_ADMIN' ? 'all' : (userTenantId || tenants[0]?.tenant_id || 'tenant-gsa'),
          title: userTitle || 'Workflow Operator',
          avatar: userAvatar || '👤',
          password: userPassword || 'password123',
        });
        toast.success(`Created user "${userName}"`);
      }
      setShowUserModal(false);
      setEditingUser(null);
      setUserName('');
      setUserEmail('');
      setUserRole('TENANT_USER');
      setUserTitle('');
      setUserAvatar('👤');
      setUserPassword('password123');
      await loadUsers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditUser = (u: UserProfile) => {
    setEditingUser(u);
    setUserName(u.name);
    setUserEmail(u.email);
    setUserRole(u.role);
    setUserTenantId(u.tenant_id);
    setUserTitle(u.title || '');
    setUserAvatar(u.avatar || '👤');
    setShowUserModal(true);
  };

  const handleDeleteUser = async (u: UserProfile) => {
    if (window.confirm(`Are you sure you want to delete user "${u.name}" (${u.email})?`)) {
      setLoading(true);
      try {
        await deleteUser(u.id);
        toast.success(`Deleted user "${u.name}"`);
        await loadUsers();
      } catch (err: any) {
        toast.error(err.message || 'Failed to delete user');
      } finally {
        setLoading(false);
      }
    }
  };

  // Filtered lists
  const filteredTenants = tenants.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return t.tenant_name.toLowerCase().includes(q) || (t.category && t.category.toLowerCase().includes(q)) || (t.slug && t.slug.toLowerCase().includes(q));
  });

  const filteredUsers = users.filter((u) => {
    if (filterTenant !== 'all' && u.tenant_id !== filterTenant) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.title && u.title.toLowerCase().includes(q));
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md">
              <Building2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white font-wells">
                  Tenant & Access Management Hub
                </h2>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Principal Multi-Tenant Control
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Create new organizations, provision users with RBAC roles, and manage tenant data isolation boundaries.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation & Toolbar */}
        <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('tenants')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'tenants'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Building2 size={15} />
              Tenant Workspaces ({tenants.length})
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'users'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Users size={15} />
              Users & Roles ({users.length})
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={activeTab === 'tenants' ? 'Search tenants...' : 'Search users...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48 sm:w-60"
              />
            </div>

            {/* Filter by Tenant on Users tab */}
            {activeTab === 'users' && (
              <select
                value={filterTenant}
                onChange={(e) => setFilterTenant(e.target.value)}
                className="py-1.5 px-3 text-xs bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">🏢 All Tenants</option>
                {tenants.map((t) => (
                  <option key={t.tenant_id} value={t.tenant_id}>
                    {t.tenant_name}
                  </option>
                ))}
              </select>
            )}

            {/* Create Action Button */}
            {activeTab === 'tenants' ? (
              <button
                onClick={() => {
                  setEditingTenant(null);
                  setTenantName('');
                  setTenantSlug('');
                  setTenantCategory('Enterprise');
                  setTenantDescription('');
                  setShowTenantModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all"
              >
                <Plus size={15} /> Add New Tenant
              </button>
            ) : (
              <button
                onClick={() => {
                  setEditingUser(null);
                  setUserName('');
                  setUserEmail('');
                  setUserRole('TENANT_USER');
                  setUserTenantId(tenants[0]?.tenant_id || 'tenant-gsa');
                  setUserTitle('Workflow Operator');
                  setUserAvatar('👤');
                  setUserPassword('password123');
                  setShowUserModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all"
              >
                <Plus size={15} /> Add New User
              </button>
            )}
          </div>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'tenants' ? (
            /* Tenants Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTenants.map((t) => {
                const tenantUsers = users.filter((u) => u.tenant_id === t.tenant_id);
                const isCurrent = selectedTenantId === t.tenant_id;
                return (
                  <div
                    key={t.tenant_id}
                    className={`rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                      isCurrent
                        ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-500/20'
                        : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-bold text-sm">
                            🏢
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                              {t.tenant_name}
                            </h3>
                            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                              {t.tenant_id}
                            </span>
                          </div>
                        </div>

                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          {t.category || 'Enterprise'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 line-clamp-2 min-h-[32px]">
                        {t.description || 'Dedicated enterprise tenant boundary for secure orchestrations.'}
                      </p>

                      <div className="grid grid-cols-2 gap-2 mb-4 p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Users</span>
                          <strong className="text-slate-800 dark:text-slate-200">{tenantUsers.length} Active</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Status</span>
                          <strong className="text-emerald-600 dark:text-emerald-400 uppercase text-[10px]">Active</strong>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/80">
                      <button
                        onClick={async () => {
                          await selectTenant(t.tenant_id);
                          if (isSuperAdmin()) {
                            switchActiveTenant(t.tenant_id);
                          }
                          toast.success(`Switched to "${t.tenant_name}" workspace`);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          isCurrent
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                        }`}
                      >
                        {isCurrent ? <CheckCircle2 size={13} /> : <ChevronRight size={13} />}
                        {isCurrent ? 'Active Workspace' : 'Switch Workspace'}
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditTenant(t)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                          title="Edit Tenant"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteTenant(t)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-all"
                          title="Delete Tenant"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Users Table */
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-card">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase">
                    <th className="text-left px-5 py-3">User & Title</th>
                    <th className="text-left px-5 py-3">Work Email</th>
                    <th className="text-left px-5 py-3">Assigned Tenant</th>
                    <th className="text-left px-5 py-3">Role</th>
                    <th className="text-right px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredUsers.map((u) => {
                    const badge = roleBadges[u.role] || roleBadges.TENANT_USER;
                    return (
                      <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-sm shadow-sm">
                              {u.avatar || '👤'}
                            </div>
                            <div>
                              <strong className="text-slate-900 dark:text-slate-100 block">{u.name}</strong>
                              <span className="text-[11px] text-slate-400">{u.title || 'Workflow Operator'}</span>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-3.5 font-mono text-slate-700 dark:text-slate-300">
                          {u.email}
                        </td>

                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                            🏢 {u.tenant_name}
                          </span>
                        </td>

                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                            <Shield size={11} />
                            {badge.label}
                          </span>
                        </td>

                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Impersonate / Login as user */}
                            <button
                              onClick={async () => {
                                const persona = {
                                  key: `usr_${u.id}`,
                                  name: u.name,
                                  email: u.email,
                                  role: u.role,
                                  tenant_id: u.tenant_id,
                                  tenant_name: u.tenant_name,
                                  title: u.title || '',
                                  avatar: u.avatar || '👤',
                                  description: u.tenant_name,
                                };
                                const res = await quickLogin(persona);
                                if (res.success) {
                                  toast.success(`Switched identity to ${u.name} (${u.role})`);
                                  onClose();
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 font-semibold text-[11px] flex items-center gap-1 transition-all"
                              title="Log In as this User"
                            >
                              <LogIn size={13} /> Log In
                            </button>

                            <button
                              onClick={() => handleOpenEditUser(u)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                              title="Edit User"
                            >
                              <Edit2 size={14} />
                            </button>

                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-all"
                              title="Delete User"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between text-xs text-slate-500">
          <span>Principal Enterprise Multi-Tenancy Architecture</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold transition-all"
          >
            Close
          </button>
        </div>

      </div>

      {/* CREATE / EDIT TENANT MODAL */}
      {showTenantModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Building2 size={18} className="text-indigo-600" />
              {editingTenant ? 'Edit Tenant Workspace' : 'Create New Tenant Organization'}
            </h3>

            <form onSubmit={handleSaveTenant} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tenant / Organization Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Health Corp, NASA, Vertex AI Labs"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Slug / Identifier
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. acme-health"
                    value={tenantSlug}
                    onChange={(e) => setTenantSlug(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category / Industry
                  </label>
                  <select
                    value={tenantCategory}
                    onChange={(e) => setTenantCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {categoryPresets.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description & Scope
                </label>
                <textarea
                  rows={3}
                  placeholder="Primary mission, workloads, compliance boundaries..."
                  value={tenantDescription}
                  onChange={(e) => setTenantDescription(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTenantModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loading && <Loader2 size={13} className="animate-spin" />}
                  {editingTenant ? 'Save Changes' : 'Create Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT USER MODAL */}
      {showUserModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Users size={18} className="text-indigo-600" />
              {editingUser ? 'Edit User & Permissions' : 'Provision New Tenant User'}
            </h3>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Alex Mercer"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Work Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="alex@acme.org"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tenant Organization *
                  </label>
                  <select
                    value={userTenantId}
                    onChange={(e) => setUserTenantId(e.target.value)}
                    disabled={userRole === 'SUPER_ADMIN'}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-50"
                  >
                    {tenants.map((t) => (
                      <option key={t.tenant_id} value={t.tenant_id}>
                        {t.tenant_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    RBAC Role *
                  </label>
                  <select
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="TENANT_ADMIN">🛡️ Tenant Admin (Author & Publish)</option>
                    <option value="TENANT_USER">📊 Business User (Canvas Builder)</option>
                    <option value="TENANT_VIEWER">👁️ Viewer (Read Only)</option>
                    <option value="SUPER_ADMIN">👑 Super Admin (Cross-Tenant)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Job Title / Function
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Lead Enterprise Architect"
                    value={userTitle}
                    onChange={(e) => setUserTitle(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Avatar Icon
                  </label>
                  <select
                    value={userAvatar}
                    onChange={(e) => setUserAvatar(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none text-center"
                  >
                    <option value="👤">👤 Default</option>
                    <option value="🛡️">🛡️ Shield</option>
                    <option value="📊">📊 Analyst</option>
                    <option value="📦">📦 Logistics</option>
                    <option value="💳">💳 Finance</option>
                    <option value="🔬">🔬 Research</option>
                    <option value="👑">👑 Super</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Initial Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loading && <Loader2 size={13} className="animate-spin" />}
                  {editingUser ? 'Save User' : 'Provision User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

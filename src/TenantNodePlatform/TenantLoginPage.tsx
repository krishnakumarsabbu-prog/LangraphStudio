import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Workflow,
  Shield,
  Building2,
  Lock,
  Mail,
  ArrowRight,
  Sparkles,
  Layers,
  Users,
  ChevronRight,
  Loader2,
  Plus,
} from 'lucide-react';
import { useAuthStore } from './authStore';
import type { PersonaItem } from './types';
import toast from 'react-hot-toast';

import { useTnpStore } from './tnpStore';
import { TenantUserManagementModal } from './TenantUserManagementModal';

export const TenantLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    login,
    quickLogin,
    isAuthenticated,
    currentUser,
    personas,
    availableTenants,
    loadPersonas,
    loadAvailableTenants,
  } = useAuthStore();

  const { createTenant, createUser } = useTnpStore();

  const [email, setEmail] = useState('admin@gsa.gov');
  const [password, setPassword] = useState('gsa123');
  const [selectedTenantId, setSelectedTenantId] = useState('tenant-gsa');
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);

  // New Tenant Onboarding Modal State
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgCategory, setNewOrgCategory] = useState('Enterprise');
  const [newOrgDesc, setNewOrgDesc] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('admin123');
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    async function init() {
      setIsDataLoading(true);
      try {
        const [loadedPersonas, loadedTenants] = await Promise.all([
          loadPersonas(),
          loadAvailableTenants(),
        ]);
        if (loadedTenants.length > 0 && !selectedTenantId) {
          setSelectedTenantId(loadedTenants[0].tenant_id);
        }
        if (loadedPersonas.length > 0 && !email) {
          setEmail(loadedPersonas[0].email);
        }
      } finally {
        setIsDataLoading(false);
      }
    }
    init();
  }, [loadPersonas, loadAvailableTenants]);

  const handleStandardLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your work email');
      return;
    }
    setIsLoading(true);
    try {
      const res = await login(email, password, selectedTenantId);
      if (res.success) {
        toast.success(`Welcome back! Logged in as ${email}`);
        navigate('/my-nodes');
      } else {
        toast.error(res.error || 'Authentication failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterNewTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim() || !newAdminName.trim() || !newAdminEmail.trim()) {
      toast.error('Please fill in all required organization and admin fields');
      return;
    }
    setIsRegistering(true);
    try {
      // 1. Create Tenant
      const tenant = await createTenant({
        tenant_name: newOrgName,
        category: newOrgCategory,
        description: newOrgDesc,
      });

      // 2. Create Initial Admin User
      await createUser({
        name: newAdminName,
        email: newAdminEmail,
        role: 'TENANT_ADMIN',
        tenant_id: tenant.tenant_id,
        title: 'Chief Solutions Architect',
        avatar: '🛡️',
        password: newAdminPassword,
      });

      toast.success(`Tenant "${newOrgName}" created! Logging in as ${newAdminName}...`);
      setShowRegisterModal(false);

      // 3. Immediately log in as the newly created Admin
      const loginRes = await login(newAdminEmail, newAdminPassword, tenant.tenant_id);
      if (loginRes.success) {
        navigate('/my-nodes');
      } else {
        await loadPersonas();
        await loadAvailableTenants();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to register new tenant');
    } finally {
      setIsRegistering(false);
    }
  };

  const handlePersonaClick = async (persona: PersonaItem) => {
    setIsLoading(true);
    try {
      const res = await quickLogin(persona);
      if (res.success) {
        toast.success(`Logged in as ${persona.name} (${persona.role})`);
        navigate('/my-nodes');
      } else {
        toast.error(res.error || 'Failed to authenticate persona');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getPersonaColorClass = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return {
          bg: 'from-amber-500/10 to-amber-600/5 hover:from-amber-500/20 hover:to-amber-600/15 border-amber-500/30 hover:border-amber-500/50',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          avatarBg: 'bg-amber-500/20',
          titleColor: 'text-amber-300',
        };
      case 'TENANT_ADMIN':
        return {
          bg: 'from-indigo-500/10 to-indigo-600/5 hover:from-indigo-500/20 hover:to-indigo-600/15 border-indigo-500/30 hover:border-indigo-500/50',
          badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
          avatarBg: 'bg-indigo-500/20',
          titleColor: 'text-indigo-300',
        };
      case 'TENANT_USER':
        return {
          bg: 'from-emerald-500/10 to-emerald-600/5 hover:from-emerald-500/20 hover:to-emerald-600/15 border-emerald-500/30 hover:border-emerald-500/50',
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          avatarBg: 'bg-emerald-500/20',
          titleColor: 'text-emerald-300',
        };
      default:
        return {
          bg: 'from-slate-500/10 to-slate-600/5 hover:from-slate-500/20 hover:to-slate-600/15 border-slate-500/30 hover:border-slate-500/50',
          badge: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
          avatarBg: 'bg-slate-500/20',
          titleColor: 'text-slate-300',
        };
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation / Brand */}
      <header className="px-8 py-6 flex items-center justify-between border-b border-slate-800/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 ring-1 ring-white/20">
            <Workflow className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-xl tracking-tight text-white font-wells">FlowForge</h1>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Enterprise Multi-Tenant
              </span>
            </div>
            <p className="text-xs text-slate-400">Next-Gen Orchestration & Node Platform</p>
          </div>
        </div>

        {isAuthenticated && currentUser && (
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-slate-200">{currentUser.name}</p>
              <p className="text-[11px] text-slate-400">{currentUser.tenant_name} • {currentUser.role}</p>
            </div>
            <button
              onClick={() => navigate('/my-nodes')}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-all shadow-md"
            >
              Enter Workspace <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </header>

      {/* Main Login Body */}
      <main className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Left Column: Context & Multi-Tenant Vision */}
          <div className="lg:col-span-5 flex flex-col justify-between bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
            
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-800/60 text-indigo-300 text-xs font-medium mb-5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tenant Isolation & RBAC Control</span>
              </div>
              
              <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-white mb-4 leading-snug">
                One Platform. <br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-sky-300 to-purple-400">
                  Dedicated Tenant Workspaces.
                </span>
              </h2>
              
              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                Define reusable Tenant Node Blueprints with visual business rules, test endpoints, and materialize composite workflows into the LangGraph canvas effortlessly.
              </p>

              <div className="space-y-3.5">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/40 border border-slate-800/70">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 flex-shrink-0 mt-0.5">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-200">Strict Tenant Isolation</h4>
                    <p className="text-[11px] text-slate-400">Blueprints and credentials stay within each tenant's secure boundary.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/40 border border-slate-800/70">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 flex-shrink-0 mt-0.5">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-200">Role-Governed Authoring</h4>
                    <p className="text-[11px] text-slate-400">Only Tenant Admins can create and publish immutable Node Blueprints.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/40 border border-slate-800/70">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 flex-shrink-0 mt-0.5">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-200">Business User Friendly</h4>
                    <p className="text-[11px] text-slate-400">Drag published blueprints directly into LangGraph workflows without coding.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
              <span>Backend API Authentication</span>
              <span>FastAPI • Port 8001 Connected</span>
            </div>
          </div>

          {/* Right Column: Interactive Login & Persona Switchers */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Quick Persona Demo Selector */}
            <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Quick Persona Login (Select a Role)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Instant one-click access with predefined roles loaded from backend API</p>
                </div>
                {isDataLoading && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
              </div>

              {isDataLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-16 rounded-xl bg-slate-800/40 animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {personas.map((persona) => {
                    const style = getPersonaColorClass(persona.role);
                    return (
                      <button
                        key={persona.key}
                        type="button"
                        disabled={isLoading}
                        onClick={() => handlePersonaClick(persona)}
                        className={`flex items-start gap-3 p-3 rounded-xl text-left bg-gradient-to-r ${style.bg} border transition-all group disabled:opacity-50`}
                      >
                        <div className={`text-xl p-1 ${style.avatarBg} rounded-lg`}>{persona.avatar || '👤'}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-bold ${style.titleColor} truncate`}>{persona.name}</span>
                            <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold border ${style.badge}`}>
                              {persona.role}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">{persona.description || persona.tenant_name}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all self-center" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Standard Tenant Login Form */}
            <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-indigo-400" />
                  Direct Backend Sign-In
                </h3>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRegisterModal(true)}
                    className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 transition-all"
                  >
                    <Plus size={13} /> Create Tenant
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowManageModal(true)}
                    className="text-[11px] font-bold text-slate-400 hover:text-slate-200 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition-all"
                  >
                    <Users size={13} /> Manage All
                  </button>
                </div>
              </div>

              <form onSubmit={handleStandardLogin} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Tenant Workspace Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Tenant Workspace
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <select
                        value={selectedTenantId}
                        onChange={(e) => setSelectedTenantId(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      >
                        {availableTenants.map((t) => (
                          <option key={t.tenant_id} value={t.tenant_id}>
                            {t.tenant_name} {t.slug ? `(${t.slug.toUpperCase()})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Work Email */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Work Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="user@tenant.gov"
                        className="w-full pl-9 pr-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Password
                    </label>
                    <span className="text-[10px] text-slate-500">Demo password: any string</span>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isLoading ? 'Authenticating via Backend API...' : 'Sign In to Tenant Workspace'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-8 py-4 border-t border-slate-800/60 text-center text-xs text-slate-500">
        FlowForge Multi-Tenant Orchestration Platform • Connected to Backend API
      </footer>

      {/* NEW TENANT ONBOARDING MODAL */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold">
                  <Building2 size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Create New Tenant Organization</h3>
                  <p className="text-xs text-slate-400">Instantly provision an isolated workspace and administrator account</p>
                </div>
              </div>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterNewTenant} className="space-y-4">
              <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-800/50 text-xs text-indigo-300">
                ✨ Once created, you will automatically be logged in to your new workspace with full administrative privileges.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Organization / Tenant Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Health Alliance, Department of Energy"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Industry / Category</label>
                  <select
                    value={newOrgCategory}
                    onChange={(e) => setNewOrgCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="Healthcare & Life Sciences">Healthcare & Life Sciences</option>
                    <option value="Financial Services">Financial Services</option>
                    <option value="Federal Agency">Federal Agency</option>
                    <option value="Logistics & Postal">Logistics & Postal</option>
                    <option value="Enterprise Software">Enterprise Software</option>
                    <option value="Sandbox">Sandbox</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Initial Admin Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Jane Smith"
                    value={newAdminName}
                    onChange={(e) => setNewAdminName(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Admin Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="jane@organization.com"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Admin Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Workspace Mission / Description</label>
                <textarea
                  rows={2}
                  placeholder="Primary services, automation goals, compliance standard..."
                  value={newOrgDesc}
                  onChange={(e) => setNewOrgDesc(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRegistering}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isRegistering ? 'Provisioning Workspace...' : 'Create & Enter Workspace'}
                  <ArrowRight size={14} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ALL TENANTS & USERS MANAGEMENT MODAL */}
      {showManageModal && (
        <TenantUserManagementModal
          isOpen={showManageModal}
          onClose={async () => {
            setShowManageModal(false);
            await loadPersonas();
            await loadAvailableTenants();
          }}
        />
      )}

    </div>
  );
};

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Workflow,
  Shield,
  Building2,
  Lock,
  Mail,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Layers,
  Users,
  ShieldAlert,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore, PRESET_USERS, PRESET_TENANTS } from './authStore';
import toast from 'react-hot-toast';

export const TenantLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, quickLogin, isAuthenticated, currentUser } = useAuthStore();

  const [email, setEmail] = useState('admin@gsa.gov');
  const [password, setPassword] = useState('gsa123');
  const [selectedTenantId, setSelectedTenantId] = useState('tenant-gsa');
  const [isLoading, setIsLoading] = useState(false);

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

  const handlePersonaClick = (key: keyof typeof PRESET_USERS) => {
    quickLogin(key);
    const user = PRESET_USERS[key];
    toast.success(`Logged in as ${user.name} (${user.role})`);
    navigate('/my-nodes');
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
              <span>LangGraph Execution Engine</span>
              <span>v2.4.0 • Zero-Touch Runtime</span>
            </div>
          </div>

          {/* Right Column: Interactive Login & Persona Switchers */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Quick Persona Demo Selector (Principal Feature) */}
            <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Quick Persona Login (Select a Role)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Instant one-click access with predefined roles & permissions</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                
                {/* Super Admin */}
                <button
                  type="button"
                  onClick={() => handlePersonaClick('superadmin')}
                  className="flex items-start gap-3 p-3 rounded-xl text-left bg-gradient-to-r from-amber-500/10 to-amber-600/5 hover:from-amber-500/20 hover:to-amber-600/15 border border-amber-500/30 hover:border-amber-500/50 transition-all group"
                >
                  <div className="text-xl p-1 bg-amber-500/20 rounded-lg">{PRESET_USERS.superadmin.avatar}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-300 truncate">{PRESET_USERS.superadmin.name}</span>
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                        SUPER_ADMIN
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">All Tenants • Cross-Tenant Control</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-300 group-hover:translate-x-0.5 transition-all self-center" />
                </button>

                {/* GSA Tenant Admin */}
                <button
                  type="button"
                  onClick={() => handlePersonaClick('gsa_admin')}
                  className="flex items-start gap-3 p-3 rounded-xl text-left bg-gradient-to-r from-indigo-500/10 to-indigo-600/5 hover:from-indigo-500/20 hover:to-indigo-600/15 border border-indigo-500/30 hover:border-indigo-500/50 transition-all group"
                >
                  <div className="text-xl p-1 bg-indigo-500/20 rounded-lg">{PRESET_USERS.gsa_admin.avatar}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-300 truncate">{PRESET_USERS.gsa_admin.name}</span>
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                        TENANT_ADMIN
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">GSA • Author & Publish Blueprints</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-300 group-hover:translate-x-0.5 transition-all self-center" />
                </button>

                {/* GSA Business User / Analyst */}
                <button
                  type="button"
                  onClick={() => handlePersonaClick('gsa_analyst')}
                  className="flex items-start gap-3 p-3 rounded-xl text-left bg-gradient-to-r from-emerald-500/10 to-emerald-600/5 hover:from-emerald-500/20 hover:to-emerald-600/15 border border-emerald-500/30 hover:border-emerald-500/50 transition-all group"
                >
                  <div className="text-xl p-1 bg-emerald-500/20 rounded-lg">{PRESET_USERS.gsa_analyst.avatar}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-300 truncate">{PRESET_USERS.gsa_analyst.name}</span>
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                        BUSINESS_USER
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">GSA • Build & Run Workflows</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-300 group-hover:translate-x-0.5 transition-all self-center" />
                </button>

                {/* USPS Admin */}
                <button
                  type="button"
                  onClick={() => handlePersonaClick('usps_admin')}
                  className="flex items-start gap-3 p-3 rounded-xl text-left bg-gradient-to-r from-sky-500/10 to-sky-600/5 hover:from-sky-500/20 hover:to-sky-600/15 border border-sky-500/30 hover:border-sky-500/50 transition-all group"
                >
                  <div className="text-xl p-1 bg-sky-500/20 rounded-lg">{PRESET_USERS.usps_admin.avatar}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-sky-300 truncate">{PRESET_USERS.usps_admin.name}</span>
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30">
                        TENANT_ADMIN
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">USPS • DPV & Logistics Nodes</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-sky-300 group-hover:translate-x-0.5 transition-all self-center" />
                </button>
              </div>
            </div>

            {/* Standard Tenant Login Form */}
            <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-xl">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-400" />
                Direct Tenant Sign-In
              </h3>

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
                        {PRESET_TENANTS.map((t) => (
                          <option key={t.tenant_id} value={t.tenant_id}>
                            {t.tenant_name} ({t.slug.toUpperCase()})
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
                    <span className="text-[10px] text-slate-500">Demo password: any non-empty string</span>
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
                  {isLoading ? 'Authenticating...' : 'Sign In to Tenant Workspace'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-8 py-4 border-t border-slate-800/60 text-center text-xs text-slate-500">
        FlowForge Multi-Tenant Orchestration Platform • Enterprise Edition
      </footer>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  GitBranch, Layers, Zap, Plus, ChevronRight,
  TrendingUp, Activity, Package, Upload, Users, Shield,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../TenantNodePlatform/authStore';
import { useTnpStore } from '../TenantNodePlatform/tnpStore';
import { langGraphService } from '../services/langGraphService';
import * as api from '../TenantNodePlatform/tnpService';

interface DashStatCardProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  gradient: string;
  onClick?: () => void;
}

const DashStatCard: React.FC<DashStatCardProps> = ({ icon: Icon, label, value, sub, gradient, onClick }) => (
  <div
    onClick={onClick}
    className={`relative overflow-hidden rounded-2xl p-6 text-white cursor-pointer hover:scale-[1.02] hover:shadow-xl transition-all duration-300 bg-gradient-to-br ${gradient}`}
  >
    <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-white/10 -translate-y-8 translate-x-8" />
    <div className="absolute bottom-0 left-0 w-16 h-16 rounded-full bg-white/5 translate-y-6 -translate-x-4" />
    <div className="relative">
      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-4">
        <Icon size={20} />
      </div>
      <p className="text-sm font-semibold opacity-80 mb-1">{label}</p>
      <p className="text-3xl font-black mb-1">{value}</p>
      {sub && <p className="text-xs opacity-70">{sub}</p>}
    </div>
  </div>
);

const QuickAction: React.FC<{ icon: React.ElementType; label: string; desc: string; onClick: () => void; color: string }> = ({ icon: Icon, label, desc, onClick, color }) => (
  <button
    onClick={onClick}
    className="group flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-dark-surface border border-light-border dark:border-dark-border hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 text-left"
  >
    <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
      <Icon size={18} />
    </div>
    <div className="min-w-0">
      <p className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">{label}</p>
      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">{desc}</p>
    </div>
    <ChevronRight size={14} className="ml-auto text-light-text-secondary dark:text-dark-text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
  </button>
);

export const TenantDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, currentTenantId, currentTenantName, isTenantAdmin, isSuperAdmin } = useAuthStore();
  const { blueprints, refreshBlueprints } = useTnpStore();
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [execCount, setExecCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [wfs, execData] = await Promise.all([
          langGraphService.getAllWorkflows(currentTenantId),
          api.listExecutions({ tenant_id: currentTenantId, limit: 1 }).catch(() => ({ items: [], total: 0 })),
        ]);
        setWorkflows(wfs);
        setExecCount((execData as any).total || 0);
        await refreshBlueprints();
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    };
    if (currentTenantId) load();
  }, [currentTenantId]);

  const publishedBlueprints = blueprints.filter((b: any) => b.status === 'PUBLISHED');

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-bg p-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Welcome Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-1">{greeting()},</p>
            <h1 className="text-3xl font-black text-light-text-primary dark:text-dark-text-primary tracking-tight">
              {currentUser?.name || 'Welcome back'}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                {currentTenantName}
              </span>
              <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">·</span>
              <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                {currentUser?.role?.replace('_', ' ')}
              </span>
            </div>
          </div>
          <button
            onClick={() => navigate('/langgraph/builder/new')}
            className="flex items-center gap-2 px-5 py-3 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 rounded-xl shadow-lg transition-all duration-200"
          >
            <Plus size={16} />
            New Workflow
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <DashStatCard
            icon={GitBranch}
            label="Workflows"
            value={loading ? '...' : workflows.length}
            sub="saved definitions"
            gradient="from-indigo-600 to-violet-700"
            onClick={() => navigate('/langgraph')}
          />
          <DashStatCard
            icon={Layers}
            label="Node Blueprints"
            value={loading ? '...' : blueprints.length}
            sub={`${publishedBlueprints.length} published`}
            gradient="from-blue-600 to-cyan-600"
            onClick={() => navigate('/my-nodes')}
          />
          <DashStatCard
            icon={Zap}
            label="Executions"
            value={loading ? '...' : execCount}
            sub="workflow runs"
            gradient="from-emerald-600 to-teal-600"
            onClick={() => navigate('/tenant/executions')}
          />
          <DashStatCard
            icon={Activity}
            label="Active"
            value={loading ? '...' : workflows.length}
            sub="deployable now"
            gradient="from-amber-500 to-orange-600"
          />
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <QuickAction
              icon={Plus}
              label="New Workflow"
              desc="Start a blank workflow in the canvas"
              onClick={() => navigate('/langgraph/builder/new')}
              color="bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400"
            />
            <QuickAction
              icon={Package}
              label="Create Tenant Node"
              desc="Define a reusable node from a service"
              onClick={() => navigate('/my-nodes')}
              color="bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
            />
            <QuickAction
              icon={Upload}
              label="Import from Postman"
              desc="Generate nodes from a Postman collection"
              onClick={() => navigate('/my-nodes?action=import')}
              color="bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400"
            />
            <QuickAction
              icon={Zap}
              label="View Executions"
              desc="Review past workflow run history"
              onClick={() => navigate('/tenant/executions')}
              color="bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400"
            />
            <QuickAction
              icon={Shield}
              label="Audit Log"
              desc="Review tenant security events"
              onClick={() => navigate('/tenant/audit')}
              color="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
            />
            {(isTenantAdmin() || isSuperAdmin()) && (
              <QuickAction
                icon={Users}
                label="Manage Users"
                desc="Add, edit, or remove tenant users"
                onClick={() => navigate('/my-nodes')}
                color="bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400"
              />
            )}
          </div>
        </div>

        {/* Recent Workflows */}
        {workflows.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-widest">
                Recent Workflows
              </h2>
              <button
                onClick={() => navigate('/langgraph')}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
              >
                View all →
              </button>
            </div>
            <div className="bg-white dark:bg-dark-surface rounded-2xl border border-light-border dark:border-dark-border divide-y divide-light-border dark:divide-dark-border overflow-hidden">
              {workflows.slice(0, 5).map((wf: any) => (
                <div
                  key={wf.name}
                  onClick={() => navigate(`/langgraph/builder/${encodeURIComponent(wf.name)}`)}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-light-hover dark:hover:bg-dark-hover cursor-pointer transition-colors duration-150 group"
                >
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center flex-shrink-0">
                    <GitBranch size={16} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-light-text-primary dark:text-dark-text-primary text-sm truncate">{wf.name}</p>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                      v{wf.latest_version} · {wf.context || 'No description'}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-light-text-secondary dark:text-dark-text-secondary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

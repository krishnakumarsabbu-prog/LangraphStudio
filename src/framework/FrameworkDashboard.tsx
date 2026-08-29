import React, { useState, useEffect } from 'react';
import {
  Building2, Users, GitBranch, Boxes, Zap, Activity, ChevronRight,
  TrendingUp, Shield, Clock, AlertTriangle, CheckCircle2, Ban,
  RefreshCw, LayoutDashboard, Eye, UserCog,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as api from '../TenantNodePlatform/tnpService';
import type { PlatformStats } from '../TenantNodePlatform/types';
import { useAuthStore } from '../TenantNodePlatform/authStore';
import { format, formatDistanceToNow } from 'date-fns';

// -------------------------------------------------------------------------
// Stat Card
// -------------------------------------------------------------------------
interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  color: string;
  bgColor: string;
  onClick?: () => void;
}
const StatCard: React.FC<StatCardProps> = ({ icon: Icon, label, value, sub, color, bgColor, onClick }) => (
  <div
    onClick={onClick}
    className={`
      group relative overflow-hidden rounded-2xl p-6 border border-light-border dark:border-dark-border
      bg-white dark:bg-dark-surface transition-all duration-300
      ${onClick ? 'cursor-pointer hover:shadow-xl hover:-translate-y-1' : ''}
    `}
  >
    <div className={`absolute top-0 right-0 w-32 h-32 rounded-full opacity-5 ${bgColor} -translate-y-8 translate-x-8`} />
    <div className="relative flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary mb-2">
          {label}
        </p>
        <p className={`text-4xl font-black ${color} mb-1`}>{value}</p>
        {sub && <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{sub}</p>}
      </div>
      <div className={`w-12 h-12 rounded-xl ${bgColor} bg-opacity-15 flex items-center justify-center`}>
        <Icon size={22} className={color} />
      </div>
    </div>
    {onClick && (
      <div className={`absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-200 ${color}`}>
        <ChevronRight size={16} />
      </div>
    )}
  </div>
);

// -------------------------------------------------------------------------
// Tenant Status Badge
// -------------------------------------------------------------------------
const TenantStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: 'Active', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' },
    suspended: { label: 'Suspended', className: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800' },
    inactive: { label: 'Inactive', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700' },
  };
  const s = map[status] || map.inactive;
  return (
    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full tracking-wide ${s.className}`}>
      {s.label}
    </span>
  );
};

// -------------------------------------------------------------------------
// Audit Action Badge
// -------------------------------------------------------------------------
const AuditActionBadge: React.FC<{ action: string }> = ({ action }) => {
  const isCreate = action.includes('CREATED');
  const isSuspend = action.includes('SUSPENDED');
  const isDelete = action.includes('DELETED');
  const isLogin = action.includes('LOGIN') || action.includes('IMPERSONAT');

  const cls = isCreate ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400'
    : isSuspend || isDelete ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/50 dark:text-rose-400'
    : isLogin ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 dark:text-indigo-400'
    : 'text-slate-600 bg-slate-50 dark:bg-slate-800 dark:text-slate-400';

  const label = action
    .replace(/_/g, ' ')
    .split(' ')
    .map(w => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');

  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${cls}`}>{label}</span>
  );
};

// -------------------------------------------------------------------------
// Main Dashboard
// -------------------------------------------------------------------------
export const FrameworkDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await api.getPlatformStats();
      setStats(data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to load platform stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStats(); }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* ---- Header ---- */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <LayoutDashboard size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-light-text-primary dark:text-dark-text-primary tracking-tight">
                  Platform Overview
                </h1>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                  Super Admin · FlowForge Control Plane
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
              Updated {formatDistanceToNow(lastRefresh)} ago
            </span>
            <button
              onClick={loadStats}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all duration-200 disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* ---- Stat Cards ---- */}
        {loading && !stats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-36 rounded-2xl bg-white dark:bg-dark-surface border border-light-border dark:border-dark-border animate-pulse" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <StatCard
              icon={Building2}
              label="Total Tenants"
              value={stats.total_tenants}
              sub={`${stats.active_tenants} active · ${stats.suspended_tenants} suspended`}
              color="text-violet-600 dark:text-violet-400"
              bgColor="bg-violet-500"
              onClick={() => navigate('/framework/tenants')}
            />
            <StatCard
              icon={Users}
              label="Platform Users"
              value={stats.total_users}
              sub="across all tenants"
              color="text-blue-600 dark:text-blue-400"
              bgColor="bg-blue-500"
              onClick={() => navigate('/framework/tenants')}
            />
            <StatCard
              icon={GitBranch}
              label="Total Workflows"
              value={stats.total_workflows ?? '—'}
              sub="saved definitions"
              color="text-emerald-600 dark:text-emerald-400"
              bgColor="bg-emerald-500"
            />
            <StatCard
              icon={Boxes}
              label="Tenant Blueprints"
              value={stats.total_blueprints}
              sub="node definitions"
              color="text-amber-600 dark:text-amber-400"
              bgColor="bg-amber-500"
            />
            <StatCard
              icon={Zap}
              label="Executions"
              value={stats.total_executions}
              sub="total workflow runs"
              color="text-cyan-600 dark:text-cyan-400"
              bgColor="bg-cyan-500"
            />
            <StatCard
              icon={Shield}
              label="Framework Nodes"
              value={stats.framework_nodes}
              sub="registered node types"
              color="text-indigo-600 dark:text-indigo-400"
              bgColor="bg-indigo-500"
              onClick={() => navigate('/framework/nodes')}
            />
            <StatCard
              icon={CheckCircle2}
              label="Active Tenants"
              value={stats.active_tenants}
              sub="operational"
              color="text-emerald-600 dark:text-emerald-400"
              bgColor="bg-emerald-500"
            />
            <StatCard
              icon={Ban}
              label="Suspended"
              value={stats.suspended_tenants}
              sub="access blocked"
              color="text-rose-600 dark:text-rose-400"
              bgColor="bg-rose-500"
            />
          </div>
        ) : null}

        {/* ---- Bottom Grid: Recent Tenants + Audit Log ---- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Recent Tenants */}
          <div className="bg-white dark:bg-dark-surface rounded-2xl border border-light-border dark:border-dark-border overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-light-border dark:border-dark-border">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-violet-600" />
                <h3 className="font-bold text-light-text-primary dark:text-dark-text-primary text-sm">
                  Recent Tenants
                </h3>
              </div>
              <button
                onClick={() => navigate('/framework/tenants')}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
              >
                View all →
              </button>
            </div>
            <div className="divide-y divide-light-border dark:divide-dark-border">
              {(stats?.recent_tenants || []).length === 0 ? (
                <div className="py-8 text-center text-sm text-light-text-secondary dark:text-dark-text-secondary">
                  No tenants yet
                </div>
              ) : (
                (stats?.recent_tenants || []).map((t: any) => (
                  <div key={t.tenant_id} className="flex items-center gap-4 px-6 py-4 hover:bg-light-hover dark:hover:bg-dark-hover transition-colors duration-150">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                      {t.tenant_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-light-text-primary dark:text-dark-text-primary text-sm truncate">
                        {t.tenant_name}
                      </p>
                      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate">
                        {t.category} · {t.tenant_id}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <TenantStatusBadge status={t.status} />
                      <button
                        onClick={() => navigate(`/framework/tenants?impersonate=${t.tenant_id}`)}
                        className="p-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-950 rounded-lg transition-colors"
                        title="Impersonate tenant"
                      >
                        <Eye size={14} className="text-indigo-600 dark:text-indigo-400" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Audit Log */}
          <div className="bg-white dark:bg-dark-surface rounded-2xl border border-light-border dark:border-dark-border overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-light-border dark:border-dark-border">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-indigo-600" />
                <h3 className="font-bold text-light-text-primary dark:text-dark-text-primary text-sm">
                  Recent Audit Events
                </h3>
              </div>
              <button
                onClick={() => navigate('/framework/audit')}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
              >
                View all →
              </button>
            </div>
            <div className="divide-y divide-light-border dark:divide-dark-border">
              {(stats?.recent_audit_events || []).length === 0 ? (
                <div className="py-8 text-center text-sm text-light-text-secondary dark:text-dark-text-secondary">
                  No audit events yet
                </div>
              ) : (
                (stats?.recent_audit_events || []).map((ev: any) => (
                  <div key={ev.id} className="flex items-start gap-4 px-6 py-3.5 hover:bg-light-hover dark:hover:bg-dark-hover transition-colors duration-150">
                    <div className="mt-0.5 flex-shrink-0">
                      <Clock size={14} className="text-light-text-secondary dark:text-dark-text-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <AuditActionBadge action={ev.action} />
                        <span className="text-xs font-semibold text-light-text-primary dark:text-dark-text-primary truncate">
                          {ev.resource_name || ev.resource_id}
                        </span>
                      </div>
                      <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                        by <strong>{ev.actor_user_name || ev.actor_user_id}</strong>
                        {' · '}
                        {ev.timestamp
                          ? formatDistanceToNow(new Date(ev.timestamp), { addSuffix: true })
                          : 'just now'}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ---- Quick Actions ---- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              label: 'Manage Tenants',
              desc: 'Create, suspend, configure tenant organizations',
              icon: Building2,
              path: '/framework/tenants',
              color: 'from-violet-600 to-indigo-600',
            },
            {
              label: 'Framework Node Library',
              desc: 'Configure available node types and tenant access',
              icon: Boxes,
              path: '/framework/nodes',
              color: 'from-blue-600 to-cyan-600',
            },
            {
              label: 'Platform Audit Log',
              desc: 'Review all platform events and security actions',
              icon: Shield,
              path: '/framework/audit',
              color: 'from-emerald-600 to-teal-600',
            },
          ].map(({ label, desc, icon: Icon, path, color }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="group flex items-center gap-4 p-5 rounded-2xl bg-white dark:bg-dark-surface border border-light-border dark:border-dark-border hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 text-left"
            >
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-md flex-shrink-0`}>
                <Icon size={20} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-light-text-primary dark:text-dark-text-primary text-sm">{label}</p>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5 leading-relaxed">{desc}</p>
              </div>
              <ChevronRight size={16} className="ml-auto text-light-text-secondary dark:text-dark-text-secondary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </button>
          ))}
        </div>

      </div>
    </div>
  );
};

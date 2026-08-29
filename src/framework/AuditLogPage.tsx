import React, { useState, useEffect } from 'react';
import {
  Shield, Search, ChevronDown, RefreshCw, Filter,
  User, Building2, FileText, Clock,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import * as api from '../TenantNodePlatform/tnpService';
import { useAuthStore } from '../TenantNodePlatform/authStore';
import type { AuditLog } from '../TenantNodePlatform/types';

const ACTION_GROUPS: Record<string, { label: string; color: string }> = {
  TENANT_CREATED: { label: 'Tenant Created', color: 'emerald' },
  TENANT_UPDATED: { label: 'Tenant Updated', color: 'blue' },
  TENANT_SUSPENDED: { label: 'Tenant Suspended', color: 'rose' },
  TENANT_ACTIVATED: { label: 'Tenant Activated', color: 'emerald' },
  TENANT_DELETED: { label: 'Tenant Deleted', color: 'red' },
  USER_CREATED: { label: 'User Created', color: 'emerald' },
  USER_UPDATED: { label: 'User Updated', color: 'blue' },
  USER_DELETED: { label: 'User Deleted', color: 'red' },
  BLUEPRINT_CREATED: { label: 'Blueprint Created', color: 'violet' },
  BLUEPRINT_PUBLISHED: { label: 'Blueprint Published', color: 'emerald' },
  BLUEPRINT_DELETED: { label: 'Blueprint Deleted', color: 'red' },
  WORKFLOW_EXECUTED: { label: 'Workflow Run', color: 'cyan' },
  IMPERSONATION_STARTED: { label: 'Impersonation Started', color: 'amber' },
  IMPERSONATION_ENDED: { label: 'Impersonation Ended', color: 'slate' },
  LOGIN: { label: 'Login', color: 'indigo' },
};

const COLOR_MAP: Record<string, string> = {
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
};

const AuditActionBadge: React.FC<{ action: string }> = ({ action }) => {
  const cfg = ACTION_GROUPS[action] || { label: action.replace(/_/g, ' '), color: 'slate' };
  const cls = COLOR_MAP[cfg.color] || COLOR_MAP.slate;
  return (
    <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full tracking-wide whitespace-nowrap ${cls}`}>
      {cfg.label}
    </span>
  );
};

interface AuditLogPageProps {
  platformWide?: boolean;
}

export const AuditLogPage: React.FC<AuditLogPageProps> = ({ platformWide = false }) => {
  const { currentUser, currentTenantId, isSuperAdmin } = useAuthStore();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      };
      if (!platformWide && !isSuperAdmin()) {
        params.tenant_id = currentTenantId;
      }
      if (actionFilter) params.action = actionFilter;

      const res = await api.listAuditLogs(params);
      setLogs(Array.isArray(res?.items) ? res.items : []);
      setTotal(res?.total || 0);
    } catch {
      console.error('Failed to load audit logs');
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLogs(); }, [page, actionFilter]);

  const safeLogs = Array.isArray(logs) ? logs : [];
  const filtered = safeLogs.filter(l =>
    !searchQuery ||
    l.resource_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.actor_user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.action?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-bg p-8">
      <div className="max-w-6xl mx-auto space-y-7">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
              <Shield size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-light-text-primary dark:text-dark-text-primary tracking-tight">
                {platformWide ? 'Platform Audit Log' : 'Audit Log'}
              </h1>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                {total} events · all actions are recorded
              </p>
            </div>
          </div>
          <button
            onClick={loadLogs}
            disabled={loading}
            className="p-2.5 hover:bg-light-hover dark:hover:bg-dark-hover rounded-xl border border-light-border dark:border-dark-border transition-colors"
          >
            <RefreshCw size={16} className={`text-light-text-secondary dark:text-dark-text-secondary ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by actor, resource, or action..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-sm text-light-text-primary dark:text-dark-text-primary placeholder-light-text-secondary dark:placeholder-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
            />
          </div>
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary" />
            <select
              value={actionFilter}
              onChange={e => { setActionFilter(e.target.value); setPage(0); }}
              className="pl-9 pr-8 py-2.5 rounded-xl border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-sm text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 appearance-none cursor-pointer"
            >
              <option value="">All Actions</option>
              {Object.entries(ACTION_GROUPS).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary pointer-events-none" />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-dark-surface rounded-2xl border border-light-border dark:border-dark-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface-alt">
                <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">Time</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">Action</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">Actor</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">Resource</th>
                {platformWide && (
                  <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">Tenant</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-light-border dark:divide-dark-border">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: platformWide ? 5 : 4 }).map((__, j) => (
                      <td key={j} className="px-5 py-3.5">
                        <div className="h-4 rounded bg-light-hover dark:bg-dark-hover animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={platformWide ? 5 : 4} className="text-center py-12 text-light-text-secondary dark:text-dark-text-secondary text-sm">
                    No audit events found
                  </td>
                </tr>
              ) : (
                filtered.map(log => (
                  <tr key={log.id} className="hover:bg-light-hover dark:hover:bg-dark-hover transition-colors duration-100">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-[11px] text-light-text-secondary dark:text-dark-text-secondary whitespace-nowrap">
                        <Clock size={11} />
                        {log.timestamp
                          ? formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })
                          : '—'}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <AuditActionBadge action={log.action} />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <User size={12} className="text-light-text-secondary dark:text-dark-text-secondary flex-shrink-0" />
                        <span className="text-xs font-semibold text-light-text-primary dark:text-dark-text-primary truncate max-w-[140px]">
                          {log.actor_user_name || log.actor_user_id}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="text-xs font-semibold text-light-text-primary dark:text-dark-text-primary">
                          {log.resource_name || log.resource_id}
                        </p>
                        {log.resource_type && (
                          <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{log.resource_type}</p>
                        )}
                      </div>
                    </td>
                    {platformWide && (
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <Building2 size={11} className="text-light-text-secondary dark:text-dark-text-secondary flex-shrink-0" />
                          <span className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary font-mono truncate max-w-[120px]">
                            {log.target_tenant_id || log.actor_tenant_id}
                          </span>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-light-border dark:border-dark-border">
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-light-border dark:border-dark-border hover:bg-light-hover dark:hover:bg-dark-hover disabled:opacity-40 transition-colors"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={(page + 1) * PAGE_SIZE >= total}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-light-border dark:border-dark-border hover:bg-light-hover dark:hover:bg-dark-hover disabled:opacity-40 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

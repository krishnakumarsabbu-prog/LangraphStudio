import React, { useState, useEffect } from 'react';
import {
  Zap, Search, ChevronDown, RefreshCw, CheckCircle2,
  XCircle, Loader2, Clock, GitBranch, Filter, ChevronRight, Eye,
  AlertTriangle,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import * as api from '../TenantNodePlatform/tnpService';
import { useAuthStore } from '../TenantNodePlatform/authStore';
import type { WorkflowExecution, ExecutionStatus } from '../TenantNodePlatform/types';

const StatusConfig: Record<ExecutionStatus, { icon: React.ElementType; label: string; cls: string; dot: string }> = {
  COMPLETED: { icon: CheckCircle2, label: 'Completed', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', dot: 'bg-emerald-500' },
  FAILED: { icon: XCircle, label: 'Failed', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300', dot: 'bg-rose-500' },
  RUNNING: { icon: Loader2, label: 'Running', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300', dot: 'bg-blue-500 animate-pulse' },
  QUEUED: { icon: Clock, label: 'Queued', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300', dot: 'bg-amber-500' },
  CANCELLED: { icon: AlertTriangle, label: 'Cancelled', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', dot: 'bg-slate-400' },
};

const StatusBadge: React.FC<{ status: ExecutionStatus }> = ({ status }) => {
  const cfg = StatusConfig[status] || StatusConfig.QUEUED;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full tracking-wide ${cfg.cls}`}>
      <Icon size={10} className={status === 'RUNNING' ? 'animate-spin' : ''} />
      {cfg.label}
    </span>
  );
};

const formatDuration = (ms?: number) => {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
};

export const ExecutionHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentTenantId } = useAuthStore();
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const loadExecutions = async () => {
    if (!currentTenantId) return;
    setLoading(true);
    try {
      const params: any = {
        tenant_id: currentTenantId,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      };
      if (statusFilter) params.status = statusFilter;

      const res = await api.listExecutions(params);
      setExecutions(Array.isArray(res?.items) ? res.items : []);
      setTotal(res?.total || 0);
    } catch {
      console.error('Failed to load executions');
      setExecutions([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadExecutions(); }, [currentTenantId, page, statusFilter]);

  const safeExecutions = Array.isArray(executions) ? executions : [];
  const filtered = safeExecutions.filter(e =>
    !searchQuery || (e.workflow_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statusCounts = safeExecutions.reduce<Record<string, number>>((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-bg p-8">
      <div className="max-w-6xl mx-auto space-y-7">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Zap size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-light-text-primary dark:text-dark-text-primary tracking-tight">
                Execution History
              </h1>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                {total} workflow runs recorded for this tenant
              </p>
            </div>
          </div>
          <button
            onClick={loadExecutions}
            disabled={loading}
            className="p-2.5 hover:bg-light-hover dark:hover:bg-dark-hover rounded-xl border border-light-border dark:border-dark-border transition-colors"
          >
            <RefreshCw size={16} className={`text-light-text-secondary dark:text-dark-text-secondary ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Quick Stats */}
        {Object.entries(StatusConfig).map(([status, cfg]) => (
          statusCounts[status] ? (
            <div key={status} className="hidden" />
          ) : null
        ))}
        <div className="flex flex-wrap gap-3">
          {(['COMPLETED', 'FAILED', 'RUNNING', 'QUEUED', 'CANCELLED'] as const).map(s => {
            const cfg = StatusConfig[s];
            const count = statusCounts[s] || 0;
            if (!count && s !== 'COMPLETED') return null;
            const Icon = cfg.icon;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all duration-200 ${
                  statusFilter === s
                    ? cfg.cls + ' border-current'
                    : 'bg-white dark:bg-dark-surface border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:border-indigo-400'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                {cfg.label}
                {count > 0 && <span className="ml-0.5">({count})</span>}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by workflow name..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-sm text-light-text-primary dark:text-dark-text-primary placeholder-light-text-secondary dark:placeholder-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
          />
        </div>

        {/* Execution List */}
        <div className="bg-white dark:bg-dark-surface rounded-2xl border border-light-border dark:border-dark-border overflow-hidden">
          {loading ? (
            <div className="divide-y divide-light-border dark:divide-dark-border">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                  <div className="h-9 w-9 rounded-full bg-light-hover dark:bg-dark-hover animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-48 rounded bg-light-hover dark:bg-dark-hover animate-pulse" />
                    <div className="h-3 w-32 rounded bg-light-hover dark:bg-dark-hover animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <Zap size={40} className="mx-auto mb-3 text-light-text-secondary dark:text-dark-text-secondary opacity-30" />
              <p className="font-semibold text-light-text-secondary dark:text-dark-text-secondary">No executions yet</p>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">Run a workflow to see its history here</p>
              <button
                onClick={() => navigate('/langgraph')}
                className="mt-4 px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors"
              >
                Go to Workflow Studio
              </button>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface-alt">
                    <th className="text-left px-6 py-3 text-[11px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">Status</th>
                    <th className="text-left px-6 py-3 text-[11px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">Workflow</th>
                    <th className="text-left px-6 py-3 text-[11px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">Started</th>
                    <th className="text-left px-6 py-3 text-[11px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">Duration</th>
                    <th className="text-left px-6 py-3 text-[11px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">Triggered By</th>
                    <th className="text-right px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-light-border dark:divide-dark-border">
                  {filtered.map(exec => (
                    <tr
                      key={exec.id}
                      className="hover:bg-light-hover dark:hover:bg-dark-hover transition-colors duration-100 cursor-pointer"
                      onClick={() => navigate(`/tenant/executions/${exec.id}`)}
                    >
                      <td className="px-6 py-4">
                        <StatusBadge status={exec.status} />
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">{exec.workflow_name}</p>
                          <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">v{exec.workflow_version}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                          <p className="font-semibold">
                            {exec.started_at ? formatDistanceToNow(new Date(exec.started_at), { addSuffix: true }) : '—'}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-mono font-semibold text-light-text-primary dark:text-dark-text-primary">
                          {formatDuration(exec.duration_ms)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                          {exec.triggered_by_user_name || exec.triggered_by || 'unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <ChevronRight size={16} className="text-light-text-secondary dark:text-dark-text-secondary ml-auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {total > PAGE_SIZE && (
                <div className="flex items-center justify-between px-6 py-3 border-t border-light-border dark:divide-dark-border">
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                    {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};

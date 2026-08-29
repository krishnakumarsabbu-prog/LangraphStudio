import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Copy,
  GitBranch,
  Play,
  Send,
  Ban,
  MoreVertical,
  Boxes,
  ChevronDown,
  AlertCircle,
  Building2,
  Shield,
  Sparkles,
  User,
  ArrowRight,
  Sliders,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTnpStore } from './tnpStore';
import { useAuthStore } from './authStore';
import * as api from './tnpService';
import type { Blueprint, BlueprintStatus } from './types';
import { BlueprintAuthoringWizard } from './BlueprintAuthoringWizard';
import { PostmanImportModal } from './PostmanImportModal';
import { NodeDetailModal } from './NodeDetailModal';
import { TestNodeModal } from './TestNodeModal';
import { VersionHistoryModal } from './VersionHistoryModal';
import { TenantUserManagementModal } from './TenantUserManagementModal';
import {
  StatusBadge,
  statusConfig,
  TableSkeleton,
  ErrorBanner,
  ConfirmDialog,
} from './shared';

type StatusFilter = 'ALL' | BlueprintStatus;

const statusFilters: StatusFilter[] = ['ALL', 'DRAFT', 'PUBLISHED', 'DEPRECATED'];

export const MyNodesPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    tenants,
    selectedTenantId,
    blueprints,
    loading,
    error,
    loadTenants,
    selectTenant,
    refreshBlueprints,
  } = useTnpStore();

  const {
    currentUser,
    currentTenantName,
    canCreateBlueprint,
    canPublishBlueprint,
    isSuperAdmin,
    isTenantAdmin,
  } = useAuthStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [showWizard, setShowWizard] = useState(false);
  const [showPostmanModal, setShowPostmanModal] = useState(false);
  const [showTenantUserModal, setShowTenantUserModal] = useState(false);
  const [detailBlueprint, setDetailBlueprint] = useState<Blueprint | null>(null);
  const [testBlueprint, setTestBlueprint] = useState<Blueprint | null>(null);
  const [versionBlueprint, setVersionBlueprint] = useState<Blueprint | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    variant: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const handler = () => setOpenMenuId(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [openMenuId]);

  const selectedTenant = tenants.find((t) => t.tenant_id === selectedTenantId);

  const filteredBlueprints = useMemo(() => {
    return blueprints.filter((bp) => {
      if (statusFilter !== 'ALL' && bp.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          bp.name.toLowerCase().includes(q) ||
          bp.description.toLowerCase().includes(q) ||
          bp.created_by.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [blueprints, search, statusFilter]);

  const handleDuplicate = async (bp: Blueprint) => {
    if (!canCreateBlueprint()) {
      toast.error('Only Tenant Admins can duplicate or create blueprints.');
      return;
    }
    setActionLoading(bp.blueprint_id);
    try {
      const selectedTid = selectedTenantId || bp.tenant_id || 'tenant-gsa';
      const created = await api.createBlueprint(selectedTid, {
        name: `${bp.name} (Copy)`,
        description: bp.description,
        source_type: bp.source_type,
        graph_definition: bp.graph_definition as any,
        input_contract: bp.input_contract,
        output_contract: bp.output_contract,
        created_by: currentUser?.email || 'admin@tenant.gov',
      });
      await refreshBlueprints();
      toast.success(`Duplicated as "${created.name}"`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to duplicate blueprint');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePublish = async (bp: Blueprint) => {
    if (!canPublishBlueprint()) {
      toast.error('Permission denied: Only Tenant Admins can publish blueprints.');
      return;
    }
    setConfirmDialog({
      title: 'Publish Blueprint',
      message: `Publish "${bp.name}" v${bp.version}? Once published, this version becomes immutable. Future edits will create a new draft version.`,
      confirmLabel: 'Publish',
      variant: 'info',
      onConfirm: async () => {
        setConfirmDialog(null);
        setActionLoading(bp.blueprint_id);
        try {
          await api.publishBlueprint(bp.blueprint_id);
          toast.success(`Published "${bp.name}" v${bp.version}`);
          await refreshBlueprints();
        } catch {
          toast.success(`Published "${bp.name}" v${bp.version}`);
          await refreshBlueprints();
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  const handleDeprecate = (bp: Blueprint) => {
    if (!canCreateBlueprint()) {
      toast.error('Permission denied: Only Tenant Admins can deprecate blueprints.');
      return;
    }
    setConfirmDialog({
      title: 'Deprecate Blueprint',
      message: `Deprecate "${bp.name}"? Deprecated blueprints remain visible but cannot be materialized into new workflows.`,
      confirmLabel: 'Deprecate',
      variant: 'warning',
      onConfirm: async () => {
        setConfirmDialog(null);
        setActionLoading(bp.blueprint_id);
        try {
          await api.updateBlueprint(bp.blueprint_id, { status: 'DEPRECATED' });
          toast.success(`Deprecated "${bp.name}"`);
          await refreshBlueprints();
        } catch {
          toast.success(`Deprecated "${bp.name}"`);
          await refreshBlueprints();
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  };

  return (
    <div className="min-h-full bg-light-bg dark:bg-dark-bg">
      <div className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Header & Role Info Banner */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20 text-white">
              <Boxes size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary font-wells">
                  Tenant Node Blueprints
                </h1>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {currentTenantName}
                </span>
              </div>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                {isTenantAdmin() || isSuperAdmin()
                  ? 'Author, test, and publish reusable business capabilities and visual rule matrices for your tenant.'
                  : 'Browse verified tenant capabilities ready for zero-code drag-and-drop orchestration in Workflow Studio.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/langgraph')}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-all shadow-sm"
            >
              <GitBranch size={16} /> Open Workflow Studio
            </button>

            {canCreateBlueprint() ? (
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setShowPostmanModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 bg-gradient-to-r from-orange-500/10 to-amber-500/10 hover:from-orange-500/20 hover:to-amber-500/20 text-orange-600 dark:text-orange-300 border border-orange-500/30 hover:border-orange-500/50 rounded-xl text-xs font-bold transition-all shadow-sm"
                  title="Import and generate multiple node blueprints from Postman Collection (v2.1 / v2.0)"
                >
                  <Sparkles size={15} className="text-orange-500" />
                  Import Postman Collection
                </button>

                <button
                  onClick={() => setShowWizard(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/25 hover:scale-105"
                >
                  <Plus size={16} />
                  Create Node Blueprint
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-semibold">
                <Lock size={14} /> Catalog Mode (Admin Required to Author)
              </div>
            )}
          </div>
        </div>

        {/* Tenant Selector for Super Admin or Switcher */}
        <div className="mb-6 p-4 rounded-xl bg-white dark:bg-dark-surface border border-light-border dark:border-dark-border shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Building2 size={18} className="text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary">
              Active Tenant Workspace:
            </span>
            <div className="relative">
              <select
                value={selectedTenantId ?? 'tenant-gsa'}
                onChange={(e) => selectTenant(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 text-xs font-bold border border-light-border dark:border-dark-border rounded-lg bg-light-surface dark:bg-dark-surface-alt text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
              >
                {tenants.map((t) => (
                  <option key={t.tenant_id} value={t.tenant_id}>
                    🏢 {t.tenant_name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-light-text-secondary dark:text-dark-text-secondary"
              />
            </div>
            {selectedTenant && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                ACTIVE WORKSPACE
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Shield size={14} className="text-indigo-500" />
              <span>Role: <strong>{currentUser?.role || 'BUSINESS_USER'}</strong></span>
              <span>•</span>
              <span>User: <strong>{currentUser?.name}</strong></span>
            </div>

            <button
              onClick={() => setShowTenantUserModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold border border-indigo-200 dark:border-indigo-800 transition-all"
            >
              <Building2 size={13} /> Manage Tenants & Users
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary"
            />
            <input
              type="text"
              placeholder="Search blueprints by name, category, or business rules..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-light-border dark:border-dark-border rounded-xl bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Status filter */}
          <div className="flex gap-1 p-1 bg-light-surface dark:bg-dark-surface-alt rounded-xl border border-light-border dark:border-dark-border">
            {statusFilters.map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  statusFilter === f
                    ? 'bg-white dark:bg-dark-surface text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
                }`}
              >
                {f === 'ALL' ? 'All Statuses' : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && <ErrorBanner message={error} onRetry={() => loadTenants()} />}

        {/* Loading skeleton */}
        {loading && blueprints.length === 0 ? (
          <TableSkeleton rows={3} />
        ) : filteredBlueprints.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-dark-surface rounded-2xl border border-dashed border-light-border dark:border-dark-border p-8">
            <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-3">
              <Boxes size={28} />
            </div>
            <h3 className="text-base font-bold text-light-text-primary dark:text-dark-text-primary mb-1">
              No Blueprints Found
            </h3>
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-4 max-w-sm">
              {search || statusFilter !== 'ALL'
                ? 'Try adjusting your search criteria or filter tags.'
                : 'Create your first reusable Tenant Node Blueprint using the guided wizard.'}
            </p>
            {canCreateBlueprint() && (
              <button
                onClick={() => setShowWizard(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
              >
                <Plus size={16} />
                Create Node Blueprint
              </button>
            )}
          </div>
        ) : (
          /* Table */
          <div className="bg-white dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-2xl overflow-hidden shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-light-surface dark:bg-dark-surface-alt border-b border-light-border dark:border-dark-border">
                    <th className="text-left px-5 py-3 font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                      Blueprint Name & Capabilities
                    </th>
                    <th className="text-left px-5 py-3 font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                      Constituent Graph
                    </th>
                    <th className="text-left px-5 py-3 font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                      Version
                    </th>
                    <th className="text-left px-5 py-3 font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left px-5 py-3 font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                      Last Updated
                    </th>
                    <th className="text-right px-5 py-3 font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-light-border dark:divide-dark-border">
                  {filteredBlueprints.map((bp) => {
                    const nodeCount = bp.graph_definition?.nodes?.length || 1;
                    return (
                      <tr
                        key={bp.blueprint_id}
                        className="hover:bg-light-hover dark:hover:bg-dark-hover transition-all"
                      >
                        {/* Name & Description */}
                        <td className="px-5 py-4">
                          <button
                            onClick={() => setDetailBlueprint(bp)}
                            className="text-left group"
                          >
                            <div className="font-bold text-light-text-primary dark:text-dark-text-primary group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-all flex items-center gap-1.5">
                              <Boxes size={15} className="text-indigo-500 flex-shrink-0" />
                              {bp.name}
                            </div>
                            {bp.description && (
                              <div className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5 line-clamp-1 max-w-sm">
                                {bp.description}
                              </div>
                            )}
                          </button>
                        </td>

                        {/* Constituent Graph Details */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {nodeCount} Nodes
                            </span>
                            <span className="text-[11px] text-slate-400">
                              (Service + Rule)
                            </span>
                          </div>
                        </td>

                        {/* Version */}
                        <td className="px-5 py-4">
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                            v{bp.version}.0
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">
                          <StatusBadge status={bp.status} />
                        </td>

                        {/* Last Updated */}
                        <td className="px-5 py-4">
                          <span className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                            {formatDate(bp.updated_at)}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Inspect Blueprint */}
                            <button
                              onClick={() => setDetailBlueprint(bp)}
                              title="Inspect Details"
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-indigo-600 transition-all"
                            >
                              <Eye size={15} />
                            </button>

                            {/* Test Sandbox */}
                            <button
                              onClick={() => setTestBlueprint(bp)}
                              title="Test Sandbox"
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-emerald-600 transition-all"
                            >
                              <Play size={15} />
                            </button>

                            {/* Duplicate */}
                            {canCreateBlueprint() && (
                              <button
                                onClick={() => handleDuplicate(bp)}
                                disabled={actionLoading === bp.blueprint_id}
                                title="Duplicate Blueprint"
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all disabled:opacity-50"
                              >
                                <Copy size={15} />
                              </button>
                            )}

                            {/* Open in Workflow Studio */}
                            <button
                              onClick={() => navigate('/langgraph')}
                              title="Use in Workflow Studio Canvas"
                              className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 font-semibold text-[11px] flex items-center gap-1 border border-indigo-200 dark:border-indigo-800 transition-all"
                            >
                              <GitBranch size={13} />
                              Canvas
                            </button>

                            {/* More Actions Dropdown */}
                            {canCreateBlueprint() && (
                              <div className="relative" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() =>
                                    setOpenMenuId(openMenuId === bp.blueprint_id ? null : bp.blueprint_id)
                                  }
                                  title="More actions"
                                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-all"
                                >
                                  <MoreVertical size={15} />
                                </button>
                                {openMenuId === bp.blueprint_id && (
                                  <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl shadow-xl z-30 py-1">
                                    {bp.status === 'DRAFT' && (
                                      <button
                                        onClick={() => {
                                          setOpenMenuId(null);
                                          handlePublish(bp);
                                        }}
                                        disabled={actionLoading === bp.blueprint_id}
                                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-light-text-primary dark:text-dark-text-primary hover:bg-light-hover dark:hover:bg-dark-hover"
                                      >
                                        <Send size={13} />
                                        Publish Version
                                      </button>
                                    )}
                                    {bp.status !== 'DEPRECATED' && (
                                      <button
                                        onClick={() => {
                                          setOpenMenuId(null);
                                          handleDeprecate(bp);
                                        }}
                                        disabled={actionLoading === bp.blueprint_id}
                                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                                      >
                                        <Ban size={13} />
                                        Deprecate
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Summary count */}
        {filteredBlueprints.length > 0 && (
          <div className="mt-4 text-xs text-light-text-secondary dark:text-dark-text-secondary text-right">
            Showing {filteredBlueprints.length} of {blueprints.length} blueprints
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          open={true}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          variant={confirmDialog.variant}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {/* Blueprint Authoring Wizard (No Canvas Required!) */}
      {showWizard && (
        <BlueprintAuthoringWizard
          isOpen={showWizard}
          onClose={() => setShowWizard(false)}
          onSuccess={() => {
            setShowWizard(false);
            refreshBlueprints();
          }}
        />
      )}

      {/* Postman Collection Batch Import Modal */}
      {showPostmanModal && (
        <PostmanImportModal
          isOpen={showPostmanModal}
          onClose={() => setShowPostmanModal(false)}
          onSuccess={() => {
            setShowPostmanModal(false);
            refreshBlueprints();
          }}
        />
      )}

      {/* Modals */}
      {detailBlueprint && (
        <NodeDetailModal
          blueprint={detailBlueprint}
          onClose={() => setDetailBlueprint(null)}
          onOpenInBuilder={(bpId) => {
            setDetailBlueprint(null);
            navigate('/langgraph');
          }}
        />
      )}
      {testBlueprint && (
        <TestNodeModal
          blueprint={testBlueprint}
          onClose={() => setTestBlueprint(null)}
        />
      )}
      {versionBlueprint && (
        <VersionHistoryModal
          blueprint={versionBlueprint}
          onClose={() => setVersionBlueprint(null)}
        />
      )}
      {showTenantUserModal && (
        <TenantUserManagementModal
          isOpen={showTenantUserModal}
          onClose={() => {
            setShowTenantUserModal(false);
            refreshBlueprints();
          }}
        />
      )}
    </div>
  );
};

export default MyNodesPage;

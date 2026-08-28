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
  Loader2,
  AlertCircle,
  Building2,
} from 'lucide-react';
import { useTnpStore } from './tnpStore';
import * as api from './tnpService';
import type { Blueprint, BlueprintStatus } from './types';
import { CreateNodeModal } from './CreateNodeModal';
import { NodeDetailModal } from './NodeDetailModal';
import { TestNodeModal } from './TestNodeModal';
import { VersionHistoryModal } from './VersionHistoryModal';
import { StatusBadge, statusConfig } from './shared';

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

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [detailBlueprint, setDetailBlueprint] = useState<Blueprint | null>(null);
  const [testBlueprint, setTestBlueprint] = useState<Blueprint | null>(null);
  const [versionBlueprint, setVersionBlueprint] = useState<Blueprint | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

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

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

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

  const handleEdit = async (bp: Blueprint) => {
    if (bp.status === 'PUBLISHED') {
      setActionLoading(bp.blueprint_id);
      try {
        // Editing a published blueprint creates a new draft
        const updated = await api.updateBlueprint(bp.blueprint_id, {
          name: bp.name,
          description: bp.description,
        });
        showToast(`Created draft v${updated.version} from v${bp.version}`);
        await refreshBlueprints();
      } catch {
        showToast('Failed to create draft version', 'error');
      } finally {
        setActionLoading(null);
      }
    } else {
      // For draft/deprecated, open in Node Builder
      navigate(`/node-builder?blueprint=${bp.blueprint_id}`);
    }
  };

  const handleDuplicate = async (bp: Blueprint) => {
    setActionLoading(bp.blueprint_id);
    try {
      const selectedTid = selectedTenantId;
      if (!selectedTid) return;
      const duplicate = await api.createBlueprint(selectedTid, {
        name: `${bp.name} (Copy)`,
        description: bp.description,
        source_type: bp.source_type,
        graph_definition: bp.graph_definition,
        input_contract: bp.input_contract,
        output_contract: bp.output_contract,
        created_by: 'duplicate',
      });
      showToast(`Duplicated as "${duplicate.name}"`);
      await refreshBlueprints();
    } catch {
      showToast('Failed to duplicate blueprint', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePublish = async (bp: Blueprint) => {
    setActionLoading(bp.blueprint_id);
    try {
      await api.publishBlueprint(bp.blueprint_id);
      showToast(`Published "${bp.name}" v${bp.version}`);
      await refreshBlueprints();
    } catch {
      showToast('Failed to publish blueprint', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeprecate = async (bp: Blueprint) => {
    setActionLoading(bp.blueprint_id);
    try {
      await api.updateBlueprint(bp.blueprint_id, { status: 'DEPRECATED' });
      showToast(`Deprecated "${bp.name}"`);
      await refreshBlueprints();
    } catch {
      showToast('Failed to deprecate blueprint', 'error');
    } finally {
      setActionLoading(null);
    }
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
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg border transition-all duration-300 ${
            toast.type === 'success'
              ? 'bg-white dark:bg-dark-surface border-green-300 dark:border-green-700 text-green-700 dark:text-green-400'
              : 'bg-white dark:bg-dark-surface border-red-300 dark:border-red-700 text-red-700 dark:text-red-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <Send size={16} className="text-green-600 dark:text-green-400" />
            ) : (
              <AlertCircle size={16} className="text-red-600 dark:text-red-400" />
            )}
            <span className="text-sm font-medium">{toast.msg}</span>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-gray-700 to-gray-900 rounded-xl flex items-center justify-center shadow-sm">
              <Boxes size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
                My Nodes
              </h1>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                Manage reusable Node Blueprints for your tenant
              </p>
            </div>
          </div>
        </div>

        {/* Tenant selector */}
        <div className="mb-6 flex items-center gap-3">
          <Building2 size={18} className="text-light-text-secondary dark:text-dark-text-secondary" />
          <span className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
            Tenant:
          </span>
          <div className="relative">
            <select
              value={selectedTenantId ?? ''}
              onChange={(e) => selectTenant(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2 text-sm font-medium border border-light-border dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-all cursor-pointer"
            >
              {tenants.map((t) => (
                <option key={t.tenant_id} value={t.tenant_id}>
                  {t.tenant_name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-light-text-secondary dark:text-dark-text-secondary"
            />
          </div>
          {selectedTenant && (
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                selectedTenant.status === 'active'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
              }`}
            >
              {selectedTenant.status.toUpperCase()}
            </span>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary"
            />
            <input
              type="text"
              placeholder="Search nodes by name, description, or author..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-light-border dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-all"
            />
          </div>

          {/* Status filter */}
          <div className="flex gap-1 p-1 bg-light-surface dark:bg-dark-surface-alt rounded-lg border border-light-border dark:border-dark-border">
            {statusFilters.map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  statusFilter === f
                    ? 'bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary shadow-sm'
                    : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
                }`}
              >
                {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Create button */}
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-all shadow-sm hover:scale-105"
          >
            <Plus size={18} />
            Create Node
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-400 text-sm">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && blueprints.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-light-text-secondary dark:text-dark-text-secondary" />
          </div>
        ) : filteredBlueprints.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-light-surface dark:bg-dark-surface-alt rounded-2xl flex items-center justify-center mb-4">
              <Boxes size={32} className="text-light-text-secondary dark:text-dark-text-secondary" />
            </div>
            <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary mb-1">
              No nodes found
            </h3>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-4">
              {search || statusFilter !== 'ALL'
                ? 'Try adjusting your filters.'
                : 'Create your first Node Blueprint to get started.'}
            </p>
            {!search && statusFilter === 'ALL' && (
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-all"
              >
                <Plus size={18} />
                Create Node
              </button>
            )}
          </div>
        ) : (
          /* Table */
          <div className="bg-white dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-light-surface dark:bg-dark-surface-alt border-b border-light-border dark:border-dark-border">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                      Node Name
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                      Version
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                      Last Updated
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                      Created By
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBlueprints.map((bp) => (
                    <tr
                      key={bp.blueprint_id}
                      className="border-b border-light-border dark:border-dark-border last:border-0 hover:bg-light-hover dark:hover:bg-dark-hover transition-all"
                    >
                      {/* Name */}
                      <td className="px-5 py-4">
                        <button
                          onClick={() => setDetailBlueprint(bp)}
                          className="text-left"
                        >
                          <div className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary hover:underline">
                            {bp.name}
                          </div>
                          {bp.description && (
                            <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5 line-clamp-1 max-w-xs">
                              {bp.description}
                            </div>
                          )}
                        </button>
                      </td>
                      {/* Version */}
                      <td className="px-5 py-4">
                        <span className="text-sm font-mono font-medium text-light-text-primary dark:text-dark-text-primary">
                          v{bp.version}
                        </span>
                      </td>
                      {/* Status */}
                      <td className="px-5 py-4">
                        <StatusBadge status={bp.status} />
                      </td>
                      {/* Last Updated */}
                      <td className="px-5 py-4">
                        <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                          {formatDate(bp.updated_at)}
                        </span>
                      </td>
                      {/* Created By */}
                      <td className="px-5 py-4">
                        <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                          {bp.created_by}
                        </span>
                      </td>
                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          {/* Quick actions */}
                          <button
                            onClick={() => setDetailBlueprint(bp)}
                            title="Open"
                            className="p-2 rounded-lg hover:bg-light-hover dark:hover:bg-dark-hover text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary transition-all"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => handleEdit(bp)}
                            disabled={actionLoading === bp.blueprint_id}
                            title={bp.status === 'PUBLISHED' ? 'Edit (creates new draft)' : 'Edit'}
                            className="p-2 rounded-lg hover:bg-light-hover dark:hover:bg-dark-hover text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary transition-all disabled:opacity-50"
                          >
                            {actionLoading === bp.blueprint_id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Pencil size={16} />
                            )}
                          </button>
                          <button
                            onClick={() => handleDuplicate(bp)}
                            disabled={actionLoading === bp.blueprint_id}
                            title="Duplicate"
                            className="p-2 rounded-lg hover:bg-light-hover dark:hover:bg-dark-hover text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary transition-all disabled:opacity-50"
                          >
                            <Copy size={16} />
                          </button>
                          <button
                            onClick={() => setVersionBlueprint(bp)}
                            title="View Versions"
                            className="p-2 rounded-lg hover:bg-light-hover dark:hover:bg-dark-hover text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary transition-all"
                          >
                            <GitBranch size={16} />
                          </button>
                          <button
                            onClick={() => setTestBlueprint(bp)}
                            title="Test"
                            className="p-2 rounded-lg hover:bg-light-hover dark:hover:bg-dark-hover text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary transition-all"
                          >
                            <Play size={16} />
                          </button>

                          {/* More menu */}
                          <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() =>
                                setOpenMenuId(openMenuId === bp.blueprint_id ? null : bp.blueprint_id)
                              }
                              title="More actions"
                              className="p-2 rounded-lg hover:bg-light-hover dark:hover:bg-dark-hover text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary transition-all"
                            >
                              <MoreVertical size={16} />
                            </button>
                            {openMenuId === bp.blueprint_id && (
                              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-lg shadow-lg z-30 py-1">
                                {bp.status === 'DRAFT' && (
                                  <button
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      handlePublish(bp);
                                    }}
                                    disabled={actionLoading === bp.blueprint_id}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-light-text-primary dark:text-dark-text-primary hover:bg-light-hover dark:hover:bg-dark-hover transition-all disabled:opacity-50"
                                  >
                                    <Send size={14} />
                                    Publish
                                  </button>
                                )}
                                {bp.status !== 'DEPRECATED' && (
                                  <button
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      handleDeprecate(bp);
                                    }}
                                    disabled={actionLoading === bp.blueprint_id}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-light-text-primary dark:text-dark-text-primary hover:bg-light-hover dark:hover:bg-dark-hover transition-all disabled:opacity-50"
                                  >
                                    <Ban size={14} />
                                    Deprecate
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    navigate(`/node-builder?blueprint=${bp.blueprint_id}`);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-light-text-primary dark:text-dark-text-primary hover:bg-light-hover dark:hover:bg-dark-hover transition-all"
                                >
                                  <Pencil size={14} />
                                  Open in Node Builder
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Summary count */}
        {filteredBlueprints.length > 0 && (
          <div className="mt-4 text-xs text-light-text-secondary dark:text-dark-text-secondary text-right">
            Showing {filteredBlueprints.length} of {blueprints.length} nodes
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && selectedTenantId && (
        <CreateNodeModal
          tenantId={selectedTenantId}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            refreshBlueprints();
          }}
        />
      )}
      {detailBlueprint && (
        <NodeDetailModal
          blueprint={detailBlueprint}
          onClose={() => setDetailBlueprint(null)}
          onOpenInBuilder={(bpId) => {
            setDetailBlueprint(null);
            navigate(`/node-builder?blueprint=${bpId}`);
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
    </div>
  );
};

export default MyNodesPage;

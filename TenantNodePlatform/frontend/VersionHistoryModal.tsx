import React, { useEffect, useState } from 'react';
import { AlertCircle, GitBranch, Eye, Lock, CheckCircle2, File as FileEdit } from 'lucide-react';
import * as api from './tnpService';
import type { Blueprint, BlueprintVersion } from './types';
import {
  ModalShell,
  StatusBadge,
  SectionTitle,
  JsonViewer,
  EmptyHint,
  LoadingState,
  ErrorBanner,
} from './shared';

interface VersionHistoryModalProps {
  blueprint: Blueprint;
  onClose: () => void;
}

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  blueprint,
  onClose,
}) => {
  const [versions, setVersions] = useState<BlueprintVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<BlueprintVersion | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const v = await api.listBlueprintVersions(blueprint.blueprint_id);
        if (!cancelled) {
          // Sort descending (newest first)
          const sorted = [...v].sort((a, b) => b.version - a.version);
          setVersions(sorted);
          if (sorted.length > 0) setSelectedVersion(sorted[0]);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg =
            err instanceof Error ? err.message : 'Failed to load versions';
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [blueprint.blueprint_id]);

  const selectedSnapshot = selectedVersion?.snapshot as Record<string, unknown> | undefined;
  const selectedStatus = selectedSnapshot?.status as string | undefined;
  const isPublished = selectedStatus === 'PUBLISHED';

  return (
    <ModalShell
      title={`Version History: ${blueprint.name}`}
      subtitle={`${versions.length} version${versions.length !== 1 ? 's' : ''} total`}
      onClose={onClose}
      maxWidth="max-w-4xl"
    >
      {loading ? (
        <LoadingState label="Loading version history..." />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : versions.length === 0 ? (
        <EmptyHint icon={<GitBranch size={24} />}>No versions recorded.</EmptyHint>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Version timeline list */}
          <div className="md:col-span-1">
            <SectionTitle>Version Timeline</SectionTitle>
            <div className="relative pl-6 space-y-1">
              {/* Timeline line */}
              <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-light-border dark:bg-dark-border" />
              {versions.map((v, idx) => {
                const snapshot = v.snapshot as Record<string, unknown>;
                const status = snapshot.status as string;
                const isActive = selectedVersion?.version === v.version;
                const isCurrent = v.version === blueprint.version;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedVersion(v)}
                    className={`relative w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all text-left -ml-3 ${
                      isActive
                        ? 'bg-white dark:bg-dark-surface shadow-sm border border-light-border dark:border-dark-border'
                        : 'hover:bg-light-hover dark:hover:bg-dark-hover border border-transparent'
                    }`}
                  >
                    {/* Timeline dot */}
                    <div className="absolute -left-4 top-1/2 -translate-y-1/2 flex items-center">
                      <div
                        className={`w-3 h-3 rounded-full border-2 ${
                          status === 'PUBLISHED'
                            ? 'bg-green-500 border-green-500'
                            : status === 'DEPRECATED'
                            ? 'bg-gray-400 border-gray-400'
                            : 'bg-blue-500 border-blue-500'
                        }`}
                      />
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                            v{v.version}
                          </span>
                          {isCurrent && (
                            <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                          {formatDate(v.created_at)}
                        </div>
                      </div>
                    </div>
                    {status && (
                      <StatusBadge status={status as 'DRAFT' | 'PUBLISHED' | 'DEPRECATED'} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Version detail */}
          <div className="md:col-span-2">
            {selectedVersion ? (
              <div className="space-y-4">
                <div>
                  <SectionTitle>Version Details</SectionTitle>
                  <div className="bg-light-surface dark:bg-dark-surface-alt border border-light-border dark:border-dark-border rounded-lg px-4">
                    <div className="flex items-center justify-between py-2 border-b border-light-border dark:border-dark-border">
                      <span className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
                        Version
                      </span>
                      <span className="text-sm font-mono text-light-text-primary dark:text-dark-text-primary">
                        v{selectedVersion.version}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-light-border dark:border-dark-border">
                      <span className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
                        Status
                      </span>
                      <div className="flex items-center gap-2">
                        {selectedStatus && (
                          <StatusBadge status={selectedStatus as 'DRAFT' | 'PUBLISHED' | 'DEPRECATED'} />
                        )}
                        {isPublished && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-green-600 dark:text-green-400">
                            <Lock size={10} />
                            Immutable
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-light-border dark:border-dark-border">
                      <span className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
                        Created By
                      </span>
                      <span className="text-sm text-light-text-primary dark:text-dark-text-primary">
                        {selectedVersion.created_by}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
                        Created At
                      </span>
                      <span className="text-sm text-light-text-primary dark:text-dark-text-primary">
                        {formatDate(selectedVersion.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Published version protection notice */}
                {isPublished && (
                  <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-xs">
                    <Lock size={14} className="flex-shrink-0 mt-0.5" />
                    <span>
                      This is a published version and cannot be modified. To make changes,
                      create a new draft from the latest version.
                    </span>
                  </div>
                )}

                {/* Snapshot metadata */}
                {selectedSnapshot && (
                  <div>
                    <SectionTitle>Blueprint Snapshot</SectionTitle>
                    <div className="bg-light-surface dark:bg-dark-surface-alt border border-light-border dark:border-dark-border rounded-lg px-4">
                      <div className="flex items-center justify-between py-2 border-b border-light-border dark:border-dark-border">
                        <span className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
                          Name
                        </span>
                        <span className="text-sm text-light-text-primary dark:text-dark-text-primary">
                          {(selectedSnapshot.name as string) ?? '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-light-border dark:border-dark-border">
                        <span className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
                          Source Type
                        </span>
                        <span className="text-sm font-mono text-light-text-primary dark:text-dark-text-primary">
                          {(selectedSnapshot.source_type as string) ?? '—'}
                        </span>
                      </div>
                      {selectedSnapshot.description && (
                        <div className="flex items-center justify-between py-2">
                          <span className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">
                            Description
                          </span>
                          <span className="text-sm text-light-text-primary dark:text-dark-text-primary text-right max-w-xs">
                            {selectedSnapshot.description as string}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Snapshot JSON — collapsed by default (advanced/debug view) */}
                <div>
                  <SectionTitle>Raw Snapshot (Advanced)</SectionTitle>
                  <JsonViewer
                    data={selectedVersion.snapshot}
                    label="Show full JSON snapshot"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-light-text-secondary dark:text-dark-text-secondary">
                <Eye size={24} className="mb-2" />
                <span className="text-sm">Select a version to view its details</span>
              </div>
            )}
          </div>
        </div>
      )}
    </ModalShell>
  );
};

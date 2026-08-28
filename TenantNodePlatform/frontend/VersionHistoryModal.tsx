import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle, GitBranch, Eye } from 'lucide-react';
import * as api from './tnpService';
import type { Blueprint, BlueprintVersion } from './types';
import { ModalShell, StatusBadge, SectionTitle, JsonViewer, EmptyHint } from './shared';

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
          setVersions(v);
          if (v.length > 0) setSelectedVersion(v[0]);
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

  return (
    <ModalShell
      title={`Version History: ${blueprint.name}`}
      subtitle={`${versions.length} version${versions.length !== 1 ? 's' : ''} total`}
      onClose={onClose}
      maxWidth="max-w-4xl"
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-light-text-secondary dark:text-dark-text-secondary" />
        </div>
      ) : error ? (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-400 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      ) : versions.length === 0 ? (
        <EmptyHint>No versions recorded.</EmptyHint>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Version list */}
          <div className="md:col-span-1">
            <SectionTitle>Versions</SectionTitle>
            <div className="bg-light-surface dark:bg-dark-surface-alt border border-light-border dark:border-dark-border rounded-lg overflow-hidden">
              {versions.map((v, idx) => {
                const snapshot = v.snapshot as Record<string, unknown>;
                const status = snapshot.status as string;
                const isActive = selectedVersion?.version === v.version;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedVersion(v)}
                    className={`w-full flex items-center justify-between px-4 py-3 border-b border-light-border dark:border-dark-border last:border-0 transition-all text-left ${
                      isActive
                        ? 'bg-white dark:bg-dark-surface shadow-sm'
                        : 'hover:bg-light-hover dark:hover:bg-dark-hover'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <GitBranch
                        size={14}
                        className={
                          isActive
                            ? 'text-light-text-primary dark:text-dark-text-primary'
                            : 'text-light-text-secondary dark:text-dark-text-secondary'
                        }
                      />
                      <div>
                        <div className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                          v{v.version}
                        </div>
                        <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
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
                <div>
                  <SectionTitle>Snapshot</SectionTitle>
                  <JsonViewer data={selectedVersion.snapshot} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-light-text-secondary dark:text-dark-text-secondary">
                <Eye size={24} className="mb-2" />
                <span className="text-sm">Select a version to view its snapshot</span>
              </div>
            )}
          </div>
        </div>
      )}
    </ModalShell>
  );
};

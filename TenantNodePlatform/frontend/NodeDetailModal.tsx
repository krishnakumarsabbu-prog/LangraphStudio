import React, { useEffect, useState } from 'react';
import {
  Loader2,
  AlertCircle,
  ExternalLink,
  GitBranch,
  ArrowRight,
  Circle,
  Square,
  Diamond,
  FileText,
  Cpu,
  Workflow,
} from 'lucide-react';
import * as api from './tnpService';
import type { Blueprint, BlueprintVersion, BlueprintDependency } from './types';
import {
  ModalShell,
  StatusBadge,
  SectionTitle,
  InfoRow,
  JsonViewer,
  EmptyHint,
} from './shared';

interface NodeDetailModalProps {
  blueprint: Blueprint;
  onClose: () => void;
  onOpenInBuilder: (blueprintId: string) => void;
}

const nodeTypeIcons: Record<string, React.FC<{ size?: number; className?: string }>> = {
  service: Cpu,
  decision: Diamond,
  form: FileText,
  workflow: Workflow,
  llm: Cpu,
  mapper: Square,
  graph: Circle,
};

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

export const NodeDetailModal: React.FC<NodeDetailModalProps> = ({
  blueprint,
  onClose,
  onOpenInBuilder,
}) => {
  const [versions, setVersions] = useState<BlueprintVersion[]>([]);
  const [dependencies, setDependencies] = useState<BlueprintDependency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [v, d] = await Promise.all([
          api.listBlueprintVersions(blueprint.blueprint_id),
          api.listBlueprintDependencies(blueprint.blueprint_id),
        ]);
        if (!cancelled) {
          setVersions(v);
          setDependencies(d);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg =
            err instanceof Error ? err.message : 'Failed to load details';
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

  const graph = blueprint.graph_definition;
  const nodes: unknown[] = graph?.nodes ?? [];
  const edges: unknown[] = graph?.edges ?? [];
  const inputs = graph?.inputs ?? {};

  // Extract business rules from decision nodes
  const decisionNodes = nodes.filter(
    (n) => (n as Record<string, unknown>).type === 'decision'
  );
  const businessRules = decisionNodes.flatMap((n) => {
    const data = (n as Record<string, unknown>).data as Record<string, unknown> | undefined;
    const rules = data?.rules as unknown[] | undefined;
    return rules ?? [];
  });

  return (
    <ModalShell
      title={blueprint.name}
      subtitle={`v${blueprint.version} · ${blueprint.source_type}`}
      onClose={onClose}
      maxWidth="max-w-4xl"
    >
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-light-text-secondary dark:text-dark-text-secondary" />
        </div>
      ) : (
        <div className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-400 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Status + Open in Builder */}
          <div className="flex items-center justify-between">
            <StatusBadge status={blueprint.status} />
            <button
              onClick={() => onOpenInBuilder(blueprint.blueprint_id)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-black dark:bg-white text-white dark:text-black rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-all"
            >
              <ExternalLink size={14} />
              Open in Node Builder
            </button>
          </div>

          {/* Metadata */}
          <div>
            <SectionTitle>Blueprint Metadata</SectionTitle>
            <div className="bg-light-surface dark:bg-dark-surface-alt border border-light-border dark:border-dark-border rounded-lg px-4">
              <InfoRow label="Name" value={blueprint.name} />
              <InfoRow label="Blueprint ID" value={<code className="text-xs font-mono">{blueprint.blueprint_id}</code>} />
              <InfoRow label="Version" value={<span className="font-mono">v{blueprint.version}</span>} />
              <InfoRow label="Status" value={<StatusBadge status={blueprint.status} />} />
              <InfoRow label="Source Type" value={<span className="font-mono">{blueprint.source_type}</span>} />
              <InfoRow label="Created By" value={blueprint.created_by} />
              <InfoRow label="Created" value={formatDate(blueprint.created_at)} />
              <InfoRow label="Last Updated" value={formatDate(blueprint.updated_at)} />
              {blueprint.description && (
                <InfoRow label="Description" value={blueprint.description} />
              )}
            </div>
          </div>

          {/* Internal Graph Preview */}
          <div>
            <SectionTitle>Internal Graph Preview</SectionTitle>
            {nodes.length === 0 ? (
              <EmptyHint>No graph nodes defined yet.</EmptyHint>
            ) : (
              <div className="bg-light-surface dark:bg-dark-surface-alt border border-light-border dark:border-dark-border rounded-lg p-4">
                {/* Nodes */}
                <div className="flex flex-wrap gap-3 mb-4">
                  {nodes.map((node, idx) => {
                    const n = node as Record<string, unknown>;
                    const Icon = nodeTypeIcons[(n.type as string) ?? 'graph'] ?? Circle;
                    const label = ((n.data as Record<string, unknown>)?.label as string) ?? (n.id as string);
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-lg shadow-sm"
                      >
                        <Icon size={14} className="text-light-text-secondary dark:text-dark-text-secondary" />
                        <div>
                          <div className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                            {label}
                          </div>
                          <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-mono">
                            {n.type as string}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Edges */}
                {edges.length > 0 && (
                  <div className="space-y-1">
                    {edges.map((edge, idx) => {
                      const e = edge as Record<string, unknown>;
                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-xs text-light-text-secondary dark:text-dark-text-secondary"
                        >
                          <code className="font-mono">{e.source as string}</code>
                          <ArrowRight size={12} />
                          <code className="font-mono">{e.target as string}</code>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Inputs / Outputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <SectionTitle>Inputs</SectionTitle>
              {Object.keys(inputs).length === 0 &&
              Object.keys(blueprint.input_contract).length === 0 ? (
                <EmptyHint>No inputs defined.</EmptyHint>
              ) : (
                <JsonViewer
                  data={
                    Object.keys(inputs).length > 0
                      ? inputs
                      : blueprint.input_contract
                  }
                />
              )}
            </div>
            <div>
              <SectionTitle>Outputs</SectionTitle>
              {Object.keys(blueprint.output_contract).length === 0 ? (
                <EmptyHint>No outputs defined.</EmptyHint>
              ) : (
                <JsonViewer data={blueprint.output_contract} />
              )}
            </div>
          </div>

          {/* Dependencies */}
          <div>
            <SectionTitle>Dependencies</SectionTitle>
            {dependencies.length === 0 ? (
              <EmptyHint>No dependencies.</EmptyHint>
            ) : (
              <div className="bg-light-surface dark:bg-dark-surface-alt border border-light-border dark:border-dark-border rounded-lg p-4 space-y-2">
                {dependencies.map((dep, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <GitBranch size={14} className="text-light-text-secondary dark:text-dark-text-secondary" />
                    <code className="font-mono text-light-text-primary dark:text-dark-text-primary">
                      {dep.dependency_id}
                    </code>
                    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                      ({dep.dependency_type})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Configuration Summary */}
          <div>
            <SectionTitle>Configuration Summary</SectionTitle>
            <JsonViewer data={graph} />
          </div>

          {/* Business Rules */}
          <div>
            <SectionTitle>Business Rules</SectionTitle>
            {businessRules.length === 0 ? (
              <EmptyHint>No business rules defined.</EmptyHint>
            ) : (
              <div className="bg-light-surface dark:bg-dark-surface-alt border border-light-border dark:border-dark-border rounded-lg p-4 space-y-2">
                {businessRules.map((rule, idx) => (
                  <div key={idx} className="text-xs">
                    <JsonViewer data={rule} label={`Rule ${idx + 1}`} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Version History */}
          <div>
            <SectionTitle>Version History</SectionTitle>
            {versions.length === 0 ? (
              <EmptyHint>No version history.</EmptyHint>
            ) : (
              <div className="bg-light-surface dark:bg-dark-surface-alt border border-light-border dark:border-dark-border rounded-lg overflow-hidden">
                {versions.map((v, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-4 py-3 border-b border-light-border dark:border-dark-border last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                        v{v.version}
                      </span>
                      <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        by {v.created_by}
                      </span>
                    </div>
                    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                      {formatDate(v.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </ModalShell>
  );
};

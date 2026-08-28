import React, { useEffect, useState } from 'react';
import { AlertCircle, ExternalLink, GitBranch, ArrowRight, Circle, Square, Diamond, FileText, Cpu, Workflow, ChevronDown, ChevronRight, CheckCircle2, File as FileEdit } from 'lucide-react';
import * as api from './tnpService';
import type { Blueprint, BlueprintVersion, BlueprintDependency } from './types';
import {
  ModalShell,
  StatusBadge,
  SectionTitle,
  InfoRow,
  JsonViewer,
  EmptyHint,
  LoadingState,
  ErrorBanner,
  BlueprintOriginBadge,
  BusinessRuleDisplay,
} from './shared';
import { isRuleGroup, RuleTreeNode, RuleConditionGroup, RuleConditionLeaf } from '../../src/components/NodeBuilder/types';

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

// Convert raw rule data from backend into a RuleTreeNode for display
function extractRuleNode(raw: unknown): RuleTreeNode | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if ('rules' in obj && 'operator' in obj) {
    return {
      operator: obj.operator as 'AND' | 'OR' | 'NOT',
      rules: (obj.rules as unknown[]).map(extractRuleNode).filter(Boolean) as RuleTreeNode[],
    } as RuleConditionGroup;
  }
  if ('field' in obj && 'operator' in obj) {
    return {
      field: obj.field as string,
      operator: obj.operator as string,
      value: obj.value,
    } as RuleConditionLeaf;
  }
  return null;
}

// Collapsible section component
const CollapsibleSection: React.FC<{
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full mb-3 group"
      >
        {open ? (
          <ChevronDown size={14} className="text-light-text-secondary dark:text-dark-text-secondary" />
        ) : (
          <ChevronRight size={14} className="text-light-text-secondary dark:text-dark-text-secondary" />
        )}
        <h3 className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider group-hover:text-light-text-primary dark:group-hover:text-dark-text-primary transition-colors">
          {title}
        </h3>
      </button>
      {open && children}
    </div>
  );
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
  const businessRules = decisionNodes.map((n, idx) => {
    const data = (n as Record<string, unknown>).data as Record<string, unknown> | undefined;
    const config = data?.config as Record<string, unknown> | undefined;
    const ruleDef = config?.ruleDefinition as Record<string, unknown> | undefined;
    const conditions = ruleDef?.conditions as unknown;
    const outcomes = ruleDef?.outcomes as { true?: string; false?: string } | undefined;
    const label = (data?.label as string) ?? `Decision ${idx + 1}`;
    return { label, conditions, outcomes, defaultOutcome: ruleDef?.defaultOutcome as string };
  });

  return (
    <ModalShell
      title={blueprint.name}
      subtitle={`v${blueprint.version} · ${blueprint.source_type}`}
      onClose={onClose}
      maxWidth="max-w-4xl"
    >
      {loading ? (
        <LoadingState label="Loading blueprint details..." />
      ) : (
        <div className="space-y-6">
          {error && (
            <ErrorBanner message={error} />
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

          {/* Blueprint Origin (for materialized nodes) */}
          {blueprint.status === 'PUBLISHED' && (
            <BlueprintOriginBadge
              blueprintName={blueprint.name}
              sourceVersion={`v${blueprint.version}`}
              materialized={true}
            />
          )}

          {/* Metadata */}
          <CollapsibleSection title="Blueprint Metadata">
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
          </CollapsibleSection>

          {/* Internal Graph Preview */}
          <CollapsibleSection title="Internal Graph Preview">
            {nodes.length === 0 ? (
              <EmptyHint icon={<Circle size={24} />}>No graph nodes defined yet.</EmptyHint>
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
          </CollapsibleSection>

          {/* Business Rules — readable format */}
          {businessRules.length > 0 && (
            <CollapsibleSection title="Business Rules">
              <div className="space-y-4">
                {businessRules.map((rule, idx) => (
                  <div
                    key={idx}
                    className="bg-light-surface dark:bg-dark-surface-alt border border-light-border dark:border-dark-border rounded-lg p-4"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <GitBranch size={14} className="text-light-text-secondary dark:text-dark-text-secondary" />
                      <span className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">
                        {rule.label}
                      </span>
                    </div>
                    {/* IF block */}
                    <div className="space-y-2 mb-3">
                      <div className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">
                        IF
                      </div>
                      {rule.conditions ? (
                        <BusinessRuleDisplay rule={extractRuleNode(rule.conditions) ?? { operator: 'AND', rules: [] }} />
                      ) : (
                        <EmptyHint>No conditions defined.</EmptyHint>
                      )}
                    </div>
                    {/* THEN / ELSE */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
                        <CheckCircle2 size={14} className="text-green-600 dark:text-green-400" />
                        <span className="text-[10px] font-bold text-green-700 dark:text-green-400 uppercase">Then</span>
                        <span className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">
                          {rule.outcomes?.true || '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                        <FileEdit size={14} className="text-amber-600 dark:text-amber-400" />
                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase">Else</span>
                        <span className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">
                          {rule.outcomes?.false || '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Inputs / Outputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CollapsibleSection title="Inputs">
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
                  label="View input schema (JSON)"
                />
              )}
            </CollapsibleSection>
            <CollapsibleSection title="Outputs">
              {Object.keys(blueprint.output_contract).length === 0 ? (
                <EmptyHint>No outputs defined.</EmptyHint>
              ) : (
                <JsonViewer data={blueprint.output_contract} label="View output schema (JSON)" />
              )}
            </CollapsibleSection>
          </div>

          {/* Dependencies */}
          <CollapsibleSection title="Dependencies" defaultOpen={dependencies.length > 0}>
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
          </CollapsibleSection>

          {/* Configuration Summary — collapsed by default (advanced/debug view) */}
          <CollapsibleSection title="Configuration Summary (Advanced)" defaultOpen={false}>
            <JsonViewer data={graph} />
          </CollapsibleSection>

          {/* Version History Timeline */}
          <CollapsibleSection title="Version History">
            {versions.length === 0 ? (
              <EmptyHint>No version history.</EmptyHint>
            ) : (
              <div className="relative pl-6">
                {/* Timeline line */}
                <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-light-border dark:bg-dark-border" />
                {versions.map((v, idx) => {
                  const snapshot = v.snapshot as Record<string, unknown>;
                  const status = snapshot.status as string;
                  const isCurrent = v.version === blueprint.version;
                  return (
                    <div
                      key={idx}
                      className={`relative pb-4 ${idx === versions.length - 1 ? 'pb-0' : ''}`}
                    >
                      {/* Timeline dot */}
                      <div
                        className={`absolute -left-4 top-1 w-3 h-3 rounded-full border-2 ${
                          status === 'PUBLISHED'
                            ? 'bg-green-500 border-green-500'
                            : status === 'DEPRECATED'
                            ? 'bg-gray-400 border-gray-400'
                            : 'bg-blue-500 border-blue-500'
                        }`}
                      />
                      <div className={`flex items-center justify-between ${isCurrent ? 'bg-blue-50 dark:bg-blue-900/10 rounded-lg px-3 py-2 -ml-3' : ''}`}>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                            v{v.version}
                          </span>
                          {status && (
                            <StatusBadge status={status as 'DRAFT' | 'PUBLISHED' | 'DEPRECATED'} />
                          )}
                          {isCurrent && (
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">
                              Current
                            </span>
                          )}
                          <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            by {v.created_by}
                          </span>
                        </div>
                        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                          {formatDate(v.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CollapsibleSection>
        </div>
      )}
    </ModalShell>
  );
};

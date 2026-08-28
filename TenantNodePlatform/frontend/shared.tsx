import React, { useEffect, useCallback } from 'react';
import { X, AlertTriangle, CheckCircle2, XCircle, Info, Loader2 } from 'lucide-react';
import type { BlueprintStatus } from './types';

// --------------------------------------------------------------------------- //
// Status badge
// --------------------------------------------------------------------------- //

export const statusConfig: Record<
  BlueprintStatus,
  { bg: string; text: string; dot: string; label: string }
> = {
  DRAFT: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-400',
    dot: 'bg-blue-500',
    label: 'Draft',
  },
  PUBLISHED: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    text: 'text-green-700 dark:text-green-400',
    dot: 'bg-green-500',
    label: 'Published',
  },
  DEPRECATED: {
    bg: 'bg-gray-100 dark:bg-gray-700/40',
    text: 'text-gray-600 dark:text-gray-400',
    dot: 'bg-gray-400',
    label: 'Deprecated',
  },
};

export const StatusBadge: React.FC<{ status: BlueprintStatus }> = ({ status }) => {
  const cfg = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

// --------------------------------------------------------------------------- //
// Modal shell — with Escape key support
// --------------------------------------------------------------------------- //

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}

export const ModalShell: React.FC<ModalProps> = ({
  title,
  subtitle,
  onClose,
  children,
  maxWidth = 'max-w-2xl',
}) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`relative w-full ${maxWidth} mt-8 mb-8 mx-4 bg-white dark:bg-dark-surface rounded-2xl shadow-2xl border border-light-border dark:border-dark-border animate-modal-in`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-light-border dark:border-dark-border">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-light-hover dark:hover:bg-dark-hover text-light-text-secondary dark:text-dark-text-secondary transition-all flex-shrink-0"
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>
        {/* Body */}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

// --------------------------------------------------------------------------- //
// Section title
// --------------------------------------------------------------------------- //

export const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-3">
    {children}
  </h3>
);

// --------------------------------------------------------------------------- //
// Info row
// --------------------------------------------------------------------------- //

export const InfoRow: React.FC<{ label: string; value: React.ReactNode }> = ({
  label,
  value,
}) => (
  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-2 border-b border-light-border dark:border-dark-border last:border-0">
    <span className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary sm:w-32 flex-shrink-0">
      {label}
    </span>
    <span className="text-sm text-light-text-primary dark:text-dark-text-primary">
      {value}
    </span>
  </div>
);

// --------------------------------------------------------------------------- //
// JSON viewer — with collapsible toggle
// --------------------------------------------------------------------------- //

export const JsonViewer: React.FC<{ data: unknown; label?: string }> = ({
  data,
  label,
}) => {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <div>
      {label && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1 hover:text-light-text-primary dark:hover:text-dark-text-primary transition-colors"
        >
          <span className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}>
            ▶
          </span>
          {label}
        </button>
      )}
      {(expanded || !label) && (
        <pre className="text-xs font-mono bg-light-surface dark:bg-dark-surface-alt border border-light-border dark:border-dark-border rounded-lg p-3 overflow-x-auto max-h-64 scrollbar-thin text-light-text-primary dark:text-dark-text-default">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
};

// --------------------------------------------------------------------------- //
// Empty hint
// --------------------------------------------------------------------------- //

export const EmptyHint: React.FC<{ children: React.ReactNode; icon?: React.ReactNode }> = ({
  children,
  icon,
}) => (
  <div className="flex flex-col items-center justify-center py-8 text-center">
    {icon && <div className="mb-2 text-light-border dark:text-dark-border">{icon}</div>}
    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary italic">
      {children}
    </p>
  </div>
);

// --------------------------------------------------------------------------- //
// Loading skeleton — for table rows and cards
// --------------------------------------------------------------------------- //

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="bg-white dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl overflow-hidden shadow-sm">
    <div className="border-b border-light-border dark:border-dark-border px-5 py-3 bg-light-surface dark:bg-dark-surface-alt">
      <div className="flex gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-3 bg-light-border dark:bg-dark-border rounded animate-pulse" style={{ width: `${60 + i * 20}px` }} />
        ))}
      </div>
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="border-b border-light-border dark:border-dark-border last:border-0 px-5 py-4">
        <div className="flex items-center gap-4">
          <div className="h-4 bg-light-border dark:bg-dark-border rounded animate-pulse flex-1" />
          <div className="h-4 bg-light-border dark:bg-dark-border rounded animate-pulse w-12" />
          <div className="h-5 bg-light-border dark:bg-dark-border rounded-full animate-pulse w-20" />
          <div className="h-4 bg-light-border dark:bg-dark-border rounded animate-pulse w-24" />
          <div className="h-4 bg-light-border dark:bg-dark-border rounded animate-pulse w-20" />
        </div>
      </div>
    ))}
  </div>
);

// --------------------------------------------------------------------------- //
// Inline loading spinner with label
// --------------------------------------------------------------------------- //

export const LoadingState: React.FC<{ label?: string }> = ({ label = 'Loading...' }) => (
  <div className="flex items-center justify-center gap-2 py-16">
    <Loader2 size={20} className="animate-spin text-light-text-secondary dark:text-dark-text-secondary" />
    <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{label}</span>
  </div>
);

// --------------------------------------------------------------------------- //
// Error banner — business-friendly error display
// --------------------------------------------------------------------------- //

export const ErrorBanner: React.FC<{ message: string; onRetry?: () => void }> = ({
  message,
  onRetry,
}) => (
  <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3 text-red-700 dark:text-red-400 text-sm">
    <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
    <div className="flex-1">
      <p>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 text-xs font-semibold text-red-700 dark:text-red-400 hover:underline"
        >
          Try again
        </button>
      )}
    </div>
  </div>
);

// --------------------------------------------------------------------------- //
// Confirmation dialog — for destructive operations
// --------------------------------------------------------------------------- //

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'warning',
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  const variantConfig = {
    danger: { icon: XCircle, iconColor: 'text-red-600 dark:text-red-400', btn: 'bg-red-600 hover:bg-red-700 text-white' },
    warning: { icon: AlertTriangle, iconColor: 'text-amber-600 dark:text-amber-400', btn: 'bg-amber-600 hover:bg-amber-700 text-white' },
    info: { icon: Info, iconColor: 'text-blue-600 dark:text-blue-400', btn: 'bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200' },
  };
  const cfg = variantConfig[variant];
  const Icon = cfg.icon;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-md mx-4 bg-white dark:bg-dark-surface rounded-2xl shadow-2xl border border-light-border dark:border-dark-border animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className={`flex-shrink-0 ${cfg.iconColor}`}>
              <Icon size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-light-text-primary dark:text-dark-text-primary mb-1">
                {title}
              </h3>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                {message}
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onCancel}
              className="px-4 py-2.5 text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary border border-light-border dark:border-dark-border rounded-lg hover:bg-light-hover dark:hover:bg-dark-hover transition-all"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${cfg.btn}`}
            >
              <CheckCircle2 size={16} />
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --------------------------------------------------------------------------- //
// Business rule readable renderer
// --------------------------------------------------------------------------- //

import {
  OPERATOR_LABELS,
  RuleConditionLeaf,
  RuleConditionGroup,
  RuleTreeNode,
  isRuleGroup,
} from '../../src/components/NodeBuilder/types';

export function ruleToBusinessLanguage(
  node: RuleTreeNode,
  depth = 0
): string {
  if (isRuleGroup(node)) {
    const group = node as RuleConditionGroup;
    const parts = group.rules.map((r, i) => {
      const part = ruleToBusinessLanguage(r, depth + 1);
      return i === 0 ? part : `${group.operator} ${part}`;
    });
    return parts.join(' ');
  }
  const leaf = node as RuleConditionLeaf;
  const opLabel = OPERATOR_LABELS[leaf.operator] || leaf.operator;
  const valStr = leaf.value === undefined || leaf.value === ''
    ? ''
    : ` ${leaf.value}`;
  return `${leaf.field} ${opLabel.toLowerCase()}${valStr}`;
}

export const BusinessRuleDisplay: React.FC<{ rule: RuleTreeNode }> = ({ rule }) => {
  const renderNode = (node: RuleTreeNode, depth: number): React.ReactNode => {
    if (isRuleGroup(node)) {
      const group = node as RuleConditionGroup;
      return (
        <div
          key={`g-${depth}-${Math.random()}`}
          className="rounded-lg border border-light-border dark:border-dark-border bg-light-surface/50 dark:bg-dark-surface-alt/30 p-3 space-y-2"
          style={{ marginLeft: depth > 0 ? 20 : 0 }}
        >
          <span className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide">
            {group.operator}
          </span>
          {group.rules.map((r, i) => (
            <div key={i}>{renderNode(r, depth + 1)}</div>
          ))}
        </div>
      );
    }
    const leaf = node as RuleConditionLeaf;
    const opLabel = OPERATOR_LABELS[leaf.operator] || leaf.operator;
    return (
      <div
        key={`l-${depth}-${Math.random()}`}
        className="flex flex-wrap items-center gap-2 py-1.5 px-3 rounded-lg bg-white dark:bg-dark-surface border border-light-border dark:border-dark-border"
        style={{ marginLeft: depth > 0 ? 20 : 0 }}
      >
        <span className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
          {leaf.field || <em className="text-light-text-secondary">field</em>}
        </span>
        <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">
          {opLabel.toLowerCase()}
        </span>
        {leaf.value !== undefined && leaf.value !== '' && (
          <span className="text-sm font-mono font-medium text-light-text-primary dark:text-dark-text-primary px-2 py-0.5 rounded bg-light-surface dark:bg-dark-surface-alt">
            {String(leaf.value)}
          </span>
        )}
      </div>
    );
  };

  return <div className="space-y-2">{renderNode(rule, 0)}</div>;
};

// --------------------------------------------------------------------------- //
// Blueprint origin badge — for materialized nodes
// --------------------------------------------------------------------------- //

export const BlueprintOriginBadge: React.FC<{
  blueprintName: string;
  sourceVersion: string;
  materialized: boolean;
}> = ({ blueprintName, sourceVersion, materialized }) => (
  <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
      <Info size={16} className="text-blue-600 dark:text-blue-400" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
          Blueprint: {blueprintName}
        </span>
        <span className="text-xs text-blue-600 dark:text-blue-500">
          Source Version: {sourceVersion}
        </span>
        {materialized && (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-600 text-white">
            Materialized
          </span>
        )}
      </div>
      <p className="text-[11px] text-blue-600 dark:text-blue-500 mt-1">
        Changes to this workflow instance will not modify the original blueprint.
      </p>
    </div>
  </div>
);
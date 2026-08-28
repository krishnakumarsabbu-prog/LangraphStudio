import React from 'react';
import { X } from 'lucide-react';
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
// Modal shell
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
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`relative w-full ${maxWidth} mt-8 mb-8 mx-4 bg-white dark:bg-dark-surface rounded-2xl shadow-2xl border border-light-border dark:border-dark-border`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-light-border dark:border-dark-border">
          <div>
            <h2 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-light-hover dark:hover:bg-dark-hover text-light-text-secondary dark:text-dark-text-secondary transition-all"
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
// JSON viewer
// --------------------------------------------------------------------------- //

export const JsonViewer: React.FC<{ data: unknown; label?: string }> = ({
  data,
  label,
}) => (
  <div>
    {label && (
      <p className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1">
        {label}
      </p>
    )}
    <pre className="text-xs font-mono bg-light-surface dark:bg-dark-surface-alt border border-light-border dark:border-dark-border rounded-lg p-3 overflow-x-auto max-h-64 scrollbar-thin text-light-text-primary dark:text-dark-text-default">
      {JSON.stringify(data, null, 2)}
    </pre>
  </div>
);

// --------------------------------------------------------------------------- //
// Empty hint
// --------------------------------------------------------------------------- //

export const EmptyHint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary italic">
    {children}
  </p>
);

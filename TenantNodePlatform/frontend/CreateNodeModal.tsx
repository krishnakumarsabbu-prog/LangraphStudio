import React, { useState } from 'react';
import { Plus, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import * as api from './tnpService';
import type { SourceType } from './types';
import { ModalShell } from './shared';

interface CreateNodeModalProps {
  tenantId: string;
  onClose: () => void;
  onCreated: () => void;
}

const sourceTypes: { value: SourceType; label: string; description: string }[] = [
  { value: 'graph', label: 'Graph (Composite)', description: 'Multi-node composition' },
  { value: 'service', label: 'Service', description: 'HTTP API call' },
  { value: 'decision', label: 'Decision', description: 'Business rules engine' },
  { value: 'form', label: 'Form', description: 'User input form' },
  { value: 'workflow', label: 'Workflow', description: 'Process workflow' },
  { value: 'llm', label: 'LLM', description: 'Language model' },
  { value: 'mapper', label: 'Mapper', description: 'Data transformation' },
];

export const CreateNodeModal: React.FC<CreateNodeModalProps> = ({
  tenantId,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>('graph');
  const [createdBy, setCreatedBy] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Node name is required. Please enter a descriptive name for your blueprint.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.createBlueprint(tenantId, {
        name: name.trim(),
        description: description.trim(),
        source_type: sourceType,
        created_by: createdBy.trim() || 'system',
      });
      toast.success(`Node "${name.trim()}" created successfully.`);
      onCreated();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to create node. Please try again.';
      // Business-friendly error
      if (msg.includes('422')) {
        setError('This node cannot be created because some required information is missing. Please review the form and try again.');
      } else if (msg.includes('Network Error') || msg.includes('timeout')) {
        setError('Unable to reach the server. Please check your connection and try again.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title="Create Node" subtitle="Define a new reusable Node Blueprint" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-1.5">
            Node Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Address Verification"
            autoFocus
            className="w-full px-4 py-2.5 text-sm border border-light-border dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-all"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-1.5">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this node do?"
            rows={3}
            className="w-full px-4 py-2.5 text-sm border border-light-border dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-all resize-none"
          />
        </div>

        {/* Source type */}
        <div>
          <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-1.5">
            Source Type
          </label>
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as SourceType)}
            className="w-full px-4 py-2.5 text-sm border border-light-border dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-all cursor-pointer"
          >
            {sourceTypes.map((st) => (
              <option key={st.value} value={st.value}>
                {st.label} — {st.description}
              </option>
            ))}
          </select>
        </div>

        {/* Created by */}
        <div>
          <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-1.5">
            Created By
          </label>
          <input
            type="text"
            value={createdBy}
            onChange={(e) => setCreatedBy(e.target.value)}
            placeholder="system"
            className="w-full px-4 py-2.5 text-sm border border-light-border dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent transition-all"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary border border-light-border dark:border-dark-border rounded-lg hover:bg-light-hover dark:hover:bg-dark-hover transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Create Node
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

/**
 * Properties / Configuration Panel for the Node Builder.
 *
 * Renders the appropriate configuration UI based on the selected
 * node type. For Decision nodes, shows the Business Decision Builder
 * (no Python editor). For Service nodes, shows the service config.
 */

import React, { useMemo } from 'react';
import { X, Settings } from 'lucide-react';
import { useNodeBuilderStore } from './store';
import { ServiceConfigPanel } from './ServiceConfigPanel';
import { DecisionBuilder } from './DecisionBuilder';
import {
  ServiceNodeConfig,
  DecisionNodeConfig,
  LLMNodeConfig,
  FormNodeConfig,
} from './types';

export const PropertiesPanel: React.FC = () => {
  const { document, selectedNodeId, updateNodeConfig, updateNodeLabel, deleteNode, selectNode } =
    useNodeBuilderStore();

  const selectedNode = useMemo(
    () => document.nodes.find((n) => n.id === selectedNodeId),
    [document.nodes, selectedNodeId]
  );

  // Compute available fields from preceding service nodes (connected via edges)
  const availableFields = useMemo(() => {
    if (!selectedNode) return [];
    const incomingEdges = document.edges.filter((e) => e.target === selectedNode.id);
    const sourceNodeIds = incomingEdges.map((e) => e.source);
    const sourceNodes = document.nodes.filter((n) => sourceNodeIds.includes(n.id));

    const fields: string[] = [];
    sourceNodes.forEach((n) => {
      const config = n.data.config as ServiceNodeConfig;
      if (n.type === 'service') {
        try {
          const schema = JSON.parse(config.outputSchema || '{}');
          Object.keys(schema).forEach((k) => {
            if (!fields.includes(k)) fields.push(k);
          });
        } catch {
          // ignore invalid schema
        }
      }
    });
    return fields;
  }, [selectedNode, document.nodes, document.edges]);

  if (!selectedNode) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6">
        <Settings className="w-10 h-10 text-light-border dark:text-dark-border mb-3" />
        <h3 className="text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary">
          No Node Selected
        </h3>
        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
          Select a node on the canvas to configure its properties.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-light-border dark:border-dark-border">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-light-surface dark:bg-dark-surface-alt text-light-text-secondary dark:text-dark-text-secondary">
            {selectedNode.type}
          </span>
          <h3 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">
            Properties
          </h3>
        </div>
        <button
          onClick={() => selectNode(null)}
          className="p-1.5 hover:bg-light-hover dark:hover:bg-dark-hover rounded-lg transition-colors"
        >
          <X className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
        </button>
      </div>

      {/* Node label */}
      <div className="px-4 py-3 border-b border-light-border dark:border-dark-border">
        <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1">
          Node Label
        </label>
        <input
          type="text"
          value={selectedNode.data.label}
          onChange={(e) => updateNodeLabel(selectedNode.id, e.target.value)}
          className="w-full px-3 py-2 text-xs border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-default rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white"
        />
      </div>

      {/* Config body */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {selectedNode.type === 'service' && (
          <ServiceConfigPanel
            config={selectedNode.data.config as ServiceNodeConfig}
            onChange={(cfg) => updateNodeConfig(selectedNode.id, cfg)}
          />
        )}

        {selectedNode.type === 'decision' && (
          <DecisionBuilder
            config={selectedNode.data.config as DecisionNodeConfig}
            onChange={(cfg) => updateNodeConfig(selectedNode.id, cfg)}
            availableFields={availableFields}
          />
        )}

        {selectedNode.type === 'llm' && (
          <LLMConfigPanel
            config={selectedNode.data.config as LLMNodeConfig}
            onChange={(cfg) => updateNodeConfig(selectedNode.id, cfg)}
          />
        )}

        {selectedNode.type === 'form' && (
          <FormConfigPanel
            config={selectedNode.data.config as FormNodeConfig}
            onChange={(cfg) => updateNodeConfig(selectedNode.id, cfg)}
          />
        )}
      </div>

      {/* Delete button */}
      <div className="px-4 py-3 border-t border-light-border dark:border-dark-border">
        <button
          onClick={() => deleteNode(selectedNode.id)}
          className="w-full px-3 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 transition-colors"
        >
          Delete Node
        </button>
      </div>
    </div>
  );
};

// --- LLM Config ---

const LLMConfigPanel: React.FC<{
  config: LLMNodeConfig;
  onChange: (cfg: Partial<LLMNodeConfig>) => void;
}> = ({ config, onChange }) => (
  <div className="space-y-3">
    <div>
      <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1">
        Name
      </label>
      <input
        type="text"
        value={config.name}
        onChange={(e) => onChange({ name: e.target.value })}
        className="w-full px-3 py-2 text-xs border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-default rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white"
      />
    </div>
    <div>
      <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1">
        Model
      </label>
      <input
        type="text"
        value={config.model}
        onChange={(e) => onChange({ model: e.target.value })}
        className="w-full px-3 py-2 text-xs font-mono border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-default rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white"
      />
    </div>
    <div>
      <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1">
        Prompt
      </label>
      <textarea
        value={config.prompt}
        onChange={(e) => onChange({ prompt: e.target.value })}
        rows={6}
        className="w-full px-3 py-2 text-xs font-mono border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-default rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white resize-none"
      />
    </div>
    <div>
      <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1">
        Temperature: {config.temperature}
      </label>
      <input
        type="range"
        min={0}
        max={2}
        step={0.1}
        value={config.temperature}
        onChange={(e) => onChange({ temperature: parseFloat(e.target.value) })}
        className="w-full"
      />
    </div>
  </div>
);

// --- Form Config ---

const FormConfigPanel: React.FC<{
  config: FormNodeConfig;
  onChange: (cfg: Partial<FormNodeConfig>) => void;
}> = ({ config, onChange }) => (
  <div className="space-y-3">
    <div>
      <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1">
        Name
      </label>
      <input
        type="text"
        value={config.name}
        onChange={(e) => onChange({ name: e.target.value })}
        className="w-full px-3 py-2 text-xs border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-default rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white"
      />
    </div>
    <div>
      <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1">
        Form Schema (JSON)
      </label>
      <textarea
        value={config.formSchema}
        onChange={(e) => onChange({ formSchema: e.target.value })}
        rows={10}
        className="w-full px-3 py-2 text-xs font-mono border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-default rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white resize-none"
      />
    </div>
  </div>
);

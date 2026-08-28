/**
 * Tenant Node Builder.
 *
 * A NEW node builder (separate from the LangGraph canvas) where tenant
 * administrators assemble reusable Node Blueprints from framework nodes.
 *
 * Layout:
 *   TOP:    toolbar (name, description, version, status, save, validate, test, publish)
 *   LEFT:   framework node palette (Service, Decision, LLM, Form)
 *   CENTER: blueprint canvas (React Flow)
 *   RIGHT:  properties / configuration panel
 */

import React, { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Connection,
  Edge,
  Node as RFNode,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  EdgeChange,
  NodeChange,
} from 'react-flow-renderer';
import {
  Globe,
  GitBranch,
  Brain,
  FileText,
  Save,
  CheckCircle2,
  Play,
  Upload,
  Plus,
  AlertCircle,
  XCircle,
  Layers,
  Settings,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNodeBuilderStore } from './store';
import { BlueprintCanvasNode } from './BlueprintCanvasNode';
import { PropertiesPanel } from './PropertiesPanel';
import { blueprintService } from './blueprintService';
import {
  FrameworkNodeType,
  BlueprintNode,
  ValidationIssue,
  ServiceNodeConfig,
  DecisionNodeConfig,
  RuleConditionGroup,
  isRuleGroup,
} from './types';

// --- Palette items ---

const PALETTE_ITEMS: Array<{ type: FrameworkNodeType; label: string; icon: React.ReactNode; description: string }> = [
  { type: 'service', label: 'Service Node', icon: <Globe className="w-4 h-4" />, description: 'HTTP API call' },
  { type: 'decision', label: 'Decision Node', icon: <GitBranch className="w-4 h-4" />, description: 'Business rules' },
  { type: 'llm', label: 'LLM Node', icon: <Brain className="w-4 h-4" />, description: 'Language model' },
  { type: 'form', label: 'Form Node', icon: <FileText className="w-4 h-4" />, description: 'User input form' },
];

// --- Validation ---

function validateBlueprint(doc: ReturnType<typeof useNodeBuilderStore.getState>['document']): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!doc.metadata.name || doc.metadata.name === 'Untitled Node Blueprint') {
    issues.push({ severity: 'error', message: 'Blueprint name is required.' });
  }

  if (doc.nodes.length === 0) {
    issues.push({ severity: 'error', message: 'Blueprint must contain at least one node.' });
  }

  doc.nodes.forEach((node) => {
    if (node.type === 'service') {
      const cfg = node.data.config as ServiceNodeConfig;
      if (!cfg.apiUrl || cfg.apiUrl.trim() === '') {
        issues.push({ severity: 'error', message: `Service node "${node.data.label}" is missing an API URL.`, nodeId: node.id });
      }
      if (!cfg.name || cfg.name.trim() === '') {
        issues.push({ severity: 'warning', message: `Service node "${node.data.label}" is missing a service name.`, nodeId: node.id });
      }
    }

    if (node.type === 'decision') {
      const cfg = node.data.config as DecisionNodeConfig;
      if (!cfg.ruleDefinition.ruleSetId) {
        issues.push({ severity: 'error', message: `Decision node "${node.data.label}" is missing a Rule Set ID.`, nodeId: node.id });
      }
      const conditions = cfg.ruleDefinition.conditions;
      if (!conditions.rules || conditions.rules.length === 0) {
        issues.push({ severity: 'error', message: `Decision node "${node.data.label}" has no conditions defined.`, nodeId: node.id });
      } else {
        // Check that all leaf conditions have field + operator
        const checkLeaves = (group: RuleConditionGroup) => {
          group.rules.forEach((rule) => {
            if (isRuleGroup(rule)) {
              checkLeaves(rule);
            } else {
              if (!rule.field) {
                issues.push({ severity: 'error', message: `Decision node "${node.data.label}" has a condition with no field selected.`, nodeId: node.id });
              }
            }
          });
        };
        checkLeaves(conditions);
      }
      if (!cfg.ruleDefinition.outcomes.true && !cfg.ruleDefinition.outcomes.false) {
        issues.push({ severity: 'warning', message: `Decision node "${node.data.label}" has no outcomes defined.`, nodeId: node.id });
      }
    }
  });

  // Validate edges
  if (doc.nodes.length > 1 && doc.edges.length === 0) {
    issues.push({ severity: 'warning', message: 'Multiple nodes exist but no connections. Consider linking nodes to define the flow.' });
  }

  doc.edges.forEach((edge) => {
    const sourceExists = doc.nodes.find((n) => n.id === edge.source);
    const targetExists = doc.nodes.find((n) => n.id === edge.target);
    if (!sourceExists || !targetExists) {
      issues.push({ severity: 'error', message: `Edge references a missing node (${edge.source} → ${edge.target}).` });
    }
  });

  return issues;
}

// --- Main component ---

export const NodeBuilder: React.FC = () => {
  const store = useNodeBuilderStore();
  const { document, selectedNodeId, isDirty, validationIssues, testResult } = store;

  // React Flow node type mapping
  const nodeTypes = useMemo(
    () => ({
      service: BlueprintCanvasNode,
      decision: BlueprintCanvasNode,
      llm: BlueprintCanvasNode,
      form: BlueprintCanvasNode,
    }),
    []
  );

  // Convert blueprint nodes to React Flow nodes
  const rfNodes: RFNode[] = useMemo(
    () =>
      document.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: {
          type: n.type,
          label: n.data.label,
          selected: n.id === selectedNodeId,
          onSelect: () => store.selectNode(n.id),
          onDelete: () => store.deleteNode(n.id),
        },
      })),
    [document.nodes, selectedNodeId, store]
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      document.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#000000', strokeWidth: 2 },
      })),
    [document.edges]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      changes.forEach((change) => {
        if (change.type === 'position' && change.position) {
          store.updateNodePosition(change.id, change.position);
        }
      });
    },
    [store]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      changes.forEach((change) => {
        if (change.type === 'remove') {
          store.deleteEdge(change.id);
        }
      });
    },
    [store]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        store.addEdge(connection.source, connection.target);
      }
    },
    [store]
  );

  const handleAddNode = (type: FrameworkNodeType) => {
    const count = document.nodes.length;
    store.addNode(type, { x: 150 + count * 60, y: 120 + count * 40 });
  };

  // --- Toolbar actions ---

  const handleValidate = async () => {
    const issues = validateBlueprint(document);
    store.setValidationIssues(issues);

    // Also validate decision rules via backend API
    const decisionNodes = document.nodes.filter((n) => n.type === 'decision');
    for (const node of decisionNodes) {
      const cfg = node.data.config as DecisionNodeConfig;
      try {
        const result = await blueprintService.validateRule(cfg.ruleDefinition as any);
        if (!result.valid) {
          result.errors.forEach((err) => {
            issues.push({ severity: 'error', message: `Decision "${node.data.label}": ${err}`, nodeId: node.id });
          });
          store.setValidationIssues([...issues]);
        }
      } catch {
        // Backend may not be running — local validation is sufficient
      }
    }

    const errors = issues.filter((i) => i.severity === 'error');
    const warnings = issues.filter((i) => i.severity === 'warning');
    if (errors.length === 0 && warnings.length === 0) {
      toast.success('Validation passed — no issues found.');
    } else if (errors.length === 0) {
      toast(`Validation passed with ${warnings.length} warning(s).`, { icon: '⚠️' });
    } else {
      toast.error(`Validation failed with ${errors.length} error(s).`);
    }
  };

  const handleSave = async () => {
    const issues = validateBlueprint(document);
    const errors = issues.filter((i) => i.severity === 'error');
    if (errors.length > 0) {
      store.setValidationIssues(issues);
      toast.error(`Cannot save — fix ${errors.length} validation error(s) first.`);
      return;
    }

    try {
      const payload = {
        name: document.metadata.name,
        description: document.metadata.description,
        source_type: 'graph',
        graph_definition: {
          nodes: document.nodes.map((n) => ({
            id: n.id,
            type: n.type,
            position: n.position,
            data: n.data,
          })),
          edges: document.edges,
        },
        input_contract: document.inputContract,
        output_contract: document.outputContract,
      };

      if (document.blueprintId) {
        await blueprintService.updateBlueprint(document.blueprintId, payload);
        toast.success('Blueprint updated successfully.');
      } else {
        const result = await blueprintService.saveBlueprint(document.tenantId, payload);
        store.setDocument({ ...document, blueprintId: result.blueprint_id });
        toast.success('Blueprint saved successfully.');
      }
      store.markClean();
    } catch (err: any) {
      toast.error(`Save failed: ${err.message || 'Unknown error'}`);
    }
  };

  const handleTest = async () => {
    const decisionNode = document.nodes.find((n) => n.type === 'decision' && n.id === selectedNodeId);
    if (!decisionNode) {
      toast.error('Select a Decision node to test its rules.');
      return;
    }

    const cfg = decisionNode.data.config as DecisionNodeConfig;

    // Build sample input from preceding service node output schema
    const incomingEdges = document.edges.filter((e) => e.target === decisionNode.id);
    const sourceNodes = incomingEdges
      .map((e) => document.nodes.find((n) => n.id === e.source))
      .filter((n) => n && n.type === 'service');

    const sampleInput: Record<string, any> = {};
    sourceNodes.forEach((n) => {
      if (!n) return;
      const svcConfig = n.data.config as ServiceNodeConfig;
      try {
        const schema = JSON.parse(svcConfig.outputSchema || '{}');
        const obj: Record<string, any> = {};
        Object.entries(schema).forEach(([key, type]) => {
          if (type === 'number') obj[key] = 0;
          else if (type === 'boolean') obj[key] = false;
          else obj[key] = '';
        });
        sampleInput[n.id] = obj;
      } catch {
        // ignore
      }
    });

    try {
      const result = await blueprintService.testRule(cfg.ruleDefinition as any, sampleInput);
      store.setTestResult({
        matched: result.matched,
        outcome: result.outcome,
        evaluationTrace: result.evaluation_trace || [],
        error: result.error,
      });
      if (result.error) {
        toast.error(`Test error: ${result.error}`);
      } else {
        toast.success(`Test result: ${result.outcome || 'no outcome'} (matched: ${result.matched})`);
      }
    } catch (err: any) {
      // Backend not running — show a local message
      store.setTestResult({
        matched: false,
        outcome: null,
        evaluationTrace: [],
        error: err.message || 'Backend not reachable',
      });
      toast.error(`Test failed: ${err.message || 'Backend not reachable'}`);
    }
  };

  const [showPublishConfirm, setShowPublishConfirm] = useState(false);

  const handlePublish = () => {
    if (!document.blueprintId) {
      toast.error('Save the blueprint before publishing.');
      return;
    }

    const issues = validateBlueprint(document);
    const errors = issues.filter((i) => i.severity === 'error');
    if (errors.length > 0) {
      store.setValidationIssues(issues);
      toast.error(`Cannot publish — fix ${errors.length} validation error(s) first.`);
      return;
    }

    setShowPublishConfirm(true);
  };

  const confirmPublish = async () => {
    setShowPublishConfirm(false);
    try {
      await blueprintService.publishBlueprint(document.blueprintId!);
      store.setMetadata({ status: 'PUBLISHED' });
      toast.success('Blueprint published successfully.');
    } catch (err: any) {
      toast.error(`Publish failed: ${err.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-light-bg dark:bg-dark-bg">
      {/* TOP: Toolbar */}
      <div className="flex-shrink-0 bg-white dark:bg-dark-surface border-b border-light-border dark:border-dark-border px-4 py-3">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Metadata fields */}
          <input
            type="text"
            value={document.metadata.name}
            onChange={(e) => store.setMetadata({ name: e.target.value })}
            placeholder="Blueprint name"
            className="px-3 py-1.5 text-sm font-bold border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white w-56"
          />
          <input
            type="text"
            value={document.metadata.description}
            onChange={(e) => store.setMetadata({ description: e.target.value })}
            placeholder="Description"
            className="px-3 py-1.5 text-xs border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-light-text-secondary dark:text-dark-text-secondary rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white w-48"
          />
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary">Version</label>
            <input
              type="text"
              value={document.metadata.version}
              onChange={(e) => store.setMetadata({ version: e.target.value })}
              className="px-2 py-1 text-xs font-mono border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary rounded-lg w-16 focus:ring-2 focus:ring-black dark:focus:ring-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary">Status</label>
            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${
              document.metadata.status === 'PUBLISHED'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}>
              {document.metadata.status}
            </span>
          </div>

          {isDirty && (
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Unsaved
            </span>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleValidate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-light-text-primary dark:text-dark-text-primary hover:bg-light-hover dark:hover:bg-dark-hover rounded-lg border border-light-border dark:border-dark-border transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Validate
            </button>
            <button
              onClick={handleTest}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-light-text-primary dark:text-dark-text-primary hover:bg-light-hover dark:hover:bg-dark-hover rounded-lg border border-light-border dark:border-dark-border transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              Test
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Save
            </button>
            <button
              onClick={handlePublish}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Publish
            </button>
          </div>
        </div>

        {/* Validation issues bar */}
        {validationIssues.length > 0 && (
          <div className="mt-2 space-y-1">
            {validationIssues.slice(0, 5).map((issue, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 text-[11px] font-medium px-2 py-1 rounded-lg ${
                  issue.severity === 'error'
                    ? 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
                    : 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20'
                }`}
              >
                {issue.severity === 'error' ? <XCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                {issue.message}
              </div>
            ))}
            {validationIssues.length > 5 && (
              <div className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary px-2">
                ...and {validationIssues.length - 5} more
              </div>
            )}
          </div>
        )}

        {/* Test result */}
        {testResult && (
          <div className="mt-2 p-3 rounded-lg border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface-alt space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary">Test Result</span>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                testResult.matched
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}>
                {testResult.matched ? 'MATCHED' : 'NOT MATCHED'}
              </span>
            </div>
            {testResult.outcome && (
              <div className="text-xs">
                <span className="font-bold text-light-text-secondary dark:text-dark-text-secondary">Outcome: </span>
                <span className="font-bold text-light-text-primary dark:text-dark-text-primary">{testResult.outcome}</span>
              </div>
            )}
            {testResult.error && (
              <div className="text-[11px] text-red-600 dark:text-red-400">{testResult.error}</div>
            )}
            {testResult.evaluationTrace.length > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto scrollbar-thin">
                {testResult.evaluationTrace.map((step, i) => (
                  <div key={i} className="flex items-start gap-2 text-[10px] font-mono">
                    <span className={`px-1.5 py-0.5 rounded font-bold ${
                      step.result
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    }`}>
                      {step.result ? 'PASS' : 'FAIL'}
                    </span>
                    <span className="text-light-text-secondary dark:text-dark-text-secondary">{step.description}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main 3-column layout */}
      <div className="flex-1 flex min-h-0">
        {/* LEFT: Palette */}
        <div className="w-56 flex-shrink-0 bg-white dark:bg-dark-surface border-r border-light-border dark:border-dark-border flex flex-col">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-light-border dark:border-dark-border">
            <Layers size={14} className="text-light-text-secondary dark:text-dark-text-secondary" />
            <h3 className="text-[10px] font-bold uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary">
              Framework Nodes
            </h3>
          </div>
          <div className="p-3 space-y-2 overflow-y-auto scrollbar-thin flex-1">
          {PALETTE_ITEMS.map((item) => (
            <button
              key={item.type}
              onClick={() => handleAddNode(item.type)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface hover:bg-light-hover dark:hover:bg-dark-hover hover:border-black dark:hover:border-white transition-all group"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-light-surface dark:bg-dark-surface-alt text-light-text-primary dark:text-dark-text-primary group-hover:bg-black group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black transition-colors">
                {item.icon}
              </div>
              <div className="flex-1 text-left">
                <div className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary">{item.label}</div>
                <div className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{item.description}</div>
              </div>
              <Plus className="w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}

          {/* Quick start hint */}
          <div className="mt-4 p-3 rounded-xl bg-light-surface dark:bg-dark-surface-alt border border-dashed border-light-border dark:border-dark-border">
            <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
              Click a node above to add it to the canvas. Then drag from a node's right handle to another node's left handle to connect them.
            </p>
          </div>
          </div>
        </div>

        {/* CENTER: Canvas */}
        <div className="flex-1 min-w-0 relative flex flex-col">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-light-border dark:border-dark-border bg-white dark:bg-dark-surface">
            <GitBranch size={14} className="text-light-text-secondary dark:text-dark-text-secondary" />
            <h3 className="text-[10px] font-bold uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary">
              Blueprint Canvas
            </h3>
          </div>
          <div className="flex-1 min-w-0 relative">
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            className="bg-light-surface dark:bg-dark-bg"
          >
            <Background color="#D0D0D0" gap={20} size={1.5} />
            <Controls className="!bg-white dark:!bg-dark-surface !border-light-border dark:!border-dark-border" />
            <MiniMap
              className="!bg-white dark:!bg-dark-surface !border-light-border dark:!border-dark-border"
              nodeColor="#000000"
              maskColor="rgba(0,0,0,0.05)"
            />
          </ReactFlow>

          {document.nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-light-surface dark:bg-dark-surface-alt flex items-center justify-center mx-auto mb-4 border border-dashed border-light-border dark:border-dark-border">
                    <Plus className="w-8 h-8 text-light-border dark:text-dark-border" />
                  </div>
                  <h3 className="text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary">
                    Empty Blueprint Canvas
                  </h3>
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                    Add framework nodes from the palette to start building.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Properties Panel */}
        <div className="w-80 flex-shrink-0 bg-white dark:bg-dark-surface border-l border-light-border dark:border-dark-border properties-panel flex flex-col">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-light-border dark:border-dark-border">
            <Settings size={14} className="text-light-text-secondary dark:text-dark-text-secondary" />
            <h3 className="text-[10px] font-bold uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary">
              Configuration
            </h3>
          </div>
          <div className="flex-1 overflow-hidden">
            <PropertiesPanel />
          </div>
        </div>
      </div>

      {/* Publish Confirmation Dialog */}
      {showPublishConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowPublishConfirm(false)}
        >
          <div
            className="relative w-full max-w-md mx-4 bg-white dark:bg-dark-surface rounded-2xl shadow-2xl border border-light-border dark:border-dark-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Upload size={20} className="text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-light-text-primary dark:text-dark-text-primary mb-1">
                    Publish Blueprint
                  </h3>
                  <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    Publish "{document.metadata.name}" v{document.metadata.version}? Once published, this version becomes immutable. Future edits will create a new draft version.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowPublishConfirm(false)}
                  className="px-4 py-2.5 text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary border border-light-border dark:border-dark-border rounded-lg hover:bg-light-hover dark:hover:bg-dark-hover transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmPublish}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all"
                >
                  <Upload size={16} />
                  Publish
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

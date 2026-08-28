import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import ReactFlow, { Background, Controls, BackgroundVariant, ConnectionLineType, ReactFlowInstance } from 'react-flow-renderer';
import { useLangGraphStore, NodeExecutionStatus } from '../../stores/langGraphStore';
import { langGraphService, LangGraphWorkflow } from '../../services/langGraphService';
import { ServiceNode } from './ServiceNode';
import { DecisionNode } from './DecisionNode';
import { LLMNode } from './LLMNode';
import { FormNode } from './FormNode';
import { WorkflowNode } from './WorkflowNode';
import { ParallelNode } from './ParallelNode';
import { MergeNode } from './MergeNode';
import { MapperNode } from './MapperNode';
import { CustomEdge } from './CustomEdge';
import { Button } from '../ui/button';
import { Settings, Trash2, GitBranch, Code, Save, Upload, Play, Maximize2, Minimize2, ArrowLeft, Workflow, X, Globe, Bot, FileText, RefreshCw, ExternalLink, Eye, Pencil, CheckCircle, XCircle, Loader2, Terminal, GitMerge, Sparkles, Sliders, FileOutput } from 'lucide-react';
import toast from 'react-hot-toast';
import { WorkflowExecuteModal } from './WorkflowExecuteModal';
import { WorkflowExecutionWithForms } from './WorkflowExecutionWithForms';
import { ServiceConfigModal } from './ServiceConfigModal';
import { DecisionConfigModal } from './DecisionConfigModal';
import { FormBuilderModal } from './FormBuilderModal';
import { FormPreviewModal } from './FormPreviewModal';
import { WorkflowConfigModal } from './WorkflowConfigModal';
import { ProgrammaticGeneratorModal } from './ProgrammaticGeneratorModal';
import { WhatIfScenarioStudio } from './WhatIfScenarioStudio';
import { ObjectMapperModal } from './ObjectMapperModal';
import { useTnpStore } from '../../TenantNodePlatform/tnpStore';
import { materializeBlueprint } from '../../services/blueprintMaterializationService';
import type { Blueprint } from '../../TenantNodePlatform/types';
import { Package } from 'lucide-react';

const nodeTypes = {
  serviceNode: ServiceNode,
  decisionNode: DecisionNode,
  llmNode: LLMNode,
  formNode: FormNode,
  workflowNode: WorkflowNode,
  parallelNode: ParallelNode,
  mergeNode: MergeNode,
  mapperNode: MapperNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

type ConfigTab = 'config' | 'advanced' | 'logs';

export const LangGraphBuilder: React.FC = () => {
  const { workflowId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isViewMode = searchParams.get('mode') === 'view';
  const [workflowName, setWorkflowName] = useState('');
  const [workflowContext, setWorkflowContext] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showJSONPreview, setShowJSONPreview] = useState(false);
  const [inputJSON, setInputJSON] = useState('{\n  "message": {}\n}');
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [edgeCondition, setEdgeCondition] = useState('');
  const [showExecuteModal, setShowExecuteModal] = useState(false);
  const [showExecuteWithFormsModal, setShowExecuteWithFormsModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<ConfigTab>('config');
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editingLabelValue, setEditingLabelValue] = useState('');
  const labelInputRef = useRef<HTMLInputElement>(null);
  const [showConfigDrawer, setShowConfigDrawer] = useState(false);
  const [isEditingWorkflowName, setIsEditingWorkflowName] = useState(false);
  const workflowNameInputRef = useRef<HTMLInputElement>(null);

  const [availableWorkflows, setAvailableWorkflows] = useState<LangGraphWorkflow[]>([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(false);
  const [showServiceConfigModal, setShowServiceConfigModal] = useState(false);
  const [showDecisionConfigModal, setShowDecisionConfigModal] = useState(false);
  const [showFormBuilderModal, setShowFormBuilderModal] = useState(false);
  const [showFormPreviewModal, setShowFormPreviewModal] = useState(false);
  const [showWorkflowConfigModal, setShowWorkflowConfigModal] = useState(false);
  const [showProgrammaticModal, setShowProgrammaticModal] = useState(false);
  const [showWhatIfStudio, setShowWhatIfStudio] = useState(false);
  const [showMapperConfigModal, setShowMapperConfigModal] = useState(false);

  const tnpStore = useTnpStore();

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addServiceNode,
    addDecisionNode,
    addLLMNode,
    addFormNode,
    addWorkflowNode,
    addParallelNode,
    addMergeNode,
    addMapperNode,
    clearCanvas,
    exportJSON,
    importJSON,
    setInputs,
    updateEdgeCondition,
    setEdges,
    selectedNodeId,
    setSelectedNodeId,
    updateNodeData,
    inputs,
    nodeExecutionStates,
    setNodeExecutionState,
    addMaterializedFragment,
  } = useLangGraphStore();

  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const selectedNodeExecution = selectedNodeId ? nodeExecutionStates[selectedNodeId] : undefined;

  useEffect(() => {
    if (workflowId && workflowId !== 'new') {
      loadWorkflow();
    } else if (workflowId === 'new') {
      clearCanvas();
      setWorkflowName('');
      setWorkflowContext('');
      setInputJSON('{\n  "message": {}\n}');
    }
  }, [workflowId]);

  useEffect(() => {
    if (inputJSON && inputJSON.trim()) {
      try {
        const parsed = JSON.parse(inputJSON);
        setInputs(parsed);
      } catch {
        // ignore invalid JSON
      }
    }
  }, [inputJSON, setInputs]);

  useEffect(() => {
    if (selectedNode?.type === 'workflowNode') {
      loadAvailableWorkflows();
    }
  }, [selectedNode?.type]);

  useEffect(() => {
    if (!isViewMode && tnpStore.tenants.length === 0) {
      tnpStore.loadTenants();
    }
  }, [isViewMode]);

  useEffect(() => {
    if (isEditingLabel && labelInputRef.current) {
      labelInputRef.current.focus();
      labelInputRef.current.select();
    }
  }, [isEditingLabel]);

  useEffect(() => {
    if (isEditingWorkflowName && workflowNameInputRef.current) {
      workflowNameInputRef.current.focus();
      workflowNameInputRef.current.select();
    }
  }, [isEditingWorkflowName]);

  const loadAvailableWorkflows = async () => {
    try {
      setWorkflowsLoading(true);
      const workflows = await langGraphService.getAllWorkflows();
      setAvailableWorkflows(workflows);
    } catch (error) {
      console.error('Failed to load workflows:', error);
    } finally {
      setWorkflowsLoading(false);
    }
  };

  const loadWorkflow = async () => {
    try {
      setIsLoading(true);
      const decodedName = decodeURIComponent(workflowId!);
      const workflow = await langGraphService.getWorkflowByName(decodedName);
      if (workflow) {
        setWorkflowName(workflow.name);
        setWorkflowContext(workflow.context || '');
        if (workflow.data) {
          importJSON(JSON.stringify(workflow.data));
        }
      }
    } catch (error) {
      console.error('Failed to load workflow:', error);
      toast.error('Failed to load workflow');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveWorkflow = async () => {
    if (!workflowName.trim()) {
      toast.error('Please enter a workflow name');
      return;
    }

    if (!workflowContext.trim()) {
      toast.error('Please enter workflow context');
      return;
    }

    try {
      setIsLoading(true);
      const graphData = JSON.parse(exportJSON());

      if (workflowId && workflowId !== 'new') {
        await langGraphService.updateWorkflow(workflowName, workflowContext, graphData);
        toast.success('Workflow updated successfully');
      } else {
        const newWorkflow = await langGraphService.createWorkflow(workflowName, workflowContext, graphData);
        toast.success('Workflow created successfully');
        navigate(`/langgraph/builder/${encodeURIComponent(newWorkflow.name)}`, { replace: true });
      }
      setShowSaveDialog(false);
    } catch (error) {
      console.error('Failed to save workflow:', error);
      toast.error('Failed to save workflow');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdgeButtonClick = useCallback((edge: any) => {
    setSelectedEdge(edge.id);
    const foundEdge = edges.find(e => e.id === edge.id);
    setEdgeCondition(foundEdge?.data?.condition || '');
  }, [edges]);

  const edgesWithHandler = edges.map(edge => ({
    ...edge,
    data: {
      ...edge.data,
      onEdgeClick: handleEdgeButtonClick,
    },
  }));

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onBlueprintDragStart = (event: React.DragEvent, blueprint: Blueprint) => {
    event.dataTransfer.setData('application/reactflow-blueprint', JSON.stringify(blueprint));
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowInstance || !reactFlowWrapper.current) {
        return;
      }

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      // --- Blueprint materialization path ---
      const blueprintJson = event.dataTransfer.getData('application/reactflow-blueprint');
      if (blueprintJson) {
        try {
          const blueprint: Blueprint = JSON.parse(blueprintJson);
          const fragment = materializeBlueprint({
            tenant_id: blueprint.tenant_id,
            blueprint_id: blueprint.blueprint_id,
            blueprint_name: blueprint.name,
            blueprint_version: blueprint.version,
            graph_definition: blueprint.graph_definition as any,
            drop_position: position,
          });
          if (fragment.nodes.length === 0) {
            toast.error('Blueprint has no nodes to materialize');
            return;
          }
          addMaterializedFragment(fragment.nodes, fragment.edges);
          setSelectedNodeId(fragment.rootWorkflowNodeId);
          toast.success(`Materialized "${blueprint.name}" (${fragment.nodes.length} nodes)`);
        } catch (err) {
          console.error('Materialization failed:', err);
          toast.error('Failed to materialize blueprint');
        }
        setActiveTab('config');
        return;
      }

      // --- Standard framework node path ---
      const nodeType = event.dataTransfer.getData('application/reactflow');
      if (!nodeType) return;

      switch (nodeType) {
        case 'serviceNode':
          addServiceNode(position);
          toast.success('Service node added');
          break;
        case 'decisionNode':
          addDecisionNode(position);
          toast.success('Decision node added');
          break;
        case 'llmNode':
          addLLMNode(position);
          toast.success('LLM node added');
          break;
        case 'formNode':
          addFormNode(position);
          toast.success('Form node added');
          break;
        case 'workflowNode':
          addWorkflowNode(position);
          toast.success('Workflow node added');
          break;
        case 'parallelNode':
          addParallelNode(position);
          toast.success('Parallel node added');
          break;
        case 'mergeNode':
          addMergeNode(position);
          toast.success('Merge node added');
          break;
        case 'mapperNode':
          addMapperNode(position);
          toast.success('Object Mapper node added');
          break;
      }
      setActiveTab('config');
    },
    [reactFlowInstance, addServiceNode, addDecisionNode, addLLMNode, addFormNode, addWorkflowNode, addParallelNode, addMergeNode, addMapperNode, addMaterializedFragment, setSelectedNodeId]
  );

  const handleClearCanvas = () => {
    if (window.confirm('Are you sure you want to clear the entire canvas?')) {
      clearCanvas();
      toast.success('Canvas cleared');
    }
  };

  const handleSaveJSON = () => {
    try {
      const parsedInput = JSON.parse(inputJSON);
      setInputs(parsedInput);
      const json = exportJSON();
      navigator.clipboard.writeText(json);
      toast.success('JSON saved to clipboard');
    } catch (error) {
      toast.error('Invalid input JSON format');
    }
  };

  const handleLoadJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const jsonString = event.target?.result as string;
            importJSON(jsonString);
            toast.success('Workflow loaded successfully');
          } catch (error) {
            toast.error('Failed to load JSON');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleExecuteWorkflow = () => {
    try {
      const parsedInput = JSON.parse(inputJSON);
      setInputs(parsedInput);
      setShowExecuteModal(true);
    } catch (error) {
      toast.error('Invalid input JSON format');
    }
  };

  const handleExecuteWorkflowWithForms = () => {
    try {
      const parsedInput = JSON.parse(inputJSON);
      setInputs(parsedInput);
      setShowExecuteWithFormsModal(true);
    } catch (error) {
      toast.error('Invalid input JSON format');
    }
  };

  const handleExportJSON = async () => {
    if (nodes.length === 0) {
      toast.error('Cannot save an empty graph');
      return;
    }
    setShowSaveDialog(true);
  };

  const handleTogglePreview = () => {
    try {
      const parsedInput = JSON.parse(inputJSON);
      setInputs(parsedInput);
      setShowJSONPreview(!showJSONPreview);
    } catch (error) {
      toast.error('Invalid input JSON format');
    }
  };

  const handleEdgeClick = useCallback((event: React.MouseEvent, edge: any) => {
    event.stopPropagation();
    setSelectedEdge(edge.id);
    setEdgeCondition(edge.data?.condition || '');
  }, []);

  const handleSaveCondition = () => {
    if (selectedEdge) {
      updateEdgeCondition(selectedEdge, edgeCondition);
      toast.success('Condition updated');
      setSelectedEdge(null);
    }
  };

  const handleDeleteEdge = () => {
    if (selectedEdge && window.confirm('Delete this edge?')) {
      const updatedEdges = edges.filter(e => e.id !== selectedEdge);
      setEdges(updatedEdges);
      setSelectedEdge(null);
      setEdgeCondition('');
      toast.success('Edge deleted');
    }
  };

  const handleClosePanel = () => {
    setSelectedEdge(null);
    setEdgeCondition('');
  };

  const closeConfigPanel = () => {
    setSelectedNodeId(null);
    setIsEditingLabel(false);
  };

  const handleStartEditLabel = () => {
    if (selectedNode) {
      setEditingLabelValue((selectedNode.data as any).label || selectedNode.id);
      setIsEditingLabel(true);
    }
  };

  const handleSaveLabel = () => {
    if (selectedNode && editingLabelValue.trim()) {
      updateNodeData(selectedNode.id, { label: editingLabelValue.trim() });
      toast.success('Label updated');
    }
    setIsEditingLabel(false);
  };

  const handleLabelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveLabel();
    } else if (e.key === 'Escape') {
      setIsEditingLabel(false);
    }
  };

  const handleStartEditWorkflowName = () => {
    if (!isViewMode) {
      setIsEditingWorkflowName(true);
    }
  };

  const handleSaveWorkflowName = () => {
    if (workflowName.trim()) {
      setIsEditingWorkflowName(false);
    } else {
      toast.error('Workflow name cannot be empty');
    }
  };

  const handleWorkflowNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveWorkflowName();
    } else if (e.key === 'Escape') {
      setIsEditingWorkflowName(false);
      setWorkflowName(workflowName || 'New Workflow');
    }
  };

  const validateNodeConfig = (node: any): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const data = node.data;

    switch (node.type) {
      case 'serviceNode':
        if (!data.url) errors.push('URL is required');
        break;
      case 'llmNode':
        if (!data.model) errors.push('Model is required');
        if (!data.prompt) errors.push('Prompt is required');
        break;
      case 'decisionNode':
        if (!data.script && !(data as any).ruleDefinition) errors.push('Decision rule configuration is required');
        break;
      case 'formNode':
        if (!data.formConfig) errors.push('Form configuration is required');
        break;
      case 'workflowNode':
        if (!data.dynamicSelection && !data.selectedWorkflowName) {
          errors.push('Workflow selection is required');
        }
        break;
      case 'parallelNode':
      case 'mergeNode':
        break;
    }

    return { valid: errors.length === 0, errors };
  };

  const handleRunNode = async () => {
    if (!selectedNode) return;

    const validation = validateNodeConfig(selectedNode);
    if (!validation.valid) {
      setNodeExecutionState(selectedNode.id, {
        status: 'failed',
        logs: [`Validation failed:`, ...validation.errors],
        error: validation.errors.join(', '),
      });
      setActiveTab('logs');
      toast.error('Validation failed - check logs');
      return;
    }

    setNodeExecutionState(selectedNode.id, {
      status: 'running',
      logs: [`[${new Date().toISOString()}] Starting node execution...`],
    });
    setActiveTab('logs');

    try {
      const nodeData = selectedNode.data as any;
      let result: any;

      if (selectedNode.type === 'serviceNode' && nodeData.url) {
        setNodeExecutionState(selectedNode.id, {
          status: 'running',
          logs: [
            `[${new Date().toISOString()}] Starting node execution...`,
            `[${new Date().toISOString()}] Calling ${nodeData.method || 'GET'} ${nodeData.url}`,
          ],
        });

        const response = await fetch(nodeData.url, {
          method: nodeData.method || 'GET',
          headers: nodeData.config?.headers?.reduce((acc: any, h: any) => ({ ...acc, [h.key]: h.value }), {}) || {},
          body: nodeData.method !== 'GET' && nodeData.config?.requestBody ? nodeData.config.requestBody : undefined,
        });

        result = await response.text();
        try {
          result = JSON.parse(result);
        } catch {}

        setNodeExecutionState(selectedNode.id, {
          status: response.ok ? 'success' : 'failed',
          logs: [
            `[${new Date().toISOString()}] Starting node execution...`,
            `[${new Date().toISOString()}] Calling ${nodeData.method || 'GET'} ${nodeData.url}`,
            `[${new Date().toISOString()}] Response status: ${response.status}`,
            `[${new Date().toISOString()}] Response:`,
            typeof result === 'object' ? JSON.stringify(result, null, 2) : result,
          ],
          lastRun: new Date(),
          error: response.ok ? undefined : `HTTP ${response.status}`,
        });
      } else {
        await new Promise(resolve => setTimeout(resolve, 1500));

        setNodeExecutionState(selectedNode.id, {
          status: 'success',
          logs: [
            `[${new Date().toISOString()}] Starting node execution...`,
            `[${new Date().toISOString()}] Node type: ${selectedNode.type}`,
            `[${new Date().toISOString()}] Simulated execution completed`,
            `[${new Date().toISOString()}] Result: Node executed successfully`,
          ],
          lastRun: new Date(),
        });
      }

      toast.success('Node executed successfully');
    } catch (error: any) {
      setNodeExecutionState(selectedNode.id, {
        status: 'failed',
        logs: [
          ...(nodeExecutionStates[selectedNode.id]?.logs || []),
          `[${new Date().toISOString()}] Error: ${error.message}`,
        ],
        lastRun: new Date(),
        error: error.message,
      });
      toast.error(`Execution failed: ${error.message}`);
    }
  };

  const renderConfigTabContent = () => {
    if (!selectedNode) return null;
    const nodeData = selectedNode.data as any;

    switch (selectedNode.type) {
      case 'parallelNode':
      case 'mergeNode':
        return (
          <div className="text-xs text-gray-500 text-center py-6">
            This node has no additional configuration options.
          </div>
        );

      case 'serviceNode':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">URL</label>
              <input
                type="text"
                value={nodeData.url || ''}
                onChange={(e) => updateNodeData(selectedNode.id, { url: e.target.value })}
                placeholder="https://api.example.com/endpoint"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">HTTP Method</label>
              <select
                value={nodeData.method || 'GET'}
                onChange={(e) => updateNodeData(selectedNode.id, { method: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
          </div>
        );

      case 'decisionNode':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Decision Rules</label>
                <p className="text-xs text-gray-500">
                  {nodeData.ruleDefinition
                    ? `Business rule configured (ID: ${nodeData.ruleDefinition.ruleSetId || 'unnamed'})`
                    : 'Click "Configure Rules" in the Advanced tab to build decision logic'}
                </p>
              </div>
              <Button
                onClick={() => setShowDecisionConfigModal(true)}
                className="px-3 py-1.5 text-xs font-bold gap-1.5 rounded-lg"
              >
                <Sliders className="w-3.5 h-3.5" />
                Configure Rules
              </Button>
            </div>
            {nodeData.ruleDefinition && (
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-xs font-mono text-gray-600 mb-1">Outcomes:</div>
                <div className="flex gap-2">
                  <span className="px-2 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-700 rounded">THEN: {nodeData.ruleDefinition.outcomes?.true || 'N/A'}</span>
                  <span className="px-2 py-0.5 text-xs font-bold bg-rose-100 text-rose-700 rounded">ELSE: {nodeData.ruleDefinition.outcomes?.false || 'N/A'}</span>
                </div>
              </div>
            )}
            {nodeData.script && !nodeData.ruleDefinition && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-xs text-amber-700">
                  This node uses a legacy Python script. Click "Configure Rules" to migrate to the Business Rule Builder.
                </p>
              </div>
            )}
          </div>
        );

      case 'llmNode':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Model</label>
              <input
                type="text"
                value={nodeData.model || ''}
                onChange={(e) => updateNodeData(selectedNode.id, { model: e.target.value })}
                placeholder="gpt-4, claude-3-sonnet, gemini-pro"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Prompt Template</label>
              <textarea
                value={nodeData.prompt || ''}
                onChange={(e) => updateNodeData(selectedNode.id, { prompt: e.target.value })}
                placeholder="Enter your prompt template here..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded font-mono resize-none h-32 focus:outline-none focus:ring-1 focus:ring-gray-400"
              />
              <p className="text-xs text-gray-500 mt-1.5">
                Use {'{state.variable}'} to reference workflow state
              </p>
            </div>
          </div>
        );

      case 'formNode':
        return (
          <div className="space-y-4">
            {nodeData.formConfig && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Form Schema Preview</label>
                <textarea
                  value={JSON.stringify(nodeData.formConfig, null, 2)}
                  readOnly
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded font-mono resize-none h-32 bg-gray-50"
                />
              </div>
            )}
            {!nodeData.formConfig && (
              <div className="text-xs text-gray-500 text-center py-6 border border-dashed border-gray-300 rounded">
                Click "Edit Form" in Advanced tab to build your form
              </div>
            )}
          </div>
        );

      case 'workflowNode':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-medium text-gray-500">
                <input
                  type="checkbox"
                  checked={nodeData.dynamicSelection || false}
                  onChange={(e) => {
                    updateNodeData(selectedNode.id, { dynamicSelection: e.target.checked });
                    if (!e.target.checked) {
                      updateNodeData(selectedNode.id, { workflowFieldPath: undefined });
                    }
                  }}
                  className="w-3.5 h-3.5 rounded"
                />
                Dynamic Selection
              </label>
              <button
                onClick={loadAvailableWorkflows}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Refresh workflows"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${workflowsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {!nodeData.dynamicSelection ? (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Select Workflow</label>
                <select
                  value={nodeData.selectedWorkflowName || ''}
                  onChange={(e) => updateNodeData(selectedNode.id, { selectedWorkflowName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400"
                  disabled={workflowsLoading}
                >
                  <option value="">-- Select Workflow --</option>
                  {availableWorkflows.map((workflow) => (
                    <option key={workflow.name} value={workflow.name}>
                      {workflow.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Workflow Field Path</label>
                <input
                  type="text"
                  value={nodeData.workflowFieldPath || ''}
                  onChange={(e) => updateNodeData(selectedNode.id, { workflowFieldPath: e.target.value })}
                  placeholder="input.workflowName"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded font-mono focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Reference a field from previous nodes
                </p>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const renderAdvancedTabContent = () => {
    if (!selectedNode) return null;
    const nodeData = selectedNode.data as any;

    switch (selectedNode.type) {
      case 'parallelNode':
      case 'mergeNode':
        return (
          <div className="text-xs text-gray-500">
            This node type has no advanced configuration options.
          </div>
        );

      case 'serviceNode':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Current Configuration</label>
              <div className="text-xs text-gray-600 p-3 bg-gray-50 rounded border border-gray-300 space-y-1">
                {nodeData.config?.authType && nodeData.config.authType !== 'none' && (
                  <div>Auth: {nodeData.config.authType}</div>
                )}
                {nodeData.config?.headers?.length > 0 && (
                  <div>{nodeData.config.headers.length} headers configured</div>
                )}
                {nodeData.config?.timeout && (
                  <div>Timeout: {nodeData.config.timeout}ms</div>
                )}
                {nodeData.config?.retryConfig?.enabled && (
                  <div>Retries: {nodeData.config.retryConfig.maxRetries}</div>
                )}
                {(!nodeData.config || (nodeData.config.authType === 'none' && !nodeData.config.headers?.length)) && (
                  <div>No advanced configuration set</div>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowServiceConfigModal(true)}
              className="w-full px-3 py-2 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
            >
              Edit Advanced Configuration
            </button>
          </div>
        );

      case 'decisionNode':
        return (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              Open the Python editor for syntax highlighting and advanced editing features.
            </p>
            <button
              onClick={() => setShowDecisionConfigModal(true)}
              className="w-full px-3 py-2 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
            >
              Open Python Editor
            </button>
          </div>
        );

      case 'llmNode':
        return (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              LLM nodes currently use basic configuration. Advanced options like temperature, max tokens, and stop sequences may be added in future updates.
            </p>
          </div>
        );

      case 'formNode':
        return (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                onClick={() => setShowFormBuilderModal(true)}
                className="flex-1 px-3 py-2 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
              >
                {nodeData.formConfig ? 'Edit Form' : 'Create Form'}
              </button>
              {nodeData.formConfig && (
                <button
                  onClick={() => setShowFormPreviewModal(true)}
                  className="flex-1 px-3 py-2 text-sm bg-gray-500 hover:bg-gray-600 text-white rounded transition-colors flex items-center justify-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Preview
                </button>
              )}
            </div>
          </div>
        );

      case 'workflowNode':
        const selectedWorkflow = availableWorkflows.find(w => w.name === nodeData.selectedWorkflowName);
        return (
          <div className="space-y-4">
            {selectedWorkflow && (
              <div className="bg-gray-50 border border-gray-300 rounded p-3 space-y-2">
                <div className="text-xs font-medium text-gray-700">Workflow Details</div>
                <div className="text-xs text-gray-600">
                  <span className="font-medium">Context:</span> {selectedWorkflow.context || 'No context'}
                </div>
                <div className="text-xs text-gray-600">
                  <span className="font-medium">Version:</span> {selectedWorkflow.latest_version}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              {nodeData.selectedWorkflowName && (
                <button
                  onClick={() => window.open(`/langgraph/builder/${encodeURIComponent(nodeData.selectedWorkflowName)}?mode=view`, '_blank')}
                  className="flex-1 px-2 py-2 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors flex items-center justify-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  View Workflow
                </button>
              )}
              <button
                onClick={() => setShowWorkflowConfigModal(true)}
                className="flex-1 px-2 py-2 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
              >
                Configure Mapping
              </button>
            </div>
          </div>
        );

      case 'mapperNode':
        return (
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 shadow-sm">
              <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                <span>Response Object Mapper</span>
                <span className="font-mono bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded text-[10px] uppercase font-semibold">
                  {(nodeData.mapperConfig?.outputFormat || 'json')}
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Transform upstream node responses into the final JSON or XML payload.
              </p>
            </div>
            <button
              onClick={() => setShowMapperConfigModal(true)}
              className="w-full px-4 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <FileOutput className="w-4 h-4 text-white" />
              Configure Response Object Mapper
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  const renderLogsTabContent = () => {
    if (!selectedNode) return null;

    const executionState = nodeExecutionStates[selectedNode.id];

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Status:</span>
            {executionState?.status === 'running' && (
              <span className="flex items-center gap-1 text-xs text-blue-600">
                <Loader2 className="w-3 h-3 animate-spin" /> Running
              </span>
            )}
            {executionState?.status === 'success' && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle className="w-3 h-3" /> Success
              </span>
            )}
            {executionState?.status === 'failed' && (
              <span className="flex items-center gap-1 text-xs text-red-600">
                <XCircle className="w-3 h-3" /> Failed
              </span>
            )}
            {(!executionState || executionState.status === 'idle') && (
              <span className="text-xs text-gray-500">Idle</span>
            )}
          </div>
          <button
            onClick={handleRunNode}
            disabled={executionState?.status === 'running'}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors disabled:opacity-50"
          >
            {executionState?.status === 'running' ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Play className="w-3 h-3" />
            )}
            Run
          </button>
        </div>

        {executionState?.lastRun && (
          <div className="text-xs text-gray-500">
            Last run: {executionState.lastRun.toLocaleString()}
          </div>
        )}

        {executionState?.error && (
          <div className="p-2 bg-red-50 border border-red-200 rounded">
            <p className="text-xs text-red-700 font-medium">Error</p>
            <p className="text-xs text-red-600">{executionState.error}</p>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
            <Terminal className="w-3 h-3" /> Logs
          </label>
          <div className="bg-gray-900 rounded p-3 max-h-64 overflow-y-auto">
            {executionState?.logs && executionState.logs.length > 0 ? (
              <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">
                {executionState.logs.join('\n')}
              </pre>
            ) : (
              <p className="text-xs text-gray-500 italic">No logs yet. Click "Run" to execute the node.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const getNodeTypeLabel = (type: string | undefined) => {
    switch (type) {
      case 'serviceNode': return 'Service Node';
      case 'decisionNode': return 'Decision Node';
      case 'llmNode': return 'LLM Node';
      case 'formNode': return 'Form Node';
      case 'workflowNode': return 'Workflow Node';
      case 'parallelNode': return 'Parallel Node';
      case 'mergeNode': return 'Merge Node';
      default: return 'Node';
    }
  };

  const getNodeIcon = (type: string | undefined) => {
    switch (type) {
      case 'serviceNode': return <Globe className="w-4 h-4" />;
      case 'decisionNode': return <GitBranch className="w-4 h-4" />;
      case 'llmNode': return <Bot className="w-4 h-4" />;
      case 'formNode': return <FileText className="w-4 h-4" />;
      case 'workflowNode': return <Workflow className="w-4 h-4" />;
      case 'parallelNode': return <GitBranch className="w-4 h-4" />;
      case 'mergeNode': return <GitMerge className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <>
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {workflowId && workflowId !== 'new' ? 'Update Workflow' : 'Save Workflow'}
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to {workflowId && workflowId !== 'new' ? 'update' : 'save'} this workflow?
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowSaveDialog(false)}
                disabled={isLoading}
                className="px-4"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveWorkflow}
                disabled={isLoading}
                className="bg-gray-700 hover:bg-gray-800 text-white px-4"
              >
                {isLoading ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showConfigDrawer && (
        <div className="fixed inset-0 bg-black/40 z-[9999] flex items-end justify-end">
          <div className="bg-white h-full w-96 shadow-2xl flex flex-col">
            <div className="px-6 py-4 border-b border-gray-300 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Workflow Configuration</h3>
              <button
                onClick={() => setShowConfigDrawer(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Workflow Name</label>
                <input
                  type="text"
                  value={workflowName}
                  onChange={(e) => setWorkflowName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400"
                  placeholder="Enter name"
                  disabled={(workflowId && workflowId !== 'new') || isViewMode}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Context</label>
                <textarea
                  value={workflowContext}
                  onChange={(e) => setWorkflowContext(e.target.value)}
                  className="w-full h-24 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
                  placeholder="Enter context"
                  disabled={isViewMode}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Input JSON</label>
                <textarea
                  value={inputJSON}
                  onChange={(e) => setInputJSON(e.target.value)}
                  className="w-full h-32 px-3 py-2 text-xs font-mono border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
                  disabled={isViewMode}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`flex flex-col bg-gray-100 ${isFullscreen ? 'fixed inset-0 z-50' : 'h-full'}`}>
        <div className="h-14 bg-white border-b border-gray-300 flex items-center px-4 gap-3 flex-shrink-0">
          <button
            onClick={() => navigate('/langgraph')}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
            title="Back to dashboard"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1">
            {isEditingWorkflowName ? (
              <input
                ref={workflowNameInputRef}
                type="text"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                onBlur={handleSaveWorkflowName}
                onKeyDown={handleWorkflowNameKeyDown}
                className="px-2 py-1 text-sm font-semibold border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
                placeholder="Enter workflow name"
              />
            ) : (
              <div className="flex items-center gap-2 group">
                <h2 className="text-sm font-semibold text-gray-900">
                  {workflowName || 'New Workflow'}
                </h2>
                {!isViewMode && (
                  <button
                    onClick={handleStartEditWorkflowName}
                    className="p-1 hover:bg-gray-100 rounded transition-colors opacity-0 group-hover:opacity-100"
                    title="Edit workflow name"
                  >
                    <Pencil className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                )}
              </div>
            )}
            <p className="text-xs text-gray-500">
              {isViewMode ? 'View-only' : 'Builder'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {!isViewMode && (
              <>
                <button
                  onClick={() => setShowProgrammaticModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded shadow-sm transition-all mr-1"
                  title="Programmatic SDK / Spec Generator (95% Automated)"
                >
                  <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                  SDK Generator
                </button>
                <button
                  onClick={() => setShowWhatIfStudio(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-gray-950 font-bold text-xs rounded shadow-sm transition-all mr-1"
                  title="What-If Real-time Scenario Analysis Studio"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  What-If Studio
                </button>
                <button
                  onClick={() => setShowConfigDrawer(true)}
                  className="p-2 hover:bg-gray-100 rounded transition-colors"
                  title="Configuration"
                >
                  <Settings className="w-5 h-5 text-gray-600" />
                </button>
                <button
                  onClick={handleExportJSON}
                  className="p-2 hover:bg-gray-100 rounded transition-colors"
                  title="Save"
                >
                  <Save className="w-5 h-5 text-gray-600" />
                </button>
                <button
                  onClick={handleLoadJSON}
                  className="p-2 hover:bg-gray-100 rounded transition-colors"
                  title="Load JSON"
                >
                  <Upload className="w-5 h-5 text-gray-600" />
                </button>
                <button
                  onClick={handleClearCanvas}
                  className="p-2 hover:bg-gray-100 rounded transition-colors"
                  title="Clear Canvas"
                >
                  <Trash2 className="w-5 h-5 text-red-600" />
                </button>
              </>
            )}
            <button
              onClick={handleExecuteWorkflowWithForms}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title="Execute"
            >
              <Play className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={handleTogglePreview}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title="Toggle JSON Preview"
            >
              <Code className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5 text-gray-600" /> : <Maximize2 className="w-5 h-5 text-gray-600" />}
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-56 border-r border-gray-300 bg-white overflow-y-auto flex-shrink-0">
            <div className="p-4">
              {!isViewMode && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Nodes</h3>
                  <div className="space-y-1.5">
                    <div
                      draggable
                      onDragStart={(e) => onDragStart(e, 'serviceNode')}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded cursor-grab active:cursor-grabbing transition-colors"
                    >
                      <Globe className="w-4 h-4 text-gray-600" />
                      <span className="text-sm text-gray-700">Service</span>
                    </div>
                    <div
                      draggable
                      onDragStart={(e) => onDragStart(e, 'decisionNode')}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded cursor-grab active:cursor-grabbing transition-colors"
                    >
                      <GitBranch className="w-4 h-4 text-gray-600" />
                      <span className="text-sm text-gray-700">Decision</span>
                    </div>
                    <div
                      draggable
                      onDragStart={(e) => onDragStart(e, 'llmNode')}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded cursor-grab active:cursor-grabbing transition-colors"
                    >
                      <Bot className="w-4 h-4 text-gray-600" />
                      <span className="text-sm text-gray-700">LLM</span>
                    </div>
                    <div
                      draggable
                      onDragStart={(e) => onDragStart(e, 'formNode')}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded cursor-grab active:cursor-grabbing transition-colors"
                    >
                      <FileText className="w-4 h-4 text-gray-600" />
                      <span className="text-sm text-gray-700">Form</span>
                    </div>
                    <div
                      draggable
                      onDragStart={(e) => onDragStart(e, 'workflowNode')}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded cursor-grab active:cursor-grabbing transition-colors"
                    >
                      <Workflow className="w-4 h-4 text-gray-600" />
                      <span className="text-sm text-gray-700">Workflow</span>
                    </div>
                    <div
                      draggable
                      onDragStart={(e) => onDragStart(e, 'parallelNode')}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded cursor-grab active:cursor-grabbing transition-colors"
                    >
                      <GitBranch className="w-4 h-4 text-gray-600" />
                      <span className="text-sm text-gray-700">Parallel</span>
                    </div>
                    <div
                      draggable
                      onDragStart={(e) => onDragStart(e, 'mergeNode')}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded cursor-grab active:cursor-grabbing transition-colors"
                    >
                      <GitMerge className="w-4 h-4 text-gray-600" />
                      <span className="text-sm text-gray-700">Merge</span>
                    </div>
                    <div
                      draggable
                      onDragStart={(e) => onDragStart(e, 'mapperNode')}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded cursor-grab active:cursor-grabbing transition-colors"
                    >
                      <FileOutput className="w-4 h-4 text-gray-600" />
                      <span className="text-sm text-gray-700">Object Mapper</span>
                    </div>
                  </div>
                </div>
              )}

              {!isViewMode && (
                <div className="mt-6 border-t border-gray-200 pt-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" />
                    My Nodes
                  </h3>

                  {tnpStore.tenants.length > 1 && (
                    <div className="mb-2">
                      <select
                        value={tnpStore.selectedTenantId ?? ''}
                        onChange={(e) => tnpStore.selectTenant(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-gray-400"
                      >
                        {tnpStore.tenants.map((t) => (
                          <option key={t.tenant_id} value={t.tenant_id}>
                            {t.tenant_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {tnpStore.loading && (
                      <div className="text-xs text-gray-400 text-center py-2">Loading...</div>
                    )}
                    {!tnpStore.loading && tnpStore.blueprints.length === 0 && (
                      <div className="text-xs text-gray-400 text-center py-2">
                        {tnpStore.tenants.length === 0
                          ? 'No tenants available'
                          : 'No blueprints for this tenant'}
                      </div>
                    )}
                    {tnpStore.blueprints.map((bp) => (
                      <div
                        key={bp.blueprint_id}
                        draggable
                        onDragStart={(e) => onBlueprintDragStart(e, bp)}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded cursor-grab active:cursor-grabbing transition-colors"
                        title={bp.description || bp.name}
                      >
                        <Package className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <span className="text-sm text-gray-700 truncate">{bp.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 relative" ref={reactFlowWrapper}>
            <ReactFlow
              nodes={nodes}
              edges={edgesWithHandler}
              onNodesChange={isViewMode ? undefined : onNodesChange}
              onEdgesChange={isViewMode ? undefined : onEdgesChange}
              onConnect={isViewMode ? undefined : onConnect}
              onEdgeClick={isViewMode ? undefined : handleEdgeClick}
              onInit={setReactFlowInstance}
              onDrop={onDrop}
              onDragOver={onDragOver}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              defaultEdgeOptions={{
                type: 'custom',
                animated: true,
                style: { stroke: '#9CA3AF', strokeWidth: 1.5 },
                markerEnd: { type: 'arrowclosed', color: '#9CA3AF' },
              }}
              connectionLineType={ConnectionLineType.SmoothStep}
              connectionLineStyle={{ stroke: '#9CA3AF', strokeWidth: 1.5 }}
              nodesDraggable={!isViewMode}
              nodesConnectable={!isViewMode}
              elementsSelectable={!isViewMode}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              className="bg-gray-50"
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#D1D5DB" />
              <Controls className="bg-white shadow-sm rounded border border-gray-300" />
            </ReactFlow>

            {selectedEdge && (
              <div
                className="absolute right-4 top-4 w-80 bg-white border border-gray-300 rounded-lg shadow-lg"
                style={{ zIndex: 1000 }}
              >
                <div className="px-4 py-3 border-b border-gray-300 flex items-center justify-between">
                  <h3 className="font-medium text-sm text-gray-900">Edge Condition</h3>
                  <button
                    onClick={handleClosePanel}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Condition Expression</label>
                    <textarea
                      value={edgeCondition}
                      onChange={(e) => setEdgeCondition(e.target.value)}
                      placeholder="e.g., state['field'] == 'value'"
                      className="w-full h-28 px-3 py-2 text-sm border border-gray-300 rounded font-mono resize-none focus:outline-none focus:ring-1 focus:ring-gray-400"
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveCondition}
                      className="flex-1 px-3 py-2 text-sm bg-gray-700 hover:bg-gray-800 text-white rounded transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleDeleteEdge}
                      className="flex-1 px-3 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showJSONPreview && (
              <div
                className="absolute bottom-4 right-4 w-80 max-h-80 overflow-auto bg-white border border-gray-300 rounded-lg shadow-lg"
                style={{ zIndex: 1001 }}
              >
                <div className="sticky top-0 bg-gray-50 px-4 py-2 border-b border-gray-300 flex items-center justify-between">
                  <h3 className="font-medium text-sm text-gray-900">JSON Preview</h3>
                  <button
                    onClick={() => setShowJSONPreview(false)}
                    className="text-gray-400 hover:text-gray-600 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <pre className="p-4 text-xs font-mono text-gray-700 whitespace-pre-wrap">
                  {exportJSON()}
                </pre>
              </div>
            )}
          </div>

          {selectedNodeId && selectedNode && (
            <div className="w-96 border-l border-gray-300 bg-white flex-shrink-0 flex flex-col" style={{ zIndex: 100 }}>
              <div className="px-4 py-3 border-b border-gray-300 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center">
                      {getNodeIcon(selectedNode.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      {isEditingLabel ? (
                        <input
                          ref={labelInputRef}
                          type="text"
                          value={editingLabelValue}
                          onChange={(e) => setEditingLabelValue(e.target.value)}
                          onBlur={handleSaveLabel}
                          onKeyDown={handleLabelKeyDown}
                          className="w-full px-2 py-0.5 text-sm font-medium border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400"
                        />
                      ) : (
                        <div className="flex items-center gap-1">
                          <h3 className="font-medium text-sm text-gray-900 truncate">
                            {(selectedNode.data as any).label || selectedNode.id}
                          </h3>
                          <button
                            onClick={handleStartEditLabel}
                            className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                            title="Edit label"
                          >
                            <Pencil className="w-3 h-3 text-gray-400" />
                          </button>
                        </div>
                      )}
                      <p className="text-xs text-gray-500">{getNodeTypeLabel(selectedNode.type)}</p>
                    </div>
                  </div>
                  <button
                    onClick={closeConfigPanel}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {(selectedNode.data as any)._source && (
                  <div className="mt-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded flex items-center gap-2">
                    <Package className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-blue-700 truncate">
                        Blueprint: {(selectedNode.data as any)._source.source_blueprint_name ?? (selectedNode.data as any)._source.source_blueprint_id} v{(selectedNode.data as any)._source.source_blueprint_version}
                      </p>
                      <p className="text-[10px] text-blue-500">
                        Workflow-owned copy - edits do not affect the blueprint
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex border-b border-gray-300 -mx-4 -mb-3 px-4">
                  <button
                    onClick={() => setActiveTab('config')}
                    className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                      activeTab === 'config'
                        ? 'border-gray-700 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Config
                  </button>
                  <button
                    onClick={() => setActiveTab('advanced')}
                    className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                      activeTab === 'advanced'
                        ? 'border-gray-700 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Advanced
                  </button>
                  <button
                    onClick={() => setActiveTab('logs')}
                    className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1 ${
                      activeTab === 'logs'
                        ? 'border-gray-700 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Run / Logs
                    {selectedNodeExecution?.status === 'running' && (
                      <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                    )}
                    {selectedNodeExecution?.status === 'success' && (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    )}
                    {selectedNodeExecution?.status === 'failed' && (
                      <XCircle className="w-3 h-3 text-red-500" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {activeTab === 'config' && renderConfigTabContent()}
                {activeTab === 'advanced' && renderAdvancedTabContent()}
                {activeTab === 'logs' && renderLogsTabContent()}
              </div>
            </div>
          )}
        </div>
      </div>

      <WorkflowExecuteModal
        isOpen={showExecuteModal}
        onClose={() => setShowExecuteModal(false)}
        workflowJSON={exportJSON()}
      />

      <WorkflowExecutionWithForms
        isOpen={showExecuteWithFormsModal}
        onClose={() => setShowExecuteWithFormsModal(false)}
        workflowJSON={exportJSON()}
      />

      {showServiceConfigModal && selectedNode && (
        <ServiceConfigModal
          isOpen={showServiceConfigModal}
          onClose={() => setShowServiceConfigModal(false)}
          onSave={(config) => updateNodeData(selectedNode.id, { config })}
          initialConfig={(selectedNode.data as any).config || {
            requestBody: '',
            headers: [],
            authType: 'none',
            authConfig: {},
            tlsConfig: { enabled: false, verifyCertificate: true },
            timeout: 30000,
            retryConfig: { enabled: false, maxRetries: 3, retryDelay: 1000 },
          }}
          initialInputs={inputs}
        />
      )}

      {showDecisionConfigModal && selectedNode && (
        <DecisionConfigModal
          isOpen={showDecisionConfigModal}
          onClose={() => setShowDecisionConfigModal(false)}
          onSave={(data) => {
            const updates: any = {};
            if (data.script !== undefined) updates.script = data.script;
            if (data.ruleDefinition !== undefined) updates.ruleDefinition = data.ruleDefinition;
            updateNodeData(selectedNode.id, updates);
          }}
          initialValue={(selectedNode.data as any).script || ''}
          initialRuleDefinition={(selectedNode.data as any).ruleDefinition}
        />
      )}

      {showFormBuilderModal && selectedNode && (
        <FormBuilderModal
          isOpen={showFormBuilderModal}
          onClose={() => setShowFormBuilderModal(false)}
          onSave={(formConfig) => updateNodeData(selectedNode.id, { formConfig })}
          initialSchema={(selectedNode.data as any).formConfig}
        />
      )}

      {showFormPreviewModal && selectedNode && (
        <FormPreviewModal
          isOpen={showFormPreviewModal}
          onClose={() => setShowFormPreviewModal(false)}
          formConfig={(selectedNode.data as any).formConfig}
        />
      )}

      {showWorkflowConfigModal && selectedNode && (
        <WorkflowConfigModal
          isOpen={showWorkflowConfigModal}
          onClose={() => setShowWorkflowConfigModal(false)}
          onSave={(config) => updateNodeData(selectedNode.id, { workflowConfig: config })}
          initialConfig={(selectedNode.data as any).workflowConfig || {
            url: '',
            method: 'POST',
            requestMapping: '{}',
            headers: [],
          }}
          initialInputs={inputs}
          workflowName={(selectedNode.data as any).selectedWorkflowName || ''}
          onBack={() => {
            const name = (selectedNode.data as any).selectedWorkflowName;
            if (name) window.open(`/langgraph/builder/${encodeURIComponent(name)}?mode=view`, '_blank');
          }}
        />
      )}

      <ProgrammaticGeneratorModal
        isOpen={showProgrammaticModal}
        onClose={() => setShowProgrammaticModal(false)}
        onImportGraph={(json) => importJSON(json)}
      />

      <WhatIfScenarioStudio
        isOpen={showWhatIfStudio}
        onClose={() => setShowWhatIfStudio(false)}
      />

      {showMapperConfigModal && selectedNode && (
        <ObjectMapperModal
          isOpen={showMapperConfigModal}
          onClose={() => setShowMapperConfigModal(false)}
          nodeId={selectedNode.id}
          nodeLabel={(selectedNode.data as any).label || selectedNode.id}
          initialMapperConfig={(selectedNode.data as any).mapperConfig}
          onSave={(mapperConfig) => updateNodeData(selectedNode.id, { mapperConfig } as any)}
        />
      )}
    </>
  );
};

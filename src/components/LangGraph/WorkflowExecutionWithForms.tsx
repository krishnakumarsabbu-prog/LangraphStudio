import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Play, Activity, Code, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, AlertCircle, Pause } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import axios from 'axios';
import toast from 'react-hot-toast';
import ReactFlow, { Node, Edge, Background, Controls, MiniMap, BackgroundVariant, Handle, Position, applyNodeChanges } from 'react-flow-renderer';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';

interface WorkflowExecutionWithFormsProps {
  isOpen: boolean;
  onClose: () => void;
  workflowJSON: string;
}

interface NodeExecution {
  nodeId: string;
  label: string;
  nodeType: string;
  status: 'success' | 'error' | 'pending' | 'paused';
  executionTimeMs: number;
  timestamp: string;
  requestData?: any;
  responseData?: any;
  errorMessage?: string;
}

const FlowNode: React.FC<{ data: any }> = ({ data }) => {
  const getStatusIcon = () => {
    if (data.status === 'success') return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (data.status === 'error') return <XCircle className="w-4 h-4 text-red-500" />;
    if (data.status === 'paused') return <Pause className="w-4 h-4 text-orange-500" />;
    return <Clock className="w-4 h-4 text-gray-400" />;
  };

  const getStatusColor = () => {
    if (data.status === 'success') return 'border-green-500 bg-green-50';
    if (data.status === 'error') return 'border-red-500 bg-red-50';
    if (data.status === 'paused') return 'border-orange-500 bg-orange-50';
    return 'border-gray-300 bg-gray-50';
  };

  return (
    <>
      <Handle type="target" position={Position.Left} className="w-3 h-3 !bg-green-500" />
      <div className={`px-4 py-3 rounded-lg border-2 shadow-lg min-w-[180px] transition-all hover:shadow-xl cursor-pointer ${getStatusColor()}`}>
        <div className="flex items-center gap-2 mb-2">
          {getStatusIcon()}
          <div className="font-semibold text-sm text-gray-900">{data.label}</div>
        </div>
        <div className="text-xs text-gray-600 space-y-1">
          <div className="flex items-center gap-1">
            <Activity className="w-3 h-3" />
            <span className="font-mono">{data.executionTimeMs || 0}ms</span>
          </div>
          <div className="text-xs font-medium text-gray-500">{data.nodeType}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="w-3 h-3 !bg-green-500" />
    </>
  );
};

const nodeTypes = {
  default: FlowNode,
  service: FlowNode,
  decision: FlowNode,
  llm: FlowNode,
  form: FlowNode,
  workflow: FlowNode,
};

export const WorkflowExecutionWithForms: React.FC<WorkflowExecutionWithFormsProps> = ({
  isOpen,
  onClose,
  workflowJSON,
}) => {
  const [inputJson, setInputJson] = useState('{}');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [nodeExecutions, setNodeExecutions] = useState<NodeExecution[]>([]);
  const [selectedNode, setSelectedNode] = useState<NodeExecution | null>(null);
  const [collapsedPanels, setCollapsedPanels] = useState({
    input: false,
    output: false,
    logs: false,
  });
  const [flowNodes, setFlowNodes] = useState<Node[]>([]);
  const [flowEdges, setFlowEdges] = useState<Edge[]>([]);

  const [isPaused, setIsPaused] = useState(false);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [pausedFormNode, setPausedFormNode] = useState<any>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [formData, setFormData] = useState<any>({});

  const onNodesChange = useCallback((changes: any) => {
    setFlowNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onNodeClick = useCallback((event: any, node: Node) => {
    const exec = nodeExecutions.find(e => e.nodeId === node.id);
    if (exec) {
      setSelectedNode(exec);

      if (exec.nodeType === 'form' && exec.status === 'paused') {
        try {
          const workflow = JSON.parse(workflowJSON);
          const formNode = workflow.graph?.nodes?.find((n: any) => n.id === node.id);
          if (formNode) {
            setPausedFormNode(formNode);
            setShowFormModal(true);
          }
        } catch (error) {
          console.error('Failed to find form node:', error);
        }
      }
    }
  }, [nodeExecutions, workflowJSON]);

  const calculateHorizontalLayout = useCallback((nodes: NodeExecution[], edges: any[]) => {
    const positions: { [key: string]: { x: number; y: number } } = {};
    const levels: { [key: string]: number } = {};
    const nodesByLevel: { [level: number]: string[] } = {};

    const incomingEdges: { [key: string]: number } = {};
    nodes.forEach(n => {
      incomingEdges[n.nodeId] = 0;
    });

    edges.forEach(edge => {
      if (edge.target) {
        incomingEdges[edge.target] = (incomingEdges[edge.target] || 0) + 1;
      }
    });

    const queue = nodes.filter(n => incomingEdges[n.nodeId] === 0).map(n => n.nodeId);
    let currentLevel = 0;

    const visited = new Set<string>();
    while (queue.length > 0) {
      const levelSize = queue.length;
      nodesByLevel[currentLevel] = [];

      for (let i = 0; i < levelSize; i++) {
        const nodeId = queue.shift()!;
        if (visited.has(nodeId)) continue;
        visited.add(nodeId);

        levels[nodeId] = currentLevel;
        nodesByLevel[currentLevel].push(nodeId);

        edges.forEach(edge => {
          if (edge.source === nodeId && edge.target && !visited.has(edge.target)) {
            queue.push(edge.target);
          }
        });
      }
      currentLevel++;
    }

    nodes.forEach(n => {
      if (!visited.has(n.nodeId)) {
        levels[n.nodeId] = currentLevel;
        if (!nodesByLevel[currentLevel]) nodesByLevel[currentLevel] = [];
        nodesByLevel[currentLevel].push(n.nodeId);
      }
    });

    Object.keys(nodesByLevel).forEach(levelKey => {
      const level = parseInt(levelKey);
      const nodesInLevel = nodesByLevel[level];
      const xPosition = level * 350;

      nodesInLevel.forEach((nodeId, index) => {
        const totalNodes = nodesInLevel.length;
        const ySpacing = 200;
        const yOffset = (index - (totalNodes - 1) / 2) * ySpacing;
        positions[nodeId] = { x: xPosition + 50, y: 300 + yOffset };
      });
    });

    return positions;
  }, []);

  useEffect(() => {
    if (isOpen && workflowJSON) {
      try {
        const workflow = JSON.parse(workflowJSON);
        const nodes = workflow.graph?.nodes || [];
        const edges = workflow.graph?.edges || [];

        const initialExecutions: NodeExecution[] = nodes.map((node: any) => ({
          nodeId: node.id,
          label: node.data?.label || node.id,
          nodeType: node.type || 'unknown',
          status: 'pending' as const,
          executionTimeMs: 0,
          timestamp: new Date().toISOString(),
          requestData: null,
          responseData: null,
        }));

        setNodeExecutions(initialExecutions);

        const positions = calculateHorizontalLayout(initialExecutions, edges);

        const initialNodes: Node[] = initialExecutions.map((exec) => ({
          id: exec.nodeId,
          type: 'default',
          position: positions[exec.nodeId] || { x: 100, y: 100 },
          data: exec,
        }));

        const initialEdges: Edge[] = edges.map((edge: any, index: number) => ({
          id: edge.id || `e-${edge.source}-${edge.target}-${index}`,
          source: edge.source,
          target: edge.target,
          animated: true,
          label: edge.condition || '',
          style: { stroke: '#9ca3af', strokeWidth: 2 },
          labelStyle: { fontSize: 10, fill: '#6b7280' },
          labelBgStyle: { fill: '#ffffff', fillOpacity: 0.8 },
        }));

        setFlowNodes(initialNodes);
        setFlowEdges(initialEdges);
      } catch (error) {
        console.error('Failed to parse workflow JSON:', error);
      }
    }
  }, [isOpen, workflowJSON, calculateHorizontalLayout]);

  if (!isOpen) return null;

  const handleExecute = async () => {
    setIsLoading(true);
    setResponse('');
    setNodeExecutions([]);
    setSelectedNode(null);
    setIsPaused(false);
    setExecutionId(null);

    try {
      const workflow = JSON.parse(workflowJSON);
      const inputs = JSON.parse(inputJson);

      const backendUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:8000';
      const apiResponse = await axios.post(`${backendUrl}/execute`, {
        graph: workflow.graph,
        inputs: inputs,
        workflow_name: workflow.name || 'unnamed_workflow',
      });

      const executionResult = apiResponse.data;
      setResponse(JSON.stringify(executionResult, null, 2));
      setExecutionId(executionResult.execution_id);

      if (executionResult.status === 'paused' && executionResult.paused_at_form) {
        setIsPaused(true);
        const formInfo = executionResult.paused_at_form;

        const workflow = JSON.parse(workflowJSON);
        const formNode = workflow.graph?.nodes?.find((n: any) => n.id === formInfo.node_id);

        setPausedFormNode(formNode);

        updateNodeExecutionStatus(executionResult, workflow, formInfo.node_id);

        toast.success('Workflow paused at form node. Click the form node to fill it.', { duration: 5000 });
      } else if (executionResult.status === 'success') {
        updateNodeExecutionStatus(executionResult, workflow);
        toast.success('Workflow execution completed');
      } else {
        toast.error(executionResult.error || 'Workflow execution failed');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Workflow execution failed';
      setResponse(JSON.stringify({ error: errorMessage, details: error.response?.data }, null, 2));
      toast.error('Workflow execution failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResumeWorkflow = async (submittedFormData: any) => {
    if (!executionId) {
      toast.error('No execution ID found');
      return;
    }

    setIsLoading(true);
    setShowFormModal(false);

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:8000';
      const apiResponse = await axios.post(`${backendUrl}/resume`, {
        execution_id: executionId,
        form_data: submittedFormData,
      });

      const executionResult = apiResponse.data;
      setResponse(JSON.stringify(executionResult, null, 2));

      if (executionResult.status === 'paused' && executionResult.paused_at_form) {
        const formInfo = executionResult.paused_at_form;
        const workflow = JSON.parse(workflowJSON);
        const formNode = workflow.graph?.nodes?.find((n: any) => n.id === formInfo.node_id);

        setPausedFormNode(formNode);
        updateNodeExecutionStatus(executionResult, workflow, formInfo.node_id);

        toast.success('Workflow paused at another form. Click the form node to continue.', { duration: 5000 });
      } else if (executionResult.status === 'success') {
        setIsPaused(false);
        const workflow = JSON.parse(workflowJSON);
        updateNodeExecutionStatus(executionResult, workflow);
        toast.success('Workflow execution completed');
      } else {
        toast.error(executionResult.error || 'Workflow resume failed');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Workflow resume failed';
      setResponse(JSON.stringify({ error: errorMessage, details: error.response?.data }, null, 2));
      toast.error('Workflow resume failed');
    } finally {
      setIsLoading(false);
    }
  };

  const updateNodeExecutionStatus = (executionResult: any, workflow: any, pausedNodeId?: string) => {
    const nodes = workflow.graph?.nodes || [];
    const resultData = executionResult.result;

    const executionResults: NodeExecution[] = nodes.map((node: any) => {
      const nodeId = node.id;
      const nodeData = resultData[nodeId];

      let requestData = null;
      let responseData = null;
      let status: 'success' | 'error' | 'pending' | 'paused' = 'pending';
      let errorMessage: string | undefined;

      if (pausedNodeId === nodeId) {
        status = 'paused';
      } else if (nodeData && typeof nodeData === 'object') {
        if (nodeData.request !== undefined) {
          status = 'success';
          requestData = nodeData.request || null;
          responseData = nodeData.response || null;

          if (nodeData.error) {
            status = 'error';
            errorMessage = nodeData.error;
          }
        } else if (nodeData.form_data !== undefined) {
          status = 'success';
          responseData = nodeData.form_data;
        }
      } else if (node.type === 'decision') {
        const decisionResult = resultData[nodeId.toUpperCase()] || resultData[nodeId];
        if (decisionResult !== undefined) {
          status = 'success';
        }
        requestData = { script: node.data?.script || '' };
        responseData = null;
      }

      return {
        nodeId: nodeId,
        label: node.data?.label || nodeId,
        nodeType: node.type || 'unknown',
        status: status,
        executionTimeMs: nodeData?.executionTime || 0,
        timestamp: new Date().toISOString(),
        requestData: requestData,
        responseData: responseData,
        errorMessage: errorMessage,
      };
    });

    setNodeExecutions(executionResults);

    const graphEdges = workflow.graph?.edges || [];

    const newFlowNodes: Node[] = executionResults.map((exec) => {
      const existingNode = flowNodes.find(n => n.id === exec.nodeId);
      return {
        id: exec.nodeId,
        type: 'default',
        position: existingNode?.position || { x: 100, y: 100 },
        data: exec,
      };
    });

    const newFlowEdges: Edge[] = graphEdges.map((edge: any, index: number) => ({
      id: edge.id || `e-${edge.source}-${edge.target}-${index}`,
      source: edge.source,
      target: edge.target,
      animated: true,
      label: edge.condition || '',
      style: { stroke: '#10b981', strokeWidth: 2 },
      labelStyle: { fontSize: 10, fill: '#6b7280' },
      labelBgStyle: { fill: '#ffffff', fillOpacity: 0.8 },
    }));

    setFlowNodes(newFlowNodes);
    setFlowEdges(newFlowEdges);
  };

  const togglePanel = (panel: keyof typeof collapsedPanels) => {
    setCollapsedPanels((prev) => ({ ...prev, [panel]: !prev[panel] }));
  };

  const renderJsonData = (data: any, title: string) => {
    if (!data) return null;
    return (
      <div className="space-y-2">
        <div className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Code className="w-4 h-4" />
          {title}
        </div>
        <pre className="bg-gray-100 p-3 rounded-lg text-xs font-mono overflow-auto max-h-64 border border-gray-200">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    );
  };

  const handleFormSubmit = ({ formData: submittedData }: { formData: any }) => {
    handleResumeWorkflow(submittedData);
  };

  const FormModal = () => {
    if (!showFormModal || !pausedFormNode) return null;

    const formSchema = pausedFormNode.data?.schema || {};

    return createPortal(
      <div className="fixed inset-0 bg-black bg-opacity-70 z-[99999]">
        <div className="bg-white w-full h-full flex flex-col">
          <div className="bg-gradient-to-r from-slate-700 to-slate-600 text-white px-8 py-6 flex items-center justify-between border-b border-slate-500">
            <h2 className="text-2xl font-bold">Form: {pausedFormNode.data?.label || pausedFormNode.id}</h2>
            <button
              onClick={() => setShowFormModal(false)}
              className="p-1 hover:bg-slate-600 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-gray-50">
            <div className="max-w-4xl mx-auto p-8">
              <div className="bg-white rounded-lg shadow-lg border border-gray-300 p-8">
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {formSchema.title || 'Workflow Form'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Fill out this form to continue workflow execution
                  </p>
                </div>

                <div className="form-container">
                  <Form
                    schema={formSchema}
                    validator={validator}
                    onSubmit={handleFormSubmit}
                    formData={formData}
                    onChange={({ formData: newData }) => setFormData(newData)}
                  >
                    <div className="mt-6 flex justify-end gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowFormModal(false)}
                        className="px-6 py-2"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Resuming...
                          </>
                        ) : (
                          'Submit & Resume'
                        )}
                      </Button>
                    </div>
                  </Form>
                </div>

                {Object.keys(formData).length > 0 && (
                  <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h4 className="text-sm font-bold text-gray-700 mb-2">Form Data Preview</h4>
                    <pre className="text-xs font-mono bg-white p-3 rounded border border-gray-200 overflow-auto">
                      {JSON.stringify(formData, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <style>{`
          .form-container .form-group {
            margin-bottom: 1.5rem;
          }

          .form-container label.control-label {
            display: block;
            font-size: 0.875rem;
            font-weight: 600;
            color: #374151;
            margin-bottom: 0.5rem;
          }

          .form-container .form-control {
            width: 100%;
            padding: 0.625rem 0.75rem;
            font-size: 0.875rem;
            line-height: 1.5;
            color: #1f2937;
            background-color: #fff;
            border: 1px solid #d1d5db;
            border-radius: 0.375rem;
            transition: all 0.15s ease-in-out;
          }

          .form-container .form-control:focus {
            outline: none;
            border-color: #374151;
            box-shadow: 0 0 0 3px rgba(55, 65, 81, 0.1);
          }

          .form-container select.form-control {
            background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
            background-position: right 0.5rem center;
            background-repeat: no-repeat;
            background-size: 1.5em 1.5em;
            padding-right: 2.5rem;
            appearance: none;
          }

          .form-container .checkbox {
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }

          .form-container .checkbox input[type="checkbox"] {
            width: 1.125rem;
            height: 1.125rem;
            border: 1px solid #d1d5db;
            border-radius: 0.25rem;
            cursor: pointer;
            accent-color: #374151;
          }

          .form-container textarea.form-control {
            min-height: 100px;
            resize: vertical;
          }
        `}</style>
      </div>,
      document.body
    );
  };

  const modalContent = (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-[9999]">
      <div className="bg-white w-full h-full flex flex-col">
        <div className="bg-gradient-to-r from-slate-700 to-slate-600 text-white px-8 py-6 flex items-center justify-between border-b border-slate-500">
          <div>
            <h2 className="text-2xl font-bold">Execute Workflow with Forms</h2>
            <p className="text-sm text-slate-200 mt-1">
              {isPaused ? 'Workflow paused - Click form node to continue' : 'Run and visualize workflow execution'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-600 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden p-4 gap-4 bg-gray-100">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 min-h-0">
            <Card className="flex flex-col overflow-hidden border border-gray-300">
              <div
                className="flex items-center justify-between p-4 border-b border-gray-300 bg-gradient-to-r from-slate-600 to-slate-500 text-white cursor-pointer"
                onClick={() => togglePanel('input')}
              >
                <div className="flex items-center gap-2">
                  <Code className="w-5 h-5" />
                  <h3 className="font-semibold">Input Request</h3>
                </div>
                {collapsedPanels.input ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
              </div>
              {!collapsedPanels.input && (
                <div className="flex-1 overflow-auto p-4">
                  <textarea
                    value={inputJson}
                    onChange={(e) => setInputJson(e.target.value)}
                    className="w-full h-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder='{\n  "field": "value"\n}'
                    disabled={isLoading || isPaused}
                  />
                </div>
              )}
            </Card>

            <Card className="lg:col-span-2 flex flex-col overflow-hidden border border-gray-300">
              <div className="flex items-center justify-between p-4 border-b border-gray-300 bg-gradient-to-r from-slate-600 to-slate-500 text-white">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  <h3 className="font-semibold">Flow Graph</h3>
                  {isPaused && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-yellow-500 text-gray-900 rounded-full flex items-center gap-1">
                      <Pause className="w-3 h-3" />
                      PAUSED
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-1">
                {flowNodes.length > 0 ? (
                  <ReactFlow
                    nodes={flowNodes}
                    edges={flowEdges}
                    nodeTypes={nodeTypes}
                    onNodesChange={onNodesChange}
                    onNodeClick={onNodeClick}
                    nodesDraggable={true}
                    nodesConnectable={false}
                    elementsSelectable={true}
                    fitView
                    fitViewOptions={{ padding: 0.2 }}
                    defaultEdgeOptions={{
                      animated: true,
                      style: { stroke: '#10b981', strokeWidth: 2 },
                    }}
                    className="bg-gray-50"
                  >
                    <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
                    <Controls className="bg-white shadow-lg" />
                    <MiniMap
                      nodeColor={(node) => {
                        const exec = nodeExecutions.find(e => e.nodeId === node.id);
                        if (exec?.status === 'success') return '#10b981';
                        if (exec?.status === 'error') return '#ef4444';
                        if (exec?.status === 'paused') return '#f59e0b';
                        return '#9ca3af';
                      }}
                      className="bg-white border border-gray-200"
                    />
                  </ReactFlow>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    {isLoading ? (
                      <div className="text-center">
                        <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-purple-500" />
                        <p>Executing workflow...</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Flow graph will appear here after execution</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>

            <Card className="flex flex-col overflow-hidden border border-gray-300">
              <div
                className="flex items-center justify-between p-4 border-b border-gray-300 bg-gradient-to-r from-slate-600 to-slate-500 text-white cursor-pointer"
                onClick={() => togglePanel('output')}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  <h3 className="font-semibold">Execution Results</h3>
                </div>
                {collapsedPanels.output ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
              </div>
              {!collapsedPanels.output && (
                <div className="flex-1 overflow-auto p-4">
                  <pre className="text-xs font-mono bg-gray-100 p-3 rounded-lg border border-gray-200 whitespace-pre-wrap">
                    {response || <span className="text-gray-400">Results will appear here...</span>}
                  </pre>
                </div>
              )}
            </Card>
          </div>

          <Card className="flex flex-col overflow-hidden max-h-[400px] border border-gray-300">
            <div
              className="flex items-center justify-between p-4 border-b border-gray-300 bg-gradient-to-r from-slate-600 to-slate-500 text-white cursor-pointer"
              onClick={() => togglePanel('logs')}
            >
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                <h3 className="font-semibold">Node Details</h3>
                {selectedNode && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-gray-700 rounded-full">
                    {selectedNode.label}
                  </span>
                )}
              </div>
              {collapsedPanels.logs ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
            </div>
            {!collapsedPanels.logs && (
              <div className="flex-1 overflow-auto p-4">
                {selectedNode ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
                      <div className="flex items-center gap-2">
                        {selectedNode.status === 'success' ? (
                          <CheckCircle className="w-6 h-6 text-green-500" />
                        ) : selectedNode.status === 'paused' ? (
                          <Pause className="w-6 h-6 text-orange-500" />
                        ) : (
                          <XCircle className="w-6 h-6 text-red-500" />
                        )}
                        <div>
                          <div className="font-semibold text-lg text-gray-900">
                            {selectedNode.label}
                          </div>
                          <div className="text-sm text-gray-600">
                            {selectedNode.nodeType}
                          </div>
                        </div>
                      </div>
                      <div className="ml-auto text-right">
                        <div className="text-sm text-gray-600">Status</div>
                        <div className={`text-sm font-semibold ${
                          selectedNode.status === 'success' ? 'text-green-600' :
                          selectedNode.status === 'paused' ? 'text-orange-600' :
                          'text-red-600'
                        }`}>
                          {selectedNode.status.toUpperCase()}
                        </div>
                      </div>
                    </div>

                    {selectedNode.nodeType === 'form' && selectedNode.status === 'paused' && (
                      <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold text-gray-900 mb-1">Action Required</div>
                            <div className="text-sm text-gray-700 mb-3">
                              This workflow is paused waiting for form input. Click this node to open and fill the form.
                            </div>
                            <Button
                              onClick={() => setShowFormModal(true)}
                              className="bg-slate-700 hover:bg-slate-600 text-white"
                            >
                              Open Form
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedNode.errorMessage && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold text-red-700 mb-1">Error Message</div>
                            <div className="text-sm text-red-600">{selectedNode.errorMessage}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div>{renderJsonData(selectedNode.requestData, 'Request Data')}</div>
                      <div>{renderJsonData(selectedNode.responseData, 'Response Data')}</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <Activity className="w-12 h-12 text-gray-400 mb-3" />
                    <div className="text-lg font-medium text-gray-600 mb-2">
                      No Node Selected
                    </div>
                    <div className="text-sm text-gray-500">
                      Click on any node in the flow graph to view its details
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="border-t border-gray-300 px-8 py-4 flex justify-between items-center bg-white">
          <Button variant="outline" onClick={onClose} className="px-6 py-2 border-gray-300">
            Close
          </Button>
          <Button
            onClick={handleExecute}
            disabled={isLoading || isPaused}
            className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Executing...
              </>
            ) : isPaused ? (
              <>
                <Pause className="w-5 h-5 mr-2" />
                Workflow Paused
              </>
            ) : (
              <>
                <Play className="w-5 h-5 mr-2" />
                Execute Workflow
              </>
            )}
          </Button>
        </div>
      </div>

      <FormModal />
    </div>
  );

  return createPortal(modalContent, document.body);
};

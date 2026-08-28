import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Play, Activity, Code, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import axios from 'axios';
import toast from 'react-hot-toast';
import ReactFlow, { Node, Edge, Background, Controls, MiniMap, BackgroundVariant, Handle, Position, applyNodeChanges } from 'react-flow-renderer';

interface WorkflowExecuteModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflowJSON: string;
}

interface NodeExecution {
  nodeId: string;
  label: string;
  nodeType: string;
  status: 'success' | 'error' | 'pending';
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
    return <Clock className="w-4 h-4 text-gray-400" />;
  };

  const getStatusColor = () => {
    if (data.status === 'success') return 'border-green-500 bg-green-50 dark:bg-green-900/20';
    if (data.status === 'error') return 'border-red-500 bg-red-50 dark:bg-red-900/20';
    return 'border-gray-300 bg-gray-50 dark:bg-gray-900/20';
  };

  return (
    <>
      <Handle type="target" position={Position.Left} className="w-3 h-3 !bg-green-500" />
      <div className={`px-4 py-3 rounded-lg border-2 shadow-lg min-w-[180px] transition-all hover:shadow-xl cursor-pointer ${getStatusColor()}`}>
        <div className="flex items-center gap-2 mb-2">
          {getStatusIcon()}
          <div className="font-semibold text-sm text-gray-900 dark:text-white">{data.label}</div>
        </div>
        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
          <div className="flex items-center gap-1">
            <Activity className="w-3 h-3" />
            <span className="font-mono">{data.executionTimeMs || 0}ms</span>
          </div>
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">{data.nodeType}</div>
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

export const WorkflowExecuteModal: React.FC<WorkflowExecuteModalProps> = ({
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

  const onNodesChange = useCallback((changes: any) => {
    setFlowNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onNodeClick = useCallback((event: any, node: Node) => {
    const exec = nodeExecutions.find(e => e.nodeId === node.id);
    if (exec) setSelectedNode(exec);
  }, [nodeExecutions]);

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

  const replaceTemplateVariables = (template: string, inputs: any): string => {
    let result = template;
    const regex = /\{\{([^}]+)\}\}/g;
    const matches = template.matchAll(regex);

    for (const match of matches) {
      const path = match[1];
      const value = getNestedValue(inputs, path);
      result = result.replace(match[0], JSON.stringify(value));
    }

    return result;
  };

  const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };

  const handleExecute = async () => {
    setIsLoading(true);
    setResponse('');
    setNodeExecutions([]);
    setSelectedNode(null);

    try {
      const workflow = JSON.parse(workflowJSON);
      const inputs = JSON.parse(inputJson);

      const backendUrl = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:8000';
      const apiResponse = await axios.post(`${backendUrl}/execute`, {
        graph: workflow.graph,
        input: inputs,
      });

      const executionResult = apiResponse.data;
      setResponse(JSON.stringify(executionResult, null, 2));

      if (executionResult.status === 'success' && executionResult.result) {
        const nodes = workflow.graph?.nodes || [];
        const resultData = executionResult.result;

        const executionResults: NodeExecution[] = nodes.map((node: any) => {
          const nodeId = node.id;
          const nodeData = resultData[nodeId];

          let requestData = null;
          let responseData = null;
          let status: 'success' | 'error' | 'pending' = 'pending';
          let errorMessage: string | undefined;
          let wasExecuted = false;

          if (nodeData && typeof nodeData === 'object' && nodeData.request !== undefined) {
            wasExecuted = true;
            status = 'success';
            requestData = nodeData.request || null;
            responseData = nodeData.response || null;

            if (nodeData.error) {
              status = 'error';
              errorMessage = nodeData.error;
            }
          } else if (node.type === 'decision') {
            const decisionResult = resultData[nodeId.toUpperCase()] || resultData[nodeId];
            if (decisionResult !== undefined) {
              wasExecuted = true;
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

  const togglePanel = (panel: keyof typeof collapsedPanels) => {
    setCollapsedPanels((prev) => ({ ...prev, [panel]: !prev[panel] }));
  };

  const renderJsonData = (data: any, title: string) => {
    if (!data) return null;
    return (
      <div className="space-y-2">
        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <Code className="w-4 h-4" />
          {title}
        </div>
        <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg text-xs font-mono overflow-auto max-h-64 border border-gray-200 dark:border-gray-700">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    );
  };

  const modalContent = (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-[9999]">
      <div className="bg-white dark:bg-gray-900 w-full h-full flex flex-col">
        <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-8 py-6 flex items-center justify-between border-b-2 border-green-700">
          <div>
            <h2 className="text-2xl font-bold">Execute Workflow</h2>
            <p className="text-sm opacity-90 mt-1">Run and visualize workflow execution</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-green-700 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden p-4 gap-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 min-h-0">
            <Card className="flex flex-col overflow-hidden">
              <div
                className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-500 to-blue-600 text-white cursor-pointer"
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
                    className="w-full h-full px-3 py-2 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white resize-none"
                    placeholder='{\n  "field": "value"\n}'
                    disabled={isLoading}
                  />
                </div>
              )}
            </Card>

            <Card className="lg:col-span-2 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-500 to-purple-600 text-white">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  <h3 className="font-semibold">Flow Graph</h3>
                  {nodeExecutions.length > 0 && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-white/20 rounded-full">
                      {nodeExecutions.length} nodes
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
                    className="bg-gray-50 dark:bg-gray-900"
                  >
                    <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
                    <Controls className="bg-white dark:bg-gray-800 shadow-lg" />
                    <MiniMap
                      nodeColor={(node) => {
                        const exec = nodeExecutions.find(e => e.nodeId === node.id);
                        if (exec?.status === 'success') return '#10b981';
                        if (exec?.status === 'error') return '#ef4444';
                        return '#9ca3af';
                      }}
                      className="bg-white dark:bg-gray-800 border border-gray-200"
                    />
                  </ReactFlow>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-600">
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

            <Card className="flex flex-col overflow-hidden">
              <div
                className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-green-500 to-green-600 text-white cursor-pointer"
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
                  <pre className="text-xs font-mono bg-gray-100 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 whitespace-pre-wrap">
                    {response || <span className="text-gray-400">Results will appear here...</span>}
                  </pre>
                </div>
              )}
            </Card>
          </div>

          <Card className="flex flex-col overflow-hidden max-h-[400px]">
            <div
              className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-orange-500 to-orange-600 text-white cursor-pointer"
              onClick={() => togglePanel('logs')}
            >
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                <h3 className="font-semibold">Execution Logs</h3>
                {selectedNode && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-white/20 rounded-full">
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
                    <div className="flex items-center gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2">
                        {selectedNode.status === 'success' ? (
                          <CheckCircle className="w-6 h-6 text-green-500" />
                        ) : (
                          <XCircle className="w-6 h-6 text-red-500" />
                        )}
                        <div>
                          <div className="font-semibold text-lg text-gray-900 dark:text-white">
                            {selectedNode.label}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {selectedNode.nodeType}
                          </div>
                        </div>
                      </div>
                      <div className="ml-auto text-right">
                        <div className="text-sm text-gray-600 dark:text-gray-400">Execution Time</div>
                        <div className="text-lg font-semibold font-mono text-gray-900 dark:text-white">
                          {selectedNode.executionTimeMs}ms
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-600 dark:text-gray-400">Status</div>
                        <div className={`text-sm font-semibold ${selectedNode.status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                          {selectedNode.status.toUpperCase()}
                        </div>
                      </div>
                    </div>

                    {selectedNode.errorMessage && (
                      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold text-red-700 dark:text-red-400 mb-1">Error Message</div>
                            <div className="text-sm text-red-600 dark:text-red-300">{selectedNode.errorMessage}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedNode.nodeType === 'decision' ? (
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Decision Script</div>
                        <pre className="text-xs text-gray-700 dark:text-gray-300 font-mono bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                          {selectedNode.requestData?.script || 'N/A'}
                        </pre>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>{renderJsonData(selectedNode.requestData, 'Request Payload')}</div>
                        <div>{renderJsonData(selectedNode.responseData, 'Response Payload')}</div>
                      </div>
                    )}

                    <div className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        <span>Timestamp: {new Date(selectedNode.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <Activity className="w-12 h-12 text-gray-400 dark:text-gray-600 mb-3" />
                    <div className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
                      No Node Selected
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-500">
                      Click on any node in the flow graph to view its execution details
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 px-8 py-4 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
          <Button variant="outline" onClick={onClose} className="px-6 py-2">
            Close
          </Button>
          <Button
            onClick={handleExecute}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Executing...
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
    </div>
  );

  return createPortal(modalContent, document.body);
};

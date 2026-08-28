import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import ReactFlow, { Background, Controls, MiniMap, BackgroundVariant, Node, Edge } from 'react-flow-renderer';
import { langGraphService } from '../../services/langGraphService';
import toast from 'react-hot-toast';

const ReadOnlyServiceNode = ({ data }: any) => (
  <div className="bg-blue-500 text-white rounded-lg px-4 py-3 min-w-[200px] shadow-lg border-2 border-blue-600">
    <div className="font-semibold text-sm">{data.label}</div>
    <div className="text-xs mt-1 opacity-90">{data.method || 'GET'}</div>
    {data.url && <div className="text-xs mt-1 truncate opacity-75">{data.url}</div>}
  </div>
);

const ReadOnlyDecisionNode = ({ data }: any) => (
  <div className="bg-amber-500 text-white rounded-lg px-4 py-3 min-w-[200px] shadow-lg border-2 border-amber-600">
    <div className="font-semibold text-sm">{data.label}</div>
    <div className="text-xs mt-1 opacity-90">Decision</div>
  </div>
);

const ReadOnlyLLMNode = ({ data }: any) => (
  <div className="bg-emerald-500 text-white rounded-lg px-4 py-3 min-w-[200px] shadow-lg border-2 border-emerald-600">
    <div className="font-semibold text-sm">{data.label}</div>
    <div className="text-xs mt-1 opacity-90">LLM</div>
  </div>
);

const ReadOnlyFormNode = ({ data }: any) => (
  <div className="bg-pink-500 text-white rounded-lg px-4 py-3 min-w-[200px] shadow-lg border-2 border-pink-600">
    <div className="font-semibold text-sm">{data.label}</div>
    <div className="text-xs mt-1 opacity-90">Form</div>
  </div>
);

const ReadOnlyWorkflowNode = ({ data }: any) => (
  <div className="bg-purple-500 text-white rounded-lg px-4 py-3 min-w-[200px] shadow-lg border-2 border-purple-600">
    <div className="font-semibold text-sm">{data.label}</div>
    <div className="text-xs mt-1 opacity-90">Workflow</div>
    {data.selectedWorkflowName && (
      <div className="text-xs mt-1 opacity-75">{data.selectedWorkflowName}</div>
    )}
  </div>
);

const nodeTypes = {
  serviceNode: ReadOnlyServiceNode,
  decisionNode: ReadOnlyDecisionNode,
  llmNode: ReadOnlyLLMNode,
  formNode: ReadOnlyFormNode,
  workflowNode: ReadOnlyWorkflowNode,
};

interface WorkflowViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflowName: string;
}

export const WorkflowViewModal: React.FC<WorkflowViewModalProps> = ({
  isOpen,
  onClose,
  workflowName,
}) => {
  const [componentId] = useState(() => Math.random().toString(36).substr(2, 9));
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(false);
  const [workflowContext, setWorkflowContext] = useState('');

  console.log(`[${componentId}] WorkflowViewModal render`, { isOpen, workflowName, nodes: nodes.length });

  useEffect(() => {
    console.log('WorkflowViewModal useEffect', { isOpen, workflowName });
    if (isOpen && workflowName) {
      loadWorkflow();
    }
  }, [isOpen, workflowName]);

  const loadWorkflow = async () => {
    console.log('loadWorkflow called');
    try {
      setLoading(true);
      const workflow = await langGraphService.getWorkflowByName(workflowName);
      console.log('Loaded workflow:', workflow);
      if (workflow) {
        setWorkflowContext(workflow.context || '');
        if (workflow.data) {
          const parsedData = typeof workflow.data === 'string' ? JSON.parse(workflow.data) : workflow.data;
          console.log('Parsed data:', parsedData);

          if (parsedData.graph) {
            setNodes(parsedData.graph.nodes || []);
            setEdges(parsedData.graph.edges || []);
          } else {
            setNodes(parsedData.nodes || []);
            setEdges(parsedData.edges || []);
          }
          console.log('Set nodes:', parsedData.graph?.nodes || parsedData.nodes);
          console.log('Set edges:', parsedData.graph?.edges || parsedData.edges);
        }
      }
    } catch (error) {
      console.error('Failed to load workflow:', error);
      toast.error('Failed to load workflow');
    } finally {
      setLoading(false);
    }
  };

  console.log(`[${componentId}] Before isOpen check`, { isOpen });

  if (!isOpen) {
    console.log(`[${componentId}] isOpen is false, returning null`);
    return null;
  }

  console.log(`[${componentId}] Creating modal content - about to render portal`);

  const modalContent = (
    <div className="fixed inset-0 bg-black bg-opacity-70" style={{ zIndex: 99999 }}>
      <div className="bg-white w-full h-full flex flex-col">
        <div className="bg-purple-500 text-white px-8 py-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{workflowName}</h2>
            {workflowContext && (
              <p className="text-sm text-purple-100 mt-1">{workflowContext}</p>
            )}
            <p className="text-xs text-purple-200 mt-1">Read-only view</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-purple-600 rounded transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading workflow...</p>
              </div>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              zoomOnScroll={true}
              panOnScroll={false}
              panOnDrag={true}
              fitView
              fitViewOptions={{ padding: 0.2 }}
            >
              <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e5e7eb" />
              <Controls showInteractive={false} />
              <MiniMap
                nodeColor={(node) => {
                  switch (node.type) {
                    case 'serviceNode':
                      return '#3b82f6';
                    case 'decisionNode':
                      return '#f59e0b';
                    case 'llmNode':
                      return '#10b981';
                    case 'formNode':
                      return '#ec4899';
                    case 'workflowNode':
                      return '#8b5cf6';
                    default:
                      return '#6b7280';
                  }
                }}
                maskColor="rgba(0, 0, 0, 0.1)"
              />
            </ReactFlow>
          )}
        </div>
      </div>
    </div>
  );

  console.log(`[${componentId}] Returning portal to document.body`);
  return createPortal(modalContent, document.body);
};

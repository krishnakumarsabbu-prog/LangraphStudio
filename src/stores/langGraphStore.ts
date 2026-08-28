import { create } from 'zustand';
import { Node, Edge, Connection, addEdge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from 'react-flow-renderer';

export interface ServiceNodeData {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  request: string;
  label: string;
}

export interface DecisionNodeData {
  script: string;
  label: string;
}

export interface LLMNodeData {
  model: string;
  prompt: string;
  label: string;
}

export interface FormNodeData {
  label: string;
  formConfig: any;
}

export interface WorkflowNodeData {
  label: string;
  selectedWorkflowName?: string;
  dynamicSelection?: boolean;
  workflowFieldPath?: string;
  workflowConfig?: {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    requestMapping: string;
    headers: Array<{ key: string; value: string }>;
  };
}

export interface ParallelNodeData {
  label: string;
}

export interface MergeNodeData {
  label: string;
}

export interface MapperNodeData {
  label: string;
  mapperConfig?: {
    outputFormat: 'json' | 'xml';
    sampleResponse: string;
    template: string;
    mappings?: Record<string, string>;
  };
}

export type NodeData = ServiceNodeData | DecisionNodeData | LLMNodeData | FormNodeData | WorkflowNodeData | ParallelNodeData | MergeNodeData | MapperNodeData;

export interface LangGraphEdge extends Edge {
  data?: {
    condition: string;
  };
}

export type NodeExecutionStatus = 'idle' | 'running' | 'success' | 'failed';

export interface NodeExecutionState {
  status: NodeExecutionStatus;
  logs: string[];
  lastRun?: Date;
  error?: string;
}

interface LangGraphState {
  nodes: Node<NodeData>[];
  edges: LangGraphEdge[];
  inputs: Record<string, any>;
  selectedNodeId: string | null;
  nodeExecutionStates: Record<string, NodeExecutionState>;

  setNodes: (nodes: Node<NodeData>[]) => void;
  setEdges: (edges: LangGraphEdge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  addServiceNode: (position: { x: number; y: number }) => string;
  addDecisionNode: (position: { x: number; y: number }) => string;
  addLLMNode: (position: { x: number; y: number }) => string;
  addFormNode: (position: { x: number; y: number }) => string;
  addWorkflowNode: (position: { x: number; y: number }) => string;
  addParallelNode: (position: { x: number; y: number }) => string;
  addMergeNode: (position: { x: number; y: number }) => string;
  addMapperNode: (position: { x: number; y: number }) => string;
  updateNodeData: (nodeId: string, data: Partial<NodeData>) => void;
  deleteNode: (nodeId: string) => void;
  updateEdgeCondition: (edgeId: string, condition: string) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  setNodeExecutionState: (nodeId: string, state: Partial<NodeExecutionState>) => void;
  clearNodeExecutionState: (nodeId: string) => void;

  setInputs: (inputs: Record<string, any>) => void;
  clearCanvas: () => void;
  exportJSON: () => string;
  importJSON: (jsonString: string) => void;
  addMaterializedFragment: (nodes: Node<NodeData>[], edges: LangGraphEdge[]) => void;
}

let nodeIdCounter = 1;

export const useLangGraphStore = create<LangGraphState>((set, get) => ({
  nodes: [],
  edges: [],
  inputs: { message: {} },
  selectedNodeId: null,
  nodeExecutionStates: {},

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes) as Node<NodeData>[],
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges) as LangGraphEdge[],
    });
  },

  onConnect: (connection) => {
    const newEdge: LangGraphEdge = {
      ...connection,
      id: `edge-${connection.source}-${connection.target}-${Date.now()}`,
      data: { condition: '' },
      type: 'custom',
      animated: true,
      style: { stroke: '#3b82f6', strokeWidth: 4 },
    };
    set({
      edges: addEdge(newEdge, get().edges) as LangGraphEdge[],
    });
  },

  addServiceNode: (position) => {
    const id = `service-${nodeIdCounter++}`;
    const newNode: Node<ServiceNodeData> = {
      id,
      type: 'serviceNode',
      position,
      data: {
        label: id,
        url: '',
        method: 'GET',
        request: '',
      },
    };
    set({ nodes: [...get().nodes, newNode], selectedNodeId: id });
    return id;
  },

  addDecisionNode: (position) => {
    const id = `decision-${nodeIdCounter++}`;
    const newNode: Node<DecisionNodeData> = {
      id,
      type: 'decisionNode',
      position,
      data: {
        label: id,
        script: '',
      },
    };
    set({ nodes: [...get().nodes, newNode], selectedNodeId: id });
    return id;
  },

  addLLMNode: (position) => {
    const id = `llm-${nodeIdCounter++}`;
    const newNode: Node<LLMNodeData> = {
      id,
      type: 'llmNode',
      position,
      data: {
        label: id,
        model: '',
        prompt: '',
      },
    };
    set({ nodes: [...get().nodes, newNode], selectedNodeId: id });
    return id;
  },

  addFormNode: (position) => {
    const id = `form-${nodeIdCounter++}`;
    const newNode: Node<FormNodeData> = {
      id,
      type: 'formNode',
      position,
      data: {
        label: id,
        formConfig: null,
      },
    };
    set({ nodes: [...get().nodes, newNode], selectedNodeId: id });
    return id;
  },

  addWorkflowNode: (position) => {
    const id = `workflow-${nodeIdCounter++}`;
    const newNode: Node<WorkflowNodeData> = {
      id,
      type: 'workflowNode',
      position,
      data: {
        label: id,
        selectedWorkflowName: undefined,
        dynamicSelection: false,
        workflowFieldPath: undefined,
        workflowConfig: {
          url: '',
          method: 'POST',
          requestMapping: '{}',
          headers: [],
        },
      },
    };
    set({ nodes: [...get().nodes, newNode], selectedNodeId: id });
    return id;
  },

  addParallelNode: (position) => {
    const id = `parallel-${nodeIdCounter++}`;
    const newNode: Node<ParallelNodeData> = {
      id,
      type: 'parallelNode',
      position,
      data: {
        label: id,
      },
    };
    set({ nodes: [...get().nodes, newNode], selectedNodeId: id });
    return id;
  },

  addMergeNode: (position) => {
    const id = `merge-${nodeIdCounter++}`;
    const newNode: Node<MergeNodeData> = {
      id,
      type: 'mergeNode',
      position,
      data: {
        label: id,
      },
    };
    set({ nodes: [...get().nodes, newNode], selectedNodeId: id });
    return id;
  },

  addMapperNode: (position) => {
    const id = `mapper-${nodeIdCounter++}`;
    const newNode: Node<MapperNodeData> = {
      id,
      type: 'mapperNode',
      position,
      data: {
        label: `Response Mapper (${id})`,
        mapperConfig: {
          outputFormat: 'json',
          sampleResponse: '{\n  "status": "SUCCESS",\n  "data": {}\n}',
          template: '{\n  "status": "SUCCESS",\n  "data": {}\n}',
        },
      },
    };
    set({ nodes: [...get().nodes, newNode], selectedNodeId: id });
    return id;
  },

  updateNodeData: (nodeId, data) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } }
          : node
      ),
    });
  },

  deleteNode: (nodeId) => {
    set({
      nodes: get().nodes.filter((node) => node.id !== nodeId),
      edges: get().edges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId
      ),
    });
  },

  updateEdgeCondition: (edgeId, condition) => {
    set({
      edges: get().edges.map((edge) =>
        edge.id === edgeId
          ? { ...edge, data: { ...edge.data, condition } }
          : edge
      ),
    });
  },

  setSelectedNodeId: (nodeId) => set({ selectedNodeId: nodeId }),

  setNodeExecutionState: (nodeId, state) => {
    const current = get().nodeExecutionStates[nodeId] || { status: 'idle', logs: [] };
    set({
      nodeExecutionStates: {
        ...get().nodeExecutionStates,
        [nodeId]: { ...current, ...state },
      },
    });
  },

  clearNodeExecutionState: (nodeId) => {
    const states = { ...get().nodeExecutionStates };
    delete states[nodeId];
    set({ nodeExecutionStates: states });
  },

  setInputs: (inputs) => set({ inputs }),

  clearCanvas: () => {
    set({ nodes: [], edges: [] });
    nodeIdCounter = 1;
  },

  addMaterializedFragment: (fragmentNodes, fragmentEdges) => {
    set({
      nodes: [...get().nodes, ...fragmentNodes],
      edges: [...get().edges, ...fragmentEdges],
    });
    if (fragmentNodes.length > 0) {
      set({ selectedNodeId: fragmentNodes[0].id });
    }
  },

  exportJSON: () => {
    const state = get();
    const exportData = {
      graph: {
        nodes: state.nodes.map((node) => {
          let type = 'service';
          if (node.type === 'serviceNode') type = 'service';
          else if (node.type === 'decisionNode') type = 'decision';
          else if (node.type === 'formNode') type = 'form';
          else if (node.type === 'workflowNode') type = 'workflow';
          else if (node.type === 'llmNode') type = 'llm';
          else if (node.type === 'parallelNode') type = 'parallel';
          else if (node.type === 'mergeNode') type = 'merge';

          return {
            id: node.id,
            type,
            data: node.data,
          };
        }),
        edges: state.edges.map((edge) => ({
          source: edge.source,
          target: edge.target,
          condition: edge.data?.condition || '',
        })),
        inputs: state.inputs,
      },
    };
    return JSON.stringify(exportData, null, 2);
  },

  importJSON: (jsonString: string) => {
    try {
      const data = JSON.parse(jsonString);
      const graph = data.graph || data;

      const importedNodes: Node<NodeData>[] = (graph.nodes || []).map((node: any, index: number) => {
        let nodeType = 'serviceNode';
        if (node.type === 'service') nodeType = 'serviceNode';
        else if (node.type === 'decision') nodeType = 'decisionNode';
        else if (node.type === 'form') nodeType = 'formNode';
        else if (node.type === 'workflow') nodeType = 'workflowNode';
        else if (node.type === 'llm') nodeType = 'llmNode';
        else if (node.type === 'parallel') nodeType = 'parallelNode';
        else if (node.type === 'merge') nodeType = 'mergeNode';

        return {
          id: node.id,
          type: nodeType,
          position: { x: 100 + (index * 50), y: 100 + (index * 50) },
          data: node.data,
        };
      });

      const importedEdges: LangGraphEdge[] = (graph.edges || []).map((edge: any) => ({
        id: `edge-${edge.source}-${edge.target}-${Date.now()}`,
        source: edge.source,
        target: edge.target,
        type: 'custom',
        animated: true,
        style: { stroke: '#3b82f6', strokeWidth: 4 },
        data: { condition: edge.condition || '' },
      }));

      set({
        nodes: importedNodes,
        edges: importedEdges,
        inputs: graph.inputs || {},
      });
    } catch (error) {
      throw new Error('Invalid JSON format');
    }
  },
}));

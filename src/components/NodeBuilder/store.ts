/**
 * Zustand store for the Tenant Node Builder.
 *
 * Completely independent of the existing LangGraph store. Manages the
 * blueprint document: metadata, nodes, edges, selection, validation
 * issues, and test results.
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  BlueprintNode,
  BlueprintEdge,
  BlueprintMetadata,
  BlueprintDocument,
  FrameworkNodeType,
  NodeConfig,
  ValidationIssue,
  TestResult,
  ServiceNodeConfig,
  DecisionNodeConfig,
  LLMNodeConfig,
  FormNodeConfig,
  createDefaultServiceConfig,
  createDefaultDecisionConfig,
  createDefaultLLMConfig,
  createDefaultFormConfig,
} from './types';

let nodeCounter = 1;

function makeNodeId(type: FrameworkNodeType): string {
  return `${type}-${nodeCounter++}-${Date.now().toString(36)}`;
}

function defaultConfigForType(type: FrameworkNodeType): NodeConfig {
  switch (type) {
    case 'service':
      return createDefaultServiceConfig();
    case 'decision':
      return createDefaultDecisionConfig();
    case 'llm':
      return createDefaultLLMConfig();
    case 'form':
      return createDefaultFormConfig();
  }
}

function defaultLabelForType(type: FrameworkNodeType): string {
  const labels: Record<FrameworkNodeType, string> = {
    service: 'Service Node',
    decision: 'Decision Node',
    llm: 'LLM Node',
    form: 'Form Node',
  };
  return labels[type];
}

interface NodeBuilderState {
  document: BlueprintDocument;
  selectedNodeId: string | null;
  validationIssues: ValidationIssue[];
  testResult: TestResult | null;
  isDirty: boolean;

  setMetadata: (metadata: Partial<BlueprintMetadata>) => void;
  setTenantId: (tenantId: string) => void;

  addNode: (type: FrameworkNodeType, position?: { x: number; y: number }) => string;
  updateNodeConfig: (nodeId: string, config: Partial<NodeConfig>) => void;
  updateNodeLabel: (nodeId: string, label: string) => void;
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  deleteNode: (nodeId: string) => void;
  selectNode: (nodeId: string | null) => void;

  addEdge: (source: string, target: string) => void;
  deleteEdge: (edgeId: string) => void;

  setInputContract: (contract: Record<string, any>) => void;
  setOutputContract: (contract: Record<string, any>) => void;
  addDependency: (depId: string) => void;
  removeDependency: (depId: string) => void;

  setValidationIssues: (issues: ValidationIssue[]) => void;
  setTestResult: (result: TestResult | null) => void;
  setDocument: (doc: BlueprintDocument) => void;
  markClean: () => void;
  resetDocument: () => void;
}

function createInitialDocument(): BlueprintDocument {
  return {
    blueprintId: null,
    tenantId: 'default-tenant',
    metadata: {
      name: 'Untitled Node Blueprint',
      description: '',
      version: '1.0',
      status: 'DRAFT',
    },
    nodes: [],
    edges: [],
    inputContract: {},
    outputContract: {},
    dependencies: [],
  };
}

export const useNodeBuilderStore = create<NodeBuilderState>((set, get) => ({
  document: createInitialDocument(),
  selectedNodeId: null,
  validationIssues: [],
  testResult: null,
  isDirty: false,

  setMetadata: (metadata) =>
    set((state) => ({
      document: { ...state.document, metadata: { ...state.document.metadata, ...metadata } },
      isDirty: true,
    })),

  setTenantId: (tenantId) =>
    set((state) => ({
      document: { ...state.document, tenantId },
      isDirty: true,
    })),

  addNode: (type, position) => {
    const id = makeNodeId(type);
    const node: BlueprintNode = {
      id,
      type,
      position: position || { x: 200 + Math.random() * 100, y: 150 + Math.random() * 80 },
      data: {
        label: defaultLabelForType(type),
        config: defaultConfigForType(type),
      },
    };
    set((state) => ({
      document: { ...state.document, nodes: [...state.document.nodes, node] },
      selectedNodeId: id,
      isDirty: true,
    }));
    return id;
  },

  updateNodeConfig: (nodeId, config) =>
    set((state) => ({
      document: {
        ...state.document,
        nodes: state.document.nodes.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, config: { ...n.data.config, ...config } as NodeConfig } }
            : n
        ),
      },
      isDirty: true,
    })),

  updateNodeLabel: (nodeId, label) =>
    set((state) => ({
      document: {
        ...state.document,
        nodes: state.document.nodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, label } } : n
        ),
      },
      isDirty: true,
    })),

  updateNodePosition: (nodeId, position) =>
    set((state) => ({
      document: {
        ...state.document,
        nodes: state.document.nodes.map((n) =>
          n.id === nodeId ? { ...n, position } : n
        ),
      },
      isDirty: true,
    })),

  deleteNode: (nodeId) =>
    set((state) => ({
      document: {
        ...state.document,
        nodes: state.document.nodes.filter((n) => n.id !== nodeId),
        edges: state.document.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      },
      selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
      isDirty: true,
    })),

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  addEdge: (source, target) => {
    if (source === target) return;
    const existing = get().document.edges.find(
      (e) => e.source === source && e.target === target
    );
    if (existing) return;
    const edge: BlueprintEdge = {
      id: `edge-${source}-${target}-${Date.now()}`,
      source,
      target,
    };
    set((state) => ({
      document: { ...state.document, edges: [...state.document.edges, edge] },
      isDirty: true,
    }));
  },

  deleteEdge: (edgeId) =>
    set((state) => ({
      document: {
        ...state.document,
        edges: state.document.edges.filter((e) => e.id !== edgeId),
      },
      isDirty: true,
    })),

  setInputContract: (contract) =>
    set((state) => ({
      document: { ...state.document, inputContract: contract },
      isDirty: true,
    })),

  setOutputContract: (contract) =>
    set((state) => ({
      document: { ...state.document, outputContract: contract },
      isDirty: true,
    })),

  addDependency: (depId) =>
    set((state) => ({
      document: {
        ...state.document,
        dependencies: state.document.dependencies.includes(depId)
          ? state.document.dependencies
          : [...state.document.dependencies, depId],
      },
      isDirty: true,
    })),

  removeDependency: (depId) =>
    set((state) => ({
      document: {
        ...state.document,
        dependencies: state.document.dependencies.filter((d) => d !== depId),
      },
      isDirty: true,
    })),

  setValidationIssues: (issues) => set({ validationIssues: issues }),
  setTestResult: (result) => set({ testResult: result }),
  setDocument: (doc) => set({ document: doc, selectedNodeId: null, isDirty: false, validationIssues: [], testResult: null }),
  markClean: () => set({ isDirty: false }),
  resetDocument: () => set({ document: createInitialDocument(), selectedNodeId: null, validationIssues: [], testResult: null, isDirty: false }),
}));

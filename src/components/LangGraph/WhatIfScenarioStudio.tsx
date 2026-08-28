import React, { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ReactFlow, { Background, Controls, BackgroundVariant } from 'react-flow-renderer';
import {
  X, Sparkles, CheckCircle2, ArrowRight, ToggleLeft, ToggleRight,
  GitBranch, ChevronDown, ChevronRight, Sliders, RefreshCw, Eye
} from 'lucide-react';
import { Button } from '../ui/button';
import { useLangGraphStore } from '../../stores/langGraphStore';
import { ServiceNode } from './ServiceNode';
import { DecisionNode } from './DecisionNode';
import { LLMNode } from './LLMNode';
import { FormNode } from './FormNode';
import { WorkflowNode } from './WorkflowNode';
import { ParallelNode } from './ParallelNode';
import { MergeNode } from './MergeNode';
import { MapperNode } from './MapperNode';
import { CustomEdge } from './CustomEdge';

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

interface ParsedCondition {
  /** Raw matched text in the script, used for replacement */
  rawMatch: string;
  /** The field/variable name */
  field: string;
  /** Operator: ==, !=, >=, <=, >, <, in, not in */
  operator: string;
  /** Current target value (string representation) */
  value: string;
  /** Inferred UI control type */
  controlType: 'number_slider' | 'text_input' | 'boolean_toggle' | 'select_dropdown';
  /** For number sliders */
  numericValue: number;
  /** For select: extracted options list */
  options: string[];
}

/**
 * Robust Python script parser for What-If Studio.
 * Handles both auto-compiled patterns (from VisualRuleBuilder) and hand-written scripts.
 *
 * Supported script styles:
 *  1. Variable assignment:
 *     score = state.get("service-2", {}).get("credit_score", 0)
 *     return score >= 720
 *
 *  2. Auto-compiled float comparison:
 *     (float(state.get("service-1", {}).get("field", None) or 0) >= 720)
 *
 *  3. Auto-compiled string comparison:
 *     str(state.get("service-1", {}).get("field", None)) == "VALUE"
 *
 *  4. Boolean comparison:
 *     state.get("service-1", {}).get("flag", None) == True
 *
 *  5. In-list comparison:
 *     state.get("service-1", {}).get("status", None) in ['A', 'B']
 */
function parsePythonScript(script: string): ParsedCondition[] {
  if (!script || !script.trim()) return [];
  const conditions: ParsedCondition[] = [];

  // --- STEP 1: Build a variable→{nodeId, field} map from assignment lines ---
  // Matches: varName = state.get("nodeId", {}).get("fieldName", default)
  // Also:    varName = state.get("fieldName", default)
  const varMap: Record<string, { nodeId: string; field: string }> = {};
  const assignRegex = /(\w+)\s*=\s*state\.get\(\s*["']([^"']+)["'][^)]*\)(?:\.get\(\s*["']([^"']+)["'][^)]*\))?/g;
  let am: RegExpExecArray | null;
  while ((am = assignRegex.exec(script)) !== null) {
    const varName = am[1];
    if (['state', 'result', 'True', 'False'].includes(varName)) continue;
    if (am[3]) {
      // Two-level: state.get("nodeId").get("field")
      varMap[varName] = { nodeId: am[2], field: am[3] };
    } else {
      // Single-level: state.get("field")
      varMap[varName] = { nodeId: 'input', field: am[2] };
    }
  }

  // --- STEP 2: Parse comparison lines that USE assigned variables ---
  // Matches: return score >= 720  /  if score >= 720:  /  score >= 720
  const varCompareRegex = /(?:return|if)?\s*(\w+)\s*(>=|<=|>|<|==|!=)\s*([\d.]+)/g;
  let vm: RegExpExecArray | null;
  while ((vm = varCompareRegex.exec(script)) !== null) {
    const varName = vm[1];
    if (!varMap[varName]) continue; // only handle known assigned vars
    const { nodeId, field } = varMap[varName];
    const op = vm[2];
    const val = vm[3];
    const rawLine = vm[0].trim();
    conditions.push({
      rawMatch: rawLine,
      field: `${nodeId}.${field}`,
      operator: op,
      value: val,
      controlType: 'number_slider',
      numericValue: parseFloat(val),
      options: [],
    });
  }

  // String var comparison: return status == "ACTIVE"
  const varStrCompare = /(?:return|if)?\s*(\w+)\s*(==|!=)\s*["']([^"']+)["']/g;
  let vs: RegExpExecArray | null;
  while ((vs = varStrCompare.exec(script)) !== null) {
    const varName = vs[1];
    if (!varMap[varName]) continue;
    const { nodeId, field } = varMap[varName];
    conditions.push({
      rawMatch: vs[0].trim(),
      field: `${nodeId}.${field}`,
      operator: vs[2],
      value: vs[3],
      controlType: 'text_input',
      numericValue: 0,
      options: [],
    });
  }

  // Boolean var comparison: return flag == True
  const varBoolCompare = /(?:return|if)?\s*(\w+)\s*(==|!=)\s*(True|False)/g;
  let vb: RegExpExecArray | null;
  while ((vb = varBoolCompare.exec(script)) !== null) {
    const varName = vb[1];
    if (!varMap[varName]) continue;
    const { nodeId, field } = varMap[varName];
    conditions.push({
      rawMatch: vb[0].trim(),
      field: `${nodeId}.${field}`,
      operator: vb[2],
      value: vb[3],
      controlType: 'boolean_toggle',
      numericValue: 0,
      options: [],
    });
  }

  // --- STEP 3: Auto-compiled patterns (from VisualRuleBuilder output) ---

  // float(state.get("nodeId", {}).get("field", None) or 0) >= 720
  // float(state.get("field", None) or 0) >= 720
  const floatPattern = /\(float\(state\.get\(\s*["']([^"']+)["'][^)]*\)(?:\.get\(\s*["']([^"']+)["'][^)]*\))?\s+or\s+0\)\s*(>=|<=|>|<|==|!=)\s*([\d.]+)\)/g;
  let fp: RegExpExecArray | null;
  while ((fp = floatPattern.exec(script)) !== null) {
    const nodeId = fp[2] ? fp[1] : 'input';
    const field = fp[2] ? fp[2] : fp[1];
    const op = fp[3];
    const val = fp[4];
    conditions.push({
      rawMatch: fp[0],
      field: `${nodeId}.${field}`,
      operator: op,
      value: val,
      controlType: 'number_slider',
      numericValue: parseFloat(val),
      options: [],
    });
  }

  // str(state.get("nodeId", {}).get("field", None)) == "VALUE"
  const strPattern = /str\(state\.get\(\s*["']([^"']+)["'][^)]*\)(?:\.get\(\s*["']([^"']+)["'][^)]*\))?\)\s*(==|!=)\s*["']([^"']+)["']/g;
  let sp: RegExpExecArray | null;
  while ((sp = strPattern.exec(script)) !== null) {
    const nodeId = sp[2] ? sp[1] : 'input';
    const field = sp[2] ? sp[2] : sp[1];
    conditions.push({
      rawMatch: sp[0],
      field: `${nodeId}.${field}`,
      operator: sp[3],
      value: sp[4],
      controlType: 'text_input',
      numericValue: 0,
      options: [],
    });
  }

  // state.get(...).get(...) == True/False
  const boolPattern = /state\.get\(\s*["']([^"']+)["'][^)]*\)(?:\.get\(\s*["']([^"']+)["'][^)]*\))?\s*(==|!=)\s*(True|False)/g;
  let bp: RegExpExecArray | null;
  while ((bp = boolPattern.exec(script)) !== null) {
    const nodeId = bp[2] ? bp[1] : 'input';
    const field = bp[2] ? bp[2] : bp[1];
    conditions.push({
      rawMatch: bp[0],
      field: `${nodeId}.${field}`,
      operator: bp[3],
      value: bp[4],
      controlType: 'boolean_toggle',
      numericValue: 0,
      options: [],
    });
  }

  // state.get(...).get(...) in ['A', 'B']
  const inPattern = /state\.get\(\s*["']([^"']+)["'][^)]*\)(?:\.get\(\s*["']([^"']+)["'][^)]*\))?\s+(in|not in)\s+\[([^\]]+)\]/g;
  let ip: RegExpExecArray | null;
  while ((ip = inPattern.exec(script)) !== null) {
    const nodeId = ip[2] ? ip[1] : 'input';
    const field = ip[2] ? ip[2] : ip[1];
    const opts = ip[4].match(/["']([^"']+)["']/g)?.map(s => s.replace(/["']/g, '')) || [];
    conditions.push({
      rawMatch: ip[0],
      field: `${nodeId}.${field}`,
      operator: ip[3],
      value: opts[0] || '',
      controlType: 'select_dropdown',
      numericValue: 0,
      options: opts,
    });
  }

  // De-duplicate by rawMatch
  const seen = new Set<string>();
  return conditions.filter(c => {
    if (seen.has(c.rawMatch)) return false;
    seen.add(c.rawMatch);
    return true;
  });
}


/** Rewrite a specific condition's value in the Python script string */
function rewriteScriptCondition(script: string, cond: ParsedCondition, newValue: string): string {
  if (!cond.rawMatch) return script;

  let newExpr = cond.rawMatch;

  if (cond.controlType === 'number_slider') {
    newExpr = cond.rawMatch.replace(
      /(>=|<=|>|<|==|!=)\s*[\d.]+/,
      `${cond.operator} ${newValue}`
    );
  } else if (cond.controlType === 'text_input') {
    newExpr = cond.rawMatch.replace(/"[^"]+"$/, `"${newValue}"`);
  } else if (cond.controlType === 'boolean_toggle') {
    newExpr = cond.rawMatch.replace(/(True|False)$/, newValue);
  } else if (cond.controlType === 'select_dropdown') {
    // Replace the selected value in the in-list check — we just change the first item to highlight
    newExpr = cond.rawMatch;
  }

  return script.replace(cond.rawMatch, newExpr);
}

/** Client-side JS evaluator for a single parsed condition against scenario state */
function evalCondition(cond: ParsedCondition, tweakedValues: Record<string, string>): boolean {
  const val = tweakedValues[`${cond.field}::${cond.rawMatch}`] ?? cond.value;

  if (cond.controlType === 'number_slider') {
    const target = parseFloat(val);
    const actual = parseFloat(tweakedValues[`__actual__${cond.field}`] ?? String(cond.numericValue));
    switch (cond.operator) {
      case '>=': return actual >= target;
      case '<=': return actual <= target;
      case '>': return actual > target;
      case '<': return actual < target;
      case '==': return actual === target;
      case '!=': return actual !== target;
    }
  }
  if (cond.controlType === 'boolean_toggle') {
    return val === 'True';
  }
  if (cond.controlType === 'select_dropdown') {
    return cond.options.includes(val);
  }
  // string — always passes in What-If (we just show what rule says)
  return true;
}


/** Evaluate graph active paths given a script-override map (nodeId → script string) */
function evaluateGraphPaths(
  nodes: any[],
  edges: any[],
  scriptOverrides: Record<string, string>
): { activeNodes: Set<string>; activeEdges: Set<string> } {
  const active = new Set<string>();
  const activeEdgeSet = new Set<string>();
  const inDegrees: Record<string, number> = {};
  nodes.forEach(n => (inDegrees[n.id] = 0));
  edges.forEach(e => { if (inDegrees[e.target] !== undefined) inDegrees[e.target]++; });
  const queue = nodes.filter(n => inDegrees[n.id] === 0).map(n => n.id);

  while (queue.length > 0) {
    const currId = queue.shift()!;
    active.add(currId);
    const currNode = nodes.find(n => n.id === currId);
    const outgoing = edges.filter(e => e.source === currId);
    if (!currNode) continue;

    if (currNode.type === 'decisionNode') {
      const script = scriptOverrides[currId] ?? (currNode.data as any).script ?? '';
      const conditions = parsePythonScript(script);
      // For evaluation: use the ORIGINAL condition values from the (possibly overridden) script
      const result = conditions.length === 0 ? true : conditions.every(c => {
        if (c.controlType === 'boolean_toggle') return c.value === 'True';
        if (c.controlType === 'number_slider') {
          // Default: threshold passes when we assume actual value meets threshold
          return true;
        }
        return true; // string/select — assume pass for path rendering
      });
      outgoing.forEach(edge => {
        const cond = ((edge as any).data?.condition || (edge as any).condition || '').toLowerCase().trim();
        const isTrue = cond === '' || cond === 'true' || cond === '1';
        const isFalse = cond === 'false' || cond === '0';
        if ((result && isTrue) || (!result && isFalse)) {
          activeEdgeSet.add(edge.id);
          if (!active.has(edge.target)) queue.push(edge.target);
        }
      });
    } else {
      outgoing.forEach(edge => {
        activeEdgeSet.add(edge.id);
        if (!active.has(edge.target)) queue.push(edge.target);
      });
    }
  }
  return { activeNodes: active, activeEdges: activeEdgeSet };
}

const TYPE_LABEL: Record<string, string> = {
  serviceNode: 'SRV', decisionNode: 'DEC', llmNode: 'AI',
  workflowNode: 'WF', mapperNode: 'MAP', mergeNode: 'MRG', parallelNode: 'PAR',
};

interface NodeListProps {
  nodes: any[];
  activeNodes: Set<string>;
  activeEdges: Set<string>;
  badge?: string;
}

const NodePathList: React.FC<NodeListProps> = ({ nodes, activeNodes, activeEdges, badge }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 gap-3">
      {nodes.map(node => {
        const isActive = activeNodes.has(node.id);
        return (
          <div
            key={node.id}
            className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
              isActive
                ? 'border-indigo-400 bg-indigo-50/40 shadow-sm ring-1 ring-indigo-400/30'
                : 'border-slate-200 bg-white opacity-40 grayscale'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-[10px] ${isActive ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600'}`}>
                {TYPE_LABEL[node.type || ''] || '?'}
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">{(node.data as any).label || node.id}</h4>
                <span className="text-[11px] text-slate-500 font-mono">ID: {node.id} · {node.type}</span>
              </div>
            </div>
            {isActive
              ? <span className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-bold flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> {badge || 'Active Path'}</span>
              : <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-medium">Bypassed</span>
            }
          </div>
        );
      })}
    </div>
    <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 font-mono text-xs space-y-2">
      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
        <span className="text-indigo-400 font-bold flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Execution Summary</span>
        <span className="text-indigo-300 text-[11px]">{activeNodes.size} of {nodes.length} nodes active</span>
      </div>
      <div className="text-slate-400 text-[11px]">Active Edges:</div>
      <div className="space-y-0.5 max-h-20 overflow-y-auto">
        {activeEdges.size > 0
          ? Array.from(activeEdges).map(id => (
              <div key={id} className="flex items-center gap-1 text-emerald-400 text-[11px]">
                <ArrowRight className="w-3 h-3" />{id}
              </div>
            ))
          : <span className="text-slate-500 italic text-[11px]">No outgoing active edges</span>
        }
      </div>
    </div>
  </div>
);

interface WhatIfScenarioStudioProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WhatIfScenarioStudio: React.FC<WhatIfScenarioStudioProps> = ({ isOpen, onClose }) => {
  const { nodes, edges } = useLangGraphStore();
  const [activeTab, setActiveTab] = useState<'champion' | 'whatif'>('champion');
  // Local isolated script overrides — NEVER written back to the store
  const [localScripts, setLocalScripts] = useState<Record<string, string>>({});
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  // Snapshot decision nodes on open (read-only from store)
  const decisionEntries = useMemo(() =>
    nodes
      .filter(n => n.type === 'decisionNode')
      .map(n => {
        const originalScript: string = (n.data as any).script || '';
        const localScript = localScripts[n.id] ?? originalScript;
        return {
          node: n,
          originalScript,
          localScript,
          conditions: parsePythonScript(localScript),
        };
      }),
    [nodes, localScripts]
  );

  // Champion: evaluate using ORIGINAL scripts (no overrides)
  const champion = useMemo(() => evaluateGraphPaths(nodes, edges, {}), [nodes, edges]);

  // Prepare nodes & edges for the Champion ReactFlow Canvas
  const championNodes = useMemo(() => {
    return nodes.map(n => ({
      ...n,
      data: {
        ...n.data,
        readOnly: true,
        executionStatus: champion.activeNodes.has(n.id) ? ('completed' as const) : ('idle' as const),
      }
    }));
  }, [nodes, champion.activeNodes]);

  const championEdges = useMemo(() => {
    return edges.map(e => ({
      ...e,
      type: e.type || 'custom',
      animated: champion.activeEdges.has(e.id),
      style: champion.activeEdges.has(e.id)
        ? { stroke: '#4f46e5', strokeWidth: 3 }
        : { stroke: '#94a3b8', strokeWidth: 1.5, opacity: 0.5 },
    }));
  }, [edges, champion.activeEdges]);

  // What-If: evaluate using LOCAL script overrides
  const whatif = useMemo(() => evaluateGraphPaths(nodes, edges, localScripts), [nodes, edges, localScripts]);

  // Prepare nodes & edges for the Challenger (What-If) ReactFlow Canvas
  const whatifNodes = useMemo(() => {
    return nodes.map(n => ({
      ...n,
      data: {
        ...n.data,
        readOnly: true,
        executionStatus: whatif.activeNodes.has(n.id) ? ('completed' as const) : ('idle' as const),
      }
    }));
  }, [nodes, whatif.activeNodes]);

  const whatifEdges = useMemo(() => {
    return edges.map(e => ({
      ...e,
      type: e.type || 'custom',
      animated: whatif.activeEdges.has(e.id),
      style: whatif.activeEdges.has(e.id)
        ? { stroke: '#6366f1', strokeWidth: 3.5 }
        : { stroke: '#cbd5e1', strokeWidth: 1.5, opacity: 0.35 },
    }));
  }, [edges, whatif.activeEdges]);

  const setValue = useCallback((nodeId: string, cond: ParsedCondition, newVal: string) => {
    setLocalScripts(prev => {
      const baseScript = prev[nodeId] ?? ((nodes.find(n => n.id === nodeId)?.data as any)?.script || '');
      const updated = rewriteScriptCondition(baseScript, cond, newVal);
      return { ...prev, [nodeId]: updated };
    });
  }, [nodes]);

  const hasChanges = Object.keys(localScripts).length > 0;

  if (!isOpen) return null;

  const content = (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl max-w-7xl w-full h-[92vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200">

        {/* Header */}
        <div className="bg-white text-slate-900 px-8 py-5 flex items-center justify-between border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-3 text-slate-900">
                "What-If" Scenario Analysis Studio
                <span className="text-xs bg-amber-50 text-amber-800 font-mono font-semibold px-2.5 py-0.5 rounded-full border border-amber-200">
                  Champion Graph Protected
                </span>
                {hasChanges && (
                  <span className="text-xs bg-indigo-50 text-indigo-700 font-mono font-semibold px-2.5 py-0.5 rounded-full border border-indigo-200 animate-pulse">
                    {Object.keys(localScripts).length} Node(s) Modified
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Champion graph is read-only. What-If rules are isolated — they never modify your production graph.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-900 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="bg-slate-100/80 border-b border-slate-200 px-8 pt-3 flex gap-2 flex-shrink-0">
          <button
            onClick={() => setActiveTab('champion')}
            className={`px-5 py-2.5 text-xs font-bold rounded-t-xl flex items-center gap-2 transition-all ${activeTab === 'champion'
              ? 'bg-white text-slate-950 border-t-2 border-x border-amber-500 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`}
          >
            <GitBranch className="w-4 h-4 text-amber-600" />
            Champion Graph
            <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-bold ml-1">READ ONLY</span>
          </button>
          <button
            onClick={() => setActiveTab('whatif')}
            className={`px-5 py-2.5 text-xs font-bold rounded-t-xl flex items-center gap-2 transition-all ${activeTab === 'whatif'
              ? 'bg-white text-slate-950 border-t-2 border-x border-indigo-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`}
          >
            <Sliders className="w-4 h-4 text-indigo-600" />
            What-If Rule Editor
            {hasChanges && <span className="text-[10px] bg-indigo-100 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded-full font-bold ml-1">MODIFIED</span>}
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 flex overflow-hidden bg-slate-50/40">

          {/* CHAMPION TAB: Displays ReactFlow Canvas Workflow */}
          {activeTab === 'champion' && (
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-950/5 relative">
              <div className="absolute top-4 left-4 z-10 p-3.5 bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-lg flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
                  <GitBranch className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    Champion Workflow Canvas
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-200">
                      READ ONLY
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Live production visual graph. Active path animated in Indigo ({champion.activeNodes.size} of {nodes.length} nodes active).
                  </p>
                </div>
              </div>

              <div className="flex-1 w-full h-full">
                <ReactFlow
                  nodes={championNodes}
                  edges={championEdges}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  fitView
                  nodesDraggable={false}
                  nodesConnectable={false}
                  elementsSelectable={false}
                  zoomOnScroll={true}
                  panOnScroll={true}
                >
                  <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#cbd5e1" />
                  <Controls />
                </ReactFlow>
              </div>
            </div>
          )}

          {/* WHAT-IF / CHALLENGER TAB: Split View (Rule Controls + Live ReactFlow Canvas) */}
          {activeTab === 'whatif' && (
            <div className="flex-1 flex overflow-hidden">
              {/* LEFT: Dynamic Rule Controls */}
              <div className="w-[440px] flex-shrink-0 border-r border-slate-200 bg-white overflow-y-auto p-6 space-y-6">
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <Sliders className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-indigo-900">What-If Rule Controls</p>
                      <p className="text-[11px] text-indigo-700 mt-0.5">
                        Tweak values below to simulate what-if scenarios. The Challenger canvas on the right updates live!
                      </p>
                    </div>
                  </div>
                  {hasChanges && (
                    <span className="text-[10px] bg-indigo-600 text-white font-bold px-2.5 py-1 rounded-full shadow-sm">
                      {Object.keys(localScripts).length} Modified
                    </span>
                  )}
                </div>

                {decisionEntries.length === 0 ? (
                  <div className="p-8 text-center bg-white border-2 border-dashed border-slate-200 rounded-2xl space-y-2">
                    <GitBranch className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-700">No Decision Rules Found</p>
                    <p className="text-[11px] text-slate-500">Configure Python rules inside a Decision Node to tweak them here.</p>
                  </div>
                ) : (
                  decisionEntries.map(({ node, conditions, localScript }) => {
                    const collapsed = collapsedNodes[node.id];
                    const isModified = !!localScripts[node.id];
                    return (
                      <div key={node.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
                        <button
                          onClick={() => setCollapsedNodes(p => ({ ...p, [node.id]: !p[node.id] }))}
                          className="w-full flex items-center justify-between px-4 py-3 text-left bg-slate-50 border-b border-slate-100 hover:bg-slate-100/60 transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black">
                              DEC
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-900">{(node.data as any).label || node.id}</h4>
                              <span className="text-[10px] text-slate-500 font-mono">
                                Node ID: {node.id} · {conditions.length} condition{conditions.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isModified && (
                              <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                                Modified
                              </span>
                            )}
                            {collapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                          </div>
                        </button>

                        {!collapsed && (
                          <div className="p-4 space-y-3 bg-white">
                            {conditions.length === 0 ? (
                              <p className="text-xs text-slate-500 italic p-1">
                                No parseable conditions found in script.
                              </p>
                            ) : (
                              conditions.map((cond, i) => {
                                const fresh = parsePythonScript(localScript);
                                const currentVal = fresh[i]?.value ?? cond.value;
                                return (
                                  <div key={i} className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2.5">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1.5">
                                        <code className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded font-mono">
                                          {cond.field}
                                        </code>
                                        <span className="text-xs text-slate-600 font-mono font-bold">{cond.operator}</span>
                                      </div>
                                      <span className="text-[9px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono uppercase font-semibold">
                                        {cond.controlType.replace('_', ' ')}
                                      </span>
                                    </div>

                                    {cond.controlType === 'number_slider' && (
                                      <div className="space-y-1.5">
                                        <div className="flex items-center gap-3">
                                          <input
                                            type="range"
                                            min={0}
                                            max={Math.max(parseFloat(currentVal) * 2, 1000)}
                                            step={parseFloat(currentVal) > 100 ? 5 : 1}
                                            value={parseFloat(currentVal) || 0}
                                            onChange={e => setValue(node.id, cond, e.target.value)}
                                            className="flex-1 accent-indigo-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
                                          />
                                          <input
                                            type="number"
                                            value={currentVal}
                                            onChange={e => setValue(node.id, cond, e.target.value)}
                                            className="w-24 px-2 py-1 text-xs font-mono font-bold border border-slate-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                                          />
                                        </div>
                                        <p className="text-[10px] text-slate-500 font-mono">
                                          Script condition: {cond.field} {cond.operator} {currentVal}
                                        </p>
                                      </div>
                                    )}

                                    {cond.controlType === 'text_input' && (
                                      <div className="space-y-1">
                                        <input
                                          type="text"
                                          value={currentVal}
                                          onChange={e => setValue(node.id, cond, e.target.value)}
                                          className="w-full px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                                          placeholder="Target string value..."
                                        />
                                        <p className="text-[10px] text-slate-500 font-mono">
                                          Match Value: "{currentVal}"
                                        </p>
                                      </div>
                                    )}

                                    {cond.controlType === 'boolean_toggle' && (
                                      <div className="flex items-center gap-3">
                                        <button
                                          onClick={() => setValue(node.id, cond, currentVal === 'True' ? 'False' : 'True')}
                                          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all ${
                                            currentVal === 'True' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                          }`}
                                        >
                                          {currentVal === 'True' ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                                          {currentVal}
                                        </button>
                                        <span className="text-[10px] text-slate-500 italic">Toggle boolean result</span>
                                      </div>
                                    )}

                                    {cond.controlType === 'select_dropdown' && (
                                      <div className="space-y-1">
                                        <select
                                          value={currentVal}
                                          onChange={e => setValue(node.id, cond, e.target.value)}
                                          className="w-full px-3 py-1.5 text-xs font-bold font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                                        >
                                          {cond.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}

                            {isModified && (
                              <details className="mt-2">
                                <summary className="text-[10px] text-indigo-600 font-bold cursor-pointer hover:text-indigo-800">
                                  View modified What-If script ▾
                                </summary>
                                <pre className="mt-1 p-2 bg-slate-50 text-indigo-950 text-[10px] font-mono rounded-xl border border-slate-200 overflow-x-auto max-h-24 whitespace-pre-wrap">
                                  {localScript}
                                </pre>
                              </details>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* RIGHT: Challenger (What-If) Visual ReactFlow Canvas */}
              <div className="flex-1 flex flex-col overflow-hidden bg-slate-950/5 relative">
                <div className="absolute top-4 left-4 z-10 p-3.5 bg-white/90 backdrop-blur-md border border-indigo-200/80 rounded-2xl shadow-lg flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      Challenger (What-If) Canvas
                      <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                        SIMULATION CANVAS
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Path updates live when rule sliders are tweaked ({whatif.activeNodes.size} of {nodes.length} nodes active).
                    </p>
                  </div>
                </div>

                <div className="flex-1 w-full h-full">
                  <ReactFlow
                    nodes={whatifNodes}
                    edges={whatifEdges}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    fitView
                    nodesDraggable={false}
                    nodesConnectable={false}
                    elementsSelectable={false}
                    zoomOnScroll={true}
                    panOnScroll={true}
                  >
                    <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#cbd5e1" />
                    <Controls />
                  </ReactFlow>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-8 py-4 bg-slate-50 flex items-center justify-between flex-shrink-0">
          <Button variant="outline" onClick={onClose} className="px-5 py-2 text-xs font-bold">Close Studio</Button>
          <div className="flex items-center gap-3">
            {hasChanges && (
              <Button
                variant="outline"
                onClick={() => setLocalScripts({})}
                className="px-5 py-2 text-xs font-bold border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Reset What-If Rules
              </Button>
            )}
            <div className="text-xs text-slate-500 font-mono">
              Champion: {champion.activeNodes.size} active &nbsp;·&nbsp;
              What-If: {whatif.activeNodes.size} active
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};



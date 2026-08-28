/**
 * BusinessRuleBuilder
 *
 * Business-facing rule builder for Decision Nodes. Produces a JSON/DSL
 * RuleDefinition (no Python required). Supports:
 *  - IF / THEN / ELSE structure
 *  - AND / OR / NOT nested condition groups
 *  - Full operator set (Equals, Contains, Between, In, Exists, etc.)
 *  - Field picker populated from connected upstream Service Node outputs
 *  - Standard + custom outcomes (APPROVE, REJECT, REVIEW, REFER, MANUAL REVIEW)
 *  - Rule testing with input JSON, matched/failed conditions, final outcome
 *
 * The final rule definition is JSON/DSL based. The backend rule engine is
 * responsible for evaluation. No eval(), no arbitrary user code execution.
 */

import React, { useMemo, useState } from 'react';
import {
  Plus, Trash2, ChevronRight, ChevronDown, GitBranch,
  Play, AlertCircle, CheckCircle2, XCircle,
  Variable, Layers, ArrowRight, FileJson,
} from 'lucide-react';
import { Button } from '../ui/button';
import { useLangGraphStore } from '../../stores/langGraphStore';
import {
  RuleDefinition, RuleTreeNode, RuleConditionLeaf, RuleConditionGroup,
  LogicalOperator, RuleOperator, OPERATOR_LABELS, OPERATORS_REQUIRING_VALUE,
  STANDARD_OUTCOMES, SCHEMA_VERSION, isRuleGroup, isRuleLeaf,
  createLeaf, createGroup,
  testRule, validateRuleDefinition, TestResult,
} from '../../utils/businessRuleEngine';

interface BusinessRuleBuilderProps {
  initialRule: RuleDefinition;
  onChange: (rule: RuleDefinition) => void;
}

// ---------------------------------------------------------------------------
// Upstream field discovery (reused from VisualRuleBuilder)
// ---------------------------------------------------------------------------

function extractKeysFromNodeData(obj: unknown, prefix = ''): string[] {
  if (!obj) return [];
  let parsed = obj as Record<string, unknown> | null;
  if (typeof obj === 'string') {
    try { parsed = JSON.parse(obj); } catch { return []; }
  }
  if (typeof parsed !== 'object' || parsed === null) return [];

  let keys: string[] = [];
  if (Array.isArray(parsed)) {
    parsed.forEach((item, idx) => {
      const p = prefix ? `${prefix}[${idx}]` : `[${idx}]`;
      if (typeof item === 'object' && item !== null) {
        keys = keys.concat(extractKeysFromNodeData(item as Record<string, unknown>, p));
      } else {
        keys.push(p);
      }
    });
    return keys;
  }

  for (const k in parsed) {
    const p = prefix ? `${prefix}.${k}` : k;
    keys.push(p);
    if (parsed[k] && typeof parsed[k] === 'object') {
      keys = keys.concat(extractKeysFromNodeData(parsed[k] as Record<string, unknown>, p));
    }
  }
  return Array.from(new Set(keys));
}

interface UpstreamSource {
  id: string;
  label: string;
  type: string;
  fields: string[];
}

// ---------------------------------------------------------------------------
// GroupRenderer — extracted to allow useState (expand/collapse)
// ---------------------------------------------------------------------------

interface GroupRendererProps {
  group: RuleConditionGroup;
  path: number[];
  depth: number;
  isRoot: boolean;
  allFields: string[];
  onAddCondition: (path: number[]) => void;
  onAddGroup: (path: number[]) => void;
  onUpdateLeaf: (path: number[], updates: Partial<RuleConditionLeaf>) => void;
  onUpdateGroup: (path: number[], updates: Partial<RuleConditionGroup>) => void;
  onRemoveNode: (path: number[]) => void;
}

const GroupRenderer: React.FC<GroupRendererProps> = ({
  group, path, depth, isRoot, allFields,
  onAddCondition, onAddGroup, onUpdateLeaf, onUpdateGroup, onRemoveNode,
}) => {
  const [expanded, setExpanded] = useState(true);

  const renderLeaf = (leaf: RuleConditionLeaf, leafPath: number[]): React.ReactNode => (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-xl border border-slate-200 hover:border-blue-300 transition-colors">
      <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
        <Variable className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
        {allFields.length > 0 ? (
          <select
            value={leaf.field}
            onChange={(e) => onUpdateLeaf(leafPath, { field: e.target.value })}
            className="w-full px-2.5 py-1.5 text-xs font-mono font-semibold bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-400"
          >
            {allFields.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={leaf.field}
            onChange={(e) => onUpdateLeaf(leafPath, { field: e.target.value })}
            className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-400"
            placeholder="field.path"
          />
        )}
      </div>
      <select
        value={leaf.operator}
        onChange={(e) => onUpdateLeaf(leafPath, { operator: e.target.value as RuleOperator })}
        className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-400"
      >
        {(Object.keys(OPERATOR_LABELS) as RuleOperator[]).map((op) => (
          <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
        ))}
      </select>
      <div className="flex-1 min-w-[120px]">
        {!OPERATORS_REQUIRING_VALUE.includes(leaf.operator) ? (
          <span className="text-xs text-slate-400 italic px-2 py-1.5">No value needed</span>
        ) : leaf.operator === 'BETWEEN' ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={String((Array.isArray(leaf.value) ? leaf.value[0] : '') ?? '')}
              onChange={(e) => onUpdateLeaf(leafPath, { value: [e.target.value, (Array.isArray(leaf.value) ? leaf.value[1] : '') ?? ''] })}
              className="w-20 px-2 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-400"
              placeholder="low"
            />
            <span className="text-xs text-slate-400">and</span>
            <input
              type="text"
              value={String((Array.isArray(leaf.value) ? leaf.value[1] : '') ?? '')}
              onChange={(e) => onUpdateLeaf(leafPath, { value: [(Array.isArray(leaf.value) ? leaf.value[0] : '') ?? '', e.target.value] })}
              className="w-20 px-2 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-400"
              placeholder="high"
            />
          </div>
        ) : leaf.operator === 'IN' || leaf.operator === 'NOT_IN' ? (
          <input
            type="text"
            value={Array.isArray(leaf.value) ? leaf.value.join(', ') : ''}
            onChange={(e) => onUpdateLeaf(leafPath, { value: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
            className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-400"
            placeholder="value1, value2, value3"
          />
        ) : (
          <input
            type="text"
            value={String(leaf.value ?? '')}
            onChange={(e) => onUpdateLeaf(leafPath, { value: e.target.value })}
            className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-400"
            placeholder="value"
          />
        )}
      </div>
      <button
        type="button"
        onClick={() => onRemoveNode(leafPath)}
        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors flex-shrink-0"
        title="Remove condition"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  return (
    <div
      className={`rounded-xl border ${isRoot ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200 bg-slate-50/50'} p-3 space-y-2`}
      style={{ marginLeft: depth * 20 }}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {!isRoot && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="p-0.5 text-slate-500 hover:text-slate-900"
            >
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          )}
          <Layers className={`w-4 h-4 ${isRoot ? 'text-blue-600' : 'text-slate-500'}`} />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
            {isRoot ? 'IF' : 'Group'}
          </span>
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
            {(['AND', 'OR', 'NOT'] as LogicalOperator[]).map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => onUpdateGroup(path, { operator: op })}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                  group.operator === op
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {op === 'AND' ? 'AND' : op === 'OR' ? 'OR' : 'NOT'}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-400">
            {group.rules.length} {group.rules.length === 1 ? 'rule' : 'rules'}
          </span>
        </div>
        {!isRoot && (
          <button
            type="button"
            onClick={() => onRemoveNode(path)}
            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
            title="Remove group"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {expanded && (
        <div className="space-y-2">
          {group.rules.map((child, i) => {
            const childPath = [...path, i];
            return (
              <React.Fragment key={i}>
                {isRuleLeaf(child) && renderLeaf(child, childPath)}
                {isRuleGroup(child) && (
                  <GroupRenderer
                    group={child}
                    path={childPath}
                    depth={depth + 1}
                    isRoot={false}
                    allFields={allFields}
                    onAddCondition={onAddCondition}
                    onAddGroup={onAddGroup}
                    onUpdateLeaf={onUpdateLeaf}
                    onUpdateGroup={onUpdateGroup}
                    onRemoveNode={onRemoveNode}
                  />
                )}
              </React.Fragment>
            );
          })}
          {group.rules.length === 0 && (
            <div className="p-4 text-center border border-dashed border-slate-300 rounded-xl bg-white">
              <p className="text-xs text-slate-400">No conditions in this group yet.</p>
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onAddCondition(path)}
              className="text-xs font-bold py-1.5 px-3 rounded-lg border-slate-300 text-slate-700 hover:bg-slate-100 gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Condition
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onAddGroup(path)}
              className="text-xs font-bold py-1.5 px-3 rounded-lg border-slate-300 text-slate-700 hover:bg-slate-100 gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Nested Group
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// OutcomeSelector — extracted to allow useState (custom mode toggle)
// ---------------------------------------------------------------------------

interface OutcomeSelectorProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  accent: 'emerald' | 'rose';
}

const OutcomeSelector: React.FC<OutcomeSelectorProps> = ({ label, value, onChange, accent }) => {
  const isCustomInitial = value && !STANDARD_OUTCOMES.includes(value);
  const [customMode, setCustomMode] = useState(isCustomInitial);

  const accentClasses = accent === 'emerald'
    ? 'border-emerald-200 bg-emerald-50/40 text-emerald-700 focus:ring-emerald-400'
    : 'border-rose-200 bg-rose-50/40 text-rose-700 focus:ring-rose-400';

  return (
    <div>
      <label className={`block text-[11px] font-bold mb-1.5 ${accent === 'emerald' ? 'text-emerald-700' : 'text-rose-700'}`}>
        {label}
      </label>
      {customMode ? (
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`flex-1 px-3 py-2 text-xs font-bold border rounded-lg focus:ring-1 ${accentClasses}`}
            placeholder="Custom outcome name"
          />
          <button
            type="button"
            onClick={() => { setCustomMode(false); onChange(STANDARD_OUTCOMES[0]); }}
            className="px-2 py-2 text-xs font-bold text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
          >
            Standard
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <select
            value={value}
            onChange={(e) => {
              if (e.target.value === '__custom__') { setCustomMode(true); onChange(''); }
              else onChange(e.target.value);
            }}
            className={`flex-1 px-3 py-2 text-xs font-bold border rounded-lg ${accentClasses}`}
          >
            {STANDARD_OUTCOMES.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
            <option value="__custom__">+ Custom...</option>
          </select>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const BusinessRuleBuilder: React.FC<BusinessRuleBuilderProps> = ({
  initialRule,
  onChange,
}) => {
  const { nodes, edges, selectedNodeId, inputs } = useLangGraphStore();
  const [rule, setRule] = useState<RuleDefinition>(initialRule);
  const [testInput, setTestInput] = useState<string>(
    JSON.stringify({ addressMatch: { matchScore: 85, status: 'VERIFIED', country: 'US' } }, null, 2)
  );
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const upstreamSources = useMemo<UpstreamSource[]>(() => {
    const list: UpstreamSource[] = [];

    if (inputs && Object.keys(inputs).length > 0) {
      list.push({
        id: 'input',
        label: 'Workflow Inputs',
        type: 'input',
        fields: extractKeysFromNodeData(inputs),
      });
    }

    if (selectedNodeId) {
      const incoming = edges.filter((e) => e.target === selectedNodeId);
      const sourceIds = incoming.map((e) => e.source);
      const connected = nodes.filter((n) => sourceIds.includes(n.id) && n.id !== selectedNodeId);
      connected.forEach((n) => {
        const reqKeys = extractKeysFromNodeData((n.data as Record<string, unknown>)?.requestBody ?? (n.data as Record<string, unknown>)?.config);
        const respKeys = extractKeysFromNodeData((n.data as Record<string, unknown>)?.responseBody ?? (n.data as Record<string, unknown>)?.outputs);
        list.push({
          id: n.id,
          label: `${(n.data as Record<string, unknown>)?.label || n.id} (${n.type})`,
          type: n.type,
          fields: Array.from(new Set([...reqKeys, ...respKeys])),
        });
      });
    } else {
      nodes.forEach((n) => {
        if (n.type !== 'decisionNode') {
          const reqKeys = extractKeysFromNodeData((n.data as Record<string, unknown>)?.requestBody ?? (n.data as Record<string, unknown>)?.config);
          const respKeys = extractKeysFromNodeData((n.data as Record<string, unknown>)?.responseBody ?? (n.data as Record<string, unknown>)?.outputs);
          list.push({
            id: n.id,
            label: `${(n.data as Record<string, unknown>)?.label || n.id} (${n.type})`,
            type: n.type,
            fields: Array.from(new Set([...reqKeys, ...respKeys])),
          });
        }
      });
    }

    if (list.length === 0) {
      list.push({
        id: 'sample',
        label: 'GSA Address Service (example)',
        type: 'serviceNode',
        fields: ['addressMatch.matchScore', 'addressMatch.status', 'addressMatch.country', 'addressMatch.addressLine1'],
      });
    }

    return list;
  }, [nodes, edges, selectedNodeId, inputs]);

  const allFields = useMemo(() => {
    const set = new Set<string>();
    upstreamSources.forEach((s) => s.fields.forEach((f) => set.add(f)));
    return Array.from(set).sort();
  }, [upstreamSources]);

  const updateRule = (updated: RuleDefinition) => {
    setRule(updated);
    onChange(updated);
  };

  // ---------------------------------------------------------------------------
  // Condition tree manipulation
  // ---------------------------------------------------------------------------

  const updateConditions = (newConditions: RuleConditionGroup) => {
    updateRule({ ...rule, conditions: newConditions });
  };

  const addLeafToGroup = (group: RuleConditionGroup, leaf: RuleConditionLeaf, path: number[] = []): RuleConditionGroup => {
    if (path.length === 0) {
      return { ...group, rules: [...group.rules, leaf] };
    }
    const idx = path[0];
    const child = group.rules[idx];
    if (isRuleGroup(child)) {
      const newRules = [...group.rules];
      newRules[idx] = addLeafToGroup(child, leaf, path.slice(1));
      return { ...group, rules: newRules };
    }
    return group;
  };

  const addGroupToGroup = (group: RuleConditionGroup, subGroup: RuleConditionGroup, path: number[] = []): RuleConditionGroup => {
    if (path.length === 0) {
      return { ...group, rules: [...group.rules, subGroup] };
    }
    const idx = path[0];
    const child = group.rules[idx];
    if (isRuleGroup(child)) {
      const newRules = [...group.rules];
      newRules[idx] = addGroupToGroup(child, subGroup, path.slice(1));
      return { ...group, rules: newRules };
    }
    return group;
  };

  const updateNodeInGroup = (group: RuleConditionGroup, path: number[], updater: (n: RuleTreeNode) => RuleTreeNode): RuleConditionGroup => {
    if (path.length === 0) return updater(group) as RuleConditionGroup;
    const idx = path[0];
    const child = group.rules[idx];
    const newRules = [...group.rules];
    newRules[idx] = path.length === 1 ? updater(child) : (isRuleGroup(child) ? updateNodeInGroup(child, path.slice(1), updater) : child);
    return { ...group, rules: newRules };
  };

  const removeFromGroup = (group: RuleConditionGroup, path: number[]): RuleConditionGroup => {
    if (path.length === 1) {
      return { ...group, rules: group.rules.filter((_, i) => i !== path[0]) };
    }
    const idx = path[0];
    const child = group.rules[idx];
    const newRules = [...group.rules];
    if (isRuleGroup(child)) {
      newRules[idx] = removeFromGroup(child, path.slice(1));
    }
    return { ...group, rules: newRules };
  };

  const handleAddCondition = (path: number[] = []) => {
    const defaultField = allFields[0] || '';
    updateConditions(addLeafToGroup(rule.conditions, createLeaf(defaultField, 'EQUALS', ''), path));
  };

  const handleAddGroup = (path: number[] = []) => {
    updateConditions(addGroupToGroup(rule.conditions, createGroup('AND', [createLeaf(allFields[0] || '', 'EQUALS', '')]), path));
  };

  const handleUpdateLeaf = (path: number[], updates: Partial<RuleConditionLeaf>) => {
    updateConditions(updateNodeInGroup(rule.conditions, path, (n) => {
      if (isRuleLeaf(n)) return { ...n, ...updates };
      return n;
    }));
  };

  const handleUpdateGroup = (path: number[], updates: Partial<RuleConditionGroup>) => {
    updateConditions(updateNodeInGroup(rule.conditions, path, (n) => {
      if (isRuleGroup(n)) return { ...n, ...updates };
      return n;
    }));
  };

  const handleRemoveNode = (path: number[]) => {
    updateConditions(removeFromGroup(rule.conditions, path));
  };

  // ---------------------------------------------------------------------------
  // Outcomes
  // ---------------------------------------------------------------------------

  const handleOutcomeChange = (branch: 'true' | 'false', value: string) => {
    updateRule({ ...rule, outcomes: { ...rule.outcomes, [branch]: value } });
  };

  const handleDefaultOutcomeChange = (value: string) => {
    updateRule({ ...rule, defaultOutcome: value });
  };

  const handleRuleSetIdChange = (value: string) => {
    updateRule({ ...rule, ruleSetId: value });
  };

  // ---------------------------------------------------------------------------
  // Test
  // ---------------------------------------------------------------------------

  const handleRunTest = () => {
    setTestError(null);
    let parsedInput: Record<string, unknown>;
    try {
      parsedInput = JSON.parse(testInput);
    } catch (e: unknown) {
      setTestError(`Invalid JSON input: ${(e as Error).message}`);
      return;
    }

    const errors = validateRuleDefinition(rule);
    if (errors.length > 0) {
      setTestError(`Rule validation failed:\n${errors.join('\n')}`);
      return;
    }

    const result = testRule(rule, parsedInput);
    setTestResult(result);
  };

  const renderGroup = (group: RuleConditionGroup, path: number[], depth: number): React.ReactNode => {
    return (
      <GroupRenderer
        group={group}
        path={path}
        depth={depth}
        isRoot={path.length === 0}
        allFields={allFields}
        onAddCondition={handleAddCondition}
        onAddGroup={handleAddGroup}
        onUpdateLeaf={handleUpdateLeaf}
        onUpdateGroup={handleUpdateGroup}
        onRemoveNode={handleRemoveNode}
      />
    );
  };

  // ---------------------------------------------------------------------------
  // Outcome selector
  // ---------------------------------------------------------------------------

  const renderOutcomeSelector = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    accent: 'emerald' | 'rose',
  ) => {
    return (
      <OutcomeSelector
        label={label}
        value={value}
        onChange={onChange}
        accent={accent}
      />
    );
  };

  // ---------------------------------------------------------------------------
  // Validation summary
  // ---------------------------------------------------------------------------

  const validationErrors = validateRuleDefinition(rule);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              Business Rule Builder
              <span className="bg-blue-600 text-white text-[10px] uppercase font-mono px-2 py-0.5 rounded-full font-bold">
                JSON DSL
              </span>
            </h3>
            <p className="text-xs text-slate-600">
              Build decision logic with field conditions and outcomes. No code required.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-1">
            <label className="block text-[11px] font-bold text-slate-700">Rule Set ID</label>
            <input
              type="text"
              value={rule.ruleSetId}
              onChange={(e) => handleRuleSetIdChange(e.target.value)}
              className="px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-400"
              placeholder="my-decision-rule"
            />
          </div>
        </div>
      </div>

      {/* Upstream sources info */}
      {upstreamSources.length > 0 && (
        <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
          <div className="flex items-center gap-2 mb-2">
            <Variable className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-700">Available Fields from Upstream Nodes</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {upstreamSources.map((src) => (
              <div key={src.id} className="flex flex-wrap gap-1">
                {src.fields.slice(0, 8).map((f) => (
                  <span key={f} className="px-2 py-0.5 text-[11px] font-mono bg-white border border-slate-200 rounded-md text-slate-600">
                    {f}
                  </span>
                ))}
                {src.fields.length > 8 && (
                  <span className="px-2 py-0.5 text-[11px] text-slate-400">+{src.fields.length - 8} more</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* IF: Conditions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 text-xs font-bold bg-slate-900 text-white rounded-lg">IF</span>
            <span className="text-xs text-slate-500">Conditions must match</span>
          </div>
        </div>
        {renderGroup(rule.conditions, [], 0)}
      </div>

      {/* THEN / ELSE: Outcomes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-2">
          <div className="flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-emerald-600" />
            <span className="px-3 py-1 text-xs font-bold bg-emerald-600 text-white rounded-lg">THEN</span>
            <span className="text-xs text-emerald-700">If conditions match</span>
          </div>
          {renderOutcomeSelector('Outcome', rule.outcomes?.true || '', (v) => handleOutcomeChange('true', v), 'emerald')}
        </div>

        <div className="p-4 bg-rose-50/50 rounded-xl border border-rose-100 space-y-2">
          <div className="flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-rose-600" />
            <span className="px-3 py-1 text-xs font-bold bg-rose-600 text-white rounded-lg">ELSE</span>
            <span className="text-xs text-rose-700">If conditions fail</span>
          </div>
          {renderOutcomeSelector('Outcome', rule.outcomes?.false || '', (v) => handleOutcomeChange('false', v), 'rose')}
        </div>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-slate-500" />
            <span className="px-3 py-1 text-xs font-bold bg-slate-500 text-white rounded-lg">DEFAULT</span>
            <span className="text-xs text-slate-600">Fallback</span>
          </div>
          {renderOutcomeSelector('Default Outcome', rule.defaultOutcome || '', (v) => handleDefaultOutcomeChange(v), 'emerald')}
        </div>
      </div>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-bold text-amber-800">Validation Issues</span>
          </div>
          <ul className="space-y-1">
            {validationErrors.map((err, i) => (
              <li key={i} className="text-xs text-amber-700 font-mono">{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Test Rule */}
      <div className="space-y-3 p-5 bg-slate-900 rounded-2xl border border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold text-slate-100 uppercase tracking-wide">Test Rule</span>
          </div>
          <Button
            type="button"
            onClick={handleRunTest}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg gap-2"
          >
            <Play className="w-3.5 h-3.5" />
            Run Test
          </Button>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
            <FileJson className="w-3.5 h-3.5" /> Input JSON
          </label>
          <textarea
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            className="w-full px-3 py-2 text-xs font-mono bg-slate-950 text-slate-100 border border-slate-700 rounded-lg focus:ring-1 focus:ring-blue-400 resize-none h-32"
            placeholder='{"addressMatch": {"matchScore": 85, "status": "VERIFIED"}}'
          />
        </div>

        {testError && (
          <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="w-4 h-4 text-rose-400" />
              <span className="text-xs font-bold text-rose-300">Error</span>
            </div>
            <pre className="text-xs text-rose-200 font-mono whitespace-pre-wrap">{testError}</pre>
          </div>
        )}

        {testResult && (
          <div className="space-y-3">
            {/* Outcome banner */}
            <div className={`p-3 rounded-lg border ${testResult.matched ? 'bg-emerald-950/50 border-emerald-700' : 'bg-rose-950/50 border-rose-700'}`}>
              <div className="flex items-center gap-2">
                {testResult.matched ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-400" />
                )}
                <span className={`text-sm font-bold ${testResult.matched ? 'text-emerald-300' : 'text-rose-300'}`}>
                  Decision: {testResult.outcome || 'NONE'}
                </span>
                <span className="text-xs text-slate-400 ml-auto">
                  Conditions {testResult.matched ? 'matched' : 'failed'}
                </span>
              </div>
            </div>

            {/* Evaluation trace */}
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase">Evaluation Trace</span>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {testResult.evaluationTrace.map((step, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 p-2 rounded-md text-xs font-mono ${
                      step.result ? 'bg-emerald-950/30 text-emerald-200' : 'bg-rose-950/30 text-rose-200'
                    }`}
                  >
                    {step.result ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <span className="font-semibold">{step.description}</span>
                      {step.detail && (
                        <span className="block text-slate-400 mt-0.5">{step.detail}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* JSON preview */}
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <FileJson className="w-3.5 h-3.5" /> Rule Definition (JSON DSL)
          </span>
          <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
            Schema v{SCHEMA_VERSION}
          </span>
        </div>
        <pre className="text-xs font-mono text-slate-700 overflow-x-auto max-h-48 p-3 bg-white rounded-lg border border-slate-200">
          {JSON.stringify(rule, null, 2)}
        </pre>
      </div>
    </div>
  );
};

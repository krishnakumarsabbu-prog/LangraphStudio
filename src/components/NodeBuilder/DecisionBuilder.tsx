/**
 * Business Decision Builder.
 *
 * Lets non-technical users construct generic business rules using
 * IF / AND / OR / THEN / ELSE. No Python editor is shown. Fields are
 * selectable from the preceding Service Node's output schema.
 *
 * The rule definition is stored as the JSON schema expected by the
 * backend Business Rule Engine (rules/models.py).
 */

import React, { useMemo } from 'react';
import { Plus, Trash2, GitBranch, ChevronRight, Layers } from 'lucide-react';
import {
  DecisionNodeConfig,
  RuleOperator,
  RuleConditionLeaf,
  RuleConditionGroup,
  RuleTreeNode,
  LogicalOperator,
  OPERATOR_LABELS,
  OPERATORS_REQUIRING_VALUE,
  isRuleGroup,
} from './types';

interface DecisionBuilderProps {
  config: DecisionNodeConfig;
  onChange: (config: Partial<DecisionNodeConfig>) => void;
  /** Fields available from preceding service nodes, e.g. ["matchScore", "status", "country"] */
  availableFields: string[];
}

const ALL_OPERATORS = Object.keys(OPERATOR_LABELS) as RuleOperator[];

function isLeaf(node: RuleTreeNode): node is RuleConditionLeaf {
  return (node as RuleConditionLeaf).field !== undefined;
}

let ruleIdCounter = 1;
const rid = () => `r-${ruleIdCounter++}-${Date.now().toString(36)}`;

function createLeaf(): RuleConditionLeaf {
  return { field: '', operator: 'EQUALS', value: '' };
}

function createGroup(operator: LogicalOperator = 'AND'): RuleConditionGroup {
  return { operator, rules: [createLeaf()] };
}

export const DecisionBuilder: React.FC<DecisionBuilderProps> = ({
  config,
  onChange,
  availableFields,
}) => {
  const ruleDef = config.ruleDefinition;

  const updateRuleDef = (updates: Partial<DecisionNodeConfig['ruleDefinition']>) => {
    onChange({ ruleDefinition: { ...ruleDef, ...updates } });
  };

  const updateConditions = (conditions: RuleConditionGroup) => {
    updateRuleDef({ conditions });
  };

  // --- Tree mutation helpers ---

  const updateNode = (node: RuleTreeNode, updater: (n: RuleTreeNode) => RuleTreeNode): RuleTreeNode => {
    if (isLeaf(node)) {
      return updater(node) as RuleConditionLeaf;
    }
    return updater(node) as RuleConditionGroup;
  };

  const replaceInGroup = (
    group: RuleConditionGroup,
    targetId: string,
    newNode: RuleTreeNode
  ): RuleConditionGroup => {
    return {
      ...group,
      rules: group.rules.map((r) => {
        if (isLeaf(r) && (r as any)._id === targetId) return newNode;
        if (isGroup(r) && (r as any)._id === targetId) return newNode;
        if (isGroup(r)) return replaceInGroup(r, targetId, newNode);
        return r;
      }),
    };
  };

  const removeFromGroup = (
    group: RuleConditionGroup,
    targetId: string
  ): RuleConditionGroup => {
    return {
      ...group,
      rules: group.rules.filter((r) => {
        const id = (r as any)._id;
        if (id === targetId) return false;
        if (isGroup(r)) {
          const cleaned = removeFromGroup(r, targetId);
          return cleaned.rules.length > 0;
        }
        return true;
      }).map((r) => (isGroup(r) ? removeFromGroup(r, targetId) : r)),
    };
  };

  const addToGroup = (
    group: RuleConditionGroup,
    targetId: string | null,
    newNode: RuleTreeNode
  ): RuleConditionGroup => {
    if (targetId === null) {
      return { ...group, rules: [...group.rules, newNode] };
    }
    return {
      ...group,
      rules: group.rules.map((r) => {
        if ((r as any)._id === targetId) {
          return { ...r, rules: [...(r as RuleConditionGroup).rules, newNode] } as RuleConditionGroup;
        }
        if (isGroup(r)) return addToGroup(r, targetId, newNode);
        return r;
      }),
    };
  };

  // Tag nodes with IDs for React keys
  const tagIds = (node: RuleTreeNode): RuleTreeNode => {
    if (isLeaf(node)) {
      return { ...node, _id: (node as any)._id || rid() } as RuleConditionLeaf;
    }
    return {
      ...node,
      _id: (node as any)._id || rid(),
      rules: node.rules.map(tagIds),
    } as RuleConditionGroup;
  };

  const taggedConditions = useMemo(() => tagIds(ruleDef.conditions) as RuleConditionGroup, [ruleDef.conditions]);

  // --- Actions ---

  const addLeafToRoot = () => {
    updateConditions(addToGroup(taggedConditions, null, tagIds(createLeaf()) as RuleConditionLeaf));
  };

  const addGroupToRoot = () => {
    updateConditions(addToGroup(taggedConditions, null, tagIds(createGroup('AND')) as RuleConditionGroup));
  };

  const addLeafToGroup = (groupId: string) => {
    updateConditions(addToGroup(taggedConditions, groupId, tagIds(createLeaf()) as RuleConditionLeaf));
  };

  const addGroupToGroup = (groupId: string) => {
    updateConditions(addToGroup(taggedConditions, groupId, tagIds(createGroup('AND')) as RuleConditionGroup));
  };

  const removeNode = (nodeId: string) => {
    const cleaned = removeFromGroup(taggedConditions, nodeId);
    if (cleaned.rules.length === 0) {
      updateConditions({ ...cleaned, rules: [tagIds(createLeaf()) as RuleConditionLeaf] });
    } else {
      updateConditions(cleaned);
    }
  };

  const updateLeaf = (leafId: string, updates: Partial<RuleConditionLeaf>) => {
    const newConditions = {
      ...taggedConditions,
      rules: taggedConditions.rules.map((r) => updateLeafRecursive(r, leafId, updates)),
    };
    updateConditions(newConditions);
  };

  const updateLeafRecursive = (
    node: RuleTreeNode,
    leafId: string,
    updates: Partial<RuleConditionLeaf>
  ): RuleTreeNode => {
    if (isLeaf(node)) {
      if ((node as any)._id === leafId) {
        return { ...node, ...updates } as RuleConditionLeaf;
      }
      return node;
    }
    return {
      ...node,
      rules: node.rules.map((r) => updateLeafRecursive(r, leafId, updates)),
    } as RuleConditionGroup;
  };

  const updateGroupOperator = (groupId: string, operator: LogicalOperator) => {
    const updateOps = (node: RuleTreeNode): RuleTreeNode => {
      if (isGroup(node)) {
        if ((node as any)._id === groupId) {
          return { ...node, operator } as RuleConditionGroup;
        }
        return { ...node, rules: node.rules.map(updateOps) } as RuleConditionGroup;
      }
      return node;
    };
    updateConditions(updateOps(taggedConditions) as RuleConditionGroup);
  };

  const needsValue = (op: RuleOperator) => OPERATORS_REQUIRING_VALUE.includes(op);

  // --- Render ---

  const renderLeaf = (leaf: RuleConditionLeaf, depth: number): React.ReactNode => {
    const leafId = (leaf as any)._id;
    return (
      <div
        key={leafId}
        className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-light-hover dark:hover:bg-dark-hover transition-colors"
        style={{ marginLeft: depth * 16 }}
      >
        <select
          value={leaf.field}
          onChange={(e) => updateLeaf(leafId, { field: e.target.value })}
          className="flex-1 px-2 py-1.5 text-[11px] font-mono border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-default rounded-lg focus:ring-1 focus:ring-black dark:focus:ring-white"
        >
          <option value="">Select field...</option>
          {availableFields.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>

        <select
          value={leaf.operator}
          onChange={(e) => updateLeaf(leafId, { operator: e.target.value as RuleOperator })}
          className="px-2 py-1.5 text-[11px] font-semibold border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-default rounded-lg focus:ring-1 focus:ring-black dark:focus:ring-white"
        >
          {ALL_OPERATORS.map((op) => (
            <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
          ))}
        </select>

        {needsValue(leaf.operator) && (
          <input
            type="text"
            value={Array.isArray(leaf.value) ? leaf.value.join(', ') : String(leaf.value ?? '')}
            onChange={(e) => {
              const raw = e.target.value;
              let val: any = raw;
              if (leaf.operator === 'BETWEEN') {
                val = raw.split(',').map((s) => s.trim());
              } else if (leaf.operator === 'IN' || leaf.operator === 'NOT_IN') {
                val = raw.split(',').map((s) => s.trim());
              } else if (!isNaN(Number(raw)) && raw.trim() !== '') {
                val = Number(raw);
              }
              updateLeaf(leafId, { value: val });
            }}
            placeholder={leaf.operator === 'BETWEEN' ? 'low, high' : leaf.operator === 'IN' || leaf.operator === 'NOT_IN' ? 'val1, val2' : 'value'}
            className="w-28 px-2 py-1.5 text-[11px] font-mono border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-default rounded-lg focus:ring-1 focus:ring-black dark:focus:ring-white"
          />
        )}

        <button
          onClick={() => removeNode(leafId)}
          className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  const renderGroup = (group: RuleConditionGroup, depth: number): React.ReactNode => {
    const groupId = (group as any)._id;
    const isRoot = depth === 0;
    return (
      <div
        key={groupId}
        className="rounded-xl border border-light-border dark:border-dark-border bg-light-surface/50 dark:bg-dark-surface-alt/30 p-2 space-y-1"
        style={{ marginLeft: depth > 0 ? 16 : 0 }}
      >
        <div className="flex items-center gap-2">
          {!isRoot && (
            <span className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase">
              Group
            </span>
          )}
          <div className="flex items-center gap-1 bg-white dark:bg-dark-surface rounded-lg border border-light-border dark:border-dark-border p-0.5">
            {(['AND', 'OR', 'NOT'] as LogicalOperator[]).map((op) => (
              <button
                key={op}
                onClick={() => updateGroupOperator(groupId, op)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                  group.operator === op
                    ? 'bg-black text-white dark:bg-white dark:text-black'
                    : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-hover dark:hover:bg-dark-hover'
                }`}
              >
                {op}
              </button>
            ))}
          </div>

          {!isRoot && (
            <button
              onClick={() => removeNode(groupId)}
              className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors ml-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {group.rules.map((rule) =>
          isGroup(rule) ? renderGroup(rule, depth + 1) : renderLeaf(rule, depth + 1)
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => addLeafToGroup(groupId)}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-hover dark:hover:bg-dark-hover rounded-lg border border-dashed border-light-border dark:border-dark-border transition-all"
          >
            <Plus className="w-3 h-3" /> Condition
          </button>
          <button
            onClick={() => addGroupToGroup(groupId)}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-hover dark:hover:bg-dark-hover rounded-lg border border-dashed border-light-border dark:border-dark-border transition-all"
          >
            <Plus className="w-3 h-3" /> Group
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-xs font-bold text-light-text-primary dark:text-dark-text-primary uppercase tracking-wide pb-2 border-b border-light-border dark:border-dark-border">
        <GitBranch className="w-3.5 h-3.5" />
        Business Decision Builder
      </div>

      {/* Rule Set ID */}
      <div>
        <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1">
          Rule Set ID
        </label>
        <input
          type="text"
          value={ruleDef.ruleSetId}
          onChange={(e) => updateRuleDef({ ruleSetId: e.target.value })}
          placeholder="address-verification-rule"
          className="w-full px-3 py-2 text-xs font-mono border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-default rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white"
        />
      </div>

      {/* IF conditions */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-light-text-primary dark:text-dark-text-primary bg-light-surface dark:bg-dark-surface-alt px-2 py-1 rounded-md">
          <ChevronRight className="w-4 h-4" />
          IF
        </div>

        {renderGroup(taggedConditions, 0)}

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={addLeafToRoot}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-hover dark:hover:bg-dark-hover rounded-lg border border-dashed border-light-border dark:border-dark-border transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Add Condition
          </button>
          <button
            onClick={addGroupToRoot}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-hover dark:hover:bg-dark-hover rounded-lg border border-dashed border-light-border dark:border-dark-border transition-all"
          >
            <Layers className="w-3.5 h-3.5" /> Add Group
          </button>
        </div>
      </div>

      {/* THEN / ELSE outcomes */}
      <div className="border-t border-light-border dark:border-dark-border pt-4 space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-light-text-primary dark:text-dark-text-primary bg-light-surface dark:bg-dark-surface-alt px-2 py-1 rounded-md">
          <ChevronRight className="w-4 h-4" />
          Outcomes
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-green-50/30 dark:bg-green-900/10 border border-green-200 dark:border-green-800 p-2">
            <label className="block text-[11px] font-bold text-green-700 dark:text-green-500 mb-1">
              THEN (if matched)
            </label>
            <input
              type="text"
              value={ruleDef.outcomes.true}
              onChange={(e) => updateRuleDef({ outcomes: { ...ruleDef.outcomes, true: e.target.value } })}
              placeholder="APPROVE"
              className="w-full px-3 py-2 text-xs font-semibold border border-green-300 dark:border-green-700 bg-green-50/30 dark:bg-green-900/10 text-light-text-primary dark:text-dark-text-default rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="rounded-lg bg-red-50/30 dark:bg-red-900/10 border border-red-200 dark:border-red-800 p-2">
            <label className="block text-[11px] font-bold text-red-700 dark:text-red-500 mb-1">
              ELSE (if not matched)
            </label>
            <input
              type="text"
              value={ruleDef.outcomes.false}
              onChange={(e) => updateRuleDef({ outcomes: { ...ruleDef.outcomes, false: e.target.value } })}
              placeholder="REVIEW"
              className="w-full px-3 py-2 text-xs font-semibold border border-red-300 dark:border-red-700 bg-red-50/30 dark:bg-red-900/10 text-light-text-primary dark:text-dark-text-default rounded-lg focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary mb-1">
            Default Outcome (fallback)
          </label>
          <input
            type="text"
            value={ruleDef.defaultOutcome}
            onChange={(e) => updateRuleDef({ defaultOutcome: e.target.value })}
            placeholder="REVIEW"
            className="w-full px-3 py-2 text-xs font-semibold border border-light-border dark:border-dark-border bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-default rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white"
          />
        </div>
      </div>

      {/* Available fields hint */}
      {availableFields.length > 0 && (
        <div className="border-t border-light-border dark:border-dark-border pt-3">
          <div className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase mb-2">
            Available Fields from Preceding Service
          </div>
          <div className="flex flex-wrap gap-1.5">
            {availableFields.map((f) => (
              <span
                key={f}
                className="px-2 py-1 text-[10px] font-mono font-semibold bg-light-surface dark:bg-dark-surface-alt text-light-text-secondary dark:text-dark-text-secondary rounded-md border border-light-border dark:border-dark-border"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Sliders,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ArrowRight,
  Code2,
} from 'lucide-react';

export interface VisualCondition {
  id: string;
  field: string;
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'CONTAINS' | 'IS_EMPTY' | 'IS_NOT_EMPTY';
  value: string;
  valueType: 'string' | 'number' | 'boolean';
}

export interface VisualRuleBranch {
  id: string;
  name: string;
  combinator: 'AND' | 'OR';
  conditions: VisualCondition[];
  outcome: string; // e.g. "APPROVE", "REJECT", "REVIEW", "ESCALATE"
  color?: string;
}

export interface VisualRuleMatrix {
  branches: VisualRuleBranch[];
  defaultOutcome: string;
}

interface VisualRuleBuilderProps {
  initialMatrix?: VisualRuleMatrix;
  availableFields?: string[];
  onChange: (matrix: VisualRuleMatrix, compiledPython: string) => void;
  readOnly?: boolean;
}

const DEFAULT_MATRIX: VisualRuleMatrix = {
  branches: [
    {
      id: 'branch-1',
      name: 'Approval Criteria',
      combinator: 'AND',
      conditions: [
        { id: 'c-1', field: 'status', operator: '==', value: 'VERIFIED', valueType: 'string' },
        { id: 'c-2', field: 'match_score', operator: '>=', value: '80', valueType: 'number' },
        { id: 'c-3', field: 'address_match', operator: '==', value: 'true', valueType: 'boolean' },
      ],
      outcome: 'APPROVE',
      color: 'emerald',
    },
    {
      id: 'branch-2',
      name: 'Manual Review Criteria',
      combinator: 'AND',
      conditions: [
        { id: 'c-4', field: 'match_score', operator: '>=', value: '50', valueType: 'number' },
      ],
      outcome: 'MANUAL_REVIEW',
      color: 'amber',
    },
  ],
  defaultOutcome: 'REJECT',
};

export function compileRuleMatrixToPython(matrix: VisualRuleMatrix): string {
  const branchLines: string[] = [];

  matrix.branches.forEach((branch, idx) => {
    if (branch.conditions.length === 0) return;

    const conditionStrs = branch.conditions.map((c) => {
      const fieldAccessor = `state.get('${c.field}')`;
      if (c.operator === 'IS_EMPTY') {
        return `(${fieldAccessor} is None or ${fieldAccessor} == '')`;
      }
      if (c.operator === 'IS_NOT_EMPTY') {
        return `(${fieldAccessor} is not None and ${fieldAccessor} != '')`;
      }
      if (c.operator === 'CONTAINS') {
        return `'${c.value}' in str(${fieldAccessor} or '')`;
      }

      let formattedValue = `'${c.value}'`;
      if (c.valueType === 'number') {
        return `float(${fieldAccessor} or 0) ${c.operator} ${c.value}`;
      } else if (c.valueType === 'boolean') {
        return `bool(${fieldAccessor}) == ${c.value.toLowerCase() === 'true' ? 'True' : 'False'}`;
      }
      return `${fieldAccessor} ${c.operator} ${formattedValue}`;
    });

    const joiner = branch.combinator === 'AND' ? ' and ' : ' or ';
    const combinedExpr = conditionStrs.join(joiner);

    if (idx === 0) {
      branchLines.push(`if ${combinedExpr}:`);
      branchLines.push(`    return '${branch.outcome}'`);
    } else {
      branchLines.push(`elif ${combinedExpr}:`);
      branchLines.push(`    return '${branch.outcome}'`);
    }
  });

  branchLines.push(`else:`);
  branchLines.push(`    return '${matrix.defaultOutcome}'`);

  return branchLines.join('\n');
}

export const VisualRuleBuilder: React.FC<VisualRuleBuilderProps> = ({
  initialMatrix = DEFAULT_MATRIX,
  availableFields = ['status', 'match_score', 'address_match', 'dpv_code', 'risk_score', 'confidence'],
  onChange,
  readOnly = false,
}) => {
  const [matrix, setMatrix] = useState<VisualRuleMatrix>(initialMatrix);
  const [showCodePreview, setShowCodePreview] = useState(false);

  const updateMatrix = (newMatrix: VisualRuleMatrix) => {
    setMatrix(newMatrix);
    const pythonCode = compileRuleMatrixToPython(newMatrix);
    onChange(newMatrix, pythonCode);
  };

  const addCondition = (branchId: string) => {
    const newMatrix: VisualRuleMatrix = {
      ...matrix,
      branches: matrix.branches.map((b) => {
        if (b.id !== branchId) return b;
        return {
          ...b,
          conditions: [
            ...b.conditions,
            {
              id: `c-${Date.now()}`,
              field: availableFields[0] || 'status',
              operator: '==',
              value: 'VERIFIED',
              valueType: 'string',
            },
          ],
        };
      }),
    };
    updateMatrix(newMatrix);
  };

  const removeCondition = (branchId: string, condId: string) => {
    const newMatrix: VisualRuleMatrix = {
      ...matrix,
      branches: matrix.branches.map((b) => {
        if (b.id !== branchId) return b;
        return {
          ...b,
          conditions: b.conditions.filter((c) => c.id !== condId),
        };
      }),
    };
    updateMatrix(newMatrix);
  };

  const updateCondition = (
    branchId: string,
    condId: string,
    patch: Partial<VisualCondition>
  ) => {
    const newMatrix: VisualRuleMatrix = {
      ...matrix,
      branches: matrix.branches.map((b) => {
        if (b.id !== branchId) return b;
        return {
          ...b,
          conditions: b.conditions.map((c) => (c.id === condId ? { ...c, ...patch } : c)),
        };
      }),
    };
    updateMatrix(newMatrix);
  };

  const updateBranch = (branchId: string, patch: Partial<VisualRuleBranch>) => {
    const newMatrix: VisualRuleMatrix = {
      ...matrix,
      branches: matrix.branches.map((b) => (b.id === branchId ? { ...b, ...patch } : b)),
    };
    updateMatrix(newMatrix);
  };

  const addBranch = () => {
    const newBranch: VisualRuleBranch = {
      id: `branch-${Date.now()}`,
      name: `Rule Branch ${matrix.branches.length + 1}`,
      combinator: 'AND',
      conditions: [
        {
          id: `c-${Date.now()}`,
          field: availableFields[0] || 'status',
          operator: '==',
          value: '',
          valueType: 'string',
        },
      ],
      outcome: 'REVIEW',
      color: 'indigo',
    };
    updateMatrix({
      ...matrix,
      branches: [...matrix.branches, newBranch],
    });
  };

  const removeBranch = (branchId: string) => {
    updateMatrix({
      ...matrix,
      branches: matrix.branches.filter((b) => b.id !== branchId),
    });
  };

  const compiledPython = compileRuleMatrixToPython(matrix);

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex items-center justify-between bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <h4 className="text-sm font-bold text-slate-100">Visual Generic Business Rule Matrix</h4>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure decision criteria visually. No Python or coding required — the platform compiles it automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCodePreview(!showCodePreview)}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-all border border-slate-700"
        >
          <Code2 className="w-3.5 h-3.5" />
          {showCodePreview ? 'Hide Runtime Script' : 'View Generated Python'}
        </button>
      </div>

      {/* Code Preview Drawer if toggled */}
      {showCodePreview && (
        <div className="p-4 rounded-xl bg-slate-950 border border-indigo-900/40 space-y-2">
          <div className="flex items-center justify-between text-xs text-indigo-300 font-semibold">
            <span>LangGraph Engine Internal Evaluation Script:</span>
            <span className="text-[10px] text-slate-500 font-mono">Auto-Compiled</span>
          </div>
          <pre className="p-3 bg-slate-900 rounded-lg text-xs font-mono text-emerald-400 overflow-x-auto">
            {compiledPython}
          </pre>
        </div>
      )}

      {/* Rule Branches */}
      <div className="space-y-4">
        {matrix.branches.map((branch, branchIdx) => (
          <div
            key={branch.id}
            className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 hover:border-slate-700 transition-all space-y-4"
          >
            {/* Branch Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold flex items-center justify-center border border-indigo-500/30">
                  {branchIdx + 1}
                </span>
                <input
                  type="text"
                  value={branch.name}
                  disabled={readOnly}
                  onChange={(e) => updateBranch(branch.id, { name: e.target.value })}
                  placeholder="Branch Name"
                  className="bg-transparent font-bold text-xs text-slate-200 focus:outline-none border-b border-transparent hover:border-slate-700 focus:border-indigo-500 px-1 py-0.5"
                />
              </div>

              <div className="flex items-center gap-3">
                {/* Combinator */}
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span>Match:</span>
                  <select
                    value={branch.combinator}
                    disabled={readOnly}
                    onChange={(e) => updateBranch(branch.id, { combinator: e.target.value as 'AND' | 'OR' })}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 font-semibold"
                  >
                    <option value="AND">ALL conditions (AND)</option>
                    <option value="OR">ANY condition (OR)</option>
                  </select>
                </div>

                {/* Outcome Target */}
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">THEN:</span>
                  <input
                    type="text"
                    value={branch.outcome}
                    disabled={readOnly}
                    onChange={(e) => updateBranch(branch.id, { outcome: e.target.value })}
                    placeholder="APPROVE"
                    className="w-32 bg-indigo-950/60 border border-indigo-700/60 rounded-lg px-2.5 py-1 text-xs font-bold text-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 uppercase"
                  />
                </div>

                {matrix.branches.length > 1 && !readOnly && (
                  <button
                    type="button"
                    onClick={() => removeBranch(branch.id)}
                    className="p-1.5 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded-lg transition-all"
                    title="Remove Branch"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Conditions Rows */}
            <div className="space-y-2 pl-4 border-l-2 border-slate-800">
              {branch.conditions.map((cond, condIdx) => (
                <div key={cond.id} className="flex items-center gap-2 text-xs">
                  {condIdx > 0 && (
                    <span className="w-10 text-[10px] uppercase font-bold text-indigo-400 text-center">
                      {branch.combinator}
                    </span>
                  )}
                  {condIdx === 0 && <span className="w-10 text-[10px] uppercase font-bold text-slate-500 text-center">IF</span>}

                  {/* Field */}
                  <select
                    value={cond.field}
                    disabled={readOnly}
                    onChange={(e) => updateCondition(branch.id, cond.id, { field: e.target.value })}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    {availableFields.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>

                  {/* Operator */}
                  <select
                    value={cond.operator}
                    disabled={readOnly}
                    onChange={(e) =>
                      updateCondition(branch.id, cond.id, {
                        operator: e.target.value as VisualCondition['operator'],
                      })
                    }
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-indigo-300 font-mono font-bold focus:outline-none"
                  >
                    <option value="==">equals (==)</option>
                    <option value="!=">not equals (!=)</option>
                    <option value=">">greater than (&gt;)</option>
                    <option value=">=">greater/equal (&gt;=)</option>
                    <option value="<">less than (&lt;)</option>
                    <option value="<=">less/equal (&lt;=)</option>
                    <option value="CONTAINS">contains</option>
                    <option value="IS_EMPTY">is empty</option>
                    <option value="IS_NOT_EMPTY">is not empty</option>
                  </select>

                  {/* Value Type */}
                  <select
                    value={cond.valueType}
                    disabled={readOnly}
                    onChange={(e) =>
                      updateCondition(branch.id, cond.id, {
                        valueType: e.target.value as 'string' | 'number' | 'boolean',
                      })
                    }
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-slate-400 focus:outline-none"
                  >
                    <option value="string">Text</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                  </select>

                  {/* Value Input (unless IS_EMPTY / IS_NOT_EMPTY) */}
                  {cond.operator !== 'IS_EMPTY' && cond.operator !== 'IS_NOT_EMPTY' && (
                    <input
                      type={cond.valueType === 'number' ? 'number' : 'text'}
                      value={cond.value}
                      disabled={readOnly}
                      onChange={(e) => updateCondition(branch.id, cond.id, { value: e.target.value })}
                      placeholder="Value (e.g. VERIFIED or 80)"
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  )}

                  {!readOnly && branch.conditions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCondition(branch.id, cond.id)}
                      className="p-1 hover:bg-rose-500/10 text-slate-600 hover:text-rose-400 rounded transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}

              {!readOnly && (
                <button
                  type="button"
                  onClick={() => addCondition(branch.id)}
                  className="mt-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-indigo-500/10 transition-all"
                >
                  <Plus className="w-3 h-3" /> Add Condition Clause
                </button>
              )}
            </div>
          </div>
        ))}

        {!readOnly && (
          <button
            type="button"
            onClick={addBranch}
            className="w-full py-2.5 border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 flex items-center justify-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" /> Add Else-If Rule Branch
          </button>
        )}
      </div>

      {/* Default Fallback Outcome */}
      <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase">ELSE (Default Fallback):</span>
          <span className="text-xs text-slate-500">If none of the above criteria match</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-semibold">RETURN:</span>
          <input
            type="text"
            value={matrix.defaultOutcome}
            disabled={readOnly}
            onChange={(e) => updateMatrix({ ...matrix, defaultOutcome: e.target.value })}
            placeholder="REJECT"
            className="w-32 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-bold text-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-500 uppercase"
          />
        </div>
      </div>
    </div>
  );
};

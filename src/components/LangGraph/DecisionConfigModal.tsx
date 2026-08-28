import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Sliders, Code2, Check, GitBranch, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import Editor from '@monaco-editor/react';
import { BusinessRuleBuilder } from './BusinessRuleBuilder';
import { VisualRuleBuilder } from './VisualRuleBuilder';
import {
  RuleDefinition, RuleTreeNode, createDefaultRuleDefinition, SCHEMA_VERSION,
} from '../../utils/businessRuleEngine';
import { DEFAULT_RULE_GROUP, compileRuleGroupToPython, parsePythonToRuleGroup, RuleGroup } from '../../utils/ruleCompiler';

interface DecisionConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { script?: string; ruleDefinition?: RuleDefinition }) => void;
  initialValue: string;
  initialRuleDefinition?: RuleDefinition;
}

type ConfigMode = 'business' | 'visual' | 'python';

export const DecisionConfigModal: React.FC<DecisionConfigModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialValue,
  initialRuleDefinition,
}) => {
  const [activeTab, setActiveTab] = useState<ConfigMode>('business');
  const [pythonScript, setPythonScript] = useState(
    initialValue || compileRuleGroupToPython(DEFAULT_RULE_GROUP)
  );
  const [ruleDefinition, setRuleDefinition] = useState<RuleDefinition>(
    initialRuleDefinition || createDefaultRuleDefinition()
  );
  const latestRuleGroupRef = useRef<RuleGroup>(
    initialValue ? parsePythonToRuleGroup(initialValue) : DEFAULT_RULE_GROUP
  );

  useEffect(() => {
    if (isOpen) {
      const script = initialValue || compileRuleGroupToPython(DEFAULT_RULE_GROUP);
      setPythonScript(script);
      latestRuleGroupRef.current = parsePythonToRuleGroup(script);
      if (initialRuleDefinition) {
        setRuleDefinition(initialRuleDefinition);
      }
    }
  }, [isOpen, initialValue, initialRuleDefinition]);

  if (!isOpen) return null;

  const handleVisualRuleChange = (group: RuleGroup, compiledPython: string) => {
    latestRuleGroupRef.current = group;
    setPythonScript(compiledPython);
  };

  const handleBusinessRuleChange = (rule: RuleDefinition) => {
    setRuleDefinition(rule);
  };

  const handleSave = () => {
    if (activeTab === 'business') {
      onSave({ ruleDefinition, script: compileRuleDefinitionToScript(ruleDefinition) });
    } else {
      onSave({ script: pythonScript });
    }
    onClose();
  };

  const modalContent = (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-6xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-white text-slate-900 px-8 py-5 flex items-center justify-between border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-3 text-slate-900">
                Configure Decision Rules
                <span className="text-xs bg-blue-50 text-blue-700 font-mono font-semibold px-2.5 py-0.5 rounded-full border border-blue-200">
                  Business Rule Builder
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Build decision logic with field conditions and outcomes. No code required.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="bg-slate-100/80 border-b border-slate-200 px-8 pt-3 flex gap-2">
          <button
            onClick={() => setActiveTab('business')}
            className={`px-5 py-2.5 text-xs font-bold rounded-t-xl flex items-center gap-2 transition-all ${activeTab === 'business'
                ? 'bg-white text-slate-950 border-t-2 border-x border-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
          >
            <Sliders className="w-4 h-4 text-blue-600" />
            Business Rule Builder
          </button>
          <button
            onClick={() => setActiveTab('visual')}
            className={`px-5 py-2.5 text-xs font-bold rounded-t-xl flex items-center gap-2 transition-all ${activeTab === 'visual'
                ? 'bg-white text-slate-950 border-t-2 border-x border-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
          >
            <Sliders className="w-4 h-4 text-slate-500" />
            Visual Rule Builder
          </button>
          <button
            onClick={() => setActiveTab('python')}
            className={`px-5 py-2.5 text-xs font-bold rounded-t-xl flex items-center gap-2 transition-all ${activeTab === 'python'
                ? 'bg-white text-slate-950 border-t-2 border-x border-slate-400 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
          >
            <Code2 className="w-4 h-4 text-slate-500" />
            Advanced (Python)
          </button>
        </div>

        {/* Advanced mode warning */}
        {activeTab === 'python' && (
          <div className="px-8 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="text-xs text-amber-800">
              <strong>Advanced mode:</strong> Python is for developers only. Business users should use the Business Rule Builder tab. The rule engine evaluates JSON/DSL definitions, not raw Python.
            </span>
          </div>
        )}

        {/* Tab Body */}
        <div className="flex-1 flex flex-col p-8 overflow-y-auto bg-slate-50/40">
          {activeTab === 'business' ? (
            <BusinessRuleBuilder
              initialRule={ruleDefinition}
              onChange={handleBusinessRuleChange}
            />
          ) : activeTab === 'visual' ? (
            <VisualRuleBuilder
              initialGroup={latestRuleGroupRef.current}
              onChange={handleVisualRuleChange}
            />
          ) : (
            <div className="flex-1 flex flex-col h-full space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                <span>Advanced Monaco Python Editor</span>
                <span className="bg-slate-200 px-2 py-0.5 rounded text-slate-800 font-bold">Python 3.10</span>
              </div>
              <div className="flex-1 border border-slate-300 rounded-2xl overflow-hidden shadow-sm">
                <Editor
                  height="100%"
                  defaultLanguage="python"
                  value={pythonScript}
                  onChange={(value) => setPythonScript(value || '')}
                  theme="vs-light"
                  options={{
                    minimap: { enabled: true },
                    fontSize: 13,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 4,
                    wordWrap: 'on',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-8 py-4 flex items-center justify-between bg-slate-50">
          <div className="text-xs text-slate-500">
            Active Mode: <span className="font-bold text-slate-900 uppercase">{activeTab === 'business' ? 'Business Rule (JSON DSL)' : activeTab}</span>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onClose} className="px-5 py-2 text-xs font-bold">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 text-xs font-bold shadow-md gap-2 rounded-xl"
            >
              <Check className="w-4 h-4" />
              Save Decision Configuration
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

/**
 * Compiles a JSON/DSL RuleDefinition into a Python script string for
 * backward compatibility with the existing execution engine.
 */
function compileRuleDefinitionToScript(rule: RuleDefinition): string {
  if (!rule || !rule.conditions) return 'result = True\n';

  const opMap: Record<string, string> = {
    EQUALS: '==', NOT_EQUALS: '!=',
    GREATER_THAN: '>', LESS_THAN: '<',
    GREATER_THAN_OR_EQUAL: '>=', LESS_THAN_OR_EQUAL: '<=',
    CONTAINS: 'in', NOT_CONTAINS: 'not in',
  };

  function compileNode(node: RuleTreeNode): string {
    if (node.field !== undefined && node.operator !== undefined) {
      const pyOp = opMap[node.operator] || '==';
      let pyVal: string;
      if (typeof node.value === 'number') pyVal = String(node.value);
      else if (typeof node.value === 'boolean') pyVal = node.value ? 'True' : 'False';
      else if (Array.isArray(node.value)) pyVal = `[${node.value.map((v: unknown) => `'${String(v)}'`).join(', ')}]`;
      else pyVal = `'${String(node.value ?? '')}'`;
      return `state.get('${node.field}', None) ${pyOp} ${pyVal}`;
    }
    if (node.rules) {
      const childExprs = node.rules.map((r: RuleTreeNode) => compileNode(r));
      if (node.operator === 'NOT') {
        return `not (${childExprs[0] || 'True'})`;
      }
      return `(${childExprs.join(node.operator === 'OR' ? ' or ' : ' and ')})`;
    }
    return 'True';
  }

  const expr = compileNode(rule.conditions);
  const trueOutcome = rule.outcomes?.true || 'APPROVE';
  const falseOutcome = rule.outcomes?.false || 'REVIEW';

  return [
    '# Auto-generated from Business Rule Builder (JSON DSL)',
    `# Rule Set: ${rule.ruleSetId}`,
    `# Schema: ${SCHEMA_VERSION}`,
    `result = ${expr}`,
    `state['decision_outcome'] = '${trueOutcome}' if result else '${falseOutcome}'`,
  ].join('\n') + '\n';
}

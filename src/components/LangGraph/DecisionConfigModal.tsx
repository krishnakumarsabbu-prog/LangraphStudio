import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Sliders, Code2, Check, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import Editor from '@monaco-editor/react';
import { VisualRuleBuilder } from './VisualRuleBuilder';
import { DEFAULT_RULE_GROUP, compileRuleGroupToPython, parsePythonToRuleGroup, RuleGroup } from '../../utils/ruleCompiler';

interface DecisionConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (script: string) => void;
  initialValue: string;
}

export const DecisionConfigModal: React.FC<DecisionConfigModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialValue,
}) => {
  const [activeTab, setActiveTab] = useState<'visual' | 'code'>('visual');
  const [pythonScript, setPythonScript] = useState(
    initialValue || compileRuleGroupToPython(DEFAULT_RULE_GROUP)
  );
  const latestRuleGroupRef = useRef<RuleGroup>(
    initialValue ? parsePythonToRuleGroup(initialValue) : DEFAULT_RULE_GROUP
  );

  useEffect(() => {
    if (isOpen) {
      const script = initialValue || compileRuleGroupToPython(DEFAULT_RULE_GROUP);
      setPythonScript(script);
      latestRuleGroupRef.current = parsePythonToRuleGroup(script);
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const handleTabSwitch = (tab: 'visual' | 'code') => {
    if (tab === 'visual') {
      // Sync pythonScript back to visual rule group
      const parsedGroup = parsePythonToRuleGroup(pythonScript);
      latestRuleGroupRef.current = parsedGroup;
    }
    setActiveTab(tab);
  };

  const handleVisualRuleChange = (group: RuleGroup, compiledPython: string) => {
    latestRuleGroupRef.current = group;
    setPythonScript(compiledPython);
  };

  const handleSave = () => {
    onSave(pythonScript);
    onClose();
  };

  const modalContent = (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-6xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-white text-slate-900 px-8 py-5 flex items-center justify-between border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-3 text-slate-900">
                Configure Decision Rules & Logic
                <span className="text-xs bg-indigo-50 text-indigo-700 font-mono font-semibold px-2.5 py-0.5 rounded-full border border-indigo-200">
                  Dynamic Node Rules
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Build dynamic decision logic using visual form controls (toggles, dropdowns, sliders) or python script.
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
            onClick={() => handleTabSwitch('visual')}
            className={`px-5 py-2.5 text-xs font-bold rounded-t-xl flex items-center gap-2 transition-all ${activeTab === 'visual'
                ? 'bg-white text-slate-950 border-t-2 border-x border-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
          >
            <Sliders className="w-4 h-4 text-indigo-600" />
            Visual Dynamic Rule Builder
          </button>
          <button
            onClick={() => handleTabSwitch('code')}
            className={`px-5 py-2.5 text-xs font-bold rounded-t-xl flex items-center gap-2 transition-all ${activeTab === 'code'
                ? 'bg-white text-slate-950 border-t-2 border-x border-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
          >
            <Code2 className="w-4 h-4 text-indigo-600" />
            Raw Python Code Editor
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 flex flex-col p-8 overflow-y-auto bg-slate-50/40">
          {activeTab === 'visual' ? (
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
            Active Mode: <span className="font-bold text-slate-900 uppercase">{activeTab}</span>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onClose} className="px-5 py-2 text-xs font-bold">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 text-xs font-bold shadow-md gap-2 rounded-xl"
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


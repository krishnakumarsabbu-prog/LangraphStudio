import React, { useState, useMemo } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight, Check, Sparkles, Layers, ArrowRightLeft, Database, HardDriveDownload, HelpCircle, Tag, Code2, Play, FileCode, CheckCircle2, Variable, Workflow } from 'lucide-react';
import { RuleGroup, RuleCondition, VariableExtraction, OutputConstruction, Operator, ValueType, ExtractionType, compileRuleGroupToPython, DEFAULT_RULE_GROUP, SCREENSHOT_SAMPLE_RULE_GROUP } from '../../utils/ruleCompiler';
import { Button } from '../ui/button';
import { useLangGraphStore } from '../../stores/langGraphStore';

interface VisualRuleBuilderProps {
  initialGroup?: RuleGroup;
  onChange: (group: RuleGroup, compiledPython: string) => void;
}

// Deep recursive key discovery helper
const extractKeysFromNodeData = (obj: any, prefix = ''): string[] => {
  if (!obj) return [];
  let parsed = obj;
  if (typeof obj === 'string') {
    try {
      parsed = JSON.parse(obj);
    } catch {
      return [];
    }
  }
  if (typeof parsed !== 'object' || parsed === null) return [];

  let keys: string[] = [];
  if (Array.isArray(parsed)) {
    parsed.forEach((item, idx) => {
      const p = prefix ? `${prefix}[${idx}]` : `[${idx}]`;
      if (typeof item === 'object' && item !== null) {
        keys = keys.concat(extractKeysFromNodeData(item, p));
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
      const nested = extractKeysFromNodeData(parsed[k], p);
      keys = keys.concat(nested);
    }
  }
  return Array.from(new Set(keys));
};

export const VisualRuleBuilder: React.FC<VisualRuleBuilderProps> = ({
  initialGroup = DEFAULT_RULE_GROUP,
  onChange,
}) => {
  const { nodes, edges, selectedNodeId, inputs } = useLangGraphStore();
  const [ruleGroup, setRuleGroup] = useState<RuleGroup>(initialGroup);
  const [activeBuilderMode, setActiveBuilderMode] = useState<'pipeline' | 'conditions'>('pipeline');
  const [newOptionInputs, setNewOptionInputs] = useState<Record<string, string>>({});

  // Compute preceding upstream nodes connected strictly via incoming edges to current Decision Node
  const precedingNodes = useMemo(() => {
    const upstreamList: Array<{ id: string; label: string; type: string; fields: string[] }> = [];

    // 1. Initial Workflow Inputs
    if (inputs && Object.keys(inputs).length > 0) {
      const inputKeys = extractKeysFromNodeData(inputs);
      upstreamList.push({
        id: 'input',
        label: '📥 Initial Workflow Inputs',
        type: 'input',
        fields: inputKeys,
      });
    }

    // 2. Incoming edge preceding nodes
    if (selectedNodeId) {
      const incomingEdges = edges.filter((e) => e.target === selectedNodeId);
      const incomingSourceIds = incomingEdges.map((e) => e.source);
      const connectedPreceding = nodes.filter((n) => incomingSourceIds.includes(n.id) && n.id !== selectedNodeId);

      connectedPreceding.forEach((n) => {
        const reqBodyKeys = extractKeysFromNodeData((n.data as any)?.requestBody || (n.data as any)?.config?.requestBody);
        const respBodyKeys = extractKeysFromNodeData((n.data as any)?.responseBody || (n.data as any)?.outputs);
        const dynamicKeys = Array.from(new Set([...reqBodyKeys, ...respBodyKeys, 'response.raw', 'response', 'raw']));

        upstreamList.push({
          id: n.id,
          label: `🔹 ${(n.data as any)?.label || n.id} (${n.type})`,
          type: n.type,
          fields: dynamicKeys,
        });
      });
    } else {
      nodes.forEach((n) => {
        if (n.type !== 'decisionNode') {
          const reqBodyKeys = extractKeysFromNodeData((n.data as any)?.requestBody || (n.data as any)?.config?.requestBody);
          const respBodyKeys = extractKeysFromNodeData((n.data as any)?.responseBody || (n.data as any)?.outputs);
          const dynamicKeys = Array.from(new Set([...reqBodyKeys, ...respBodyKeys, 'response.raw', 'response', 'raw']));

          upstreamList.push({
            id: n.id,
            label: `🔹 ${(n.data as any)?.label || n.id} (${n.type})`,
            type: n.type,
            fields: dynamicKeys,
          });
        }
      });
    }

    if (upstreamList.length === 0) {
      upstreamList.push({
        id: 'service-2',
        label: '🔹 Service 2 (serviceNode)',
        type: 'serviceNode',
        fields: ['response.raw', 'response', 'raw', 'status'],
      });
    }

    return upstreamList;
  }, [nodes, edges, selectedNodeId, inputs]);

  const updateGroup = (updated: RuleGroup) => {
    setRuleGroup(updated);
    const python = compileRuleGroupToPython(updated);
    onChange(updated, python);
  };

  const handleLoadScreenshotPreset = () => {
    updateGroup(SCREENSHOT_SAMPLE_RULE_GROUP);
    setActiveBuilderMode('pipeline');
  };

  // Variable Extractions ("Variables Above") handlers
  const handleAddExtraction = () => {
    const defaultNode = precedingNodes[0]?.id || 'service-2';
    const currentExtractions = ruleGroup.extractions || [];
    const directExt = currentExtractions.find((e) => e.extractionType === 'direct');
    const sourceVar = directExt?.varName || 'raw';
    const count = currentExtractions.length + 1;

    const newExt: VariableExtraction = {
      id: `ext-${Date.now()}`,
      varName: `has_tag_${count}`,
      nodeId: defaultNode,
      fieldPath: directExt?.fieldPath || 'response.raw',
      extractionType: 'contains_tag',
      sourceVarName: sourceVar,
      tagValue: `<Z41:CMRAIndicator>N</Z41:CMRAIndicator>`,
      targetStateKey: `has_tag_${count}`,
    };
    updateGroup({
      ...ruleGroup,
      extractions: [...currentExtractions, newExt],
      construction: ruleGroup.construction || {
        resultVarName: 'gsa_bool',
        logic: 'AND',
        selectedVarNames: [newExt.targetStateKey || newExt.varName],
        outputStateKey: 'GSA',
        trueValue: "'True'",
        falseValue: "'False'",
      },
    });
  };

  const handleUpdateExtraction = (id: string, updates: Partial<VariableExtraction>) => {
    const updated = (ruleGroup.extractions || []).map((ext) => (ext.id === id ? { ...ext, ...updates } : ext));
    updateGroup({ ...ruleGroup, extractions: updated });
  };

  const handleRemoveExtraction = (id: string) => {
    const updated = (ruleGroup.extractions || []).filter((ext) => ext.id !== id);
    updateGroup({ ...ruleGroup, extractions: updated });
  };

  // Output Construction ("Construction Below") handlers
  const handleUpdateConstruction = (updates: Partial<OutputConstruction>) => {
    const currentConstr = ruleGroup.construction || {
      resultVarName: 'gsa_bool',
      logic: 'AND',
      selectedVarNames: (ruleGroup.extractions || []).map((e) => e.targetStateKey || e.varName),
      outputStateKey: 'GSA',
      trueValue: "'True'",
      falseValue: "'False'",
    };
    updateGroup({ ...ruleGroup, construction: { ...currentConstr, ...updates } });
  };

  const toggleConstructionVar = (varName: string) => {
    const currentConstr = ruleGroup.construction || {
      resultVarName: 'gsa_bool',
      logic: 'AND',
      selectedVarNames: [],
      outputStateKey: 'GSA',
      trueValue: "'True'",
      falseValue: "'False'",
    };
    const selected = currentConstr.selectedVarNames.includes(varName)
      ? currentConstr.selectedVarNames.filter((v) => v !== varName)
      : [...currentConstr.selectedVarNames, varName];

    updateGroup({ ...ruleGroup, construction: { ...currentConstr, selectedVarNames: selected } });
  };

  // Legacy Conditions Handlers
  const handleAddCondition = () => {
    const defaultNode = precedingNodes[0]?.id || 'input';
    const defaultField = precedingNodes[0]?.fields?.[0] || 'result';

    const newCond: RuleCondition = {
      id: `rule-${Date.now()}`,
      nodeId: defaultNode,
      field: defaultField,
      operator: '==',
      value: 'SUCCESS',
      valueType: 'string',
      min: 0,
      max: 100,
      step: 1,
    };
    updateGroup({
      ...ruleGroup,
      conditions: [...(ruleGroup.conditions || []), newCond],
    });
  };

  const handleRemoveCondition = (id: string) => {
    updateGroup({
      ...ruleGroup,
      conditions: (ruleGroup.conditions || []).filter((c) => c.id !== id),
    });
  };

  const handleConditionChange = (id: string, updates: Partial<RuleCondition>) => {
    const newConditions = (ruleGroup.conditions || []).map((cond) => {
      if (cond.id !== id) return cond;

      const updated = { ...cond, ...updates };

      if (updates.valueType && updates.valueType !== cond.valueType) {
        if (updates.valueType === 'boolean') {
          updated.value = true;
          updated.operator = '==';
        } else if (updates.valueType === 'number') {
          updated.value = 100;
          updated.operator = '>=';
          updated.min = 0;
          updated.max = 1000;
          updated.step = 1;
        } else if (updates.valueType === 'select') {
          updated.options = updated.options && updated.options.length > 0 ? updated.options : ['PASS', 'FAIL'];
          updated.value = [updated.options[0]];
          updated.operator = 'in';
        } else {
          updated.value = '';
          updated.operator = '==';
        }
      }

      return updated;
    });

    updateGroup({ ...ruleGroup, conditions: newConditions });
  };

  const extractions = ruleGroup.extractions || [];
  const construction = ruleGroup.construction;

  return (
    <div className="space-y-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      {/* Top Banner & Mode Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-indigo-50/80 text-slate-900 p-5 rounded-2xl border border-indigo-100 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
            <Variable className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              Visual Variable & Logic Construction Builder
              <span className="bg-indigo-600 text-white text-[10px] uppercase font-mono px-2 py-0.5 rounded-full font-bold">
                Enterprise
              </span>
            </h3>
            <p className="text-xs text-slate-600">
              Extract raw upstream fields, evaluate dynamic tag presence (XML/JSON), and construct decision states.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={handleLoadScreenshotPreset}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm gap-2"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            Load Screenshot XML & GSA Logic
          </Button>

          <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveBuilderMode('pipeline')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeBuilderMode === 'pipeline'
                  ? 'bg-white text-indigo-700 shadow-xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Variables & Construction
            </button>
            <button
              type="button"
              onClick={() => setActiveBuilderMode('conditions')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeBuilderMode === 'conditions'
                  ? 'bg-white text-indigo-700 shadow-xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Simple Field Conditions
            </button>
          </div>
        </div>
      </div>

      {activeBuilderMode === 'pipeline' ? (
        <div className="space-y-8">
          {/* SECTION 1: "Variables Above" - Variable Extractions */}
          <div className="bg-slate-50/70 p-6 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-200">
                  1
                </span>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                    Variables Above: Upstream Data Extraction & Tag Indicators
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Safely extract raw text/XML from upstream nodes and evaluate tag presence flags stored in state.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                onClick={handleAddExtraction}
                variant="outline"
                className="bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-bold py-1.5 px-3 rounded-xl gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> + Add Variable Extraction
              </Button>
            </div>

            {extractions.length > 0 ? (
              <div className="space-y-4">
                {extractions.map((ext, idx) => {
                  const selectedNodeObj = precedingNodes.find((n) => n.id === ext.nodeId) || precedingNodes[0];

                  return (
                    <div
                      key={ext.id}
                      className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3 hover:border-indigo-300 transition-colors"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-indigo-600" />
                          <span className="text-xs font-bold text-slate-800 font-mono">
                            Variable #{idx + 1}: <code className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">{ext.varName}</code>
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            value={ext.extractionType}
                            onChange={(e) =>
                              handleUpdateExtraction(ext.id, { extractionType: e.target.value as ExtractionType })
                            }
                            className="px-2.5 py-1 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                          >
                            <option value="direct">📥 Direct Field Getter (e.g. raw = state.get(...))</option>
                            <option value="contains_tag">🏷️ XML / Text Tag Search ("&lt;TAG&gt;" in raw)</option>
                            <option value="regex">🔍 Regex Pattern Match</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => handleRemoveExtraction(ext.id)}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded transition-colors"
                            title="Remove Variable"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Input fields row */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Variable / Label Name
                          </label>
                          <input
                            type="text"
                            value={ext.varName}
                            onChange={(e) => handleUpdateExtraction(ext.id, { varName: e.target.value })}
                            className="w-full px-3 py-1.5 font-mono text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-400"
                            placeholder="e.g. raw, tag_flag_4"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Upstream Source Node
                          </label>
                          <select
                            value={ext.nodeId}
                            onChange={(e) => handleUpdateExtraction(ext.id, { nodeId: e.target.value })}
                            className="w-full px-3 py-1.5 font-bold text-xs bg-white border border-slate-300 rounded-lg"
                          >
                            {precedingNodes.map((n) => (
                              <option key={n.id} value={n.id}>
                                {n.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Field Path (e.g. response.raw)
                          </label>
                          <input
                            type="text"
                            value={ext.fieldPath}
                            onChange={(e) => handleUpdateExtraction(ext.id, { fieldPath: e.target.value })}
                            className="w-full px-3 py-1.5 font-mono text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-400"
                            placeholder="response.raw"
                          />
                        </div>
                      </div>

                      {ext.extractionType !== 'direct' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-100 text-xs">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Search Inside Variable (<code className="text-indigo-600">in var</code>)
                            </label>
                            <input
                              type="text"
                              value={ext.sourceVarName || 'raw'}
                              onChange={(e) => handleUpdateExtraction(ext.id, { sourceVarName: e.target.value })}
                              className="w-full px-3 py-1.5 font-mono text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-400"
                              placeholder="e.g. raw"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-indigo-900 mb-1">
                              Target Tag / Substring Pattern
                            </label>
                            <input
                              type="text"
                              value={ext.tagValue || ''}
                              onChange={(e) => handleUpdateExtraction(ext.id, { tagValue: e.target.value })}
                              className="w-full px-3 py-1.5 font-mono text-xs border border-indigo-200 bg-indigo-50/30 rounded-lg focus:ring-1 focus:ring-indigo-400"
                              placeholder='e.g. <Z41:CMRAIndicator>N</Z41:CMRAIndicator>'
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              State Flag Key (<code className="text-indigo-600">state["key"]</code>)
                            </label>
                            <input
                              type="text"
                              value={ext.targetStateKey || ext.varName}
                              onChange={(e) => handleUpdateExtraction(ext.id, { targetStateKey: e.target.value })}
                              className="w-full px-3 py-1.5 font-mono text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-400"
                              placeholder="e.g. has_cmra_indicator_tag"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center border border-dashed border-slate-300 rounded-xl bg-white text-xs text-slate-500">
                No intermediate variable extractions defined. Click <strong>"+ Add Variable Extraction"</strong> or load the sample preset above.
              </div>
            )}
          </div>

          {/* SECTION 2: "Construction Below" - Decision & State Output Construction */}
          <div className="bg-slate-50/70 p-6 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-200">
                  2
                </span>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                    Construction Below: Decision Evaluation & State Output Assignment
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Combine extracted state variable flags with logical AND/OR and construct final state output.
                  </p>
                </div>
              </div>

              {/* Logic Switcher */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
                <button
                  type="button"
                  onClick={() => handleUpdateConstruction({ logic: 'AND' })}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    (construction?.logic || 'AND') === 'AND'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ALL (AND)
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateConstruction({ logic: 'OR' })}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    (construction?.logic || 'AND') === 'OR'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ANY (OR)
                </button>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              {/* Select variables to include */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-2">
                  Select Computed Flags to Combine (Logic: <span className="text-indigo-600">{construction?.logic || 'AND'}</span>):
                </label>
                <div className="flex flex-wrap gap-2">
                  {extractions
                    .filter((e) => e.targetStateKey || e.extractionType !== 'direct')
                    .map((e) => {
                      const key = e.targetStateKey || e.varName;
                      const isSelected = (construction?.selectedVarNames || []).includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleConstructionVar(key)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-300" />}
                          state["{key}"]
                        </button>
                      );
                    })}
                  {extractions.filter((e) => e.targetStateKey || e.extractionType !== 'direct').length === 0 && (
                    <span className="text-xs text-slate-400 italic">
                      Add tag/boolean variable extractions above to enable flags here.
                    </span>
                  )}
                </div>
              </div>

              {/* Expression variable name & State Output Key */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Evaluation Result Var Name
                  </label>
                  <input
                    type="text"
                    value={construction?.resultVarName || 'gsa_bool'}
                    onChange={(e) => handleUpdateConstruction({ resultVarName: e.target.value })}
                    className="w-full px-3 py-1.5 font-mono text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-400"
                    placeholder="gsa_bool"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Target State Output Key
                  </label>
                  <input
                    type="text"
                    value={construction?.outputStateKey || 'GSA'}
                    onChange={(e) => handleUpdateConstruction({ outputStateKey: e.target.value })}
                    className="w-full px-3 py-1.5 font-mono text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-400"
                    placeholder="GSA"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-emerald-700 mb-1">
                    True State Value
                  </label>
                  <input
                    type="text"
                    value={construction?.trueValue || "'True'"}
                    onChange={(e) => handleUpdateConstruction({ trueValue: e.target.value })}
                    className="w-full px-3 py-1.5 font-mono text-xs border border-emerald-300 bg-emerald-50/40 rounded-lg focus:ring-1 focus:ring-emerald-400"
                    placeholder="'True'"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-rose-700 mb-1">
                    False State Value
                  </label>
                  <input
                    type="text"
                    value={construction?.falseValue || "'False'"}
                    onChange={(e) => handleUpdateConstruction({ falseValue: e.target.value })}
                    className="w-full px-3 py-1.5 font-mono text-xs border border-rose-300 bg-rose-50/40 rounded-lg focus:ring-1 focus:ring-rose-400"
                    placeholder="'False'"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Legacy Simple Conditions Mode */
        <div className="space-y-4">
          {ruleGroup.conditions && ruleGroup.conditions.length > 0 ? (
            <div className="space-y-4">
              {ruleGroup.conditions.map((cond, index) => {
                const selectedNodeObj = precedingNodes.find((n) => n.id === cond.nodeId) || precedingNodes[0];
                const availableFields = selectedNodeObj?.fields || [];

                return (
                  <div
                    key={cond.id}
                    className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4 transition-all hover:border-slate-300 hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shadow-xs">
                          {index + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          Rule Condition #{index + 1}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={cond.valueType}
                          onChange={(e) =>
                            handleConditionChange(cond.id, { valueType: e.target.value as ValueType })
                          }
                          className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800"
                        >
                          <option value="string">📝 Text / String Field</option>
                          <option value="number">🔢 Number Slider</option>
                          <option value="select">📋 Dynamic Dropdown</option>
                          <option value="boolean">🔀 Toggle Switch</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => handleRemoveCondition(cond.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                          <Database className="w-3.5 h-3.5 text-indigo-600" /> 1. Select Preceding Node
                        </label>
                        <select
                          value={cond.nodeId || precedingNodes[0]?.id || 'input'}
                          onChange={(e) => {
                            const newNodeId = e.target.value;
                            const newNodeObj = precedingNodes.find((n) => n.id === newNodeId);
                            const defaultField = newNodeObj?.fields?.[0] || 'result';
                            handleConditionChange(cond.id, { nodeId: newNodeId, field: defaultField });
                          }}
                          className="w-full px-3 py-2 text-xs font-bold bg-white border border-indigo-200 rounded-xl"
                        >
                          {precedingNodes.map((n) => (
                            <option key={n.id} value={n.id}>
                              {n.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                          <HardDriveDownload className="w-3.5 h-3.5 text-indigo-600" /> 2. Select Output Field
                        </label>
                        <input
                          type="text"
                          value={cond.field}
                          onChange={(e) => handleConditionChange(cond.id, { field: e.target.value })}
                          className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">3. Operator</label>
                        <select
                          value={cond.operator}
                          onChange={(e) =>
                            handleConditionChange(cond.id, { operator: e.target.value as Operator })
                          }
                          className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl"
                        >
                          <option value="==">== Equals</option>
                          <option value="!=">!= Not Equals</option>
                          <option value=">">&gt; Greater Than</option>
                          <option value=">=">&gt;= Greater Than or Equal</option>
                          <option value="<">&lt; Less Than</option>
                          <option value="<=">&lt;= Less Than or Equal</option>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center border border-dashed border-slate-300 rounded-2xl bg-white space-y-2">
              <HelpCircle className="w-8 h-8 text-slate-300 mx-auto" />
              <h4 className="text-xs font-bold text-slate-800">No Simple Field Conditions Configured</h4>
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={handleAddCondition}
            className="w-full py-2.5 text-xs font-bold border-dashed border-2 border-slate-300 hover:border-indigo-500 rounded-2xl gap-2"
          >
            <Plus className="w-4 h-4 text-indigo-600" /> Add Simple Condition
          </Button>
        </div>
      )}

      {/* Real-time Live Python Code Compilation Output Box */}
      <div className="p-4 bg-slate-900 text-slate-100 rounded-2xl font-mono text-xs space-y-2 border border-slate-800 shadow-md">
        <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
          <span className="flex items-center gap-1.5 text-indigo-400 font-semibold text-xs">
            <Sparkles className="w-4 h-4 text-amber-400" /> Compiled Executable Python Decision Script:
          </span>
          <span className="text-[10px] bg-slate-800 text-indigo-300 px-2.5 py-0.5 rounded-full font-bold">
            Live Preview
          </span>
        </div>
        <pre className="text-emerald-400 overflow-x-auto max-h-48 p-3 bg-slate-950 rounded-xl font-mono text-[12px] leading-relaxed shadow-inner">
          {compileRuleGroupToPython(ruleGroup)}
        </pre>
      </div>
    </div>
  );
};

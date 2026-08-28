/**
 * ruleCompiler.ts
 * 
 * Node-Scoped Data Model, Python Compiler, and Client-side Evaluator for Visual HTML Rules.
 * Enables non-technical users to build and tweak decision rules using preceding node output features
 * and interactive HTML controls (toggles, dropdowns, sliders).
 */

export type ValueType = 'boolean' | 'select' | 'number' | 'string';
export type Operator = '==' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | 'not in';
export type ExtractionType = 'direct' | 'contains_tag' | 'regex';

export interface RuleCondition {
  id: string;
  nodeId?: string; // Selected preceding node ID (e.g. 'service-1', 'service-2', or 'input')
  field: string;
  operator: Operator;
  value: any;
  valueType: ValueType;
  options?: string[]; // For dropdown choices
  min?: number;      // For number sliders
  max?: number;
  step?: number;
}

export interface VariableExtraction {
  id: string;
  varName: string;            // Name of extracted text variable (e.g. "raw") or variable label
  nodeId: string;             // Selected upstream node ID (e.g. "service-2", "service-1", "input")
  fieldPath: string;          // Selected nested field path (e.g. "response.raw", "response.body")
  extractionType: ExtractionType; // 'direct' | 'contains_tag' | 'regex'
  sourceVarName?: string;     // Raw variable name to search in (e.g. "raw")
  tagValue?: string;          // Target pattern / XML tag (e.g. "<Z41:CMRAIndicator>N</Z41:CMRAIndicator>")
  targetStateKey?: string;    // Target key stored in state (e.g. "has_cmra_indicator_tag")
}

export interface OutputConstruction {
  resultVarName: string;      // e.g. "gsa_bool"
  logic: 'AND' | 'OR';        // Logical combination of variables
  selectedVarNames: string[]; // e.g. ["has_cmra_indicator_tag", "has_pbsa_indicator_tag"]
  outputStateKey: string;     // e.g. "GSA"
  trueValue: string;          // e.g. "'True'" or "True"
  falseValue: string;         // e.g. "'False'" or "False"
}

export interface RuleGroup {
  logic: 'AND' | 'OR';
  conditions: RuleCondition[];
  extractions?: VariableExtraction[];
  construction?: OutputConstruction;
}

export const DEFAULT_RULE_GROUP: RuleGroup = {
  logic: 'AND',
  conditions: [],
  extractions: [],
  construction: undefined,
};

export const SCREENSHOT_SAMPLE_RULE_GROUP: RuleGroup = {
  logic: 'AND',
  conditions: [],
  extractions: [
    {
      id: 'ext-raw-1',
      varName: 'raw',
      nodeId: 'service-2',
      fieldPath: 'response.raw',
      extractionType: 'direct',
    },
    {
      id: 'ext-cmra-2',
      varName: 'has_cmra_indicator_tag',
      nodeId: 'service-2',
      fieldPath: 'response.raw',
      extractionType: 'contains_tag',
      sourceVarName: 'raw',
      tagValue: '<Z41:CMRAIndicator>N</Z41:CMRAIndicator>',
      targetStateKey: 'has_cmra_indicator_tag',
    },
    {
      id: 'ext-pbsa-3',
      varName: 'has_pbsa_indicator_tag',
      nodeId: 'service-2',
      fieldPath: 'response.raw',
      extractionType: 'contains_tag',
      sourceVarName: 'raw',
      tagValue: '<Z41:PBSAIndicator>N</Z41:PBSAIndicator>',
      targetStateKey: 'has_pbsa_indicator_tag',
    },
  ],
  construction: {
    resultVarName: 'gsa_bool',
    logic: 'AND',
    selectedVarNames: ['has_cmra_indicator_tag', 'has_pbsa_indicator_tag'],
    outputStateKey: 'GSA',
    trueValue: "'True'",
    falseValue: "'False'",
  },
};

/**
 * Helper to build safe nested dict getter python code string
 * e.g. nodeId = "service-2", fieldPath = "response.raw"
 * returns `(((state.get("service-2") or {}).get("response") or {}).get("raw") or "")`
 */
export function buildNestedGetterPy(nodeId: string, fieldPath: string): string {
  if (!fieldPath || fieldPath.trim() === '') {
    return `state.get("${nodeId}") or ""`;
  }
  const parts = fieldPath.split('.');
  let expr = `state.get("${nodeId}") or {}`;
  for (let i = 0; i < parts.length - 1; i++) {
    expr = `(${expr}).get("${parts[i]}") or {}`;
  }
  const lastPart = parts[parts.length - 1];
  return `((${expr}).get("${lastPart}") or "")`;
}

/**
 * Compiles a visual RuleGroup structure into executable Python code with node-scoped lookups.
 */
export function compileRuleGroupToPython(group: RuleGroup): string {
  if (!group) {
    return '# No visual rule conditions configured - passes by default\nresult = True\n';
  }

  const lines: string[] = [];

  // 1. Process Variable Extractions ("Variables Above")
  if (group.extractions && group.extractions.length > 0) {
    // Find first direct getter variable name as fallback (e.g. "raw")
    const firstDirectVar = group.extractions.find((e) => e.extractionType === 'direct')?.varName || 'raw';

    group.extractions.forEach((ext) => {
      if (ext.extractionType === 'direct') {
        const getter = buildNestedGetterPy(ext.nodeId, ext.fieldPath);
        lines.push(`${ext.varName} = ${getter}`);
      } else if (ext.extractionType === 'contains_tag') {
        const tag = ext.tagValue || '';
        const sourceVar = ext.sourceVarName || firstDirectVar;
        const targetState = ext.targetStateKey || ext.varName;
        lines.push(`state["${targetState}"] = "${tag}" in ${sourceVar}`);
      } else if (ext.extractionType === 'regex') {
        const pattern = ext.tagValue || '';
        const sourceVar = ext.sourceVarName || firstDirectVar;
        const targetState = ext.targetStateKey || ext.varName;
        lines.push(`import re`);
        lines.push(`state["${targetState}"] = bool(re.search(r"${pattern}", str(${sourceVar})))`);
      }
    });

    if (group.extractions.length > 0) {
      lines.push('');
    }
  }

  // 2. Process Output Construction ("Construction Below")
  if (group.construction && group.construction.selectedVarNames.length > 0) {
    const constr = group.construction;
    const joinOp = constr.logic === 'AND' ? ' and ' : ' or ';
    const terms = constr.selectedVarNames.map((v) => `state["${v}"]`);
    lines.push(`${constr.resultVarName} = ${terms.join(joinOp)}`);
    lines.push(`state["${constr.outputStateKey}"] = ${constr.trueValue} if ${constr.resultVarName} else ${constr.falseValue}`);
    lines.push(`result = ${constr.resultVarName}`);
    return lines.join('\n') + '\n';
  }


  // 3. Fallback to standard rule conditions if no extractions/construction
  if (group.conditions && group.conditions.length > 0) {
    const expressions: string[] = group.conditions.map((cond) => {
      let fieldExpr = `state.get("${cond.field}", None)`;
      if (cond.nodeId) {
        if (cond.nodeId === 'input') {
          fieldExpr = `state.get("input", {}).get("${cond.field}", state.get("${cond.field}", None))`;
        } else {
          fieldExpr = `state.get("${cond.nodeId}", {}).get("${cond.field}", None)`;
        }
      }

      if (cond.valueType === 'boolean') {
        const boolVal = cond.value ? 'True' : 'False';
        return `${fieldExpr} ${cond.operator} ${boolVal}`;
      }

      if (cond.valueType === 'select') {
        if (Array.isArray(cond.value)) {
          const pyList = `[${cond.value.map((v) => `'${v}'`).join(', ')}]`;
          return `${fieldExpr} ${cond.operator} ${pyList}`;
        }
        return `${fieldExpr} ${cond.operator} '${cond.value}'`;
      }

      if (cond.valueType === 'number') {
        const numVal = typeof cond.value === 'number' ? cond.value : parseFloat(cond.value) || 0;
        return `(float(${fieldExpr} or 0) ${cond.operator} ${numVal})`;
      }

      // String default
      return `str(${fieldExpr}) ${cond.operator} "${cond.value}"`;
    });

    const joinOperator = group.logic === 'AND' ? ' and \\\n    ' : ' or \\\n    ';
    const combinedBody = expressions.join(joinOperator);

    return `# Auto-generated Visual Node-Scoped Decision Rule\n# Evaluation Logic (${group.logic})\n\ndef evaluate_decision_rule(state):\n    return (\n        ${combinedBody}\n    )\n\nresult = evaluate_decision_rule(state)\n`;
  }

  if (lines.length > 0) {
    return lines.join('\n') + '\n';
  }

  return '# No visual rule conditions configured - passes by default\nresult = True\n';
}

/**
 * Parses Python script strings back into a structured RuleGroup representation.
 * Supports decompiling script constructs like the screenshot example.
 */
export function parsePythonToRuleGroup(script: string): RuleGroup {
  if (!script || !script.trim()) return DEFAULT_RULE_GROUP;

  const extractions: VariableExtraction[] = [];
  let construction: OutputConstruction | undefined = undefined;

  const lines = script.split('\n').map((l) => l.trim()).filter(Boolean);

  lines.forEach((line, index) => {
    // Match getter: e.g. raw = (((state.get("service-2") or {}).get("response") or {}).get("raw") or "")
    const getterMatch = line.match(/^([a-zA-Z0-9_]+)\s*=\s*(.*state\.get.*)/);
    if (getterMatch) {
      const varName = getterMatch[1];
      const rest = getterMatch[2];
      const nodeMatch = rest.match(/state\.get\(["']([^"']+)["']\)/);
      const nodeId = nodeMatch ? nodeMatch[1] : 'service-2';

      // extract last field
      const fieldMatches = Array.from(rest.matchAll(/\.get\(["']([^"']+)["']\)/g));
      const fields = fieldMatches.slice(1).map((m) => m[1]);
      const fieldPath = fields.length > 0 ? fields.join('.') : 'raw';

      extractions.push({
        id: `ext-parsed-${index}`,
        varName,
        nodeId,
        fieldPath,
        extractionType: 'direct',
      });
      return;
    }

    // Match tag presence: state["has_cmra_indicator_tag"] = "<Z41:CMRAIndicator>N</Z41:CMRAIndicator>" in raw
    const tagMatch = line.match(/^state\[["']([^"']+)["']\]\s*=\s*["']([^"']+)["']\s+in\s+([a-zA-Z0-9_]+)/);
    if (tagMatch) {
      const targetStateKey = tagMatch[1];
      const tagValue = tagMatch[2];
      const sourceVar = tagMatch[3];

      extractions.push({
        id: `ext-parsed-${index}`,
        varName: sourceVar,
        nodeId: 'service-2',
        fieldPath: 'response.raw',
        extractionType: 'contains_tag',
        tagValue,
        targetStateKey,
      });
      return;
    }

    // Match bool combination: gsa_bool = state["has_cmra_indicator_tag"] and state["has_pbsa_indicator_tag"]
    const boolMatch = line.match(/^([a-zA-Z0-9_]+)\s*=\s*(.*)/);
    if (boolMatch && !line.startsWith('state[') && !line.startsWith('result') && !line.startsWith('def') && !line.startsWith('#')) {
      const resultVarName = boolMatch[1];
      const expr = boolMatch[2];
      const isAnd = expr.includes(' and ');
      const isOr = expr.includes(' or ');
      const vars = Array.from(expr.matchAll(/state\[["']([^"']+)["']\]/g)).map((m) => m[1]);

      if (vars.length > 0) {
        construction = {
          resultVarName,
          logic: isOr ? 'OR' : 'AND',
          selectedVarNames: vars,
          outputStateKey: 'GSA',
          trueValue: "'True'",
          falseValue: "'False'",
        };
      }
      return;
    }

    // Match state output: state["GSA"] = 'True' if gsa_bool else 'False'
    const stateOutMatch = line.match(/^state\[["']([^"']+)["']\]\s*=\s*(['"][^'"]+['"]|True|False)\s+if\s+([a-zA-Z0-9_]+)\s+else\s+(['"][^'"]+['"]|True|False)/);
    if (stateOutMatch) {
      const outputStateKey = stateOutMatch[1];
      const trueValue = stateOutMatch[2];
      const resultVarName = stateOutMatch[3];
      const falseValue = stateOutMatch[4];

      if (construction) {
        construction.outputStateKey = outputStateKey;
        construction.trueValue = trueValue;
        construction.falseValue = falseValue;
        construction.resultVarName = resultVarName;
      } else {
        construction = {
          resultVarName,
          logic: 'AND',
          selectedVarNames: [],
          outputStateKey,
          trueValue,
          falseValue,
        };
      }
    }
  });

  if (extractions.length > 0 || construction) {
    return {
      logic: 'AND',
      conditions: [],
      extractions,
      construction,
    };
  }

  return DEFAULT_RULE_GROUP;
}

/**
 * Helper to safely extract nested node-scoped state values
 */
export function getNestedStateValue(state: Record<string, any>, field: string, nodeId?: string): any {
  if (!state) return undefined;

  if (nodeId) {
    if (nodeId === 'input') {
      if (state.input && field in state.input) return state.input[field];
      if (field in state) return state[field];
    }
    const nodeState = state[nodeId];
    if (nodeState && typeof nodeState === 'object') {
      if (field in nodeState) return nodeState[field];
      if (nodeState.response && typeof nodeState.response === 'object' && field in nodeState.response) {
        return nodeState.response[field];
      }
    }
  }

  // Direct fallback
  if (field in state) return state[field];
  return undefined;
}

/**
 * Client-side JS Evaluator for real-time "What-If" scenario simulation.
 */
export function evaluateRuleConditionInJS(cond: RuleCondition, state: Record<string, any>): boolean {
  const actualValue = getNestedStateValue(state, cond.field, cond.nodeId);

  if (cond.valueType === 'boolean') {
    const boolActual = Boolean(actualValue);
    const boolTarget = Boolean(cond.value);
    return cond.operator === '==' ? boolActual === boolTarget : boolActual !== boolTarget;
  }

  if (cond.valueType === 'number') {
    const numActual = typeof actualValue === 'number' ? actualValue : parseFloat(actualValue) || 0;
    const numTarget = typeof cond.value === 'number' ? cond.value : parseFloat(cond.value) || 0;

    switch (cond.operator) {
      case '==': return numActual === numTarget;
      case '!=': return numActual !== numTarget;
      case '>': return numActual > numTarget;
      case '>=': return numActual >= numTarget;
      case '<': return numActual < numTarget;
      case '<=': return numActual <= numTarget;
      default: return false;
    }
  }

  if (cond.valueType === 'select') {
    if (Array.isArray(cond.value)) {
      const isIncluded = cond.value.includes(String(actualValue));
      return cond.operator === 'in' ? isIncluded : !isIncluded;
    }
    return cond.operator === '==' ? String(actualValue) === String(cond.value) : String(actualValue) !== String(cond.value);
  }

  // String comparison
  const strActual = String(actualValue ?? '');
  const strTarget = String(cond.value ?? '');
  return cond.operator === '==' ? strActual === strTarget : strActual !== strTarget;
}

/**
 * Evaluates an entire RuleGroup in JS for What-If path highlighting.
 */
export function evaluateRuleGroupInJS(group: RuleGroup, state: Record<string, any>): boolean {
  if (!group) return true;

  // Handle variable extractions & construction if present
  if (group.extractions && group.extractions.length > 0 && group.construction) {
    const localVars: Record<string, any> = {};
    const stateFlags: Record<string, boolean> = {};

    group.extractions.forEach((ext) => {
      if (ext.extractionType === 'direct') {
        const val = getNestedStateValue(state, ext.fieldPath, ext.nodeId);
        localVars[ext.varName] = val ?? '';
      } else if (ext.extractionType === 'contains_tag') {
        const rawText = String(localVars[ext.varName] || getNestedStateValue(state, ext.fieldPath, ext.nodeId) || '');
        const hasTag = ext.tagValue ? rawText.includes(ext.tagValue) : false;
        if (ext.targetStateKey) {
          stateFlags[ext.targetStateKey] = hasTag;
        }
      }
    });

    const constr = group.construction;
    if (constr.selectedVarNames.length > 0) {
      const bools = constr.selectedVarNames.map((v) => Boolean(stateFlags[v]));
      const res = constr.logic === 'AND' ? bools.every(Boolean) : bools.some(Boolean);
      return res;
    }
  }

  if (!group.conditions || group.conditions.length === 0) return true;

  if (group.logic === 'AND') {
    return group.conditions.every((cond) => evaluateRuleConditionInJS(cond, state));
  } else {
    return group.conditions.some((cond) => evaluateRuleConditionInJS(cond, state));
  }
}


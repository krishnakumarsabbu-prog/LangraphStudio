/**
 * Client-side Business Rule Engine.
 *
 * Mirrors the backend rule engine (TenantNodePlatform/backend/rules/engine.py).
 * Produces and evaluates the JSON/DSL rule definition format. No eval(), no
 * arbitrary user code execution.
 */

export type RuleOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'GREATER_THAN_OR_EQUAL'
  | 'LESS_THAN_OR_EQUAL'
  | 'CONTAINS'
  | 'NOT_CONTAINS'
  | 'STARTS_WITH'
  | 'ENDS_WITH'
  | 'EXISTS'
  | 'NOT_EXISTS'
  | 'IS_EMPTY'
  | 'IS_NOT_EMPTY'
  | 'IN'
  | 'NOT_IN'
  | 'BETWEEN';

export type LogicalOperator = 'AND' | 'OR' | 'NOT';

export interface RuleConditionLeaf {
  field: string;
  operator: RuleOperator;
  value: unknown;
}

export interface RuleConditionGroup {
  operator: LogicalOperator;
  rules: RuleTreeNode[];
}

export type RuleTreeNode = RuleConditionLeaf | RuleConditionGroup;

export interface RuleDefinition {
  ruleSetId: string;
  schemaVersion: string;
  conditions: RuleConditionGroup;
  outcomes: { true: string; false: string };
  defaultOutcome: string;
}

export interface TraceStep {
  description: string;
  result: boolean;
  detail: string;
}

export interface TestResult {
  matched: boolean;
  outcome: string | null;
  evaluationTrace: TraceStep[];
  errors: string[];
}

export const OPERATOR_LABELS: Record<RuleOperator, string> = {
  EQUALS: 'Equals',
  NOT_EQUALS: 'Not Equals',
  GREATER_THAN: 'Greater Than',
  LESS_THAN: 'Less Than',
  GREATER_THAN_OR_EQUAL: 'Greater Than or Equal',
  LESS_THAN_OR_EQUAL: 'Less Than or Equal',
  CONTAINS: 'Contains',
  NOT_CONTAINS: 'Not Contains',
  STARTS_WITH: 'Starts With',
  ENDS_WITH: 'Ends With',
  EXISTS: 'Exists',
  NOT_EXISTS: 'Does Not Exist',
  IS_EMPTY: 'Is Empty',
  IS_NOT_EMPTY: 'Is Not Empty',
  IN: 'In',
  NOT_IN: 'Not In',
  BETWEEN: 'Between',
};

export const OPERATORS_REQUIRING_VALUE: RuleOperator[] = [
  'EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'LESS_THAN',
  'GREATER_THAN_OR_EQUAL', 'LESS_THAN_OR_EQUAL',
  'CONTAINS', 'NOT_CONTAINS', 'STARTS_WITH', 'ENDS_WITH',
  'IN', 'NOT_IN', 'BETWEEN',
];

export const STANDARD_OUTCOMES = [
  'APPROVE',
  'REJECT',
  'REVIEW',
  'REFER',
  'MANUAL REVIEW',
];

export const SCHEMA_VERSION = '1.0';

export function isRuleGroup(node: RuleTreeNode): node is RuleConditionGroup {
  return (node as RuleConditionGroup).rules !== undefined;
}

export function isRuleLeaf(node: RuleTreeNode): node is RuleConditionLeaf {
  return (node as RuleConditionLeaf).field !== undefined;
}

export function createDefaultRuleDefinition(): RuleDefinition {
  return {
    ruleSetId: `rule-${Date.now()}`,
    schemaVersion: SCHEMA_VERSION,
    conditions: {
      operator: 'AND',
      rules: [],
    },
    outcomes: { true: 'APPROVE', false: 'REVIEW' },
    defaultOutcome: 'REVIEW',
  };
}

export function createLeaf(field = '', operator: RuleOperator = 'EQUALS', value: unknown = ''): RuleConditionLeaf {
  return { field, operator, value };
}

export function createGroup(operator: LogicalOperator = 'AND', rules: RuleTreeNode[] = []): RuleConditionGroup {
  return { operator, rules };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateRuleDefinition(rule: Partial<RuleDefinition>): string[] {
  const errors: string[] = [];

  if (!rule || typeof rule !== 'object') {
    return ['Rule definition must be a JSON object.'];
  }

  if (!rule.ruleSetId || typeof rule.ruleSetId !== 'string') {
    errors.push("'ruleSetId' is required and must be a non-empty string.");
  }

  if ((rule.schemaVersion || SCHEMA_VERSION) !== SCHEMA_VERSION) {
    errors.push(`Unsupported schemaVersion '${rule.schemaVersion}'. Supported: '${SCHEMA_VERSION}'.`);
  }

  if (!rule.conditions) {
    errors.push("'conditions' is required.");
  } else {
    errors.push(...validateConditionNode(rule.conditions, 'conditions'));
  }

  if (rule.outcomes !== undefined) {
    if (typeof rule.outcomes !== 'object' || rule.outcomes === null) {
      errors.push("'outcomes' must be an object with 'true' and/or 'false' keys.");
    } else {
      for (const key of Object.keys(rule.outcomes)) {
        if (key !== 'true' && key !== 'false') {
          errors.push(`'outcomes' has unexpected key '${key}'. Only 'true' and 'false' are allowed.`);
        }
      }
    }
  }

  if (rule.defaultOutcome !== undefined && rule.defaultOutcome !== null && typeof rule.defaultOutcome !== 'string') {
    errors.push("'defaultOutcome' must be a string or null.");
  }

  return errors;
}

function validateConditionNode(node: unknown, path: string): string[] {
  const errors: string[] = [];

  if (!node || typeof node !== 'object') {
    return [`'${path}' must be a JSON object.`];
  }
  const n = node as Record<string, unknown>;

  if (n.field !== undefined && n.operator !== undefined && n.rules === undefined) {
    if (!n.field || typeof n.field !== 'string') {
      errors.push(`'${path}.field' is required and must be a non-empty string.`);
    }
    const validOps = new Set(Object.keys(OPERATOR_LABELS));
    if (!validOps.has(n.operator as string)) {
      errors.push(`'${path}.operator' must be one of: ${Array.from(validOps).sort().join(', ')}.`);
    }
    if (n.operator && !OPERATORS_REQUIRING_VALUE.includes(n.operator as RuleOperator)) {
      // no value needed
    } else if (n.value === undefined) {
      errors.push(`'${path}.value' is required for operator '${n.operator}'.`);
    } else if (n.operator === 'BETWEEN') {
      if (!Array.isArray(n.value) || n.value.length !== 2) {
        errors.push(`'${path}.value' for BETWEEN must be a two-element array [low, high].`);
      }
    } else if (n.operator === 'IN' || n.operator === 'NOT_IN') {
      if (!Array.isArray(n.value)) {
        errors.push(`'${path}.value' for ${n.operator} must be an array.`);
      }
    }
    return errors;
  }

  if (n.rules !== undefined) {
    const op = (n.operator as string) || 'AND';
    if (!['AND', 'OR', 'NOT'].includes(op)) {
      errors.push(`'${path}.operator' must be one of: AND, OR, NOT.`);
    }
    if (!Array.isArray(n.rules)) {
      errors.push(`'${path}.rules' must be an array.`);
      return errors;
    }
    if (op === 'NOT' && n.rules.length !== 1) {
      errors.push(`'${path}': NOT operator must have exactly one rule.`);
    }
    if (n.rules.length === 0) {
      errors.push(`'${path}.rules' must not be empty.`);
    }
    for (let i = 0; i < n.rules.length; i++) {
      errors.push(...validateConditionNode(n.rules[i], `${path}.rules[${i}]`));
    }
    return errors;
  }

  return [`'${path}' is neither a valid condition nor a group.`];
}

// ---------------------------------------------------------------------------
// Field resolution
// ---------------------------------------------------------------------------

const MISSING = Symbol('missing');

function resolveFieldValue(fieldPath: string, input: Record<string, unknown>): unknown {
  if (!fieldPath || typeof input !== 'object' || input === null) return MISSING;
  let current: Record<string, unknown> = input;
  for (const segment of fieldPath.split('.')) {
    if (current && typeof current === 'object' && segment in current) {
      current = current[segment];
    } else {
      return MISSING;
    }
  }
  return current;
}

// ---------------------------------------------------------------------------
// Operator evaluation
// ---------------------------------------------------------------------------

function isNumeric(v: unknown): boolean {
  return (typeof v === 'number' && !Number.isNaN(v)) || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)));
}

function coerceNumeric(v: unknown): number | null {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') {
    const n = Number(v);
    return isNaN(n) ? null : n;
  }
  return null;
}

function equals(actual: unknown, expected: unknown): boolean {
  if (isNumeric(actual) && isNumeric(expected)) {
    return Number(actual) === Number(expected);
  }
  return actual === expected;
}

export function resolveOperator(operator: string, actual: unknown, expected: unknown): [boolean, string] {
  const op = operator as RuleOperator;

  if (op === 'EXISTS') {
    const exists = actual !== MISSING;
    return [exists, `field exists = ${exists}`];
  }
  if (op === 'NOT_EXISTS') {
    const exists = actual !== MISSING;
    return [!exists, `field does not exist = ${!exists}`];
  }
  if (op === 'IS_EMPTY') {
    if (actual === MISSING) return [true, 'field missing -> empty'];
    if (actual === null) return [true, 'null -> empty'];
    if (typeof actual === 'string' || Array.isArray(actual) || (typeof actual === 'object' && actual !== null)) {
      return [actual.length === 0, `length ${actual.length}`];
    }
    return [false, `value present -> not empty`];
  }
  if (op === 'IS_NOT_EMPTY') {
    if (actual === MISSING) return [false, 'field missing -> not empty = false'];
    if (actual === null) return [false, 'null -> not empty = false'];
    if (typeof actual === 'string' || Array.isArray(actual)) {
      return [actual.length > 0, `length ${actual.length} > 0`];
    }
    if (typeof actual === 'object' && actual !== null) {
      return [Object.keys(actual).length > 0, `keys ${Object.keys(actual).length} > 0`];
    }
    return [true, `value present -> not empty`];
  }

  if (actual === MISSING) {
    if (op === 'NOT_EQUALS' || op === 'NOT_CONTAINS' || op === 'NOT_IN') {
      return [true, 'field missing -> inequality holds'];
    }
    return [false, 'field missing -> comparison false'];
  }

  if (op === 'EQUALS') {
    const r = equals(actual, expected);
    return [r, `${JSON.stringify(actual)} == ${JSON.stringify(expected)} -> ${r}`];
  }
  if (op === 'NOT_EQUALS') {
    const r = !equals(actual, expected);
    return [r, `${JSON.stringify(actual)} != ${JSON.stringify(expected)} -> ${r}`];
  }

  if (op === 'GREATER_THAN' || op === 'LESS_THAN' || op === 'GREATER_THAN_OR_EQUAL' || op === 'LESS_THAN_OR_EQUAL' || op === 'BETWEEN') {
    const a = coerceNumeric(actual);
    if (a === null) return [false, `actual ${JSON.stringify(actual)} is not numeric -> false`];

    if (op === 'BETWEEN') {
      if (!Array.isArray(expected) || expected.length !== 2) return [false, 'BETWEEN value must be [low, high]'];
      const low = coerceNumeric(expected[0]);
      const high = coerceNumeric(expected[1]);
      if (low === null || high === null) return [false, 'BETWEEN bounds not numeric'];
      const r = low <= a && a <= high;
      return [r, `${a} between [${low}, ${high}] -> ${r}`];
    }

    const e = coerceNumeric(expected);
    if (e === null) return [false, `expected ${JSON.stringify(expected)} is not numeric -> false`];

    let r = false;
    if (op === 'GREATER_THAN') r = a > e;
    else if (op === 'LESS_THAN') r = a < e;
    else if (op === 'GREATER_THAN_OR_EQUAL') r = a >= e;
    else r = a <= e;
    return [r, `${a} ${op} ${e} -> ${r}`];
  }

  if (op === 'CONTAINS') {
    if (typeof actual === 'string' && typeof expected === 'string') {
      const r = actual.includes(expected);
      return [r, `'${actual}' contains '${expected}' -> ${r}`];
    }
    if (Array.isArray(actual)) {
      const r = actual.includes(expected);
      return [r, `list contains ${JSON.stringify(expected)} -> ${r}`];
    }
    return [false, `cannot apply CONTAINS to ${typeof actual}`];
  }
  if (op === 'NOT_CONTAINS') {
    if (typeof actual === 'string' && typeof expected === 'string') {
      const r = !actual.includes(expected);
      return [r, `'${actual}' not contains '${expected}' -> ${r}`];
    }
    if (Array.isArray(actual)) {
      const r = !actual.includes(expected);
      return [r, `list not contains ${JSON.stringify(expected)} -> ${r}`];
    }
    return [true, `cannot apply NOT_CONTAINS -> true`];
  }
  if (op === 'STARTS_WITH') {
    if (typeof actual === 'string' && typeof expected === 'string') {
      const r = actual.startsWith(expected);
      return [r, `'${actual}' starts with '${expected}' -> ${r}`];
    }
    return [false, `cannot apply STARTS_WITH`];
  }
  if (op === 'ENDS_WITH') {
    if (typeof actual === 'string' && typeof expected === 'string') {
      const r = actual.endsWith(expected);
      return [r, `'${actual}' ends with '${expected}' -> ${r}`];
    }
    return [false, `cannot apply ENDS_WITH`];
  }
  if (op === 'IN') {
    if (Array.isArray(expected)) {
      const r = expected.includes(actual);
      return [r, `${JSON.stringify(actual)} in ${JSON.stringify(expected)} -> ${r}`];
    }
    return [false, 'IN value must be an array'];
  }
  if (op === 'NOT_IN') {
    if (Array.isArray(expected)) {
      const r = !expected.includes(actual);
      return [r, `${JSON.stringify(actual)} not in ${JSON.stringify(expected)} -> ${r}`];
    }
    return [false, 'NOT_IN value must be an array'];
  }

  return [false, `unknown operator '${op}'`];
}

// ---------------------------------------------------------------------------
// Condition tree evaluation
// ---------------------------------------------------------------------------

export function evaluateConditionGroup(
  node: RuleTreeNode,
  input: Record<string, unknown>,
  trace: TraceStep[],
  indent = 0,
): boolean {
  if (isRuleLeaf(node)) {
    const actual = resolveFieldValue(node.field, input);
    const [result, detail] = resolveOperator(node.operator, actual, node.value);
    const actualRepr = actual === MISSING ? 'MISSING' : JSON.stringify(actual);
    const desc = `${'  '.repeat(indent)}${node.field} ${node.operator} ${JSON.stringify(node.value)}` +
      (actual === MISSING ? `  [field='${node.field}' missing]` : `  [actual=${actualRepr}]`);
    trace.push({ description: desc, result, detail });
    return result;
  }

  const op = node.operator;
  if (op === 'NOT') {
    const childResult = evaluateConditionGroup(node.rules[0], input, trace, indent + 1);
    const result = !childResult;
    trace.push({ description: `${'  '.repeat(indent)}NOT -> ${result}`, result, detail: `negated ${childResult}` });
    return result;
  }

  const childResults = node.rules.map((r) => evaluateConditionGroup(r, input, trace, indent + 1));
  const result = op === 'AND' ? childResults.every(Boolean) : childResults.some(Boolean);
  trace.push({ description: `${'  '.repeat(indent)}${op} -> ${result}`, result, detail: `children: [${childResults.join(', ')}]` });
  return result;
}

export function evaluateRule(rule: RuleDefinition, input: Record<string, unknown>): boolean {
  if (!rule.conditions) return false;
  const trace: TraceStep[] = [];
  return evaluateConditionGroup(rule.conditions, input, trace);
}

export function testRule(rule: RuleDefinition, input: Record<string, unknown>): TestResult {
  const errors = validateRuleDefinition(rule);
  if (errors.length > 0) {
    return { matched: false, outcome: null, evaluationTrace: [], errors };
  }

  const trace: TraceStep[] = [];
  const matched = evaluateConditionGroup(rule.conditions, input, trace);
  const outcomes = rule.outcomes || { true: '', false: '' };
  let outcome: string | null = null;
  if (matched) outcome = outcomes.true ?? rule.defaultOutcome ?? null;
  else outcome = outcomes.false ?? rule.defaultOutcome ?? null;

  trace.push({
    description: `Final outcome -> ${outcome}`,
    result: matched,
    detail: `matched=${matched}, outcome=${outcome}`,
  });

  return { matched, outcome, evaluationTrace: trace, errors: [] };
}

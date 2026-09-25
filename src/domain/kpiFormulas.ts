import type { KPI, Parameter } from "./types";

export type KpiFormulaErrorCode =
  | "PMB-011"
  | "PMB-012"
  | "PMB-013"
  | "PMB-015"
  | "PMB-016"
  | "PMB-017";

export class KpiFormulaError extends Error {
  constructor(public readonly code: KpiFormulaErrorCode, message: string) {
    super(message);
    this.name = "KpiFormulaError";
  }
}

type Token =
  | { type: "number"; value: number }
  | { type: "identifier"; value: string }
  | { type: "string"; value: string }
  | { type: "operator"; value: "+" | "-" | "*" | "/" }
  | { type: "left" | "right" | "comma" | "end" };

export type KpiFormulaAst =
  | { type: "number"; value: number }
  | { type: "parameter"; id: string }
  | { type: "kpi"; id: string }
  | { type: "unary"; operand: KpiFormulaAst }
  | { type: "binary"; operator: "+" | "-" | "*" | "/"; left: KpiFormulaAst; right: KpiFormulaAst }
  | { type: "function"; name: "min" | "max" | "sum" | "average"; arguments: KpiFormulaAst[] };

export interface FormulaReferences {
  parameterIds: string[];
  kpiIds: string[];
}

export interface FormulaValue {
  value: number;
  unit: string;
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let position = 0;
  while (position < source.length) {
    const character = source[position];
    if (/\s/.test(character)) {
      position += 1;
      continue;
    }
    if (/[0-9.]/.test(character)) {
      const match = source.slice(position).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
      if (!match) throw new KpiFormulaError("PMB-011", `Invalid number at position ${position + 1}.`);
      const value = Number(match[0]);
      if (!Number.isFinite(value)) throw new KpiFormulaError("PMB-011", "Formula numbers must be finite.");
      tokens.push({ type: "number", value });
      position += match[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(character)) {
      const match = source.slice(position).match(/^[A-Za-z_][A-Za-z0-9_]*/);
      if (!match) throw new KpiFormulaError("PMB-011", `Invalid identifier at position ${position + 1}.`);
      tokens.push({ type: "identifier", value: match[0].toLowerCase() });
      position += match[0].length;
      continue;
    }
    if (character === "\"") {
      let value = "";
      position += 1;
      let closed = false;
      while (position < source.length) {
        if (source[position] === "\"") {
          closed = true;
          position += 1;
          break;
        }
        if (source[position] === "\\") {
          position += 1;
          const escaped = source[position];
          if (escaped !== "\"" && escaped !== "\\") {
            throw new KpiFormulaError("PMB-011", "Only quote and backslash escapes are supported in references.");
          }
          value += escaped;
          position += 1;
          continue;
        }
        value += source[position];
        position += 1;
      }
      if (!closed) throw new KpiFormulaError("PMB-011", "Unterminated reference string.");
      tokens.push({ type: "string", value });
      continue;
    }
    if ("+-*/".includes(character)) {
      tokens.push({ type: "operator", value: character as "+" | "-" | "*" | "/" });
      position += 1;
      continue;
    }
    if (character === "(") tokens.push({ type: "left" });
    else if (character === ")") tokens.push({ type: "right" });
    else if (character === ",") tokens.push({ type: "comma" });
    else throw new KpiFormulaError("PMB-011", `Unexpected character “${character}” at position ${position + 1}.`);
    position += 1;
  }
  tokens.push({ type: "end" });
  return tokens;
}

export function parseKpiFormula(source: string): KpiFormulaAst {
  if (!source.trim()) throw new KpiFormulaError("PMB-011", "A formula is required.");
  const tokens = tokenize(source);
  let cursor = 0;
  const peek = () => tokens[cursor];
  const take = () => tokens[cursor++];
  const expect = (type: Token["type"]) => {
    const token = take();
    if (token.type !== type) throw new KpiFormulaError("PMB-011", `Expected ${type}.`);
    return token;
  };

  const primary = (): KpiFormulaAst => {
    const token = take();
    if (token.type === "number") return { type: "number", value: token.value };
    if (token.type === "left") {
      const expression = addition();
      expect("right");
      return expression;
    }
    if (token.type !== "identifier") throw new KpiFormulaError("PMB-011", "Expected a number, reference, function, or parenthesized expression.");
    expect("left");
    if (token.value === "param" || token.value === "kpi") {
      const reference = take();
      if (reference.type !== "string") throw new KpiFormulaError("PMB-011", "Expected a quoted exact ID.");
      expect("right");
      return token.value === "param"
        ? { type: "parameter", id: reference.value }
        : { type: "kpi", id: reference.value };
    }
    if (!["min", "max", "sum", "average"].includes(token.value)) {
      throw new KpiFormulaError("PMB-011", `Unknown function “${token.value}”.`);
    }
    const args: KpiFormulaAst[] = [];
    if (peek().type !== "right") {
      args.push(addition());
      while (peek().type === "comma") {
        take();
        args.push(addition());
      }
    }
    expect("right");
    if (!args.length) throw new KpiFormulaError("PMB-011", `${token.value} requires at least one argument.`);
    return { type: "function", name: token.value as "min" | "max" | "sum" | "average", arguments: args };
  };
  const unary = (): KpiFormulaAst => {
    const token = peek();
    if (token.type === "operator" && token.value === "-") {
      take();
      return { type: "unary", operand: unary() };
    }
    return primary();
  };
  const multiplication = (): KpiFormulaAst => {
    let node = unary();
    while (peek().type === "operator" && ["*", "/"].includes((peek() as { value: string }).value)) {
      const operator = (take() as { value: "*" | "/" }).value;
      node = { type: "binary", operator, left: node, right: unary() };
    }
    return node;
  };
  const addition = (): KpiFormulaAst => {
    let node = multiplication();
    while (peek().type === "operator" && ["+", "-"].includes((peek() as { value: string }).value)) {
      const operator = (take() as { value: "+" | "-" }).value;
      node = { type: "binary", operator, left: node, right: multiplication() };
    }
    return node;
  };

  const ast = addition();
  if (peek().type !== "end") throw new KpiFormulaError("PMB-011", "Unexpected content after the formula.");
  return ast;
}

export function formulaReferences(ast: KpiFormulaAst): FormulaReferences {
  const parameterIds = new Set<string>();
  const kpiIds = new Set<string>();
  const visit = (node: KpiFormulaAst) => {
    if (node.type === "parameter") parameterIds.add(node.id);
    else if (node.type === "kpi") kpiIds.add(node.id);
    else if (node.type === "unary") visit(node.operand);
    else if (node.type === "binary") {
      visit(node.left);
      visit(node.right);
    } else if (node.type === "function") node.arguments.forEach(visit);
  };
  visit(ast);
  return { parameterIds: [...parameterIds], kpiIds: [...kpiIds] };
}

function equalUnits(values: FormulaValue[]): string {
  const unit = values[0]?.unit ?? "";
  if (values.some((value) => value.unit !== unit)) {
    throw new KpiFormulaError("PMB-016", "Addition and aggregation require exactly equal units.");
  }
  return unit;
}

function multiplyUnits(left: string, right: string): string {
  if (!left) return right;
  if (!right) return left;
  return `${left}*${right}`;
}

function divideUnits(left: string, right: string): string {
  if (!right) return left;
  return left ? `${left}/${right}` : `1/${right}`;
}

export function evaluateKpiFormula(
  ast: KpiFormulaAst,
  parameters: Map<string, Parameter>,
  kpiValues: Map<string, FormulaValue>
): FormulaValue {
  const evaluate = (node: KpiFormulaAst): FormulaValue => {
    if (node.type === "number") return { value: node.value, unit: "" };
    if (node.type === "parameter") {
      const parameter = parameters.get(node.id);
      if (!parameter) throw new KpiFormulaError("PMB-012", `Parameter “${node.id}” does not exist in the active model.`);
      if (typeof parameter.value !== "number" || !Number.isFinite(parameter.value)) {
        throw new KpiFormulaError("PMB-017", `Parameter “${node.id}” has no finite numeric value.`);
      }
      return { value: parameter.value, unit: parameter.unit?.trim() ?? "" };
    }
    if (node.type === "kpi") {
      const value = kpiValues.get(node.id);
      if (!value) throw new KpiFormulaError("PMB-013", `KPI “${node.id}” has no calculated value.`);
      return value;
    }
    if (node.type === "unary") {
      const value = evaluate(node.operand);
      return { ...value, value: -value.value };
    }
    if (node.type === "binary") {
      const left = evaluate(node.left);
      const right = evaluate(node.right);
      if (node.operator === "+" || node.operator === "-") {
        equalUnits([left, right]);
        return { value: node.operator === "+" ? left.value + right.value : left.value - right.value, unit: left.unit };
      }
      if (node.operator === "/" && right.value === 0) throw new KpiFormulaError("PMB-015", "Division by zero.");
      return {
        value: node.operator === "*" ? left.value * right.value : left.value / right.value,
        unit: node.operator === "*" ? multiplyUnits(left.unit, right.unit) : divideUnits(left.unit, right.unit)
      };
    }
    const values = node.arguments.map(evaluate);
    const unit = equalUnits(values);
    const numbers = values.map((value) => value.value);
    const value = node.name === "min" ? Math.min(...numbers)
      : node.name === "max" ? Math.max(...numbers)
        : node.name === "sum" ? numbers.reduce((total, item) => total + item, 0)
          : numbers.reduce((total, item) => total + item, 0) / numbers.length;
    return { value, unit };
  };
  return evaluate(ast);
}

export function kpiDependencyCycle(kpis: KPI[]): string[] | null {
  const byId = new Map(kpis.map((kpi) => [kpi.id, kpi]));
  const visited = new Set<string>();
  const active = new Set<string>();
  const trail: string[] = [];
  const visit = (id: string): string[] | null => {
    if (active.has(id)) return [...trail.slice(trail.indexOf(id)), id];
    if (visited.has(id)) return null;
    visited.add(id);
    active.add(id);
    trail.push(id);
    for (const dependency of byId.get(id)?.dependsOnKpiIds ?? []) {
      if (!byId.has(dependency)) continue;
      const cycle = visit(dependency);
      if (cycle) return cycle;
    }
    trail.pop();
    active.delete(id);
    return null;
  };
  for (const kpi of kpis) {
    const cycle = visit(kpi.id);
    if (cycle) return cycle;
  }
  return null;
}

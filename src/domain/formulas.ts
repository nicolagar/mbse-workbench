import type { FormulaBinding, ModelElement, Project, RequirementFormula } from "./types";
import { dimensionKey, parseUnit } from "./units";

type Dimension = Record<string, number>;
interface Quantity {
  value: number;
  dimension: Dimension;
  literal: boolean;
  preferredScale: number;
}
type Token =
  | { type: "number"; value: number }
  | { type: "reference"; value: string }
  | { type: "operator"; value: string }
  | { type: "left" | "right" | "end" };

export interface RequirementEvaluation {
  status: "satisfied" | "failed" | "pending" | "error" | "notDefined";
  message: string;
  expression?: string;
  referencedIds: string[];
}

const cleanDimension = (dimension: Dimension): Dimension =>
  Object.fromEntries(Object.entries(dimension).filter(([, exponent]) => Math.abs(exponent) > 1e-12));

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < expression.length) {
    const rest = expression.slice(index);
    const whitespace = rest.match(/^\s+/);
    if (whitespace) {
      index += whitespace[0].length;
      continue;
    }
    const reference = rest.match(/^@([A-Za-z_][A-Za-z0-9_]*)/);
    if (reference) {
      tokens.push({ type: "reference", value: reference[1] });
      index += reference[0].length;
      continue;
    }
    const number = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
    if (number) {
      tokens.push({ type: "number", value: Number(number[0]) });
      index += number[0].length;
      continue;
    }
    const comparison = rest.match(/^(<=|>=|==|!=|<|>|=)/);
    if (comparison) {
      tokens.push({ type: "operator", value: comparison[1] });
      index += comparison[1].length;
      continue;
    }
    const character = rest[0];
    if ("+-*/".includes(character)) tokens.push({ type: "operator", value: character });
    else if (character === "(") tokens.push({ type: "left" });
    else if (character === ")") tokens.push({ type: "right" });
    else throw new Error(`Unexpected token near “${rest.slice(0, 12)}”. Use @symbols for references.`);
    index += 1;
  }
  tokens.push({ type: "end" });
  return tokens;
}

class Parser {
  private position = 0;
  constructor(private readonly tokens: Token[], private readonly values: Map<string, Quantity>) {}

  parse(): boolean {
    const left = this.additive();
    const token = this.peek();
    if (token.type !== "operator" || !["<", "<=", ">", ">=", "=", "==", "!="].includes(token.value)) {
      throw new Error("A requirement formula must contain a comparison.");
    }
    this.position += 1;
    const right = this.additive();
    if (this.peek().type !== "end") throw new Error("Unexpected content after the comparison.");
    const [leftValue, rightValue] = comparable(left, right);
    switch (token.value) {
      case "<": return leftValue < rightValue;
      case "<=": return leftValue <= rightValue;
      case ">": return leftValue > rightValue;
      case ">=": return leftValue >= rightValue;
      case "!=": return Math.abs(leftValue - rightValue) > 1e-9;
      default: return Math.abs(leftValue - rightValue) <= Math.max(1, Math.abs(leftValue), Math.abs(rightValue)) * 1e-9;
    }
  }

  private additive(): Quantity {
    let value = this.multiplicative();
    while (this.peek().type === "operator" && ["+", "-"].includes((this.peek() as { value: string }).value)) {
      const operator = (this.tokens[this.position++] as { value: string }).value;
      const right = this.multiplicative();
      const [leftValue, rightValue, dimension, preferredScale] = addable(value, right);
      value = {
        value: operator === "+" ? leftValue + rightValue : leftValue - rightValue,
        dimension,
        literal: value.literal && right.literal,
        preferredScale
      };
    }
    return value;
  }

  private multiplicative(): Quantity {
    let value = this.unary();
    while (this.peek().type === "operator" && ["*", "/"].includes((this.peek() as { value: string }).value)) {
      const operator = (this.tokens[this.position++] as { value: string }).value;
      const right = this.unary();
      const multiplier = operator === "*" ? 1 : -1;
      const dimension = { ...value.dimension };
      for (const [key, exponent] of Object.entries(right.dimension)) {
        dimension[key] = (dimension[key] ?? 0) + exponent * multiplier;
      }
      if (operator === "/" && right.value === 0) throw new Error("Division by zero.");
      value = {
        value: operator === "*" ? value.value * right.value : value.value / right.value,
        dimension: cleanDimension(dimension),
        literal: value.literal && right.literal,
        preferredScale: operator === "*" ? value.preferredScale * right.preferredScale : value.preferredScale / right.preferredScale
      };
    }
    return value;
  }

  private unary(): Quantity {
    const token = this.peek();
    if (token.type === "operator" && ["+", "-"].includes(token.value)) {
      this.position += 1;
      const value = this.unary();
      return { ...value, value: token.value === "-" ? -value.value : value.value };
    }
    return this.primary();
  }

  private primary(): Quantity {
    const token = this.tokens[this.position++];
    if (token.type === "number") return { value: token.value, dimension: {}, literal: true, preferredScale: 1 };
    if (token.type === "reference") {
      const value = this.values.get(token.value);
      if (!value) throw new Error(`No value is bound to @${token.value}.`);
      return value;
    }
    if (token.type === "left") {
      const value = this.additive();
      if (this.tokens[this.position++].type !== "right") throw new Error("A closing parenthesis is missing.");
      return value;
    }
    throw new Error("A number, reference, or parenthesized expression was expected.");
  }

  private peek(): Token {
    return this.tokens[this.position];
  }
}

function comparable(left: Quantity, right: Quantity): [number, number] {
  if (left.literal && !right.literal) return [left.value * right.preferredScale, right.value];
  if (!left.literal && right.literal) return [left.value, right.value * left.preferredScale];
  if (dimensionKey(left.dimension) !== dimensionKey(right.dimension)) {
    throw new Error("The comparison uses incompatible units.");
  }
  return [left.value, right.value];
}

function addable(left: Quantity, right: Quantity): [number, number, Dimension, number] {
  if (left.literal && !right.literal) {
    return [left.value * right.preferredScale, right.value, right.dimension, right.preferredScale];
  }
  if (!left.literal && right.literal) {
    return [left.value, right.value * left.preferredScale, left.dimension, left.preferredScale];
  }
  if (dimensionKey(left.dimension) !== dimensionKey(right.dimension)) {
    throw new Error("Addition or subtraction uses incompatible units.");
  }
  return [left.value, right.value, left.dimension, left.preferredScale];
}

function resolveBinding(project: Project, binding: FormulaBinding, authoredUnit?: string): { quantity?: Quantity; pending?: string; error?: string } {
  if (binding.kind === "parameter") {
    const parameter = project.elements.flatMap((element) => element.parameters).find((item) => item.id === binding.targetId);
    if (!parameter) return { error: `The parameter bound to @${binding.symbol} no longer exists.` };
    if (parameter.value === null || parameter.value === "") return { pending: `@${binding.symbol} has no value.` };
    if (typeof parameter.value !== "number" || !Number.isFinite(parameter.value)) return { error: `@${binding.symbol} is not numeric.` };
    try {
      const unit = parseUnit(parameter.unit, project.unitDefinitions);
      if (authoredUnit !== undefined && dimensionKey(unit.dimension) !== dimensionKey(parseUnit(authoredUnit, project.unitDefinitions).dimension)) return { error: `@${binding.symbol} no longer has the dimension of its authored unit ${authoredUnit}.` };
      return {
        quantity: {
          value: parameter.value * unit.factor,
          dimension: unit.dimension,
          literal: false,
          preferredScale: authoredUnit === undefined ? unit.factor : parseUnit(authoredUnit, project.unitDefinitions).factor
        }
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "The parameter unit is invalid." };
    }
  }
  const kpi = project.kpis.find((item) => item.id === binding.targetId);
  if (!kpi) return { error: `The KPI bound to @${binding.symbol} no longer exists.` };
  if (kpi.lastCalculatedValue === undefined || kpi.lastCalculatedValue === null) {
    return { pending: `@${binding.symbol} is awaiting a Stage-B KPI result.` };
  }
  try {
    const unit = parseUnit(kpi.outputUnit, project.unitDefinitions);
    if (authoredUnit !== undefined && dimensionKey(unit.dimension) !== dimensionKey(parseUnit(authoredUnit, project.unitDefinitions).dimension)) return { error: `@${binding.symbol} no longer has the dimension of its authored unit ${authoredUnit}.` };
    return {
      quantity: {
        value: kpi.lastCalculatedValue * unit.factor,
        dimension: unit.dimension,
        literal: false,
        preferredScale: authoredUnit === undefined ? unit.factor : parseUnit(authoredUnit, project.unitDefinitions).factor
      }
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The KPI unit is invalid." };
  }
}

export function evaluateFormula(project: Project, formula: RequirementFormula): RequirementEvaluation {
  const expression = formula.expression.trim();
  const referencedIds = formula.bindings.map((binding) => binding.targetId);
  if (!expression) return { status: "notDefined", message: "No formula is defined.", referencedIds };
  const expressionSymbols = [...expression.matchAll(/@([A-Za-z_][A-Za-z0-9_]*)/g)].map((match) => match[1]);
  const boundSymbols = new Set(formula.bindings.map((binding) => binding.symbol));
  const unassigned = [...new Set(expressionSymbols.filter((symbol) => !boundSymbols.has(symbol)))];
  if (unassigned.length) {
    return {
      status: "pending",
      message: `Assign ${unassigned.map((symbol) => `@${symbol}`).join(", ")} to a parameter or KPI before validation.`,
      expression,
      referencedIds
    };
  }
  const symbols = new Set<string>();
  const values = new Map<string, Quantity>();
  for (const binding of formula.bindings) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(binding.symbol)) {
      return { status: "error", message: `“${binding.symbol}” is not a valid formula symbol.`, expression, referencedIds };
    }
    if (symbols.has(binding.symbol)) {
      return { status: "error", message: `@${binding.symbol} is bound more than once.`, expression, referencedIds };
    }
    symbols.add(binding.symbol);
    const resolved = resolveBinding(project, binding, formula.bindingUnits?.[binding.symbol]);
    if (resolved.error) return { status: "error", message: resolved.error, expression, referencedIds };
    if (resolved.pending) return { status: "pending", message: resolved.pending, expression, referencedIds };
    values.set(binding.symbol, resolved.quantity!);
  }
  try {
    const satisfied = new Parser(tokenize(expression), values).parse();
    return {
      status: satisfied ? "satisfied" : "failed",
      message: satisfied ? "The requirement formula is satisfied." : "The requirement formula evaluated to false.",
      expression,
      referencedIds
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "The formula could not be evaluated.",
      expression,
      referencedIds
    };
  }
}

export function evaluateRequirement(project: Project, requirement: ModelElement): RequirementEvaluation {
  if (requirement.elementType !== "systemRequirement" || !requirement.requirementFormula) {
    return { status: "notDefined", message: "No formula is defined.", referencedIds: [] };
  }
  return evaluateFormula(project, requirement.requirementFormula);
}

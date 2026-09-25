import type { FormulaBinding, Parameter, Project } from "./types";
import { dimensionKey, formatDimension, parseUnit } from "./units";

interface Quantity {
  value: number;
  dimension: Record<string, number>;
  literal: boolean;
}

type Token =
  | { type: "number"; value: number }
  | { type: "reference" | "identifier" | "operator"; value: string }
  | { type: "left" | "right" | "end" };

export interface ParameterCalculationResult {
  status: "calculated" | "pending" | "error";
  message: string;
  value: number | null;
  unit?: string;
  referencedIds: string[];
}

const cleanDimension = (dimension: Record<string, number>) =>
  Object.fromEntries(Object.entries(dimension).filter(([, exponent]) => Math.abs(exponent) > 1e-10));

function tokenize(expression: string): Token[] {
  expression = expression.replace(/²/g, "^2").replace(/³/g, "^3").replace(/⁻/g, "-");
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
    const identifier = rest.match(/^([A-Za-z_][A-Za-z0-9_]*)/);
    if (identifier) {
      tokens.push({ type: "identifier", value: identifier[1] });
      index += identifier[0].length;
      continue;
    }
    const power = rest.match(/^(\*\*|\^)/);
    if (power) {
      tokens.push({ type: "operator", value: "^" });
      index += power[0].length;
      continue;
    }
    const character = rest[0];
    if ("+-*/".includes(character)) tokens.push({ type: "operator", value: character });
    else if (character === "(") tokens.push({ type: "left" });
    else if (character === ")") tokens.push({ type: "right" });
    else throw new Error(`Unexpected token near “${rest.slice(0, 12)}”. Use @symbols for parameter references.`);
    index += 1;
  }
  tokens.push({ type: "end" });
  return tokens;
}

class ArithmeticParser {
  private position = 0;
  constructor(private readonly tokens: Token[], private readonly values: Map<string, Quantity>) {}

  parse(): Quantity {
    const result = this.additive();
    if (this.peek().type !== "end") throw new Error("Unexpected content after the expression.");
    if (!Number.isFinite(result.value)) throw new Error("The formula result is not finite.");
    return result;
  }

  private additive(): Quantity {
    let left = this.multiplicative();
    while (this.peek().type === "operator" && ["+", "-"].includes((this.peek() as { value: string }).value)) {
      const operator = (this.tokens[this.position++] as { value: string }).value;
      const right = this.multiplicative();
      if (dimensionKey(left.dimension) !== dimensionKey(right.dimension)) {
        if (left.literal && dimensionKey(left.dimension) === "") left = { ...left, value: left.value, dimension: right.dimension };
        else if (right.literal && dimensionKey(right.dimension) === "") right.dimension = left.dimension;
        else throw new Error("Addition or subtraction uses incompatible units.");
      }
      left = {
        value: operator === "+" ? left.value + right.value : left.value - right.value,
        dimension: left.dimension,
        literal: left.literal && right.literal
      };
    }
    return left;
  }

  private multiplicative(): Quantity {
    let left = this.power();
    while (this.peek().type === "operator" && ["*", "/"].includes((this.peek() as { value: string }).value)) {
      const operator = (this.tokens[this.position++] as { value: string }).value;
      const right = this.power();
      if (operator === "/" && right.value === 0) throw new Error("Division by zero.");
      const dimension = { ...left.dimension };
      Object.entries(right.dimension).forEach(([key, exponent]) => {
        dimension[key] = (dimension[key] ?? 0) + (operator === "*" ? exponent : -exponent);
      });
      left = {
        value: operator === "*" ? left.value * right.value : left.value / right.value,
        dimension: cleanDimension(dimension),
        literal: left.literal && right.literal
      };
    }
    return left;
  }

  private power(): Quantity {
    const base = this.unary();
    if (this.peek().type !== "operator" || (this.peek() as { value: string }).value !== "^") return base;
    this.position += 1;
    const exponent = this.power();
    if (dimensionKey(exponent.dimension) !== "") throw new Error("An exponent must be dimensionless.");
    const dimension = Object.fromEntries(Object.entries(base.dimension).map(([key, value]) => [key, value * exponent.value]));
    return {
      value: base.value ** exponent.value,
      dimension: cleanDimension(dimension),
      literal: base.literal
    };
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
    if (token.type === "number") return { value: token.value, dimension: {}, literal: true };
    if (token.type === "reference") {
      const value = this.values.get(token.value);
      if (!value) throw new Error(`No value is bound to @${token.value}.`);
      return { ...value };
    }
    if (token.type === "identifier" && token.value.toLowerCase() === "sqrt") {
      if (this.tokens[this.position++].type !== "left") throw new Error("sqrt must be followed by parentheses.");
      const value = this.additive();
      if (this.tokens[this.position++].type !== "right") throw new Error("A closing parenthesis is missing.");
      if (value.value < 0) throw new Error("sqrt cannot evaluate a negative value.");
      return {
        value: Math.sqrt(value.value),
        dimension: cleanDimension(Object.fromEntries(Object.entries(value.dimension).map(([key, exponent]) => [key, exponent / 2]))),
        literal: value.literal
      };
    }
    if (token.type === "left") {
      const value = this.additive();
      if (this.tokens[this.position++].type !== "right") throw new Error("A closing parenthesis is missing.");
      return value;
    }
    throw new Error("A number, parameter reference, sqrt expression or parenthesized expression was expected.");
  }

  private peek() {
    return this.tokens[this.position];
  }
}

function refinementScope(project: Project, ownerElementId: string): Set<string> {
  const result = new Set([ownerElementId]);
  const visit = (parentId: string) => {
    project.relationships
      .filter((relationship) => relationship.relationshipType === "refines" && relationship.targetId === parentId)
      .forEach((relationship) => {
        if (!result.has(relationship.sourceId)) {
          result.add(relationship.sourceId);
          visit(relationship.sourceId);
        }
      });
  };
  visit(ownerElementId);
  return result;
}

export function allowedCalculatedParameterIds(project: Project, ownerElementId: string): Set<string> {
  const owners = refinementScope(project, ownerElementId);
  return new Set(
    project.elements
      .filter((element) => owners.has(element.id))
      .flatMap((element) => element.parameters.map((parameter) => parameter.id))
  );
}

function expressionSymbols(expression: string) {
  return [...new Set([...expression.matchAll(/@([A-Za-z_][A-Za-z0-9_]*)/g)].map((match) => match[1]))];
}

function bindingMap(bindings: FormulaBinding[]) {
  const map = new Map<string, FormulaBinding>();
  bindings.forEach((binding) => map.set(binding.symbol, binding));
  return map;
}

export function recalculateCalculatedParameters(project: Project): Project {
  const parameters = new Map<string, { parameter: Parameter; ownerId: string }>();
  project.elements.forEach((element) => element.parameters.forEach((parameter) => {
    parameters.set(parameter.id, { parameter, ownerId: element.id });
  }));
  const memo = new Map<string, ParameterCalculationResult>();

  const evaluate = (parameterId: string, stack: string[]): ParameterCalculationResult => {
    const cached = memo.get(parameterId);
    if (cached) return cached;
    const located = parameters.get(parameterId);
    if (!located) return { status: "error", message: "The calculated parameter no longer exists.", value: null, referencedIds: [] };
    const { parameter, ownerId } = located;
    const calculation = parameter.calculation;
    if (!calculation) {
      if (typeof parameter.value !== "number" || !Number.isFinite(parameter.value)) {
        return { status: "pending", message: `${parameter.name} has no numeric value.`, value: null, unit: parameter.unit, referencedIds: [] };
      }
      return { status: "calculated", message: "Entered parameter value is available.", value: parameter.value, unit: parameter.unit, referencedIds: [] };
    }
    if (stack.includes(parameterId)) {
      const result: ParameterCalculationResult = {
        status: "error",
        message: `Calculated-parameter cycle: ${[...stack, parameterId].join(" → ")}.`,
        value: null,
        unit: calculation.requestedUnit,
        referencedIds: calculation.bindings.map((binding) => binding.targetId)
      };
      memo.set(parameterId, result);
      return result;
    }
    if (!calculation.expression.trim()) {
      const result: ParameterCalculationResult = { status: "pending", message: "Enter a calculation formula.", value: null, unit: calculation.requestedUnit, referencedIds: [] };
      memo.set(parameterId, result);
      return result;
    }
    const bySymbol = bindingMap(calculation.bindings);
    const unassigned = expressionSymbols(calculation.expression).filter((symbol) => !bySymbol.has(symbol));
    if (unassigned.length) {
      const result: ParameterCalculationResult = {
        status: "pending",
        message: `Assign ${unassigned.map((symbol) => `@${symbol}`).join(", ")} to a parameter.`,
        value: null,
        unit: calculation.requestedUnit,
        referencedIds: calculation.bindings.map((binding) => binding.targetId)
      };
      memo.set(parameterId, result);
      return result;
    }
    const allowed = allowedCalculatedParameterIds(project, ownerId);
    const values = new Map<string, Quantity>();
    for (const binding of calculation.bindings) {
      if (binding.kind !== "parameter") {
        const result: ParameterCalculationResult = { status: "error", message: "Calculated parameters may reference parameters only.", value: null, referencedIds: [] };
        memo.set(parameterId, result);
        return result;
      }
      if (!allowed.has(binding.targetId)) {
        const result: ParameterCalculationResult = {
          status: "error",
          message: `@${binding.symbol} is outside the owner’s refinement hierarchy.`,
          value: null,
          referencedIds: calculation.bindings.map((item) => item.targetId)
        };
        memo.set(parameterId, result);
        return result;
      }
      const input = parameters.get(binding.targetId);
      if (!input) {
        const result: ParameterCalculationResult = { status: "error", message: `The parameter bound to @${binding.symbol} no longer exists.`, value: null, referencedIds: [] };
        memo.set(parameterId, result);
        return result;
      }
      const inputResult = evaluate(binding.targetId, [...stack, parameterId]);
      if (inputResult.status !== "calculated" || inputResult.value === null) {
        const result: ParameterCalculationResult = {
          status: inputResult.status,
          message: `@${binding.symbol}: ${inputResult.message}`,
          value: null,
          unit: calculation.requestedUnit,
          referencedIds: calculation.bindings.map((item) => item.targetId)
        };
        memo.set(parameterId, result);
        return result;
      }
      try {
        const parsed = parseUnit(inputResult.unit, project.unitDefinitions);
        values.set(binding.symbol, {
          value: inputResult.value * parsed.factor,
          dimension: parsed.dimension,
          literal: false
        });
      } catch (error) {
        const result: ParameterCalculationResult = {
          status: "error",
          message: error instanceof Error ? error.message : "An input unit is invalid.",
          value: null,
          referencedIds: calculation.bindings.map((item) => item.targetId)
        };
        memo.set(parameterId, result);
        return result;
      }
    }
    try {
      const quantity = new ArithmeticParser(tokenize(calculation.expression), values).parse();
      const inferredUnit = formatDimension(quantity.dimension);
      const output = calculation.requestedUnit?.trim()
        ? parseUnit(calculation.requestedUnit, project.unitDefinitions)
        : { dimension: quantity.dimension, factor: 1 };
      if (dimensionKey(output.dimension) !== dimensionKey(quantity.dimension)) {
        throw new Error(`Requested unit “${calculation.requestedUnit}” is incompatible with inferred unit “${inferredUnit}”.`);
      }
      const result: ParameterCalculationResult = {
        status: "calculated",
        message: `Calculated successfully with inferred dimension ${inferredUnit}.`,
        value: quantity.value / output.factor,
        unit: calculation.requestedUnit?.trim() || inferredUnit,
        referencedIds: calculation.bindings.map((binding) => binding.targetId)
      };
      memo.set(parameterId, result);
      return result;
    } catch (error) {
      const result: ParameterCalculationResult = {
        status: "error",
        message: error instanceof Error ? error.message : "The calculated-parameter formula is invalid.",
        value: null,
        unit: calculation.requestedUnit,
        referencedIds: calculation.bindings.map((binding) => binding.targetId)
      };
      memo.set(parameterId, result);
      return result;
    }
  };

  parameters.forEach(({ parameter }) => {
    if (parameter.calculation) evaluate(parameter.id, []);
  });

  return {
    ...project,
    elements: project.elements.map((element) => ({
      ...element,
      parameters: element.parameters.map((parameter) => {
        if (!parameter.calculation) return parameter;
        const result = memo.get(parameter.id) ?? evaluate(parameter.id, []);
        return {
          ...parameter,
          valueOrigin: "calculated",
          value: result.value,
          unit: result.unit,
          inferredUnit: result.unit,
          calculationStatus: result.status,
          calculationMessage: result.message
        };
      })
    }))
  };
}

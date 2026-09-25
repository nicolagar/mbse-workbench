import type { Feature } from "./types";

export type FeatureExpressionNode =
  | { type: "feature"; id: string }
  | { type: "not"; operand: FeatureExpressionNode }
  | { type: "and" | "or"; left: FeatureExpressionNode; right: FeatureExpressionNode };

export type FeatureExpressionToken =
  | { type: "feature"; value: string }
  | { type: "and" | "or" | "not" | "leftParen" | "rightParen"; value: string };

export interface ParsedFeatureExpression {
  ast?: FeatureExpressionNode;
  tokens: FeatureExpressionToken[];
  featureIds: string[];
}

export class FeatureExpressionError extends Error {
  constructor(message: string, public readonly kind: "syntax" | "unknownFeature") {
    super(message);
  }
}

export function tokenizeFeatureExpression(expression: string): FeatureExpressionToken[] {
  const tokens: FeatureExpressionToken[] = [];
  let index = 0;
  while (index < expression.length) {
    const character = expression[index];
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (character === "(") {
      tokens.push({ type: "leftParen", value: character });
      index += 1;
      continue;
    }
    if (character === ")") {
      tokens.push({ type: "rightParen", value: character });
      index += 1;
      continue;
    }
    const start = index;
    while (index < expression.length && !/[\s()]/.test(expression[index])) index += 1;
    const value = expression.slice(start, index);
    const operator = value.toLowerCase();
    if (operator === "and" || operator === "or" || operator === "not") {
      tokens.push({ type: operator, value });
    } else {
      tokens.push({ type: "feature", value });
    }
  }
  return tokens;
}

export function parseFeatureExpression(
  expression: string,
  knownFeatures?: Pick<Feature, "id">[]
): ParsedFeatureExpression {
  if (!expression.trim()) return { tokens: [], featureIds: [] };
  const tokens = tokenizeFeatureExpression(expression);
  let index = 0;
  const peek = () => tokens[index];
  const consume = () => tokens[index++];

  const primary = (): FeatureExpressionNode => {
    const token = consume();
    if (!token) throw new FeatureExpressionError("The expression ends before an operand.", "syntax");
    if (token.type === "feature") return { type: "feature", id: token.value };
    if (token.type === "leftParen") {
      const value = orExpression();
      if (consume()?.type !== "rightParen") {
        throw new FeatureExpressionError("A closing parenthesis is missing.", "syntax");
      }
      return value;
    }
    throw new FeatureExpressionError(`Expected a feature ID but found “${token.value}”.`, "syntax");
  };
  const notExpression = (): FeatureExpressionNode =>
    peek()?.type === "not"
      ? (consume(), { type: "not", operand: notExpression() })
      : primary();
  const andExpression = (): FeatureExpressionNode => {
    let left = notExpression();
    while (peek()?.type === "and") {
      consume();
      left = { type: "and", left, right: notExpression() };
    }
    return left;
  };
  const orExpression = (): FeatureExpressionNode => {
    let left = andExpression();
    while (peek()?.type === "or") {
      consume();
      left = { type: "or", left, right: andExpression() };
    }
    return left;
  };

  const ast = orExpression();
  if (index !== tokens.length) {
    throw new FeatureExpressionError(`Unexpected token “${tokens[index].value}”.`, "syntax");
  }
  const featureIds = [...new Set(tokens.filter((token) => token.type === "feature").map((token) => token.value))];
  if (knownFeatures) {
    const knownIds = new Set(knownFeatures.map((feature) => feature.id));
    const unknown = featureIds.filter((id) => !knownIds.has(id));
    if (unknown.length) {
      throw new FeatureExpressionError(`Unknown feature ID${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}.`, "unknownFeature");
    }
  }
  return { ast, tokens, featureIds };
}

export function evaluateFeatureExpressionAst(
  node: FeatureExpressionNode,
  selectedFeatureIds: ReadonlySet<string>
): boolean {
  if (node.type === "feature") return selectedFeatureIds.has(node.id);
  if (node.type === "not") return !evaluateFeatureExpressionAst(node.operand, selectedFeatureIds);
  if (node.type === "and") {
    return evaluateFeatureExpressionAst(node.left, selectedFeatureIds)
      && evaluateFeatureExpressionAst(node.right, selectedFeatureIds);
  }
  return evaluateFeatureExpressionAst(node.left, selectedFeatureIds)
    || evaluateFeatureExpressionAst(node.right, selectedFeatureIds);
}

export function evaluateFeatureExpression(
  expression: string,
  selectedFeatureIds: Iterable<string>,
  knownFeatures: Pick<Feature, "id">[]
): boolean {
  const parsed = parseFeatureExpression(expression, knownFeatures);
  return parsed.ast
    ? evaluateFeatureExpressionAst(parsed.ast, new Set(selectedFeatureIds))
    : true;
}

export function featureExpressionSummary(node: FeatureExpressionNode | undefined, names: Map<string, string>): string {
  if (!node) return "Common to every valid configuration.";
  if (node.type === "feature") return names.get(node.id) ?? node.id;
  if (node.type === "not") return `not (${featureExpressionSummary(node.operand, names)})`;
  return `(${featureExpressionSummary(node.left, names)}) ${node.type.toUpperCase()} (${featureExpressionSummary(node.right, names)})`;
}

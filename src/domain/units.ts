import type { UnitDefinition } from "./types";

export interface ParsedUnit {
  dimension: Record<string, number>;
  factor: number;
}

const unit = (
  id: string,
  symbol: string,
  name: string,
  quantityName: string,
  dimension: Record<string, number>,
  factorToSI: number,
  isoReference?: string,
  aliases: string[] = []
): UnitDefinition => ({ id, symbol, name, quantityName, dimension, factorToSI, aliases, isoReference });

/**
 * Practical Stage-A catalogue aligned with the quantity and SI conventions used
 * by ISO 80000. It is deliberately described as aligned, not as a complete copy
 * or certification of every ISO 80000 part.
 */
export const builtInUnitDefinitions: UnitDefinition[] = [
  unit("unit-one", "1", "one", "dimensionless", {}, 1, "ISO 80000-1"),
  unit("unit-percent", "%", "percent", "dimensionless ratio", {}, 0.01, "ISO 80000-1"),
  unit("unit-m", "m", "metre", "length", { length: 1 }, 1, "ISO 80000-3"),
  unit("unit-mm", "mm", "millimetre", "length", { length: 1 }, 0.001, "ISO 80000-3"),
  unit("unit-cm", "cm", "centimetre", "length", { length: 1 }, 0.01, "ISO 80000-3"),
  unit("unit-km", "km", "kilometre", "length", { length: 1 }, 1000, "ISO 80000-3"),
  unit("unit-kg", "kg", "kilogram", "mass", { mass: 1 }, 1, "ISO 80000-4"),
  unit("unit-g", "g", "gram", "mass", { mass: 1 }, 0.001, "ISO 80000-4"),
  unit("unit-t", "t", "tonne", "mass", { mass: 1 }, 1000, "ISO 80000-4"),
  unit("unit-s", "s", "second", "time", { time: 1 }, 1, "ISO 80000-3", ["sec", "second"]),
  unit("unit-min", "min", "minute", "time", { time: 1 }, 60, "ISO 80000-3", ["minute"]),
  unit("unit-h", "h", "hour", "time", { time: 1 }, 3600, "ISO 80000-3", ["hr", "hour"]),
  unit("unit-day", "day", "day", "time", { time: 1 }, 86400, "ISO 80000-3"),
  unit("unit-A", "A", "ampere", "electric current", { current: 1 }, 1, "ISO 80000-6"),
  unit("unit-K", "K", "kelvin", "thermodynamic temperature", { temperature: 1 }, 1, "ISO 80000-5"),
  unit("unit-mol", "mol", "mole", "amount of substance", { amount: 1 }, 1, "ISO 80000-9"),
  unit("unit-cd", "cd", "candela", "luminous intensity", { luminousIntensity: 1 }, 1, "ISO 80000-7"),
  unit("unit-rad", "rad", "radian", "plane angle", {}, 1, "ISO 80000-3"),
  unit("unit-Hz", "Hz", "hertz", "frequency", { time: -1 }, 1, "ISO 80000-3"),
  unit("unit-N", "N", "newton", "force", { mass: 1, length: 1, time: -2 }, 1, "ISO 80000-4"),
  unit("unit-Pa", "Pa", "pascal", "pressure", { mass: 1, length: -1, time: -2 }, 1, "ISO 80000-4"),
  unit("unit-kPa", "kPa", "kilopascal", "pressure", { mass: 1, length: -1, time: -2 }, 1000, "ISO 80000-4"),
  unit("unit-MPa", "MPa", "megapascal", "pressure", { mass: 1, length: -1, time: -2 }, 1_000_000, "ISO 80000-4"),
  unit("unit-J", "J", "joule", "energy", { mass: 1, length: 2, time: -2 }, 1, "ISO 80000-4"),
  unit("unit-W", "W", "watt", "power", { mass: 1, length: 2, time: -3 }, 1, "ISO 80000-4"),
  unit("unit-kW", "kW", "kilowatt", "power", { mass: 1, length: 2, time: -3 }, 1000, "ISO 80000-4"),
  unit("unit-C", "C", "coulomb", "electric charge", { current: 1, time: 1 }, 1, "ISO 80000-6"),
  unit("unit-V", "V", "volt", "electric potential", { mass: 1, length: 2, time: -3, current: -1 }, 1, "ISO 80000-6"),
  unit("unit-L", "L", "litre", "volume", { length: 3 }, 0.001, "ISO 80000-3", ["l"]),
  unit("unit-part", "part", "part", "count", { count: 1 }, 1, undefined, ["parts"]),
  unit("unit-person", "person", "person", "resource count", { person: 1 }, 1),
  unit("unit-EUR", "EUR", "euro", "currency", { currency: 1 }, 1, undefined, ["euro"])
];

const cleanDimension = (dimension: Record<string, number>) =>
  Object.fromEntries(Object.entries(dimension).filter(([, exponent]) => Math.abs(exponent) > 1e-10));

export const dimensionKey = (dimension: Record<string, number>) =>
  Object.entries(cleanDimension(dimension))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, exponent]) => `${key}:${Number(exponent.toFixed(10))}`)
    .join("|");

const normalizeUnitText = (value: string) => value
  .replace(/\s+/g, "")
  .replace(/[·⋅]/g, "*")
  .replace(/²/g, "^2")
  .replace(/³/g, "^3")
  .replace(/⁻/g, "-");

function catalogue(custom: UnitDefinition[]) {
  const entries = [...builtInUnitDefinitions, ...custom];
  const result = new Map<string, UnitDefinition>();
  entries.forEach((definition) => {
    result.set(definition.symbol, definition);
    definition.aliases.forEach((alias) => result.set(alias, definition));
  });
  return result;
}

export function parseUnit(unitText: string | undefined, custom: UnitDefinition[] = []): ParsedUnit {
  if (!unitText?.trim()) return { dimension: {}, factor: 1 };
  const compact = normalizeUnitText(unitText);
  const definitions = catalogue(custom);
  const parts = compact.split(/([*/])/).filter(Boolean);
  let sign = 1;
  let factor = 1;
  const dimension: Record<string, number> = {};
  for (const part of parts) {
    if (part === "*") {
      sign = 1;
      continue;
    }
    if (part === "/") {
      sign = -1;
      continue;
    }
    const match = part.match(/^(.+?)(?:\^(-?\d+(?:\.\d+)?))?$/);
    if (!match) throw new Error(`Unsupported unit “${unitText}”.`);
    const definition = definitions.get(match[1]);
    if (!definition) throw new Error(`Unknown unit “${match[1]}”. Define it in the project unit catalogue.`);
    const exponent = Number(match[2] ?? 1) * sign;
    factor *= definition.factorToSI ** exponent;
    Object.entries(definition.dimension).forEach(([key, baseExponent]) => {
      dimension[key] = (dimension[key] ?? 0) + baseExponent * exponent;
    });
  }
  return { dimension: cleanDimension(dimension), factor };
}

const baseSymbols: Record<string, string> = {
  length: "m",
  mass: "kg",
  time: "s",
  current: "A",
  temperature: "K",
  amount: "mol",
  luminousIntensity: "cd",
  count: "part",
  person: "person",
  currency: "EUR"
};

const exponentText = (exponent: number) => {
  if (Math.abs(exponent - 1) < 1e-10) return "";
  if (Math.abs(exponent - 2) < 1e-10) return "²";
  if (Math.abs(exponent - 3) < 1e-10) return "³";
  return `^${Number(exponent.toFixed(6))}`;
};

export function formatDimension(dimension: Record<string, number>): string {
  const entries = Object.entries(cleanDimension(dimension)).sort(([left], [right]) => left.localeCompare(right));
  if (!entries.length) return "1";
  const positive = entries.filter(([, exponent]) => exponent > 0);
  const negative = entries.filter(([, exponent]) => exponent < 0);
  const side = (items: Array<[string, number]>, negativeSide = false) => items
    .map(([key, exponent]) => `${baseSymbols[key] ?? key}${exponentText(negativeSide ? -exponent : exponent)}`)
    .join("*");
  const numerator = side(positive) || "1";
  return negative.length ? `${numerator}/${side(negative, true)}` : numerator;
}

export function validateUnitDefinition(definition: UnitDefinition, existing: UnitDefinition[]): string | null {
  if (!definition.symbol.trim()) return "A custom unit requires a symbol.";
  if (!definition.name.trim() || !definition.quantityName.trim()) return "A custom unit requires a name and quantity name.";
  if (!Number.isFinite(definition.factorToSI) || definition.factorToSI <= 0) return "The conversion factor must be greater than zero.";
  const occupied = [...builtInUnitDefinitions, ...existing.filter((item) => item.id !== definition.id)]
    .flatMap((item) => [item.symbol, ...item.aliases]);
  if (occupied.includes(definition.symbol) || definition.aliases.some((alias) => occupied.includes(alias))) {
    return "The symbol or an alias is already defined.";
  }
  if (!Object.values(definition.dimension).some((value) => value !== 0)) {
    return "Define at least one base-dimension exponent, or use the built-in dimensionless unit.";
  }
  return null;
}

export function convertValue(value: number, from: string, to: string, definitions: UnitDefinition[] = []): number {
  const source = parseUnit(from, definitions), target = parseUnit(to, definitions);
  if (dimensionKey(source.dimension) !== dimensionKey(target.dimension)) throw new Error(`Cannot convert ${from} to ${to}.`);
  return value * source.factor / target.factor;
}

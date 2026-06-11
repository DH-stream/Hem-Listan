import type { ParsedQuantity } from "./types";

const UNIT_FACTORS = {
  l: { unit: "ml", factor: 1000, dimension: "volume" },
  dl: { unit: "ml", factor: 100, dimension: "volume" },
  cl: { unit: "ml", factor: 10, dimension: "volume" },
  ml: { unit: "ml", factor: 1, dimension: "volume" },
  msk: { unit: "ml", factor: 15, dimension: "volume" },
  tsk: { unit: "ml", factor: 5, dimension: "volume" },
  krm: { unit: "ml", factor: 1, dimension: "volume" },
  kg: { unit: "g", factor: 1000, dimension: "weight" },
  g: { unit: "g", factor: 1, dimension: "weight" },
  st: { unit: "st", factor: 1, dimension: "count" },
  styck: { unit: "st", factor: 1, dimension: "count" },
  förp: { unit: "förp", factor: 1, dimension: "package" },
  förpackning: { unit: "förp", factor: 1, dimension: "package" },
} as const;

const parseNumber = (value: string): number | null => {
  const normalized = value.trim().replace(",", ".");
  const mixed = normalized.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const fraction = normalized.match(/^(\d+)\/(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const parseQuantity = (value?: string | null): ParsedQuantity | null => {
  if (!value) return null;
  const normalized = value.toLowerCase().replace(/[½]/g, " 1/2").replace(/[¼]/g, " 1/4").trim();
  const match = normalized.match(/^(ca\.?\s*)?(\d+(?:[.,]\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)\s*(l|dl|cl|ml|msk|tsk|krm|kg|g|st|styck|förp|förpackning)\b/i);
  if (!match) return null;

  const amount = parseNumber(match[2]);
  if (amount === null) return null;
  const config = UNIT_FACTORS[match[3].toLowerCase() as keyof typeof UNIT_FACTORS];
  const packageSizeMatch = normalized.match(/à\s*([^)]+)/i);

  return {
    amount: amount * config.factor,
    unit: config.unit,
    dimension: config.dimension,
    approximate: Boolean(match[1]),
    ...(config.dimension === "package" && packageSizeMatch
      ? { packageSize: packageSizeMatch[1].trim() }
      : {}),
  };
};

export const addQuantities = (
  left: ParsedQuantity | null,
  right: ParsedQuantity | null,
): ParsedQuantity | null => {
  if (!left) return right;
  if (!right) return left;
  if (left.dimension !== right.dimension || left.unit !== right.unit) return null;
  if (left.dimension === "package" && left.packageSize !== right.packageSize) return null;
  return {
    ...left,
    amount: left.amount + right.amount,
    approximate: left.approximate || right.approximate,
  };
};

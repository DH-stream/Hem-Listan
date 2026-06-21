export const MAX_PRICING_QUERY_LENGTH = 80;

export const normalizePricingQuery = (value: string) =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("sv-SE")
    .replace(/\s+/g, " ")
    .trim();

export const parsePriceSek = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalizedPrice = value
    .replace(/\s/g, "")
    .replace(/kr/gi, "")
    .replace(/(\d):(\d{1,2})(?=\D|$)/g, "$1.$2")
    .replace(",", ".");
  const parsed = Number.parseFloat(normalizedPrice);
  return Number.isFinite(parsed) ? parsed : null;
};


export const parseApproxWeightKg = (...values: unknown[]): number | null => {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const normalized = value
      .normalize("NFKC")
      .toLocaleLowerCase("sv-SE")
      .replace(/\s+/g, " ")
      .trim();
    const match = normalized.match(/(?:^|\b)(?:ca[:\s]*)?(\d+(?:[,.]\d+)?)\s*(kg|g)\b/);
    if (!match) continue;
    const amount = Number.parseFloat(match[1].replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) continue;
    return match[2] === "g" ? amount / 1000 : amount;
  }
  return null;
};

const isKgUnitPriceLabel = (unitLabel: string) => {
  const normalized = unitLabel
    .normalize("NFKC")
    .toLocaleLowerCase("sv-SE")
    .replace(/\s+/g, "")
    .trim();
  return normalized === "kg" || normalized === "kr/kg" || normalized === "sek/kg";
};

export const formatSekPerKg = (priceSek: number) =>
  `${priceSek.toLocaleString("sv-SE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} kr/kg`;

export const normalizeKgUnitPriceToEstimatedItemPrice = (
  priceSek: number,
  unitLabel: string,
  weightKg: number | null,
): { priceSek: number; unitLabel: "st"; comparePrice: string } | null => {
  if (!Number.isFinite(priceSek) || priceSek < 0) return null;
  if (!isKgUnitPriceLabel(unitLabel)) return null;
  if (weightKg === null || !Number.isFinite(weightKg) || weightKg <= 0) return null;

  return {
    priceSek: Math.round(priceSek * weightKg * 100) / 100,
    unitLabel: "st",
    comparePrice: formatSekPerKg(priceSek),
  };
};

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

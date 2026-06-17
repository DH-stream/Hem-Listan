import type { GroceryChainId } from "./types";

export type PricingChain = "city_gross" | "ica";

export type PricingSource = {
  chain: PricingChain;
  storeId: string;
  label: string;
  storeUrl?: string;
};

export const PRICING_SOURCE_STORAGE_KEY = "hem-listan-pricing-source:v1";

export const DEFAULT_CITY_GROSS_STORE_ID = "public";

export const PRICING_SOURCES: PricingSource[] = [
  {
    chain: "city_gross",
    storeId: DEFAULT_CITY_GROSS_STORE_ID,
    label: "City Gross",
  },
  {
    chain: "ica",
    storeId: "1004392",
    label: "ICA Maxi Kungälv",
    storeUrl: "https://handlaprivatkund.ica.se/stores/1004392",
  },
];

export const DEFAULT_PRICING_SOURCE = PRICING_SOURCES[0];

export const isPricingChain = (value: unknown): value is PricingChain =>
  value === "city_gross" || value === "ica";

export const getPricingSource = (
  chain: GroceryChainId | PricingChain,
  storeId?: string | null,
): PricingSource | undefined =>
  PRICING_SOURCES.find(
    (source) => source.chain === chain && (!storeId || source.storeId === storeId),
  );

export const normalizePricingSource = (value: unknown): PricingSource => {
  if (!value || typeof value !== "object") return DEFAULT_PRICING_SOURCE;
  const candidate = value as Partial<PricingSource>;
  if (!isPricingChain(candidate.chain) || typeof candidate.storeId !== "string") {
    return DEFAULT_PRICING_SOURCE;
  }
  return getPricingSource(candidate.chain, candidate.storeId) ?? DEFAULT_PRICING_SOURCE;
};

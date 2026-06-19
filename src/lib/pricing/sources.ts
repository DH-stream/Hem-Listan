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

export const SEEDED_ICA_STORES: PricingSource[] = [
  {
    chain: "ica",
    storeId: "1004392",
    label: "ICA Maxi Kungälv",
    storeUrl: "https://handlaprivatkund.ica.se/stores/1004392",
  },
  {
    chain: "ica",
    storeId: "1004219",
    label: "Maxi ICA Stormarknad Göteborg",
    storeUrl: "https://handlaprivatkund.ica.se/stores/1004219",
  },
  {
    chain: "ica",
    storeId: "1003458",
    label: "ICA Kvantum Ale",
    storeUrl: "https://handlaprivatkund.ica.se/stores/1003458",
  },
  {
    chain: "ica",
    storeId: "1003778",
    label: "ICA Kvantum Frölunda",
    storeUrl: "https://handlaprivatkund.ica.se/stores/1003778",
  },
  {
    chain: "ica",
    storeId: "1004247",
    label: "ICA Focus",
    storeUrl: "https://handlaprivatkund.ica.se/stores/1004247",
  },
  {
    chain: "ica",
    storeId: "1003988",
    label: "ICA Supermarket Aptiten",
    storeUrl: "https://handlaprivatkund.ica.se/stores/1003988",
  },
];

export const PRICING_SOURCES: PricingSource[] = [
  {
    chain: "city_gross",
    storeId: DEFAULT_CITY_GROSS_STORE_ID,
    label: "City Gross",
  },
  ...SEEDED_ICA_STORES,
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

const isValidIcaStoreId = (storeId: string): boolean => /^\d+$/.test(storeId.trim());

const buildIcaStoreUrl = (storeId: string): string =>
  `https://handlaprivatkund.ica.se/stores/${storeId}`;

export async function resolveNearestIcaStore(): Promise<PricingSource> {
  return SEEDED_ICA_STORES[0];
}

export const normalizePricingSource = (value: unknown): PricingSource => {
  if (!value || typeof value !== "object") return DEFAULT_PRICING_SOURCE;
  const candidate = value as Partial<PricingSource>;
  if (!isPricingChain(candidate.chain) || typeof candidate.storeId !== "string") {
    return DEFAULT_PRICING_SOURCE;
  }

  const staticSource = PRICING_SOURCES.find(
    (source) => source.chain === candidate.chain && source.storeId === candidate.storeId,
  );
  if (staticSource) return staticSource;

  if (candidate.chain === "ica" && typeof candidate.label === "string") {
    const storeId = candidate.storeId.trim();
    const label = candidate.label.trim();
    if (isValidIcaStoreId(storeId) && label) {
      return {
        chain: "ica",
        storeId,
        label,
        storeUrl:
          typeof candidate.storeUrl === "string" && candidate.storeUrl.trim()
            ? candidate.storeUrl.trim()
            : buildIcaStoreUrl(storeId),
      };
    }
  }

  return DEFAULT_PRICING_SOURCE;
};

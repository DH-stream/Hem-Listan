import type { GroceryChainId } from "./types";

export type PricingChain = "city_gross" | "ica";

export type PricingSource = {
  chain: PricingChain;
  storeId: string;
  label: string;
  storeUrl?: string;
};

export type SeededIcaStore = PricingSource & {
  city?: string;
  address?: string;
  region?: string;
  aliases?: string[];
  latitude?: number;
  longitude?: number;
};

export const PRICING_SOURCE_STORAGE_KEY = "hem-listan-pricing-source:v1";

export const DEFAULT_CITY_GROSS_STORE_ID = "public";

export const SEEDED_ICA_STORES: SeededIcaStore[] = [
  {
    chain: "ica",
    storeId: "1004392",
    label: "ICA Maxi Kungälv",
    storeUrl: "https://handlaprivatkund.ica.se/stores/1004392",
    city: "Kungälv",
    address: "Gymnasiegatan 8",
    region: "Västra Götaland",
    aliases: ["Maxi ICA Stormarknad Kungälv", "ICA Stormarknad Kungälv", "Kungälv Maxi"],
  },
  {
    chain: "ica",
    storeId: "1004219",
    label: "Maxi ICA Stormarknad Göteborg",
    storeUrl: "https://handlaprivatkund.ica.se/stores/1004219",
    city: "Göteborg",
    address: "Grafiska Vägen 16",
    region: "Västra Götaland",
    aliases: ["ICA Maxi Göteborg", "Maxi Göteborg", "Mölndalsvägen", "Grafiska Vägen"],
  },
  {
    chain: "ica",
    storeId: "1003458",
    label: "ICA Kvantum Ale",
    storeUrl: "https://handlaprivatkund.ica.se/stores/1003458",
    city: "Nödinge",
    address: "Ale Torg 7",
    region: "Västra Götaland",
    aliases: ["ICA Kvantum Ale Torg", "Ale Torg", "Nödinge-Nol"],
  },
  {
    chain: "ica",
    storeId: "1003778",
    label: "ICA Kvantum Frölunda",
    storeUrl: "https://handlaprivatkund.ica.se/stores/1003778",
    city: "Västra Frölunda",
    address: "Radiovägen 5",
    region: "Västra Götaland",
    aliases: ["Frölunda", "Radiovägen", "Göteborg väster"],
  },
  {
    chain: "ica",
    storeId: "1004247",
    label: "ICA Focus",
    storeUrl: "https://handlaprivatkund.ica.se/stores/1004247",
    city: "Göteborg",
    address: "Åvägen 42",
    region: "Västra Götaland",
    aliases: ["Focus", "Focusgallerian", "Liseberg", "Evenemangsstråket"],
  },
  {
    chain: "ica",
    storeId: "1003988",
    label: "ICA Supermarket Aptiten",
    storeUrl: "https://handlaprivatkund.ica.se/stores/1003988",
    city: "Stockholm",
    address: "Torkel Knutssonsgatan 16",
    region: "Stockholm",
    aliases: ["ICA Aptiten", "Aptiten", "Södermalm", "Mariatorget"],
  },
];

export const toPricingSource = (source: PricingSource): PricingSource => ({
  chain: source.chain,
  storeId: source.storeId,
  label: source.label,
  storeUrl: source.storeUrl,
});

export const PRICING_SOURCES: PricingSource[] = [
  {
    chain: "city_gross",
    storeId: DEFAULT_CITY_GROSS_STORE_ID,
    label: "City Gross",
  },
  ...SEEDED_ICA_STORES.map(toPricingSource),
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

export const filterSeededIcaStores = (query: string): SeededIcaStore[] => {
  const normalizedQuery = query.trim().toLocaleLowerCase("sv-SE");
  if (!normalizedQuery) return SEEDED_ICA_STORES;

  return SEEDED_ICA_STORES.filter((store) =>
    [store.label, store.city, store.address, store.region, ...(store.aliases ?? [])].some((value) =>
      value?.toLocaleLowerCase("sv-SE").includes(normalizedQuery),
    ),
  );
};

export async function resolveNearestIcaStore(): Promise<PricingSource> {
  return toPricingSource(SEEDED_ICA_STORES[0]);
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
  if (staticSource) return toPricingSource(staticSource);

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

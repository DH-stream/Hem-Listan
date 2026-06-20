import { findNearestIcaStore } from "./icaStoreSearch";
import type { UserCoordinates } from "./geolocation";
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
    storeId: "1004426",
    label: "ICA Nära Skafferiet",
    storeUrl: "https://handlaprivatkund.ica.se/stores/1004426",
    city: "Kungälv",
    address: "Ivar Claessonsgatan 34",
    region: "Västra Götaland",
    aliases: ["Skafferiet", "ICA Skafferiet", "ICA Nära Kungälv", "Kungälv"],
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

const normalizeStoreSearchValue = (value: string): string =>
  value.trim().toLocaleLowerCase("sv-SE");

const getSeededIcaStoreSearchRank = (store: SeededIcaStore, query: string): number => {
  const label = normalizeStoreSearchValue(store.label);
  const city = store.city ? normalizeStoreSearchValue(store.city) : "";
  const address = store.address ? normalizeStoreSearchValue(store.address) : "";
  const region = store.region ? normalizeStoreSearchValue(store.region) : "";
  const aliases = store.aliases?.map(normalizeStoreSearchValue) ?? [];

  if (city === query) return 100;
  if (aliases.some((alias) => alias === query)) return 90;
  if (label === query) return 85;
  if (label.includes(query)) return 80;
  if (aliases.some((alias) => alias.includes(query))) return 70;
  if (city.includes(query)) return 65;
  if (address.includes(query)) return 50;
  if (region.includes(query)) return 10;

  return 0;
};

export const filterSeededIcaStores = (query: string): SeededIcaStore[] => {
  const normalizedQuery = normalizeStoreSearchValue(query);
  if (!normalizedQuery) return SEEDED_ICA_STORES;

  return SEEDED_ICA_STORES.map((store, index) => ({
    index,
    rank: getSeededIcaStoreSearchRank(store, normalizedQuery),
    store,
  }))
    .filter((result) => result.rank > 0)
    .sort((a, b) => b.rank - a.rank || a.index - b.index)
    .map((result) => result.store);
};

export async function resolveNearestIcaStore(coords?: UserCoordinates): Promise<PricingSource | null> {
  if (coords) {
    try {
      const nearestStore = await findNearestIcaStore(coords);
      return nearestStore ? toPricingSource(nearestStore) : null;
    } catch (error) {
      console.warn("[ica-store-nearest] nearest lookup failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

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

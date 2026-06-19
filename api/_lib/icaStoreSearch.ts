import type { PricingSource } from "../../src/lib/pricing/sources";

const ICA_STORES_URL = "https://www.ica.se/butiker/";
const ICA_STORE_CACHE_TTL_MS = 45 * 60 * 1000;

export type IcaStoreSearchResult = PricingSource & {
  chain: "ica";
  city?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
};

type FetchLike = typeof fetch;

export type IcaStoreSearchDebug = {
  query: string;
  upstreamUrl: string;
  upstreamStatus?: number;
  htmlLength?: number;
  parsedStoreCount: number;
  filteredStoreCount: number;
  firstParsedStores: Array<Pick<IcaStoreSearchResult, "storeId" | "label" | "city" | "address">>;
  source: "ica_html" | "cache";
  fallbackUsed: boolean;
  cacheAgeMs?: number;
  error?: string;
};

export type IcaStoreSearchResponse = {
  stores: IcaStoreSearchResult[];
  debug: IcaStoreSearchDebug;
};

type RawIcaStore = {
  accountNumber?: unknown;
  storeName?: unknown;
  address?: { street?: unknown; city?: unknown };
  lat?: unknown;
  lng?: unknown;
};

let storeCache: { stores: IcaStoreSearchResult[]; fetchedAt: number } | null = null;

export const clearIcaStoreSearchCacheForTests = () => {
  storeCache = null;
};

const normalizeSearchValue = (value: string): string =>
  value.trim().toLocaleLowerCase("sv-SE");

const parseNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toStoreSearchResult = (store: RawIcaStore): IcaStoreSearchResult | null => {
  if (typeof store.accountNumber !== "string" || !/^\d+$/.test(store.accountNumber)) {
    return null;
  }
  if (typeof store.storeName !== "string" || !store.storeName.trim()) return null;

  const address = store.address;
  const street = typeof address?.street === "string" ? address.street.trim() : undefined;
  const city = typeof address?.city === "string" ? address.city.trim() : undefined;

  return {
    chain: "ica",
    storeId: store.accountNumber,
    label: store.storeName.trim(),
    storeUrl: `https://handlaprivatkund.ica.se/stores/${store.accountNumber}`,
    ...(city ? { city } : {}),
    ...(street ? { address: street } : {}),
    ...(parseNumber(store.lat) !== undefined ? { latitude: parseNumber(store.lat) } : {}),
    ...(parseNumber(store.lng) !== undefined ? { longitude: parseNumber(store.lng) } : {}),
  };
};

const extractJsonObjectAt = (text: string, start: number): string | null => {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }

  return null;
};

export const parseIcaStoresFromHtml = (html: string): IcaStoreSearchResult[] => {
  const stores = new Map<string, IcaStoreSearchResult>();
  const marker = '"accountNumber"';
  let searchFrom = 0;

  while (searchFrom < html.length) {
    const markerIndex = html.indexOf(marker, searchFrom);
    if (markerIndex === -1) break;
    const objectStart = html.lastIndexOf("{", markerIndex);
    if (objectStart === -1) {
      searchFrom = markerIndex + marker.length;
      continue;
    }

    const objectText = extractJsonObjectAt(html, objectStart);
    searchFrom = markerIndex + marker.length;
    if (!objectText) continue;

    try {
      const parsed = JSON.parse(objectText) as RawIcaStore;
      const store = toStoreSearchResult(parsed);
      if (store) stores.set(store.storeId, store);
    } catch {
      // Ignore non-store objects in the page payload.
    }
  }

  return Array.from(stores.values());
};

const rankStore = (store: IcaStoreSearchResult, query: string): number => {
  const label = normalizeSearchValue(store.label);
  const city = store.city ? normalizeSearchValue(store.city) : "";
  const address = store.address ? normalizeSearchValue(store.address) : "";

  if (city === query) return 100;
  if (label === query) return 90;
  if (label.includes(query)) return 80;
  if (city.includes(query)) return 70;
  if (address.includes(query)) return 50;
  return 0;
};

export const filterIcaStoreSearchResults = (
  stores: IcaStoreSearchResult[],
  query: string,
): IcaStoreSearchResult[] => {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return stores;

  return stores
    .map((store, index) => ({ index, rank: rankStore(store, normalizedQuery), store }))
    .filter((result) => result.rank > 0)
    .sort((a, b) => b.rank - a.rank || a.index - b.index)
    .map((result) => result.store);
};

const createDebug = (
  query: string,
  stores: IcaStoreSearchResult[],
  filtered: IcaStoreSearchResult[],
  details: Partial<IcaStoreSearchDebug> = {},
): IcaStoreSearchDebug => ({
  query,
  upstreamUrl: ICA_STORES_URL,
  parsedStoreCount: stores.length,
  filteredStoreCount: filtered.length,
  firstParsedStores: stores.slice(0, 5).map((store) => ({
    storeId: store.storeId,
    label: store.label,
    city: store.city,
    address: store.address,
  })),
  source: "ica_html",
  fallbackUsed: false,
  ...details,
});

const filterAndBuildResponse = (
  query: string,
  stores: IcaStoreSearchResult[],
  details: Partial<IcaStoreSearchDebug>,
): IcaStoreSearchResponse => {
  const filtered = filterIcaStoreSearchResults(stores, query).slice(0, 20);
  return {
    stores: filtered,
    debug: createDebug(query, stores, filtered, details),
  };
};

export async function searchIcaStoresWithDebug(
  query: string,
  options: { fetchImpl?: FetchLike; now?: number } = {},
): Promise<IcaStoreSearchResponse> {
  const normalizedQuery = query.trim();
  const now = options.now ?? Date.now();
  if (normalizedQuery.length < 2) {
    return filterAndBuildResponse(normalizedQuery, [], { source: "cache" });
  }

  if (storeCache && now - storeCache.fetchedAt < ICA_STORE_CACHE_TTL_MS) {
    return filterAndBuildResponse(normalizedQuery, storeCache.stores, {
      source: "cache",
      cacheAgeMs: now - storeCache.fetchedAt,
    });
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(ICA_STORES_URL, {
      headers: { "user-agent": "Hem-Listan ICA store search" },
    });
    const html = await response.text();
    if (!response.ok) throw new Error(`ICA store search failed: ${response.status}`);

    const stores = parseIcaStoresFromHtml(html);
    storeCache = { stores, fetchedAt: now };
    return filterAndBuildResponse(normalizedQuery, stores, {
      upstreamStatus: response.status,
      htmlLength: html.length,
      source: "ica_html",
    });
  } catch (error) {
    if (storeCache) {
      return filterAndBuildResponse(normalizedQuery, storeCache.stores, {
        source: "cache",
        fallbackUsed: true,
        cacheAgeMs: now - storeCache.fetchedAt,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  }
}

export async function searchIcaStores(
  query: string,
  options: { fetchImpl?: FetchLike; now?: number } = {},
): Promise<IcaStoreSearchResult[]> {
  return (await searchIcaStoresWithDebug(query, options)).stores;
}

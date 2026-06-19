import type { PricingSource } from "../../src/lib/pricing/sources";

const ICA_STORES_URL = "https://www.ica.se/butiker/";

export type IcaStoreSearchResult = PricingSource & {
  chain: "ica";
  city?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
};

type FetchLike = typeof fetch;

type RawIcaStore = {
  accountNumber?: unknown;
  storeName?: unknown;
  address?: { street?: unknown; city?: unknown };
  lat?: unknown;
  lng?: unknown;
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

export async function searchIcaStores(
  query: string,
  options: { fetchImpl?: FetchLike } = {},
): Promise<IcaStoreSearchResult[]> {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) return [];

  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(ICA_STORES_URL, {
    headers: { "user-agent": "Hem-Listan ICA store search" },
  });
  if (!response.ok) throw new Error(`ICA store search failed: ${response.status}`);

  const html = await response.text();
  return filterIcaStoreSearchResults(parseIcaStoresFromHtml(html), normalizedQuery).slice(0, 20);
}

const ICA_STORES_URL = "https://www.ica.se/butiker/";
const ICA_STORE_CACHE_TTL_MS = 45 * 60 * 1000;
const GEOCODE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PRICE_PROBE_QUERY = "banan";
const PRICE_PROBE_LIMIT = 8;
const NOMINATIM_ORIGIN = "https://nominatim.openstreetmap.org";

export type IcaStoreSearchResult = {
  chain: "ica";
  storeId: string;
  label: string;
  storeUrl?: string;
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
  stage?: string;
  error?: string;
};

export type IcaStoreSearchResponse = {
  stores: IcaStoreSearchResult[];
  debug: IcaStoreSearchDebug;
};

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type IcaNearestStoreDebug = {
  userPlaceQuery?: string;
  candidateCount: number;
  geocodedCandidateCount: number;
  priceProbeCount: number;
  skippedBecauseNoPriceCount: number;
  selectedDistanceKm: number | null;
  fallbackUsed: boolean;
  error?: string;
};

export type IcaNearestStoreCandidate = IcaStoreSearchResult & {
  distanceKm?: number;
  priceCapable?: boolean;
  priceProbeStatus?: "not_probed" | "priced" | "no_price" | "error";
};

export type IcaNearestStoreResponse = {
  store: IcaStoreSearchResult | null;
  stores: IcaNearestStoreCandidate[];
  debug: IcaNearestStoreDebug;
};

export type ReverseGeocodeResult = {
  query: string;
  city?: string;
  address?: string;
  municipality?: string;
  region?: string;
  debug: { source: "nominatim"; fallbackUsed: boolean; error?: string };
};

type GeocodeResult = Coordinates & { source: "nominatim" | "cache" };

type RawIcaStore = {
  accountNumber?: unknown;
  storeName?: unknown;
  address?: { street?: unknown; city?: unknown };
  lat?: unknown;
  lng?: unknown;
};

let storeCache: { stores: IcaStoreSearchResult[]; fetchedAt: number } | null = null;
let geocodeCache = new Map<string, { coords: Coordinates; fetchedAt: number }>();

export const clearIcaStoreSearchCacheForTests = () => {
  storeCache = null;
  geocodeCache = new Map();
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


const getAddressComponent = (address: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = address[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
};

const parseNominatimCoordinates = (value: unknown): Coordinates | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const latitude = parseNumber(record.lat);
  const longitude = parseNumber(record.lon);
  if (latitude === undefined || longitude === undefined) return null;
  return { latitude, longitude };
};

const normalizeGeocodeCacheKey = (value: string): string => normalizeSearchValue(value);

export async function reverseGeocodeLocation(
  coords: Coordinates,
  options: { fetchImpl?: FetchLike } = {},
): Promise<ReverseGeocodeResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = new URL("/reverse", NOMINATIM_ORIGIN);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(coords.latitude));
  url.searchParams.set("lon", String(coords.longitude));
  url.searchParams.set("addressdetails", "1");

  const response = await fetchImpl(url, { headers: { "user-agent": "Hem-Listan nearest ICA store" } });
  if (!response.ok) throw new Error(`Reverse geocoding failed: ${response.status}`);
  const payload = (await response.json()) as Record<string, unknown>;
  const address = payload.address && typeof payload.address === "object" ? payload.address as Record<string, unknown> : {};
  const city = getAddressComponent(address, ["city", "town", "village", "hamlet", "suburb"]);
  const municipality = getAddressComponent(address, ["municipality", "county"]);
  const region = getAddressComponent(address, ["state", "region"]);
  const query = city ?? municipality ?? region;
  if (!query) throw new Error("Reverse geocoding returned no searchable place");

  return {
    query,
    ...(city ? { city } : {}),
    ...(typeof payload.display_name === "string" ? { address: payload.display_name } : {}),
    ...(municipality ? { municipality } : {}),
    ...(region ? { region } : {}),
    debug: { source: "nominatim", fallbackUsed: false },
  };
}

export async function geocodeAddress(
  address: string | undefined,
  city: string | undefined,
  country = "Sweden",
  options: { fetchImpl?: FetchLike; now?: number; cacheKey?: string } = {},
): Promise<GeocodeResult | null> {
  const query = [address, city, country].filter(Boolean).join(", ");
  if (!query.trim()) return null;
  const now = options.now ?? Date.now();
  const cacheKey = normalizeGeocodeCacheKey(options.cacheKey ? `${options.cacheKey}:${query}` : query);
  const cached = geocodeCache.get(cacheKey);
  if (cached && now - cached.fetchedAt < GEOCODE_CACHE_TTL_MS) {
    return { ...cached.coords, source: "cache" };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const url = new URL("/search", NOMINATIM_ORIGIN);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "se");
  url.searchParams.set("q", query);

  const response = await fetchImpl(url, { headers: { "user-agent": "Hem-Listan nearest ICA store" } });
  if (!response.ok) throw new Error(`Store geocoding failed: ${response.status}`);
  const payload = await response.json();
  const firstResult = Array.isArray(payload) ? payload[0] : null;
  const coords = parseNominatimCoordinates(firstResult);
  if (!coords) return null;
  geocodeCache.set(cacheKey, { coords, fetchedAt: now });
  return { ...coords, source: "nominatim" };
}

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

async function loadIcaStores(
  options: { fetchImpl?: FetchLike; now?: number } = {},
): Promise<{ stores: IcaStoreSearchResult[]; details: Partial<IcaStoreSearchDebug> }> {
  const now = options.now ?? Date.now();
  if (storeCache && now - storeCache.fetchedAt < ICA_STORE_CACHE_TTL_MS) {
    return {
      stores: storeCache.stores,
      details: { source: "cache", cacheAgeMs: now - storeCache.fetchedAt },
    };
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
    return {
      stores,
      details: { upstreamStatus: response.status, htmlLength: html.length, source: "ica_html" },
    };
  } catch (error) {
    if (storeCache) {
      return {
        stores: storeCache.stores,
        details: {
          source: "cache",
          fallbackUsed: true,
          cacheAgeMs: now - storeCache.fetchedAt,
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
    throw error;
  }
}

export function distanceKm(a: Coordinates, b: Coordinates): number {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLatitude = toRadians(b.latitude - a.latitude);
  const deltaLongitude = toRadians(b.longitude - a.longitude);
  const latitudeA = toRadians(a.latitude);
  const latitudeB = toRadians(b.latitude);
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(deltaLongitude / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function rankIcaStoresByDistance(
  stores: IcaStoreSearchResult[],
  coords: Coordinates,
): Array<IcaStoreSearchResult & { distanceKm: number }> {
  return stores
    .flatMap((store) => {
      if (typeof store.latitude !== "number" || typeof store.longitude !== "number") return [];
      const distance = distanceKm(coords, { latitude: store.latitude, longitude: store.longitude });
      return [{ ...store, distanceKm: distance }];
    })
    .sort((a, b) => a.distanceKm - b.distanceKm || a.storeId.localeCompare(b.storeId));
}

const toStoreSearchResultResponse = (store: IcaStoreSearchResult): IcaStoreSearchResult => ({
  chain: store.chain,
  storeId: store.storeId,
  label: store.label,
  ...(store.storeUrl ? { storeUrl: store.storeUrl } : {}),
  ...(store.city ? { city: store.city } : {}),
  ...(store.address ? { address: store.address } : {}),
});

async function probeIcaStorePriceCapability(
  store: IcaStoreSearchResult,
  options: { priceProbe?: (store: IcaStoreSearchResult) => Promise<boolean> } = {},
): Promise<{ priceCapable: boolean; priceProbeStatus: IcaNearestStoreCandidate["priceProbeStatus"] }> {
  try {
    if (options.priceProbe) {
      return (await options.priceProbe(store))
        ? { priceCapable: true, priceProbeStatus: "priced" }
        : { priceCapable: false, priceProbeStatus: "no_price" };
    }
    const { searchIcaProducts } = await import("./icaPricing.js");
    const products = await searchIcaProducts(PRICE_PROBE_QUERY, store.storeId, {
      skipCache: true,
      bypassNegativeCache: true,
    });
    return products.some((product) => Number.isFinite(product.priceSek) && product.priceSek > 0)
      ? { priceCapable: true, priceProbeStatus: "priced" }
      : { priceCapable: false, priceProbeStatus: "no_price" };
  } catch {
    return { priceCapable: false, priceProbeStatus: "error" };
  }
}

export async function findNearestIcaStoreWithDebug(
  coords: Coordinates,
  options: {
    fetchImpl?: FetchLike;
    now?: number;
    limit?: number;
    priceProbeLimit?: number;
    priceProbe?: (store: IcaStoreSearchResult) => Promise<boolean>;
  } = {},
): Promise<IcaNearestStoreResponse> {
  const reverse = await reverseGeocodeLocation(coords, options);
  const searchResult = await searchIcaStoresWithDebug(reverse.query, options);
  const candidates = searchResult.stores;
  const geocodedCandidates = (
    await Promise.all(
      candidates.map(async (store) => {
        try {
          const geocoded = await geocodeAddress(store.address, store.city, "Sweden", {
            fetchImpl: options.fetchImpl,
            now: options.now,
            cacheKey: store.storeId,
          });
          if (!geocoded) return null;
          return {
            ...store,
            distanceKm: distanceKm(coords, geocoded),
            priceProbeStatus: "not_probed" as const,
          };
        } catch {
          return null;
        }
      }),
    )
  )
    .filter((store): store is NonNullable<typeof store> => Boolean(store))
    .sort((a, b) => a.distanceKm - b.distanceKm || a.storeId.localeCompare(b.storeId));

  const stores: IcaNearestStoreCandidate[] = [];
  let selected: IcaNearestStoreCandidate | null = null;
  let priceProbeCount = 0;
  let skippedBecauseNoPriceCount = 0;

  for (const candidate of geocodedCandidates.slice(0, options.priceProbeLimit ?? PRICE_PROBE_LIMIT)) {
    priceProbeCount += 1;
    const probe = await probeIcaStorePriceCapability(candidate, options);
    const probedCandidate = { ...candidate, ...probe };
    stores.push(probedCandidate);
    if (probe.priceCapable) {
      selected = probedCandidate;
      break;
    }
    skippedBecauseNoPriceCount += 1;
  }

  const probedIds = new Set(stores.map((store) => store.storeId));
  for (const candidate of geocodedCandidates) {
    if (stores.length >= (options.limit ?? 5)) break;
    if (!probedIds.has(candidate.storeId)) stores.push(candidate);
  }

  return {
    store: selected ? toStoreSearchResultResponse(selected) : null,
    stores,
    debug: {
      userPlaceQuery: reverse.query,
      candidateCount: candidates.length,
      geocodedCandidateCount: geocodedCandidates.length,
      priceProbeCount,
      skippedBecauseNoPriceCount,
      selectedDistanceKm: selected?.distanceKm ?? null,
      fallbackUsed: false,
    },
  };
}

export async function searchIcaStoresWithDebug(
  query: string,
  options: { fetchImpl?: FetchLike; now?: number } = {},
): Promise<IcaStoreSearchResponse> {
  const normalizedQuery = query.trim();
  const now = options.now ?? Date.now();
  if (normalizedQuery.length < 2) {
    return filterAndBuildResponse(normalizedQuery, [], { source: "cache" });
  }

  try {
    const { stores, details } = await loadIcaStores(options);
    return filterAndBuildResponse(normalizedQuery, stores, details);
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

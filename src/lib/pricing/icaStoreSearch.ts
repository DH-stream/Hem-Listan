import type { PricingSource, SeededIcaStore } from "./sources";
import type { UserCoordinates } from "./geolocation";

export type IcaStoreSearchResult = PricingSource & {
  chain: "ica";
  city?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object");

export const normalizeIcaStoreSearchResult = (value: unknown): IcaStoreSearchResult | null => {
  if (!isRecord(value)) return null;
  const { chain, storeId, label, storeUrl } = value;
  if (chain !== "ica") return null;
  if (typeof storeId !== "string" || !/^\d+$/.test(storeId.trim())) return null;
  if (typeof label !== "string" || !label.trim()) return null;

  return {
    chain: "ica",
    storeId: storeId.trim(),
    label: label.trim(),
    storeUrl:
      typeof storeUrl === "string" && storeUrl.trim()
        ? storeUrl.trim()
        : `https://handlaprivatkund.ica.se/stores/${storeId.trim()}`,
    ...(typeof value.city === "string" && value.city.trim() ? { city: value.city.trim() } : {}),
    ...(typeof value.address === "string" && value.address.trim()
      ? { address: value.address.trim() }
      : {}),
    ...(typeof value.latitude === "number" && Number.isFinite(value.latitude)
      ? { latitude: value.latitude }
      : {}),
    ...(typeof value.longitude === "number" && Number.isFinite(value.longitude)
      ? { longitude: value.longitude }
      : {}),
  };
};

export const seededStoreToSearchResult = (store: SeededIcaStore): IcaStoreSearchResult => ({
  chain: "ica",
  storeId: store.storeId,
  label: store.label,
  storeUrl: store.storeUrl ?? `https://handlaprivatkund.ica.se/stores/${store.storeId}`,
  ...(store.city ? { city: store.city } : {}),
  ...(store.address ? { address: store.address } : {}),
  ...(store.latitude !== undefined ? { latitude: store.latitude } : {}),
  ...(store.longitude !== undefined ? { longitude: store.longitude } : {}),
});

export async function searchIcaStores(query: string): Promise<IcaStoreSearchResult[]> {
  const response = await fetch(`/api/ica/stores/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) {
    let errorPayload: unknown = null;
    try {
      errorPayload = await response.clone().json();
    } catch {
      errorPayload = null;
    }
    console.warn("[ica-store-search] API request failed", {
      query,
      status: response.status,
      payload: errorPayload,
    });
    throw new Error("ICA store search unavailable");
  }
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.stores)) return [];
  const stores = payload.stores
    .map(normalizeIcaStoreSearchResult)
    .filter((store): store is IcaStoreSearchResult => Boolean(store));
  console.info("[ica-store-search] API result", {
    query,
    resultCount: stores.length,
    firstResults: stores.slice(0, 5).map((store) => ({
      storeId: store.storeId,
      label: store.label,
      city: store.city,
      address: store.address,
    })),
    debug: payload.debug,
  });
  return stores;
}

export async function reverseGeocodeUserLocation(coords: UserCoordinates): Promise<{ query: string }> {
  const query = new URLSearchParams({
    lat: String(coords.latitude),
    lng: String(coords.longitude),
  });
  const response = await fetch(`/api/location/reverse?${query.toString()}`);
  if (!response.ok) {
    throw new Error("Location reverse geocode unavailable");
  }
  const payload: unknown = await response.json();
  if (!isRecord(payload) || typeof payload.query !== "string" || !payload.query.trim()) {
    throw new Error("Location reverse geocode returned no place query");
  }
  console.info("[ica-store-nearby] reverse geocode result", {
    query: payload.query,
    city: payload.city,
    municipality: payload.municipality,
    region: payload.region,
    debug: payload.debug,
  });
  return { query: payload.query.trim() };
}


export async function findNearestIcaStore(coords: UserCoordinates): Promise<IcaStoreSearchResult | null> {
  const query = new URLSearchParams({
    lat: String(coords.latitude),
    lng: String(coords.longitude),
  });
  const response = await fetch(`/api/ica/stores/nearest?${query.toString()}`);
  if (!response.ok) {
    throw new Error("ICA nearest store unavailable");
  }
  const payload: unknown = await response.json();
  if (!isRecord(payload)) return null;
  const store = normalizeIcaStoreSearchResult(payload.store);
  console.info("[ica-store-nearest] API result", {
    selectedStoreId: store?.storeId,
    selectedLabel: store?.label,
    debug: payload.debug,
  });
  return store;
}

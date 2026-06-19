import type { PricingSource, SeededIcaStore } from "./sources";

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
  if (!response.ok) throw new Error("ICA store search unavailable");
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.stores)) return [];
  return payload.stores
    .map(normalizeIcaStoreSearchResult)
    .filter((store): store is IcaStoreSearchResult => Boolean(store));
}

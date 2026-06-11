import type { UserStorePreferences } from "./types";
import { CITY_GROSS_DEMO_STORE } from "./cityGrossAdapter";

const STORAGE_KEY = "hem-listan:user-store-preferences:v1";

export const defaultStorePreferences: UserStorePreferences = {
  priceMode: "manual_store",
  selectedStoreId: CITY_GROSS_DEMO_STORE.id,
};

export const loadStorePreferences = (): UserStorePreferences => {
  if (typeof window === "undefined") return defaultStorePreferences;

  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return defaultStorePreferences;
    const parsed = JSON.parse(value) as Partial<UserStorePreferences>;
    return {
      // Cheapest-store is intentionally unavailable in V1 even if storage was edited manually.
      priceMode: "manual_store",
      selectedStoreId:
        typeof parsed.selectedStoreId === "string"
          ? parsed.selectedStoreId
          : defaultStorePreferences.selectedStoreId,
    };
  } catch {
    return defaultStorePreferences;
  }
};

export const saveStorePreferences = (preferences: UserStorePreferences) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
};

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_PRICING_SOURCE,
  PRICING_SOURCE_STORAGE_KEY,
  normalizePricingSource,
  type PricingSource,
} from "./sources";

const readStoredPricingSource = (): PricingSource => {
  if (typeof window === "undefined") return DEFAULT_PRICING_SOURCE;
  try {
    const stored = window.localStorage.getItem(PRICING_SOURCE_STORAGE_KEY);
    return normalizePricingSource(stored ? JSON.parse(stored) : null);
  } catch {
    return DEFAULT_PRICING_SOURCE;
  }
};

export const usePricingSource = () => {
  const [selectedPricingSource, setSelectedPricingSourceState] = useState<PricingSource>(
    () => readStoredPricingSource(),
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PRICING_SOURCE_STORAGE_KEY,
        JSON.stringify(selectedPricingSource),
      );
    } catch {
      // Pricing source still works for this session if localStorage is unavailable.
    }
  }, [selectedPricingSource]);

  const setSelectedPricingSource = useCallback((source: PricingSource) => {
    setSelectedPricingSourceState(normalizePricingSource(source));
  }, []);

  return { selectedPricingSource, setSelectedPricingSource };
};

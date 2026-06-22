import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_PRICING_SOURCE,
  PRICING_SOURCE_STORAGE_KEY,
  normalizePricingSource,
  type PricingSource,
} from "./sources";

export const LAST_ICA_PRICING_SOURCE_STORAGE_KEY = "hem-listan-last-ica-pricing-source:v1";

const readStoredPricingSource = (): PricingSource => {
  if (typeof window === "undefined") return DEFAULT_PRICING_SOURCE;
  try {
    const stored = window.localStorage.getItem(PRICING_SOURCE_STORAGE_KEY);
    return normalizePricingSource(stored ? JSON.parse(stored) : null);
  } catch {
    return DEFAULT_PRICING_SOURCE;
  }
};

const readStoredIcaPricingSource = (): PricingSource | null => {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(LAST_ICA_PRICING_SOURCE_STORAGE_KEY);
    const source = normalizePricingSource(stored ? JSON.parse(stored) : null);
    return source.chain === "ica" ? source : null;
  } catch {
    return null;
  }
};

export const usePricingSource = () => {
  const [selectedPricingSource, setSelectedPricingSourceState] = useState<PricingSource>(
    () => readStoredPricingSource(),
  );
  const [lastIcaPricingSource, setLastIcaPricingSource] = useState<PricingSource | null>(
    () => {
      const selectedSource = readStoredPricingSource();
      return selectedSource.chain === "ica" ? selectedSource : readStoredIcaPricingSource();
    },
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

  useEffect(() => {
    if (selectedPricingSource.chain !== "ica") return;
    setLastIcaPricingSource(selectedPricingSource);
    try {
      window.localStorage.setItem(
        LAST_ICA_PRICING_SOURCE_STORAGE_KEY,
        JSON.stringify(selectedPricingSource),
      );
    } catch {
      // Last ICA source is best-effort only; comparison can still show a disabled ICA row.
    }
  }, [selectedPricingSource]);

  const setSelectedPricingSource = useCallback((source: PricingSource) => {
    const normalizedSource = normalizePricingSource(source);
    setSelectedPricingSourceState(normalizedSource);
  }, []);

  return { selectedPricingSource, setSelectedPricingSource, lastIcaPricingSource };
};

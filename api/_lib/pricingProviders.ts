import type { BasketPriceEstimate, ProductPrice } from "../../src/lib/pricing/types";
import type { PricingBasketRequest } from "./basketPricing.js";
import { calculateBasketPriceEstimate } from "./basketPricing.js";
import { searchCityGrossProducts } from "./cityGrossPricing.js";
import { searchIcaProducts } from "./icaPricing.js";
import { searchWillysProducts } from "./willysPricing.js";

export type PricingChain = "city_gross" | "ica" | "willys";

export interface PricingProvider {
  chain: PricingChain;
  searchProducts(
    query: string,
    storeId: string | undefined,
    options: { debug?: boolean },
  ): Promise<ProductPrice[]>;
  estimateBasket(
    request: PricingBasketRequest,
    options: { debug?: boolean },
  ): Promise<BasketPriceEstimate>;
}

const createProvider = (
  chain: PricingChain,
  searchProducts: PricingProvider["searchProducts"],
): PricingProvider => ({
  chain,
  searchProducts,
  estimateBasket: (request, options) =>
    calculateBasketPriceEstimate(request, {
      ...options,
      searchProducts: (query, storeId) => searchProducts(query, storeId, options),
      ...(chain === "ica"
        ? {
            refreshSearchProducts: (query: string, storeId?: string) =>
              searchIcaProducts(query, storeId, {
                ...options,
                bypassNegativeCache: true,
              }),
          }
        : {}),
    }),
});

const providers: Record<PricingChain, PricingProvider> = {
  city_gross: createProvider("city_gross", (query, storeId, options) =>
    searchCityGrossProducts(query, storeId, options),
  ),
  ica: createProvider("ica", (query, storeId, options) =>
    searchIcaProducts(query, storeId, options),
  ),
  willys: createProvider("willys", (query, storeId, options) =>
    searchWillysProducts(query, storeId, options),
  ),
};

export const getPricingProvider = (chain: PricingChain): PricingProvider =>
  providers[chain];

export const isSupportedPricingChain = (value: unknown): value is PricingChain =>
  value === "city_gross" || value === "ica" || value === "willys";

export async function calculateBasketPricing(
  request: PricingBasketRequest,
  options: { debug?: boolean } = {},
): Promise<BasketPriceEstimate> {
  return getPricingProvider(request.chain).estimateBasket(request, options);
}

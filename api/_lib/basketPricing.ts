import { matchListItem, normalizePriceQuery } from "../../src/lib/pricing/matching";
import type { BasketPriceEstimate, ProductPrice } from "../../src/lib/pricing/types";
import { searchCityGrossProducts } from "./cityGrossPricing";

export const MAX_BASKET_ITEMS = 100;

export interface PricingBasketItem {
  id: string;
  name: string;
}

export interface PricingBasketRequest {
  chain: "city_gross";
  storeId?: string;
  items: PricingBasketItem[];
}

interface BasketPricingOptions {
  searchProducts?: (
    query: string,
    storeId?: string,
  ) => Promise<ProductPrice[]>;
}

export const validateBasketPricingRequest = (
  body: unknown,
): { ok: true; request: PricingBasketRequest } | { ok: false; error: string } => {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body is required." };
  }

  const value = body as Record<string, unknown>;
  if (value.chain !== "city_gross") {
    return { ok: false, error: "Unsupported grocery chain." };
  }
  if (!Array.isArray(value.items) || value.items.length === 0) {
    return { ok: false, error: "At least one item is required." };
  }
  if (value.items.length > MAX_BASKET_ITEMS) {
    return {
      ok: false,
      error: `A basket may contain at most ${MAX_BASKET_ITEMS} items.`,
    };
  }

  const items: PricingBasketItem[] = [];
  for (const item of value.items) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "Every item must include an id and name." };
    }
    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.id !== "string" ||
      candidate.id.trim() === "" ||
      typeof candidate.name !== "string" ||
      candidate.name.length > 80 ||
      normalizePriceQuery(candidate.name) === ""
    ) {
      return { ok: false, error: "Every item must include an id and name." };
    }
    items.push({
      id: candidate.id.slice(0, 128),
      name: candidate.name,
    });
  }

  return {
    ok: true,
    request: {
      chain: "city_gross",
      storeId:
        typeof value.storeId === "string" && value.storeId.trim()
          ? value.storeId.trim().slice(0, 40)
          : undefined,
      items,
    },
  };
};

export async function calculateCityGrossBasket(
  request: PricingBasketRequest,
  options: BasketPricingOptions = {},
): Promise<BasketPriceEstimate> {
  const searchProducts = options.searchProducts ?? searchCityGrossProducts;
  const queryByItemId = new Map<string, string>();
  const searchQueryByNormalizedQuery = new Map<string, string>();

  request.items.forEach((item) => {
    const normalizedQuery = normalizePriceQuery(item.name);
    const searchQuery = item.name.normalize("NFKC").replace(/\s+/g, " ").trim();
    const currentSearchQuery = searchQueryByNormalizedQuery.get(normalizedQuery);
    queryByItemId.set(item.id, normalizedQuery);
    if (!currentSearchQuery || searchQuery.length < currentSearchQuery.length) {
      searchQueryByNormalizedQuery.set(normalizedQuery, searchQuery);
    }
  });

  const queries = Array.from(searchQueryByNormalizedQuery.entries());
  const productEntries: Array<readonly [string, ProductPrice[]]> = [];
  let nextQueryIndex = 0;

  const worker = async () => {
    while (nextQueryIndex < queries.length) {
      const [normalizedQuery, searchQuery] = queries[nextQueryIndex];
      nextQueryIndex += 1;
      productEntries.push([
        normalizedQuery,
        await searchProducts(searchQuery, request.storeId),
      ] as const);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(4, queries.length) }, () => worker()),
  );
  const productsByQuery = new Map(productEntries);

  const matches = request.items.map((item) =>
    matchListItem(
      item,
      productsByQuery.get(queryByItemId.get(item.id) ?? "") ?? [],
    ),
  );

  return {
    matches,
    approximateTotalSek:
      Math.round(
        matches.reduce(
          (total, match) => total + (match.product?.priceSek ?? 0),
          0,
        ) * 100,
      ) / 100,
  };
}

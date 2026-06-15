import {
  cleanCityGrossSearchQuery,
  matchListItem,
  normalizePriceQuery,
} from "./pricingMatching.js";
import type {
  BasketPriceEstimate,
  ProductPrice,
} from "../../src/lib/pricing/types";
import { searchCityGrossProducts } from "./cityGrossPricing.js";

export const MAX_BASKET_ITEMS = 100;

export interface PricingBasketItem {
  id: string;
  name: string;
  sourceTaskIds?: string[];
}

export interface PricingBasketRequest {
  chain: "city_gross";
  storeId?: string;
  items: PricingBasketItem[];
}

interface BasketPricingOptions {
  debug?: boolean;
  searchProducts?: (query: string, storeId?: string) => Promise<ProductPrice[]>;
}

const pricingApiLog = (
  enabled: boolean,
  message: string,
  details?: unknown,
) => {
  if (enabled) console.log(`[pricing-api] ${message}`, details ?? "");
};

export const validateBasketPricingRequest = (
  body: unknown,
):
  | { ok: true; request: PricingBasketRequest }
  | { ok: false; error: string } => {
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
      sourceTaskIds: Array.isArray(candidate.sourceTaskIds)
        ? candidate.sourceTaskIds
            .filter(
              (id): id is string =>
                typeof id === "string" && id.trim() !== "",
            )
            .map((id) => id.slice(0, 128))
            .slice(0, MAX_BASKET_ITEMS)
        : undefined,
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
  const debug = options.debug ?? false;
  const searchProducts =
    options.searchProducts ??
    ((query: string, storeId?: string) =>
      searchCityGrossProducts(query, storeId, { debug }));
  pricingApiLog(debug, "basket input", { itemCount: request.items.length });
  const queryByItemId = new Map<string, string>();
  const searchQueryByNormalizedQuery = new Map<string, string>();

  request.items.forEach((item) => {
    const searchQuery = cleanCityGrossSearchQuery(item.name);
    const normalizedQuery = normalizePriceQuery(searchQuery);
    const currentSearchQuery =
      searchQueryByNormalizedQuery.get(normalizedQuery);
    queryByItemId.set(item.id, normalizedQuery);
    if (!normalizedQuery) return;
    if (!currentSearchQuery || searchQuery.length < currentSearchQuery.length) {
      searchQueryByNormalizedQuery.set(normalizedQuery, searchQuery);
    }
  });

  const queries = Array.from(searchQueryByNormalizedQuery.entries());
  pricingApiLog(debug, "normalized queries", {
    queryCount: queries.length,
    queries: queries.slice(0, 10).map(([normalizedQuery, searchQuery]) => ({
      normalizedQuery,
      searchQuery,
    })),
    ...(queries.length > 10 ? { omittedCount: queries.length - 10 } : {}),
  });
  const productEntries: Array<readonly [string, ProductPrice[]]> = [];
  let nextQueryIndex = 0;

  const worker = async () => {
    while (nextQueryIndex < queries.length) {
      const [normalizedQuery, searchQuery] = queries[nextQueryIndex];
      nextQueryIndex += 1;
      pricingApiLog(debug, "search start", {
        normalizedQuery,
        searchQuery,
        storeId: request.storeId,
      });
      const products = await searchProducts(searchQuery, request.storeId);
      pricingApiLog(debug, "search result", {
        normalizedQuery,
        productCount: products.length,
      });
      productEntries.push([normalizedQuery, products] as const);
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
      { debug },
    ),
  );

  const result = {
    matches,
    approximateTotalSek:
      Math.round(
        matches.reduce(
          (total, match) =>
            total +
            (match.estimatedCheckoutPriceSek ?? match.product?.priceSek ?? 0),
          0,
        ) * 100,
      ) / 100,
  };

  const pricedCount = result.matches.filter((match) => match.product).length;
  pricingApiLog(debug, "match summary", {
    inputItemCount: request.items.length,
    matchCount: result.matches.length,
    pricedCount,
    noProductCount: result.matches.length - pricedCount,
    approximateTotalSek: result.approximateTotalSek,
    winners: result.matches.slice(0, 10).map((match) => ({
      listItemName: match.listItemName,
      productName: match.product?.productName,
      confidence: match.confidence,
      preferenceScore: match.preferenceScore,
      preferenceReasons: match.preferenceReasons,
    })),
  });
  return result;
}

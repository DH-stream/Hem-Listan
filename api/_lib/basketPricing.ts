import {
  buildPricingSearchQueries,
  buildPricingSearchQuery,
  matchListItem,
  normalizePriceQuery,
} from "./pricingMatching.js";
import type {
  BasketPriceEstimate,
  ProductPrice,
} from "../../src/lib/pricing/types";
import { searchCityGrossProducts } from "./cityGrossPricing.js";
import {
  consumeWillysPricingDiagnostics,
  resetWillysPricingDiagnostics,
  searchWillysProducts,
} from "./willysPricing.js";
import {
  consumeIcaPricingDiagnostics,
  resetIcaPricingDiagnostics,
  searchIcaProducts,
} from "./icaPricing.js";
import type { IcaProviderDiagnostic } from "./icaPricing.js";
import type { WillysProviderDiagnostic } from "./willysPricing.js";
import { emitPricingMatchEventsFireAndForget } from "./pricingMatchEvents.js";
import type { PricingMatchEventLogger } from "./pricingMatchEvents.js";

export const MAX_BASKET_ITEMS = 100;

export interface PricingBasketItem {
  id: string;
  name: string;
  sourceTaskIds?: string[];
}

export interface PricingBasketClientContext {
  anonymousInstallationId?: string;
}

export interface PricingBasketRequest {
  chain: "city_gross" | "ica" | "willys";
  storeId?: string;
  items: PricingBasketItem[];
  clientContext?: PricingBasketClientContext;
}

interface BasketPricingOptions {
  debug?: boolean;
  searchProducts?: (query: string, storeId?: string) => Promise<ProductPrice[]>;
  refreshSearchProducts?: (query: string, storeId?: string) => Promise<ProductPrice[]>;
  matchEventLogger?: PricingMatchEventLogger;
}

interface PricingQueryDiagnostic {
  normalizedQuery: string;
  searchQuery: string;
  providerProductCount: number;
  topProviderProducts: Array<{
    productName: string;
    priceSek: number;
    unitLabel: string;
    category?: string;
  }>;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  if (value.chain !== "city_gross" && value.chain !== "ica" && value.chain !== "willys") {
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
      chain: value.chain,
      storeId:
        typeof value.storeId === "string" && value.storeId.trim()
          ? value.storeId.trim().slice(0, 40)
          : undefined,
      items,
      clientContext:
        value.clientContext &&
        typeof value.clientContext === "object" &&
        typeof (value.clientContext as Record<string, unknown>).anonymousInstallationId === "string" &&
        uuidPattern.test((value.clientContext as Record<string, unknown>).anonymousInstallationId as string)
          ? {
              anonymousInstallationId: (
                (value.clientContext as Record<string, unknown>)
                  .anonymousInstallationId as string
              ).toLowerCase(),
            }
          : undefined,
    },
  };
};

const defaultSearchProductsFor = (request: PricingBasketRequest) =>
  request.chain === "ica"
    ? (query: string, storeId?: string) => searchIcaProducts(query, storeId)
    : request.chain === "willys"
      ? (query: string, storeId?: string) => searchWillysProducts(query, storeId)
      : (query: string, storeId?: string) => searchCityGrossProducts(query, storeId);

const summarizeDiagnostics = (
  request: PricingBasketRequest,
  diagnostics: PricingQueryDiagnostic[],
  pricedCount: number,
  matchCount: number,
  providerAttempts?: Array<IcaProviderDiagnostic | WillysProviderDiagnostic>,
) =>
  JSON.stringify({
    chain: request.chain,
    storeId: request.storeId ?? null,
    queryCount: diagnostics.length,
    pricedCount,
    matchCount,
    coverageRatio: matchCount > 0 ? pricedCount / matchCount : 0,
    queries: diagnostics,
    ...(providerAttempts && providerAttempts.length > 0
      ? {
          providerAttemptSummary:
            request.chain === "ica"
              ? summarizeIcaProviderAttempts(providerAttempts as IcaProviderDiagnostic[])
              : summarizeGenericProviderAttempts(providerAttempts),
          providerAttempts,
        }
      : {}),
  });

const summarizeGenericProviderAttempts = (
  attempts: Array<IcaProviderDiagnostic | WillysProviderDiagnostic>,
) => {
  const resultTypeCounts: Record<string, number> = {};
  attempts.forEach((attempt) => {
    const resultType = attempt.resultType ?? "unclassified";
    resultTypeCounts[resultType] = (resultTypeCounts[resultType] ?? 0) + 1;
  });
  return {
    resultTypeCounts,
    cacheHitCount: resultTypeCounts.cache_hit ?? 0,
    successfulAttemptCount: resultTypeCounts.success ?? 0,
    emptyAttemptCount: resultTypeCounts.empty ?? 0,
    errorAttemptCount: resultTypeCounts.error ?? 0,
  };
};

export const summarizeIcaProviderAttempts = (attempts: IcaProviderDiagnostic[]) => {
  const resultTypeCounts: Record<string, number> = {};
  const failuresByQuery = new Map<string, Record<string, number>>();
  attempts.forEach((attempt) => {
    const resultType = attempt.resultType ?? "unclassified";
    resultTypeCounts[resultType] = (resultTypeCounts[resultType] ?? 0) + 1;
    if (!attempt.failureType) return;
    const failures = failuresByQuery.get(attempt.query) ?? {};
    failures[attempt.failureType] = (failures[attempt.failureType] ?? 0) + 1;
    failuresByQuery.set(attempt.query, failures);
  });
  return {
    resultTypeCounts,
    liveProductAttemptCount: attempts.filter(
      (attempt) =>
        !attempt.fromCache && (attempt.normalizedProductCount ?? 0) > 0,
    ).length,
    cacheHitCount: resultTypeCounts.cache_hit ?? 0,
    blockedAttemptCount:
      (resultTypeCounts.waf_blocked ?? 0) +
      (resultTypeCounts.store_selector ?? 0) +
      (resultTypeCounts.html_no_product_data ?? 0),
    topFailedQueries: Array.from(failuresByQuery, ([query, failureTypes]) => ({
      query,
      failureCount: Object.values(failureTypes).reduce(
        (total, count) => total + count,
        0,
      ),
      failureTypes,
    }))
      .sort((a, b) => b.failureCount - a.failureCount || a.query.localeCompare(b.query))
      .slice(0, 10),
  };
};

export async function calculateBasketPriceEstimate(
  request: PricingBasketRequest,
  options: BasketPricingOptions = {},
): Promise<BasketPriceEstimate> {
  const debug = options.debug ?? false;
  const searchProducts = options.searchProducts ?? defaultSearchProductsFor(request);
  if (debug && request.chain === "ica") resetIcaPricingDiagnostics();
  if (debug && request.chain === "willys") resetWillysPricingDiagnostics();
  pricingApiLog(debug, "basket input", {
    chain: request.chain,
    storeId: request.storeId,
    itemCount: request.items.length,
  });
  const queryByItemId = new Map<string, string>();
  const searchQueriesByNormalizedQuery = new Map<string, string[]>();

  request.items.forEach((item) => {
    const searchQuery = buildPricingSearchQuery(item.name);
    const normalizedQuery = normalizePriceQuery(searchQuery);
    queryByItemId.set(item.id, normalizedQuery);
    if (!normalizedQuery) return;

    const currentSearchQueries =
      searchQueriesByNormalizedQuery.get(normalizedQuery) ?? [];
    const searchQueryByNormalizedVariant = new Map<string, string>();
    [
      ...currentSearchQueries,
      ...buildPricingSearchQueries(item.name),
    ]
      .filter(Boolean)
      .forEach((candidateSearchQuery) => {
        const normalizedVariant = normalizePriceQuery(candidateSearchQuery);
        const currentVariant = searchQueryByNormalizedVariant.get(normalizedVariant);
        if (!currentVariant || candidateSearchQuery.length < currentVariant.length) {
          searchQueryByNormalizedVariant.set(normalizedVariant, candidateSearchQuery);
        }
      });
    searchQueriesByNormalizedQuery.set(
      normalizedQuery,
      Array.from(searchQueryByNormalizedVariant.values()),
    );
  });

  const queries = Array.from(searchQueriesByNormalizedQuery.entries()).flatMap(
    ([normalizedQuery, searchQueries]) =>
      searchQueries.map((searchQuery) => [normalizedQuery, searchQuery] as const),
  );
  pricingApiLog(debug, "normalized queries", {
    queryCount: queries.length,
    queries: queries.slice(0, 10).map(([normalizedQuery, searchQuery]) => ({
      normalizedQuery,
      searchQuery,
    })),
    ...(queries.length > 10 ? { omittedCount: queries.length - 10 } : {}),
  });
  const productEntries: Array<readonly [string, ProductPrice[]]> = [];
  const diagnostics: PricingQueryDiagnostic[] = [];
  let nextQueryIndex = 0;

  const worker = async () => {
    while (nextQueryIndex < queries.length) {
      const [normalizedQuery, searchQuery] = queries[nextQueryIndex];
      nextQueryIndex += 1;
      pricingApiLog(debug, "search start", {
        chain: request.chain,
        normalizedQuery,
        searchQuery,
        storeId: request.storeId,
      });
      const products = await searchProducts(searchQuery, request.storeId);
      pricingApiLog(debug, "search result", {
        chain: request.chain,
        normalizedQuery,
        productCount: products.length,
        topProducts: products.slice(0, 5).map((product) => ({
          productName: product.productName,
          priceSek: product.priceSek,
          unitLabel: product.unitLabel,
          category: product.category,
        })),
      });
      if (debug) {
        diagnostics.push({
          normalizedQuery,
          searchQuery,
          providerProductCount: products.length,
          topProviderProducts: products.slice(0, 5).map((product) => ({
            productName: product.productName,
            priceSek: product.priceSek,
            unitLabel: product.unitLabel,
            ...(product.category ? { category: product.category } : {}),
          })),
        });
      }
      productEntries.push([normalizedQuery, products] as const);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(4, queries.length) }, () => worker()),
  );
  const productsByQuery = new Map<string, ProductPrice[]>();
  productEntries.forEach(([normalizedQuery, products]) => {
    const existingProducts = productsByQuery.get(normalizedQuery) ?? [];
    const productsById = new Map(
      existingProducts.map((product) => [product.id, product] as const),
    );
    products.forEach((product) => {
      if (!productsById.has(product.id)) productsById.set(product.id, product);
    });
    productsByQuery.set(normalizedQuery, Array.from(productsById.values()));
  });

  let matches = request.items.map((item) =>
    matchListItem(
      item,
      productsByQuery.get(queryByItemId.get(item.id) ?? "") ?? [],
      { debug },
    ),
  );

  const initialPricedCount = matches.filter((match) => match.product).length;
  const initialCoverageRatio =
    matches.length > 0 ? initialPricedCount / matches.length : 0;
  if (
    request.chain === "ica" &&
    (!options.searchProducts || options.refreshSearchProducts) &&
    initialCoverageRatio < 0.6
  ) {
    const refreshSearchProducts =
      options.refreshSearchProducts ??
      ((query: string, storeId?: string) =>
        searchIcaProducts(query, storeId, {
          debug,
          bypassNegativeCache: true,
        }));
    const zeroQueries = Array.from(
      new Map(
        request.items
          .filter((item) => !matches.find((match) => match.listItemId === item.id)?.product)
          .flatMap((item) => {
            const normalizedQuery = queryByItemId.get(item.id) ?? "";
            return (searchQueriesByNormalizedQuery.get(normalizedQuery) ?? []).map(
              (searchQuery) => [`${normalizedQuery}\0${searchQuery}`, normalizedQuery, searchQuery] as const,
            );
          })
          .filter((entry) => Boolean(entry[1]) && Boolean(entry[2]))
          .map(([key, normalizedQuery, searchQuery]) => [
            key,
            [normalizedQuery, searchQuery] as const,
          ]),
      ).values(),
    );
    const refreshedEntries = await Promise.all(
      zeroQueries.map(async ([normalizedQuery, query]) => [
        normalizedQuery,
        await refreshSearchProducts(query, request.storeId),
      ] as const),
    );
    refreshedEntries.forEach(([normalizedQuery, products]) => {
      if (products.length === 0) return;
      const existingProducts = productsByQuery.get(normalizedQuery) ?? [];
      const productsById = new Map(
        existingProducts.map((product) => [product.id, product] as const),
      );
      products.forEach((product) => {
        if (!productsById.has(product.id)) productsById.set(product.id, product);
      });
      productsByQuery.set(normalizedQuery, Array.from(productsById.values()));
    });
    matches = request.items.map((item) =>
      matchListItem(
        item,
        productsByQuery.get(queryByItemId.get(item.id) ?? "") ?? [],
        { debug },
      ),
    );
  }

  const approximateTotalSek =
    Math.round(
      matches.reduce(
        (total, match) =>
          total +
          (match.estimatedCheckoutPriceSek ?? match.product?.priceSek ?? 0),
        0,
      ) * 100,
    ) / 100;

  const pricedCount = matches.filter((match) => match.product).length;
  const providerAttempts =
    debug && request.chain === "ica"
      ? consumeIcaPricingDiagnostics()
      : debug && request.chain === "willys"
        ? consumeWillysPricingDiagnostics()
        : [];
  const result: BasketPriceEstimate = {
    matches,
    approximateTotalSek,
    ...(debug
      ? {
          debugCode: pricedCount > 0 ? "pricing_match_debug" : "pricing_no_match_debug",
          debugMessage: summarizeDiagnostics(
            request,
            diagnostics.sort((a, b) => a.normalizedQuery.localeCompare(b.normalizedQuery)),
            pricedCount,
            matches.length,
            providerAttempts,
          ),
        }
      : {}),
  };

  emitPricingMatchEventsFireAndForget(
    request,
    request.items,
    matches,
    options.matchEventLogger,
    (error) => pricingApiLog(debug, "match event logging failed", error),
  );

  pricingApiLog(debug, "match summary", {
    inputItemCount: request.items.length,
    matchCount: result.matches.length,
    pricedCount,
    noProductCount: result.matches.length - pricedCount,
    coverageRatio: matches.length > 0 ? pricedCount / matches.length : 0,
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

export async function calculateCityGrossBasket(
  request: PricingBasketRequest,
  options: BasketPricingOptions = {},
): Promise<BasketPriceEstimate> {
  return calculateBasketPriceEstimate({ ...request, chain: "city_gross" }, options);
}

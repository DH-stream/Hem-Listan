import type { ProductPrice } from "../../src/lib/pricing/types";
import {
  MAX_PRICING_QUERY_LENGTH,
  normalizePricingQuery,
  normalizeKgUnitPriceToEstimatedItemPrice,
  parseApproxWeightKg,
  parsePriceSek,
} from "./pricingProviderUtils.js";

const WILLYS_ORIGIN = "https://www.willys.se";
const WILLYS_SEARCH_URL = `${WILLYS_ORIGIN}/search`;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 20 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 7_000;
const WILLYS_STORE_ID = "public";

interface CacheEntry {
  expiresAt: number;
  products: ProductPrice[];
}

export interface WillysProviderDiagnostic {
  query: string;
  cacheKey: string;
  fromCache: boolean;
  resultType: "cache_hit" | "success" | "empty" | "error";
  status?: number;
  rawProductCount?: number;
  normalizedProductCount?: number;
  failureType?: string;
}

interface WillysSearchOptions {
  debug?: boolean;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

interface WillysProductResult {
  code?: unknown;
  name?: unknown;
  priceValue?: unknown;
  price?: unknown;
  priceUnit?: unknown;
  comparePrice?: unknown;
  comparePriceUnit?: unknown;
  image?: { url?: unknown };
  thumbnail?: { url?: unknown };
  displayVolume?: unknown;
  productLine2?: unknown;
  description?: unknown;
  online?: unknown;
  outOfStock?: unknown;
}


const WILLYS_SINGLE_PIECE_FALLBACK_WEIGHTS_KG: Record<string, number> = {
  banan: 0.18,
  citron: 0.12,
  lime: 0.08,
  apelsin: 0.18,
  "äpple": 0.15,
  "päron": 0.17,
  kiwi: 0.09,
  avokado: 0.17,
  "vitlök": 0.06,
};

const WILLYS_BULK_PRODUCE_TERMS = [
  "potatis",
  "lök",
  "tomat",
  "vindruvor",
  "morötter",
  "äpplen",
  "bananer",
];

const normalizeProduceText = (value: string) =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("sv-SE")
    .replace(/[^a-zåäö0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getWillysSinglePieceFallbackWeightKg = (product: WillysProductResult) => {
  const haystack = normalizeProduceText(
    [product.name, product.code]
      .filter((value): value is string => typeof value === "string")
      .join(" "),
  );
  if (!haystack) return null;
  if (WILLYS_BULK_PRODUCE_TERMS.some((term) => {
    const normalizedTerm = normalizeProduceText(term);
    return new RegExp(`(^| )${normalizedTerm}( |$)`).test(haystack);
  })) {
    return null;
  }

  for (const [term, weightKg] of Object.entries(WILLYS_SINGLE_PIECE_FALLBACK_WEIGHTS_KG)) {
    const normalizedTerm = normalizeProduceText(term);
    if (new RegExp(`(^| )${normalizedTerm}( |$)`).test(haystack)) {
      return weightKg;
    }
  }
  return null;
};

const cache = new Map<string, CacheEntry>();
let diagnostics: WillysProviderDiagnostic[] = [];

const pricingApiLog = (enabled: boolean, message: string, details?: unknown) => {
  if (enabled) console.log(`[pricing-api] ${message}`, details ?? "");
};

export const validateWillysPricingQuery = (value: unknown) => {
  if (typeof value !== "string" || normalizePricingQuery(value) === "") {
    return { ok: false as const, error: "Query is required." };
  }
  if (value.length > MAX_PRICING_QUERY_LENGTH) {
    return {
      ok: false as const,
      error: `Query must be at most ${MAX_PRICING_QUERY_LENGTH} characters.`,
    };
  }
  return { ok: true as const, query: normalizePricingQuery(value) };
};

const absoluteUrl = (value: unknown) => {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  try {
    return new URL(value, WILLYS_ORIGIN).toString();
  } catch {
    return undefined;
  }
};

const getResults = (payload: unknown): WillysProductResult[] => {
  if (!payload || typeof payload !== "object") return [];
  const results = (payload as { results?: unknown }).results;
  return Array.isArray(results) ? (results as WillysProductResult[]) : [];
};

export const normalizeWillysProduct = (
  product: WillysProductResult,
  fetchedAt = new Date().toISOString(),
): ProductPrice | null => {
  const priceSek = parsePriceSek(product.priceValue);
  if (typeof product.name !== "string" || !product.name.trim() || priceSek === null) {
    return null;
  }

  const productName = product.name.trim();
  const code = typeof product.code === "string" ? product.code.trim() : "";
  const comparePrice =
    typeof product.comparePrice === "string" && product.comparePrice.trim()
      ? product.comparePrice.trim()
      : undefined;
  const comparePriceUnit =
    typeof product.comparePriceUnit === "string" && product.comparePriceUnit.trim()
      ? product.comparePriceUnit.trim()
      : undefined;

  const providerWeightKg = parseApproxWeightKg(
    product.displayVolume,
    product.productLine2,
    product.description,
  );
  const unitLabel =
    typeof product.priceUnit === "string" && product.priceUnit.trim()
      ? product.priceUnit.trim()
      : "st";
  const kgEstimate = normalizeKgUnitPriceToEstimatedItemPrice(
    priceSek,
    unitLabel,
    providerWeightKg ?? getWillysSinglePieceFallbackWeightKg(product),
  );
  const normalizedComparePrice =
    kgEstimate?.comparePrice ??
    (comparePrice && comparePriceUnit ? `${comparePrice}/${comparePriceUnit}` : comparePrice);

  return {
    id: code ? `willys-${code}` : `willys-${productName.toLocaleLowerCase("sv-SE")}`,
    chainId: "willys",
    storeId: WILLYS_STORE_ID,
    productName,
    priceSek: kgEstimate?.priceSek ?? priceSek,
    unitLabel: kgEstimate?.unitLabel ?? unitLabel,
    searchTerms: [productName, code].filter(Boolean),
    comparePrice: normalizedComparePrice,
    imageUrl: absoluteUrl(product.image?.url) ?? absoluteUrl(product.thumbnail?.url),
    isCampaign: false,
    fetchedAt,
  };
};

const productAvailabilityRank = (product: WillysProductResult) => {
  const onlinePenalty = product.online === false ? 10 : 0;
  const outOfStockPenalty = product.outOfStock === true ? 100 : 0;
  return onlinePenalty + outOfStockPenalty;
};

export const clearWillysPricingCache = () => cache.clear();
export const resetWillysPricingDiagnostics = () => {
  diagnostics = [];
};
export const consumeWillysPricingDiagnostics = () => {
  const current = diagnostics;
  diagnostics = [];
  return current;
};

export async function searchWillysProducts(
  query: string,
  storeId?: string,
  options: WillysSearchOptions = {},
): Promise<ProductPrice[]> {
  const debug = options.debug ?? false;
  const validation = validateWillysPricingQuery(query);
  if (!validation.ok) return [];

  const normalizedStoreId = storeId?.trim() || WILLYS_STORE_ID;
  const cacheKey = `willys:${normalizedStoreId}:${validation.query}`;
  const now = options.now ?? Date.now;
  const currentTime = now();
  const cached = cache.get(cacheKey);
  pricingApiLog(debug, "willys cache key", { cacheKey });
  if (cached && cached.expiresAt > currentTime) {
    pricingApiLog(debug, "willys cache hit", { cacheKey, productCount: cached.products.length });
    diagnostics.push({
      query: validation.query,
      cacheKey,
      fromCache: true,
      resultType: "cache_hit",
      normalizedProductCount: cached.products.length,
    });
    return cached.products;
  }

  const searchUrl = new URL(WILLYS_SEARCH_URL);
  searchUrl.searchParams.set("q", validation.query);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const loggedSearchUrl = new URL(searchUrl);
    loggedSearchUrl.searchParams.set("q", "[redacted]");
    pricingApiLog(debug, "willys fetch", { searchUrl: loggedSearchUrl.toString() });
    const response = await (options.fetchImpl ?? fetch)(searchUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Hem-Listan/1.2 (+public grocery price lookup)",
      },
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") ?? "";
    pricingApiLog(debug, "willys response", { status: response.status, contentType });
    if (!response.ok) throw new Error(`Willys returned ${response.status}`);
    if (!contentType.includes("application/json")) {
      throw new Error("Willys returned a non-JSON response");
    }

    const fetchedAt = new Date(currentTime).toISOString();
    const rawProducts = getResults(await response.json()).sort(
      (a, b) => productAvailabilityRank(a) - productAvailabilityRank(b),
    );
    const products = rawProducts
      .map((product) => normalizeWillysProduct(product, fetchedAt))
      .filter((product): product is ProductPrice => product !== null);

    pricingApiLog(debug, "willys products parsed", {
      rawProductCount: rawProducts.length,
      normalizedProductCount: products.length,
      products: products.slice(0, 3).map((product) => ({
        productName: product.productName,
        priceSek: product.priceSek,
        unitLabel: product.unitLabel,
      })),
    });
    diagnostics.push({
      query: validation.query,
      cacheKey,
      fromCache: false,
      resultType: products.length > 0 ? "success" : "empty",
      status: response.status,
      rawProductCount: rawProducts.length,
      normalizedProductCount: products.length,
    });
    cache.set(cacheKey, {
      expiresAt: currentTime + (products.length > 0 ? CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS),
      products,
    });
    return products;
  } catch (error) {
    pricingApiLog(debug, "willys error", error);
    const fallbackProducts = cached?.products ?? [];
    diagnostics.push({
      query: validation.query,
      cacheKey,
      fromCache: false,
      resultType: "error",
      normalizedProductCount: fallbackProducts.length,
      failureType: error instanceof Error ? error.message : "unknown",
    });
    cache.set(cacheKey, {
      expiresAt: currentTime + NEGATIVE_CACHE_TTL_MS,
      products: fallbackProducts,
    });
    return fallbackProducts;
  } finally {
    clearTimeout(timeoutId);
  }
}

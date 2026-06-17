import type { ProductPrice } from "../../src/lib/pricing/types";
import {
  MAX_PRICING_QUERY_LENGTH,
  normalizePricingQuery,
  parsePriceSek,
} from "./pricingProviderUtils.js";

const ICA_ORIGIN = "https://handlaprivatkund.ica.se";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 20 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 7_000;

interface CacheEntry {
  expiresAt: number;
  products: ProductPrice[];
}

interface IcaSearchOptions {
  debug?: boolean;
  fetchImpl?: typeof fetch;
  now?: () => number;
  liveEnabled?: boolean;
}

interface IcaProductCandidate {
  id?: unknown;
  articleId?: unknown;
  productId?: unknown;
  retailerProductId?: unknown;
  name?: unknown;
  productName?: unknown;
  title?: unknown;
  brand?: unknown;
  manufacturer?: unknown;
  size?: unknown;
  descriptiveSize?: unknown;
  quantity?: unknown;
  unit?: unknown;
  unitLabel?: unknown;
  price?: unknown;
  currentPrice?: unknown;
  ordinaryPrice?: unknown;
  comparePrice?: unknown;
  comparativePrice?: unknown;
  priceComparison?: unknown;
  imageUrl?: unknown;
  image?: unknown;
  images?: unknown;
  url?: unknown;
  productUrl?: unknown;
  category?: unknown;
  categories?: unknown;
  breadcrumb?: unknown;
  breadcrumbs?: unknown;
  isCampaign?: unknown;
  hasPromotion?: unknown;
  hasDiscount?: unknown;
  priceInfo?: Record<string, unknown>;
  prices?: Record<string, unknown>;
}

const cache = new Map<string, CacheEntry>();

const pricingApiLog = (enabled: boolean, message: string, details?: unknown) => {
  if (enabled) console.log(`[pricing-api] ${message}`, details ?? "");
};

const validateIcaQuery = (value: unknown) => {
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

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const firstString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
};

const firstPrice = (...values: unknown[]) => {
  for (const value of values) {
    const parsed = parsePriceSek(value);
    if (parsed !== null) return parsed;
  }
  return null;
};

const absoluteUrl = (value: unknown, baseUrl: string) => {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return undefined;
  }
};

const collectCategoryLabels = (value: unknown): string[] => {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) return value.flatMap(collectCategoryLabels);
  const record = asRecord(value);
  if (!record) return [];
  return ["name", "title", "label", "path"].flatMap((key) =>
    collectCategoryLabels(record[key]),
  );
};

const getPayloadShape = (payload: unknown, depth = 0): unknown => {
  if (depth >= 2) return Array.isArray(payload) ? `[array:${payload.length}]` : typeof payload;
  if (Array.isArray(payload)) {
    return {
      type: "array",
      length: payload.length,
      first: payload.length > 0 ? getPayloadShape(payload[0], depth + 1) : undefined,
    };
  }
  const record = asRecord(payload);
  if (!record) return typeof payload;
  return Object.fromEntries(
    Object.entries(record)
      .slice(0, 12)
      .map(([key, value]) => [key, getPayloadShape(value, depth + 1)]),
  );
};

const getImageUrl = (product: IcaProductCandidate) => {
  const imageRecord = asRecord(product.image);
  if (imageRecord) {
    const url = firstString(imageRecord.url, imageRecord.src);
    if (url) return url;
  }
  if (Array.isArray(product.images)) {
    for (const image of product.images) {
      const record = asRecord(image);
      const url = record ? firstString(record.url, record.src) : firstString(image);
      if (url) return url;
    }
  }
  return firstString(product.imageUrl);
};

export const normalizeIcaProduct = (
  product: IcaProductCandidate,
  storeId: string,
  fetchedAt = new Date().toISOString(),
): ProductPrice | null => {
  const priceInfo = product.priceInfo ?? product.prices ?? {};
  const id = firstString(
    product.id,
    product.articleId,
    product.productId,
    product.retailerProductId,
  );
  const name = firstString(product.name, product.productName, product.title);
  const priceSek = firstPrice(
    product.price,
    product.currentPrice,
    product.ordinaryPrice,
    priceInfo.currentPrice,
    priceInfo.price,
    asRecord(priceInfo.currentPrice)?.price,
  );
  if (!id || !name || priceSek === null) return null;

  const brand = firstString(product.brand, product.manufacturer);
  const normalizedName = name.toLocaleLowerCase("sv-SE");
  const normalizedBrand = brand?.toLocaleLowerCase("sv-SE");
  const productName =
    brand && normalizedBrand && !normalizedName.includes(normalizedBrand)
      ? `${brand} ${name}`
      : name;
  const comparePrice = firstString(
    product.comparePrice,
    product.comparativePrice,
    product.priceComparison,
    priceInfo.comparePrice,
    priceInfo.comparativePrice,
    priceInfo.priceComparison,
  );
  const categoryPath = [
    product.breadcrumb,
    product.breadcrumbs,
    product.categories,
    product.category,
  ]
    .flatMap(collectCategoryLabels)
    .filter((label, index, labels) => labels.indexOf(label) === index);

  return {
    id,
    chainId: "ica",
    storeId,
    productName,
    priceSek,
    unitLabel:
      firstString(
        product.size,
        product.descriptiveSize,
        product.quantity,
        product.unitLabel,
        product.unit,
      ) ?? "st",
    searchTerms: [name, brand].filter((term): term is string => Boolean(term)),
    comparePrice,
    category: categoryPath[0],
    categoryPath: categoryPath.length > 0 ? categoryPath : undefined,
    productUrl: absoluteUrl(
      firstString(product.productUrl, product.url) ??
        `/stores/${storeId}/products/${id}/details`,
      ICA_ORIGIN,
    ),
    imageUrl: absoluteUrl(getImageUrl(product), ICA_ORIGIN),
    isCampaign: Boolean(
      product.isCampaign ||
        product.hasPromotion ||
        product.hasDiscount ||
        priceInfo.hasPromotion ||
        priceInfo.hasDiscount,
    ),
    fetchedAt,
  };
};

const hasAnyKey = (record: Record<string, unknown>, keys: string[]) =>
  keys.some((key) => record[key] !== undefined && record[key] !== null);

const looksLikeProductCandidate = (value: unknown) => {
  const record = asRecord(value);
  if (!record) return false;
  const hasIdentity = hasAnyKey(record, [
    "id",
    "articleId",
    "productId",
    "retailerProductId",
  ]);
  const hasName = hasAnyKey(record, ["name", "productName", "title"]);
  const hasPrice = hasAnyKey(record, [
    "price",
    "currentPrice",
    "ordinaryPrice",
    "priceInfo",
    "prices",
  ]);
  return hasIdentity && hasName && hasPrice;
};

const productArray = (value: unknown): IcaProductCandidate[] => {
  if (!Array.isArray(value)) return [];
  return value.some(looksLikeProductCandidate)
    ? (value as IcaProductCandidate[])
    : [];
};

const getProducts = (payload: unknown): IcaProductCandidate[] => {
  const directProducts = productArray(payload);
  if (directProducts.length > 0) return directProducts;
  const record = asRecord(payload);
  if (!record) return [];
  for (const key of ["products", "items", "results", "productResults"]) {
    const products = productArray(record[key]);
    if (products.length > 0) return products;
  }
  for (const value of Object.values(record)) {
    const nested = getProducts(value);
    if (nested.length > 0) return nested;
  }
  return [];
};

export const clearIcaPricingCache = () => cache.clear();

const buildIcaSearchUrls = (query: string, storeId: string) => {
  const urls = [
    new URL(`/stores/${encodeURIComponent(storeId)}/api/products/search`, ICA_ORIGIN),
    new URL(`/api/products/search`, ICA_ORIGIN),
  ];
  urls[0].searchParams.set("q", query);
  urls[0].searchParams.set("query", query);
  urls[0].searchParams.set("take", "12");
  urls[1].searchParams.set("storeId", storeId);
  urls[1].searchParams.set("q", query);
  urls[1].searchParams.set("take", "12");
  return urls;
};

export async function searchIcaProducts(
  query: string,
  storeId = "1004392",
  options: IcaSearchOptions = {},
): Promise<ProductPrice[]> {
  const debug = options.debug ?? false;
  const validation = validateIcaQuery(query);
  if (!validation.ok) return [];

  const liveEnabled = options.liveEnabled ?? process.env.ICA_LIVE_PRICING === "true";
  pricingApiLog(debug, "ica live status", { liveEnabled });
  if (!liveEnabled) return [];

  const normalizedStoreId = storeId.trim().slice(0, 40) || "1004392";
  const cacheKey = `ica:${normalizedStoreId}:${validation.query}`;
  const now = options.now ?? Date.now;
  const currentTime = now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > currentTime) {
    pricingApiLog(debug, "ica cache hit", { cacheKey, productCount: cached.products.length });
    return cached.products;
  }

  let lastError: unknown;
  for (const searchUrl of buildIcaSearchUrls(validation.query, normalizedStoreId)) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      pricingApiLog(debug, "ica fetch", {
        searchUrl: searchUrl.origin + searchUrl.pathname,
      });
      const response = await (options.fetchImpl ?? fetch)(searchUrl, {
        headers: {
          Accept: "application/json",
          Referer: `${ICA_ORIGIN}/stores/${encodeURIComponent(normalizedStoreId)}`,
          "User-Agent": "Hem-Listan/1.2 (+public grocery price lookup)",
        },
        signal: controller.signal,
      });
      const contentType = response.headers.get("content-type") ?? "";
      pricingApiLog(debug, "ica response", { status: response.status, contentType });
      if (!response.ok || !contentType.includes("application/json")) continue;
      const fetchedAt = new Date(currentTime).toISOString();
      const payload = await response.json();
      const rawProducts = getProducts(payload);
      const products = rawProducts
        .map((product) => normalizeIcaProduct(product, normalizedStoreId, fetchedAt))
        .filter((product): product is ProductPrice => product !== null);
      pricingApiLog(debug, "ica products parsed", {
        rawProductCount: rawProducts.length,
        normalizedProductCount: products.length,
        payloadShape: products.length === 0 ? getPayloadShape(payload) : undefined,
        products: products.slice(0, 5).map((product) => ({
          productName: product.productName,
          priceSek: product.priceSek,
          unitLabel: product.unitLabel,
          category: product.category,
        })),
      });
      cache.set(cacheKey, {
        expiresAt: currentTime + (products.length > 0 ? CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS),
        products,
      });
      return products;
    } catch (error) {
      lastError = error;
      pricingApiLog(debug, "ica endpoint error", {
        searchUrl: searchUrl.origin + searchUrl.pathname,
        error,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  pricingApiLog(
    debug,
    "ica error",
    lastError ?? new Error("ICA returned no usable JSON product response"),
  );
  pricingApiLog(debug, "ica fallback", {
    fallbackCount: 0,
    staleCacheIgnored: Boolean(cached),
  });
  cache.set(cacheKey, {
    expiresAt: currentTime + NEGATIVE_CACHE_TTL_MS,
    products: [],
  });
  return [];
}

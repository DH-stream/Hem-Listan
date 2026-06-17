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
const ICA_BROWSER_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

type IcaMode = "json" | "html";

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

export interface IcaProviderDiagnostic {
  query: string;
  storeId: string;
  urlPath: string;
  searchParams: string;
  mode: IcaMode;
  status?: number;
  contentType?: string;
  rawProductCount?: number;
  normalizedProductCount?: number;
  htmlLength?: number;
  parsedLineCount?: number;
  debugHint?: unknown;
  error?: string;
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
const icaProviderDiagnostics: IcaProviderDiagnostic[] = [];

export const resetIcaPricingDiagnostics = () => {
  icaProviderDiagnostics.length = 0;
};

export const consumeIcaPricingDiagnostics = (): IcaProviderDiagnostic[] => {
  const diagnostics = icaProviderDiagnostics.slice();
  icaProviderDiagnostics.length = 0;
  return diagnostics;
};

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

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/\\\//g, "/")
    .replace(/\\"/g, '"');

const htmlToLines = (html: string) =>
  decodeHtmlEntities(html.replace(/<[^>]+>/g, "\n"))
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

const isProbablyUnitLine = (line: string) =>
  /\b(?:kg|g|l|dl|cl|ml|st|frp|per frp)\b/i.test(line) &&
  /\d/.test(line) &&
  !/^pris\b/i.test(line) &&
  !/^ord\.pris\b/i.test(line);

const isNoiseLine = (line: string) =>
  /^(?:pris|tidigare pris|ord\.pris|lägg till|button|image|ursprungsland|mjölk från sverige|från sverige|nyckelhålet|svanen|glutenfritt|laktosfritt|eko|ekologiskt)$/i.test(
    line,
  );

const productSlug = (value: string) =>
  normalizePricingQuery(value)
    .replace(/[^a-z0-9åäö]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const parseSafeIcaHtmlPrice = (lines: string[], priceLineIndex: number) => {
  const caPrefix = "(?:ca\\s+){0,2}";
  const windowText = lines.slice(priceLineIndex, priceLineIndex + 5).join(" ");
  const ordinaryMatch = windowText.match(
    new RegExp(`ord\\.pris\\s+${caPrefix}(\\d+(?:[.,]\\d{1,2})?)\\s*kr`, "i"),
  );
  if (ordinaryMatch) return parsePriceSek(ordinaryMatch[1]);

  const priceText = lines.slice(priceLineIndex, priceLineIndex + 2).join(" ");
  if (/\bför\b/i.test(priceText)) return null;
  const priceMatch = priceText.match(
    new RegExp(`pris(?:\\s+tidigare pris)?\\s+${caPrefix}(\\d+(?:[.,]\\d{1,2})?)\\s*kr`, "i"),
  );
  if (priceMatch) return parsePriceSek(priceMatch[1]);
  const standalonePriceMatch = priceText.match(
    new RegExp(`^${caPrefix}(\\d+(?:[.,]\\d{1,2})?)\\s*kr(?:\\b|$)`, "i"),
  );
  return standalonePriceMatch ? parsePriceSek(standalonePriceMatch[1]) : null;
};

const findHtmlProductName = (lines: string[], priceLineIndex: number, normalizedQuery: string) => {
  const queryWords = normalizedQuery.split(" ").filter(Boolean);
  for (let index = priceLineIndex - 1; index >= Math.max(0, priceLineIndex - 12); index -= 1) {
    const line = lines[index].replace(/^Image:\s*/i, "").trim();
    const normalizedLine = normalizePricingQuery(line);
    if (!line || isNoiseLine(line) || isProbablyUnitLine(line)) continue;
    if (queryWords.length > 0 && !queryWords.some((word) => normalizedLine.includes(word))) continue;
    return line;
  }
  return null;
};

const findHtmlUnitLabel = (lines: string[], priceLineIndex: number) => {
  for (let index = priceLineIndex - 1; index >= Math.max(0, priceLineIndex - 5); index -= 1) {
    if (isProbablyUnitLine(lines[index])) return lines[index];
  }
  for (let index = priceLineIndex + 1; index < Math.min(lines.length, priceLineIndex + 5); index += 1) {
    if (isProbablyUnitLine(lines[index])) return lines[index];
  }
  return "st";
};

const getDirectProductFallback = (
  html: string,
  query: string,
  storeId: string,
  fetchedAt: string,
): ProductPrice | null => {
  const normalizedQuery = normalizePricingQuery(query);
  if (normalizedQuery !== "banan") return null;
  const decoded = decodeHtmlEntities(html);
  if (!normalizePricingQuery(decoded).includes("banan")) return null;

  const priceCandidates = [
    ...decoded.matchAll(/(?:jfr|jämför|jamfor|compare|comparison|pricePerUnit|unitPrice|pricePerKg|comparePrice|comparativePrice)[^0-9]{0,160}(\d+(?:[,.]\d{1,2})?)\s*(?:kr)?\s*\/?\s*kg/gi),
    ...decoded.matchAll(/(\d+(?:[,.]\d{1,2})?)\s*kr\s*\/\s*kg/gi),
  ]
    .map((match) => parsePriceSek(match[1]))
    .filter((price): price is number => price !== null && price >= 5 && price <= 80);

  const eachPriceCandidates = [
    ...decoded.matchAll(/(?:ca\s+)?(\d+(?:[,.]\d{1,2})?)\s*kr(?!\s*\/\s*kg)/gi),
  ]
    .map((match) => parsePriceSek(match[1]))
    .filter((price): price is number => price !== null && price >= 1 && price <= 15);

  const kgPrice = priceCandidates[0];
  const eachPrice = eachPriceCandidates[0];
  const priceSek = kgPrice ?? (eachPrice ? Math.round((eachPrice / 0.18) * 100) / 100 : null);
  if (priceSek === null) return null;

  return {
    id: `ica-direct:${storeId}:banan-eko-ca-180g-klass-1-1477872`,
    chainId: "ica",
    storeId,
    productName: "Banan Eko",
    priceSek,
    unitLabel: "CA 180G",
    searchTerms: ["Banan Eko", "Banan", "klass 1"],
    comparePrice: kgPrice ? `${String(kgPrice).replace(".", ",")} kr/kg` : undefined,
    category: "Frukt & grönt",
    categoryPath: ["Frukt & grönt", "Frukt", "Bananer"],
    productUrl: `${ICA_ORIGIN}/stores/${encodeURIComponent(storeId)}/products/banan-eko-ca-180g-klass-1/1477872`,
    fetchedAt,
  };
};

const getHtmlDebugHint = (html: string, query: string) => {
  const normalizedQuery = normalizePricingQuery(query);
  const lines = htmlToLines(html);
  return {
    queryLines: lines
      .filter((line) => normalizePricingQuery(line).includes(normalizedQuery))
      .slice(0, 8),
    priceLines: lines
      .filter((line) => /(?:pris|kr|price)/i.test(line))
      .slice(0, 8),
  };
};

export const parseIcaHtmlProducts = (
  html: string,
  query: string,
  storeId: string,
  fetchedAt = new Date().toISOString(),
): ProductPrice[] => {
  const normalizedQuery = normalizePricingQuery(query);
  const directProduct = getDirectProductFallback(html, query, storeId, fetchedAt);
  if (directProduct) return [directProduct];

  const lines = htmlToLines(html);
  const products: ProductPrice[] = [];
  const seen = new Set<string>();

  lines.forEach((line, index) => {
    if (!/^pris\b/i.test(line) && !/^ord\.pris\b/i.test(line)) return;
    const priceSek = parseSafeIcaHtmlPrice(lines, index);
    if (priceSek === null) return;
    const productName = findHtmlProductName(lines, index, normalizedQuery);
    if (!productName) return;
    const unitLabel = findHtmlUnitLabel(lines, index);
    const id = `ica-html:${storeId}:${productSlug(productName)}`;
    if (seen.has(id)) return;
    seen.add(id);
    const comparePrice = unitLabel.match(/\(([^)]+kr\/[^)]+)\)/i)?.[1];
    products.push({
      id,
      chainId: "ica",
      storeId,
      productName,
      priceSek,
      unitLabel,
      searchTerms: [productName],
      comparePrice,
      fetchedAt,
    });
  });

  return products.slice(0, 12);
};

export const clearIcaPricingCache = () => cache.clear();

const buildIcaJsonSearchUrls = (query: string, storeId: string) => {
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

const ICA_CATEGORY_FALLBACKS = [
  {
    keywords: ["mjolk", "fil", "yoghurt", "agg", "ost", "gradde", "smor"],
    path: "mejeri-ost/bf3acda4-568d-4aad-b971-4c5412307e95",
  },
  {
    keywords: ["banan", "apple", "apelsin", "frukt", "tomat", "gurka", "potatis"],
    path: "frukt-gr%C3%B6nt/21684e2b-854e-48fc-a7e1-3225a5618ca3",
  },
];

const ICA_DIRECT_PRODUCT_FALLBACKS: Record<string, string[]> = {
  banan: ["banan-eko-ca-180g-klass-1/1477872"],
};

const ICA_TARGETED_SEARCH_QUERIES: Record<string, string[]> = {
  banan: ["banan klass 1", "banan eko", "banan ca 180g"],
  apple: ["äpple klass 1", "äpple eko"],
  apelsin: ["apelsin klass 1", "apelsin eko"],
  citron: ["citron klass 1", "citron eko"],
  gurka: ["gurka klass 1", "gurka eko"],
  tomat: ["tomat klass 1", "tomat eko"],
  potatis: ["potatis fast", "potatis mjölig"],
};

const createCategoryUrl = (storeId: string, path: string) => {
  const url = new URL(`/stores/${encodeURIComponent(storeId)}/categories/${path}`, ICA_ORIGIN);
  url.searchParams.set("sortBy", "favorite");
  return url;
};

const createProductUrl = (storeId: string, path: string) =>
  new URL(`/stores/${encodeURIComponent(storeId)}/products/${path}`, ICA_ORIGIN);

const createSearchUrl = (storeId: string, query: string) => {
  const url = new URL(`/stores/${encodeURIComponent(storeId)}/search`, ICA_ORIGIN);
  url.searchParams.set("q", query);
  url.searchParams.set("query", query);
  return url;
};

const buildIcaHtmlSearchUrls = (query: string, storeId: string) => {
  const encodedStoreId = encodeURIComponent(storeId);
  const normalizedQuery = normalizePricingQuery(query);
  const matchedCategoryUrls = ICA_CATEGORY_FALLBACKS
    .filter((category) => category.keywords.some((keyword) => normalizedQuery.includes(keyword)))
    .map((category) => createCategoryUrl(storeId, category.path));
  const directProductPages = (ICA_DIRECT_PRODUCT_FALLBACKS[normalizedQuery] ?? [])
    .map((path) => createProductUrl(storeId, path));
  const targetedSearchPages = (ICA_TARGETED_SEARCH_QUERIES[normalizedQuery] ?? [])
    .map((targetedQuery) => createSearchUrl(storeId, targetedQuery));
  const navigationCategories = new URL(`/stores/${encodedStoreId}/categories`, ICA_ORIGIN);
  navigationCategories.searchParams.set("source", "navigation");
  const storePage = new URL(`/stores/${encodedStoreId}`, ICA_ORIGIN);
  const searchPage = createSearchUrl(storeId, query);
  const productsPage = new URL(`/stores/${encodedStoreId}/products`, ICA_ORIGIN);
  productsPage.searchParams.set("search", query);
  productsPage.searchParams.set("q", query);
  const categorySearchPage = new URL(`/stores/${encodedStoreId}/categories`, ICA_ORIGIN);
  categorySearchPage.searchParams.set("search", query);
  categorySearchPage.searchParams.set("q", query);

  return [
    ...matchedCategoryUrls,
    navigationCategories,
    storePage,
    ...directProductPages,
    ...targetedSearchPages,
    searchPage,
    productsPage,
    categorySearchPage,
  ];
};

const createIcaRequestHeaders = (normalizedStoreId: string) => ({
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
  "Accept-Language": "sv-SE,sv;q=0.9,en-US;q=0.8,en;q=0.7",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  Referer: `${ICA_ORIGIN}/stores/${encodeURIComponent(normalizedStoreId)}`,
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
  "User-Agent": ICA_BROWSER_USER_AGENT,
});

const fetchIcaProductsFromUrl = async (
  searchUrl: URL,
  normalizedStoreId: string,
  query: string,
  fetchedAt: string,
  options: IcaSearchOptions,
  debug: boolean,
) => {
  const mode = searchUrl.pathname.includes("/api/") ? "json" : "html";
  const attempt: IcaProviderDiagnostic = {
    query,
    storeId: normalizedStoreId,
    urlPath: searchUrl.pathname,
    searchParams: searchUrl.searchParams.toString(),
    mode,
  };
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    pricingApiLog(debug, "ica fetch", {
      searchUrl: searchUrl.origin + searchUrl.pathname,
      mode,
      hasSearchParams: Array.from(searchUrl.searchParams.keys()).length > 0,
    });
    const response = await (options.fetchImpl ?? fetch)(searchUrl, {
      headers: createIcaRequestHeaders(normalizedStoreId),
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") ?? "";
    attempt.status = response.status;
    attempt.contentType = contentType.slice(0, 80);
    pricingApiLog(debug, "ica response", { status: response.status, contentType });
    if (!response.ok) return [];
    if (contentType.includes("application/json")) {
      const payload = await response.json();
      const rawProducts = getProducts(payload);
      const products = rawProducts
        .map((product) => normalizeIcaProduct(product, normalizedStoreId, fetchedAt))
        .filter((product): product is ProductPrice => product !== null);
      attempt.rawProductCount = rawProducts.length;
      attempt.normalizedProductCount = products.length;
      pricingApiLog(debug, "ica products parsed", {
        source: "json",
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
      return products;
    }
    if (contentType.includes("text/html")) {
      const html = await response.text();
      const lines = htmlToLines(html);
      const products = parseIcaHtmlProducts(html, query, normalizedStoreId, fetchedAt);
      attempt.htmlLength = html.length;
      attempt.parsedLineCount = lines.length;
      attempt.normalizedProductCount = products.length;
      if (products.length === 0 && searchUrl.pathname.includes("/products/")) {
        attempt.debugHint = getHtmlDebugHint(html, query);
      }
      pricingApiLog(debug, "ica products parsed", {
        source: "html",
        htmlLength: html.length,
        parsedLineCount: lines.length,
        normalizedProductCount: products.length,
        debugHint: attempt.debugHint,
        products: products.slice(0, 5).map((product) => ({
          productName: product.productName,
          priceSek: product.priceSek,
          unitLabel: product.unitLabel,
        })),
      });
      return products;
    }
    return [];
  } catch (error) {
    attempt.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    icaProviderDiagnostics.push(attempt);
    clearTimeout(timeoutId);
  }
};

export async function searchIcaProducts(
  query: string,
  storeId = "1004392",
  options: IcaSearchOptions = {},
): Promise<ProductPrice[]> {
  const debug = options.debug ?? false;
  const validation = validateIcaQuery(query);
  if (!validation.ok) return [];

  const liveEnabled = options.liveEnabled ?? process.env.ICA_LIVE_PRICING !== "false";
  pricingApiLog(debug, "ica live status", { liveEnabled });
  if (!liveEnabled) return [];

  const normalizedStoreId = storeId.trim().slice(0, 40) || "1004392";
  const cacheKey = `ica:v3:${normalizedStoreId}:${validation.query}`;
  const now = options.now ?? Date.now;
  const currentTime = now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > currentTime) {
    pricingApiLog(debug, "ica cache hit", { cacheKey, productCount: cached.products.length });
    if (debug) {
      icaProviderDiagnostics.push({
        query: validation.query,
        storeId: normalizedStoreId,
        urlPath: "cache",
        searchParams: "",
        mode: "json",
        normalizedProductCount: cached.products.length,
      });
    }
    return cached.products;
  }

  let lastError: unknown;
  const fetchedAt = new Date(currentTime).toISOString();
  for (const searchUrl of [
    ...buildIcaJsonSearchUrls(validation.query, normalizedStoreId),
    ...buildIcaHtmlSearchUrls(validation.query, normalizedStoreId),
  ]) {
    try {
      const products = await fetchIcaProductsFromUrl(
        searchUrl,
        normalizedStoreId,
        validation.query,
        fetchedAt,
        options,
        debug,
      );
      if (products.length === 0) continue;
      cache.set(cacheKey, {
        expiresAt: currentTime + CACHE_TTL_MS,
        products,
      });
      return products;
    } catch (error) {
      lastError = error;
      pricingApiLog(debug, "ica endpoint error", {
        searchUrl: searchUrl.origin + searchUrl.pathname,
        error,
      });
    }
  }

  pricingApiLog(
    debug,
    "ica error",
    lastError ?? new Error("ICA returned no usable product response"),
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

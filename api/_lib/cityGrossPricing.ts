import type { ProductPrice } from "../../src/lib/pricing/types";

const CITY_GROSS_ORIGIN = "https://www.citygross.se";
const CITY_GROSS_SEARCH_URL = `${CITY_GROSS_ORIGIN}/api/v1/Loop54/search`;
const CITY_GROSS_IMAGE_BASE_URL = `${CITY_GROSS_ORIGIN}/images/products`;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 20 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 7_000;
export const MAX_PRICING_QUERY_LENGTH = 80;

interface CacheEntry {
  expiresAt: number;
  products: ProductPrice[];
}

interface CityGrossSearchOptions {
  fetchImpl?: typeof fetch;
  now?: () => number;
  liveEnabled?: boolean;
}

interface CityGrossProduct {
  id?: unknown;
  name?: unknown;
  brand?: unknown;
  subtitle?: unknown;
  descriptiveSize?: unknown;
  url?: unknown;
  images?: Array<{ url?: unknown }>;
  productStoreDetails?: {
    prices?: {
      currentPrice?: {
        price?: unknown;
        unit?: unknown;
        comparativePrice?: unknown;
        comparativePriceUnit?: unknown;
      };
      hasDiscount?: unknown;
      hasPromotion?: unknown;
    };
  };
}

const cache = new Map<string, CacheEntry>();

export const normalizePricingQuery = (value: string) =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("sv-SE")
    .replace(/\s+/g, " ")
    .trim();

export const validatePricingQuery = (value: unknown) => {
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

export const parsePriceSek = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number.parseFloat(
    value.replace(/\s/g, "").replace(/kr/gi, "").replace(",", "."),
  );
  return Number.isFinite(parsed) ? parsed : null;
};

const unitLabel = (value: unknown) => {
  if (typeof value !== "string") return "st";
  const units: Record<string, string> = {
    PCE: "st",
    KGM: "kg",
    LTR: "l",
  };
  return units[value] ?? value.toLocaleLowerCase("sv-SE");
};

const absoluteUrl = (value: unknown, baseUrl: string) => {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return undefined;
  }
};

export const normalizeCityGrossProduct = (
  product: CityGrossProduct,
  storeId?: string,
  fetchedAt = new Date().toISOString(),
): ProductPrice | null => {
  const currentPrice = product.productStoreDetails?.prices?.currentPrice;
  const priceSek = parsePriceSek(currentPrice?.price);
  if (
    typeof product.id !== "string" ||
    typeof product.name !== "string" ||
    priceSek === null
  ) {
    return null;
  }

  const brand = typeof product.brand === "string" ? product.brand.trim() : "";
  const productName = [brand, product.name.trim()].filter(Boolean).join(" ");
  const comparativePrice = parsePriceSek(currentPrice?.comparativePrice);
  const comparativeUnit = unitLabel(currentPrice?.comparativePriceUnit);
  const imageName = product.images?.find((image) => typeof image.url === "string")?.url;

  return {
    id: product.id,
    chainId: "city_gross",
    storeId: storeId ?? "city-gross-public",
    productName,
    priceSek,
    unitLabel:
      typeof product.descriptiveSize === "string" && product.descriptiveSize.trim()
        ? product.descriptiveSize.trim()
        : unitLabel(currentPrice?.unit),
    searchTerms: [product.name, brand, product.subtitle]
      .filter((term): term is string => typeof term === "string" && term.trim() !== ""),
    comparePrice:
      comparativePrice === null
        ? undefined
        : `${comparativePrice.toLocaleString("sv-SE")} kr/${comparativeUnit}`,
    productUrl: absoluteUrl(product.url, CITY_GROSS_ORIGIN),
    imageUrl: absoluteUrl(imageName, `${CITY_GROSS_IMAGE_BASE_URL}/`),
    isCampaign: Boolean(
      product.productStoreDetails?.prices?.hasDiscount ||
        product.productStoreDetails?.prices?.hasPromotion,
    ),
    fetchedAt,
  };
};

const getProducts = (payload: unknown): CityGrossProduct[] => {
  if (!payload || typeof payload !== "object") return [];
  const products = (payload as { searchResults?: { products?: unknown } }).searchResults
    ?.products;
  return Array.isArray(products) ? (products as CityGrossProduct[]) : [];
};

export const clearCityGrossPricingCache = () => cache.clear();

export async function searchCityGrossProducts(
  query: string,
  storeId?: string,
  options: CityGrossSearchOptions = {},
): Promise<ProductPrice[]> {
  const validation = validatePricingQuery(query);
  if (!validation.ok) return [];

  const liveEnabled =
    options.liveEnabled ?? process.env.CITY_GROSS_LIVE_PRICING !== "false";
  if (!liveEnabled) return [];

  const normalizedStoreId = storeId?.trim().slice(0, 40) || "public";
  const cacheKey = `city_gross:${normalizedStoreId}:${validation.query}`;
  const now = options.now ?? Date.now;
  const currentTime = now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > currentTime) return cached.products;

  const searchUrl = new URL(CITY_GROSS_SEARCH_URL);
  searchUrl.searchParams.set("SearchQuery", validation.query);
  searchUrl.searchParams.set("skip", "0");
  searchUrl.searchParams.set("take", "12");
  searchUrl.searchParams.set("type", "product");
  if (storeId?.trim()) searchUrl.searchParams.set("store", storeId.trim().slice(0, 40));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await (options.fetchImpl ?? fetch)(searchUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Hem-Listan/1.2 (+public grocery price lookup)",
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`City Gross returned ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      throw new Error("City Gross returned a non-JSON response");
    }

    const fetchedAt = new Date(currentTime).toISOString();
    const products = getProducts(await response.json())
      .map((product) => normalizeCityGrossProduct(product, storeId, fetchedAt))
      .filter((product): product is ProductPrice => product !== null);

    cache.set(cacheKey, {
      expiresAt:
        currentTime + (products.length > 0 ? CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS),
      products,
    });
    return products;
  } catch {
    const fallbackProducts = cached?.products ?? [];
    cache.set(cacheKey, {
      expiresAt: currentTime + NEGATIVE_CACHE_TTL_MS,
      products: fallbackProducts,
    });
    return fallbackProducts;
  } finally {
    clearTimeout(timeoutId);
  }
}

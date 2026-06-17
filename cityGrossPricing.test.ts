import assert from "node:assert/strict";
import test from "node:test";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { Readable } from "node:stream";
import basketPricingHandler, {
  createBasketPricingHandler,
  serializePricingError,
} from "./api/pricing/basket";
import {
  calculateCityGrossBasket,
  validateBasketPricingRequest,
} from "./api/_lib/basketPricing";
import {
  clearCityGrossPricingCache,
  parsePriceSek,
  searchCityGrossProducts,
} from "./api/_lib/cityGrossPricing";
import type { ProductPrice } from "./src/lib/pricing/types";
import {
  cleanCityGrossSearchQuery,
  matchListItem,
} from "./api/_lib/pricingMatching";

type TestResponse = ServerResponse & {
  status(statusCode: number): TestResponse;
  json(body: unknown): TestResponse;
  responseBody?: unknown;
};

const createResponse = () => {
  const response = {
    statusCode: 200,
    setHeader() {
      return response;
    },
    status(statusCode: number) {
      response.statusCode = statusCode;
      return response;
    },
    json(body: unknown) {
      response.responseBody = body;
      return response;
    },
    responseBody: undefined as unknown,
  };
  return response as unknown as TestResponse;
};

const milkProduct: ProductPrice = {
  id: "milk-1",
  chainId: "city_gross",
  storeId: "city-gross-public",
  productName: "Arla Mellanmjölk 1 l",
  priceSek: 15.95,
  unitLabel: "1 l",
  searchTerms: ["mjölk", "mellanmjölk"],
};

test("basket pricing runtime stays inside the API bundle", () => {
  const source = readFileSync(
    new URL("./api/_lib/basketPricing.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /from "\.\/pricingMatching\.js"/);
  assert.doesNotMatch(source, /from "\.\.\/\.\.\/src\/lib\/pricing\/matching"/);
});

test("basket pricing endpoint accepts an object body", async () => {
  const response = createResponse();
  await basketPricingHandler(
    {
      method: "POST",
      body: { chain: "city_gross", items: [{ id: "milk", name: "mjölk" }] },
    } as unknown as IncomingMessage,
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(
    (response.responseBody as { matches: unknown[] }).matches.length,
    1,
  );
});

test("basket pricing endpoint accepts a JSON string body", async () => {
  const response = createResponse();
  await basketPricingHandler(
    {
      method: "POST",
      body: JSON.stringify({
        chain: "city_gross",
        items: [{ id: "milk", name: "mjölk" }],
      }),
    } as unknown as IncomingMessage,
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(
    (response.responseBody as { matches: unknown[] }).matches.length,
    1,
  );
});

test("basket pricing endpoint accepts a raw request stream", async () => {
  const response = createResponse();
  const request = Readable.from([
    JSON.stringify({
      chain: "city_gross",
      items: [{ id: "milk", name: "mjölk" }],
    }),
  ]) as IncomingMessage;
  request.method = "POST";

  await basketPricingHandler(request, response);

  assert.equal(response.statusCode, 200);
  assert.equal(
    (response.responseBody as { matches: unknown[] }).matches.length,
    1,
  );
});

test("basket pricing endpoint returns 400 for invalid JSON", async () => {
  const response = createResponse();
  await basketPricingHandler(
    { method: "POST", body: "{" } as unknown as IncomingMessage,
    response,
  );

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.responseBody, { error: "Invalid JSON body." });
});

test("basket pricing endpoint returns 400 when items are missing", async () => {
  const response = createResponse();
  await basketPricingHandler(
    {
      method: "POST",
      body: { chain: "city_gross" },
    } as unknown as IncomingMessage,
    response,
  );

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.responseBody, {
    error: "At least one item is required.",
  });
});

test("basket pricing endpoint degrades safely when calculation throws", async () => {
  const pricing = await import("./api/_lib/basketPricing");
  const handler = createBasketPricingHandler(async () => ({
    ...pricing,
    calculateCityGrossBasket: async () => {
      throw new Error("City Gross exploded");
    },
  }));
  const response = createResponse();

  await handler(
    {
      method: "POST",
      url: "/api/pricing/basket?debug=1",
      body: { chain: "city_gross", items: [{ id: "milk", name: "mjölk" }] },
    } as unknown as IncomingMessage,
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.responseBody, {
    matches: [],
    approximateTotalSek: 0,
    error: "Basket pricing unavailable",
    debugCode: "calculation_failed",
    debugMessage: "City Gross exploded",
  });
});

test("basket pricing endpoint does not use City Gross fallback for ICA requests", async () => {
  const pricing = await import("./api/_lib/basketPricing");
  let cityGrossFallbackCalled = false;
  const handler = createBasketPricingHandler(async () => ({
    ...pricing,
    calculateBasketPricing: undefined,
    calculateCityGrossBasket: async () => {
      cityGrossFallbackCalled = true;
      throw new Error("City Gross fallback should not run");
    },
  }));
  const response = createResponse();

  await handler(
    {
      method: "POST",
      url: "/api/pricing/basket?debug=1",
      body: {
        chain: "ica",
        storeId: "1004392",
        items: [{ id: "milk", name: "mjölk" }],
      },
    } as unknown as IncomingMessage,
    response,
  );

  assert.equal(cityGrossFallbackCalled, false);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.responseBody, {
    matches: [],
    approximateTotalSek: 0,
    error: "Basket pricing unavailable",
    debugCode: "calculation_failed",
    debugMessage: "Basket pricing calculator unavailable for selected chain",
  });
});

test("basket pricing endpoint hides calculation details without debug mode", async () => {
  const pricing = await import("./api/_lib/basketPricing");
  const handler = createBasketPricingHandler(async () => ({
    ...pricing,
    calculateCityGrossBasket: async () => {
      throw new Error("Sensitive calculation detail");
    },
  }));
  const response = createResponse();

  await handler(
    {
      method: "POST",
      body: { chain: "city_gross", items: [{ id: "milk", name: "mjölk" }] },
    } as unknown as IncomingMessage,
    response,
  );

  assert.deepEqual(response.responseBody, {
    matches: [],
    approximateTotalSek: 0,
    error: "Basket pricing unavailable",
  });
});

test("basket pricing endpoint identifies module load failures in debug mode", async () => {
  const handler = createBasketPricingHandler(async () => {
    throw new Error("Cannot find basket pricing module");
  });
  const response = createResponse();

  await handler(
    {
      method: "POST",
      url: "/api/pricing/basket?pricingDebug=1",
      body: { chain: "city_gross", items: [{ id: "milk", name: "mjölk" }] },
    } as unknown as IncomingMessage,
    response,
  );

  assert.deepEqual(response.responseBody, {
    matches: [],
    approximateTotalSek: 0,
    error: "Basket pricing unavailable",
    debugCode: "module_load_failed",
    debugMessage: "Cannot find basket pricing module",
  });
});

test("basket pricing endpoint hides module load details without debug mode", async () => {
  const handler = createBasketPricingHandler(async () => {
    throw new Error("Sensitive module path");
  });
  const response = createResponse();

  await handler(
    {
      method: "POST",
      body: { chain: "city_gross", items: [{ id: "milk", name: "mjölk" }] },
    } as unknown as IncomingMessage,
    response,
  );

  assert.deepEqual(response.responseBody, {
    matches: [],
    approximateTotalSek: 0,
    error: "Basket pricing unavailable",
  });
});

test("basket pricing endpoint adds validation diagnostics only in debug mode", async () => {
  const response = createResponse();
  await basketPricingHandler(
    {
      method: "POST",
      url: "/api/pricing/basket?debug=1",
      body: { chain: "city_gross" },
    } as unknown as IncomingMessage,
    response,
  );

  assert.deepEqual(response.responseBody, {
    error: "At least one item is required.",
    debugCode: "validation_failed",
    debugMessage: "At least one item is required.",
  });
});

test("basket pricing endpoint adds invalid JSON diagnostics only in debug mode", async () => {
  const response = createResponse();
  await basketPricingHandler(
    {
      method: "POST",
      url: "/api/pricing/basket?debug=1",
      body: "{",
    } as unknown as IncomingMessage,
    response,
  );

  assert.deepEqual(response.responseBody, {
    error: "Invalid JSON body.",
    debugCode: "invalid_json",
    debugMessage: "Invalid JSON body.",
  });
});

test("pricing error serialization exposes only safe fields", () => {
  const cause = new Error("upstream refused");
  const error = Object.assign(new Error("pricing failed", { cause }), {
    code: "E_PRICE",
    stack: "sensitive stack",
    secret: "do not expose",
  });

  assert.deepEqual(serializePricingError(error), {
    name: "Error",
    message: "pricing failed",
    code: "E_PRICE",
    causeMessage: "upstream refused",
  });
});

test("basket pricing endpoint returns 400 for an empty basket", async () => {
  const response = createResponse();
  await basketPricingHandler(
    {
      method: "POST",
      body: { chain: "city_gross", items: [] },
    } as unknown as IncomingMessage,
    response,
  );

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.responseBody, {
    error: "At least one item is required.",
  });
});

test("basket request validation rejects unsupported chains", () => {
  assert.deepEqual(
    validateBasketPricingRequest({
      chain: "other",
      items: [{ id: "1", name: "mjölk" }],
    }),
    { ok: false, error: "Unsupported grocery chain." },
  );
});

test("normalizes a Swedish price string", () => {
  assert.equal(parsePriceSek("34,50 kr"), 34.5);
});

test("cleans quantities and recipe notes from City Gross search queries", () => {
  const examples = [
    ["Röd paprika (1 st)", "Röd paprika"],
    ["Potatis (400 g)", "Potatis"],
    ["Tomatpuré (15 ml)", "Tomatpuré"],
    ["Crème fraiche (1 dl)", "Crème fraiche"],
    ["Kycklingfilé (ca 500 g)", "Kycklingfilé"],
    ["Babyspenat (1 förp)", "Babyspenat"],
  ];

  for (const [input, expected] of examples) {
    assert.equal(cleanCityGrossSearchQuery(input), expected);
  }
});

test("basket pricing searches with a cleaned query and keeps the original item name", async () => {
  const queries: string[] = [];
  const originalName = "Kycklingfilé (ca 500 g)";
  const chickenProduct: ProductPrice = {
    id: "chicken",
    chainId: "city_gross",
    storeId: "demo",
    productName: "Kycklingfilé",
    priceSek: 59.95,
    unitLabel: "500 g",
    searchTerms: ["kycklingfilé"],
  };

  const result = await calculateCityGrossBasket(
    {
      chain: "city_gross",
      items: [{ id: "chicken", name: originalName }],
    },
    {
      searchProducts: async (query) => {
        queries.push(query);
        return [chickenProduct];
      },
    },
  );

  assert.deepEqual(queries, ["Kycklingfilé"]);
  assert.equal(result.matches[0].listItemName, originalName);
  assert.equal(result.matches[0].product?.id, "chicken");
});

test("generic egg ranking prefers a normal pack over bulk and eco premium", () => {
  const eggProducts: ProductPrice[] = [
    {
      id: "24-pack",
      chainId: "city_gross",
      storeId: "demo",
      productName: "GARANT Ägg 24P Frigående Inomhus",
      priceSek: 59.95,
      unitLabel: "24 st",
      searchTerms: ["ägg"],
    },
    {
      id: "12-pack",
      chainId: "city_gross",
      storeId: "demo",
      productName: "GARANT Ägg 12P Frigående Inomhus",
      priceSek: 34.95,
      unitLabel: "12 st",
      searchTerms: ["ägg"],
    },
    {
      id: "eco-6-pack",
      chainId: "city_gross",
      storeId: "demo",
      productName: "EKO Ägg 6P",
      priceSek: 39.95,
      unitLabel: "6 st",
      searchTerms: ["ägg"],
    },
  ];

  assert.equal(
    matchListItem({ id: "eggs", name: "Ägg" }, eggProducts).product?.id,
    "12-pack",
  );
});

test("explicit eco egg queries do not penalize eco products", () => {
  const eggProducts: ProductPrice[] = [
    {
      id: "standard",
      chainId: "city_gross",
      storeId: "demo",
      productName: "GARANT Ägg 12P Frigående Inomhus",
      priceSek: 34.95,
      unitLabel: "12 st",
      searchTerms: ["ägg"],
    },
    {
      id: "eco",
      chainId: "city_gross",
      storeId: "demo",
      productName: "EKO Ägg 6P",
      priceSek: 39.95,
      unitLabel: "6 st",
      searchTerms: ["eko ägg"],
    },
  ];

  assert.equal(
    matchListItem({ id: "eggs", name: "eko ägg" }, eggProducts).product?.id,
    "eco",
  );
});

test("basket pricing deduplicates normalized item queries", async () => {
  const queries: string[] = [];
  const result = await calculateCityGrossBasket(
    {
      chain: "city_gross",
      items: [
        { id: "milk-1", name: "Mjölk" },
        { id: "milk-2", name: "2 l mjölk" },
      ],
    },
    {
      searchProducts: async (query) => {
        queries.push(query);
        return [milkProduct];
      },
    },
  );

  assert.deepEqual(queries, ["Mjölk"]);
  assert.equal(result.matches.length, 2);
  assert.equal(result.approximateTotalSek, 47.85);
});

test("failed City Gross fetch is negative-cached briefly", async () => {
  clearCityGrossPricingCache();
  let fetchCount = 0;
  const fetchImpl = async () => {
    fetchCount += 1;
    throw new Error("network unavailable");
  };

  const first = await searchCityGrossProducts(
    "negative cache test",
    undefined,
    {
      fetchImpl,
      liveEnabled: true,
      now: () => 1_000,
    },
  );
  const second = await searchCityGrossProducts(
    "negative cache test",
    undefined,
    {
      fetchImpl,
      liveEnabled: true,
      now: () => 2_000,
    },
  );

  assert.deepEqual(first, []);
  assert.deepEqual(second, []);
  assert.equal(fetchCount, 1);
});

test("expired successful cache is returned when refresh fails", async () => {
  clearCityGrossPricingCache();
  const successResponse = async () =>
    new Response(
      JSON.stringify({
        searchResults: {
          products: [
            {
              id: "egg-1",
              name: "Ägg 12-pack",
              brand: "Garant",
              descriptiveSize: "12P",
              productStoreDetails: {
                prices: { currentPrice: { price: 34.5, unit: "PCE" } },
              },
            },
          ],
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );

  const fresh = await searchCityGrossProducts("stale cache test", undefined, {
    fetchImpl: successResponse,
    liveEnabled: true,
    now: () => 0,
  });
  const stale = await searchCityGrossProducts("stale cache test", undefined, {
    fetchImpl: async () => {
      throw new Error("refresh failed");
    },
    liveEnabled: true,
    now: () => 6 * 60 * 60 * 1000 + 1,
  });

  assert.equal(fresh.length, 1);
  assert.deepEqual(stale, fresh);
});

test("normalizes public City Gross JSON without exposing the raw response", async () => {
  clearCityGrossPricingCache();
  const products = await searchCityGrossProducts(
    "ägg endpoint test",
    undefined,
    {
      liveEnabled: true,
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            searchResults: {
              products: [
                {
                  id: "egg-1",
                  name: "Ägg 12-pack",
                  brand: "Garant",
                  superCategory: "Mejeri, ost & ägg",
                  category: "Ägg",
                  bfCategory: "Hönsägg",
                  descriptiveSize: "12P",
                  url: "/matvaror/agg-p1",
                  images: [{ url: "egg.jpeg" }],
                  productStoreDetails: {
                    prices: {
                      currentPrice: {
                        price: 34.5,
                        unit: "PCE",
                        comparativePrice: 2.88,
                        comparativePriceUnit: "PCE",
                      },
                      hasPromotion: false,
                    },
                  },
                },
              ],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    },
  );

  assert.equal(products.length, 1);
  assert.equal(products[0].productName, "Garant Ägg 12-pack");
  assert.equal(products[0].priceSek, 34.5);
  assert.equal(products[0].comparePrice, "2,88 kr/st");
  assert.equal(products[0].chainId, "city_gross");
  assert.equal(products[0].category, "Mejeri, ost & ägg");
  assert.deepEqual(products[0].categoryPath, [
    "Mejeri, ost & ägg",
    "Ägg",
    "Hönsägg",
  ]);
});

const pricedProduct = (
  overrides: Partial<ProductPrice> & Pick<ProductPrice, "id" | "productName" | "priceSek" | "unitLabel">,
): ProductPrice => ({
  chainId: "city_gross",
  storeId: "demo",
  searchTerms: [],
  ...overrides,
});

test("fixed packages use the full checkout price instead of prorating recipe quantities", async () => {
  const cases = [
    {
      item: { id: "creme", name: "Crème fraiche (1 dl)" },
      product: pricedProduct({
        id: "creme-5dl",
        productName: "Crème Fraiche 5DL",
        priceSek: 28.95,
        unitLabel: "5 dl",
        searchTerms: ["crème fraiche"],
      }),
      expected: 28.95,
    },
    {
      item: { id: "puree", name: "Tomatpuré (15 ml)" },
      product: pricedProduct({
        id: "puree-300g",
        productName: "Tomatpuré 300G",
        priceSek: 25.5,
        unitLabel: "300 g",
        searchTerms: ["tomatpuré"],
      }),
      expected: 25.5,
    },
  ];

  for (const { item, product, expected } of cases) {
    const result = await calculateCityGrossBasket(
      { chain: "city_gross", items: [item] },
      { searchProducts: async () => [product] },
    );

    assert.equal(result.matches[0].estimatedCheckoutPriceSek, undefined);
    assert.equal(result.approximateTotalSek, expected);
  }
});

test("package ranking prefers a right-sized chicken product over a 2 kg pack", () => {
  const products = [
    pricedProduct({
      id: "chicken-2kg",
      productName: "ELDORADO Kyckling Filé 2KG Fryst Storpack",
      priceSek: 137.2,
      unitLabel: "2 kg",
      searchTerms: ["kycklingfilé"],
    }),
    pricedProduct({
      id: "chicken-700g",
      productName: "Kycklingfilé Naturell 700G",
      priceSek: 79.95,
      unitLabel: "700 g",
      searchTerms: ["kycklingfilé"],
    }),
  ];

  assert.equal(
    matchListItem({ id: "chicken", name: "Kycklingfilé (ca 500 g)" }, products)
      .product?.id,
    "chicken-700g",
  );
});

test("milk quantity chooses the cheapest reasonable package plan", () => {
  const products = [
    pricedProduct({
      id: "milk-1l",
      productName: "Mjölk 1L",
      priceSek: 14,
      unitLabel: "1 l",
      searchTerms: ["mjölk"],
    }),
    pricedProduct({
      id: "milk-15l",
      productName: "Mjölk 1,5L",
      priceSek: 18,
      unitLabel: "1,5 l",
      searchTerms: ["mjölk"],
    }),
    pricedProduct({
      id: "milk-2l",
      productName: "Mjölk 2L",
      priceSek: 25,
      unitLabel: "2 l",
      searchTerms: ["mjölk"],
    }),
  ];

  const match = matchListItem({ id: "milk", name: "Mjölk (2 l)" }, products);
  assert.equal(match.product?.id, "milk-2l");
  assert.equal(match.estimatedCheckoutPriceSek, 25);
  assert.equal(match.priceBasis, "package_plan");
});

test("milk package plans expose the products represented by the checkout total", () => {
  const products = [
    pricedProduct({
      id: "milk-1l",
      productName: "Mjölk 1L",
      priceSek: 14,
      unitLabel: "1 l",
      searchTerms: ["mjölk"],
    }),
    pricedProduct({
      id: "milk-15l",
      productName: "Mjölk 1,5L",
      priceSek: 18,
      unitLabel: "1,5 l",
      searchTerms: ["mjölk"],
    }),
  ];

  const onePackage = matchListItem(
    { id: "milk-11", name: "Mjölk (1,1 l)" },
    products,
  );
  assert.equal(onePackage.product?.id, "milk-15l");
  assert.equal(onePackage.estimatedCheckoutPriceSek, 18);
  assert.deepEqual(
    onePackage.purchasePlan?.items.map(({ product, count }) => [
      product.id,
      count,
    ]),
    [["milk-15l", 1]],
  );

  const mixedPackages = matchListItem(
    { id: "milk-22", name: "Mjölk (2,2 l)" },
    products,
  );
  assert.equal(mixedPackages.estimatedCheckoutPriceSek, 32);
  assert.equal(mixedPackages.purchasePlan?.purchasedAmount, 2500);
  assert.deepEqual(
    mixedPackages.purchasePlan?.items.map(({ product, count }) => [
      product.id,
      count,
    ]),
    [
      ["milk-1l", 1],
      ["milk-15l", 1],
    ],
  );
  assert.ok(
    mixedPackages.purchasePlan?.items.some(
      ({ product }) => product.id === mixedPackages.product?.id,
    ),
  );
});

test("piece-priced CA150G lemons use whole-item checkout prices", () => {
  const product = pricedProduct({
    id: "lemon-piece",
    productName: "Citron",
    priceSek: 7.95,
    unitLabel: "CA150G",
    searchTerms: ["citron"],
  });

  const one = matchListItem({ id: "lemon-1", name: "Citron (1 st)" }, [product]);
  const two = matchListItem({ id: "lemon-2", name: "Citron (2 st)" }, [product]);
  assert.equal(one.estimatedCheckoutPriceSek, 7.95);
  assert.equal(two.estimatedCheckoutPriceSek, 15.9);
  assert.equal(two.priceBasis, "package_plan");
  assert.deepEqual(
    two.purchasePlan?.items.map(({ product: plannedProduct, count }) => [
      plannedProduct.id,
      count,
    ]),
    [["lemon-piece", 2]],
  );
});

test("count requests do not multiply ordinary mass packages", () => {
  const product = pricedProduct({
    id: "apple-bag",
    productName: "Äpple 1KG",
    priceSek: 24.95,
    unitLabel: "1KG",
    searchTerms: ["äpple"],
  });

  const match = matchListItem(
    { id: "apple", name: "Äpple (2 st)" },
    [product],
  );
  assert.equal(match.product?.id, "apple-bag");
  assert.equal(match.estimatedCheckoutPriceSek, undefined);
  assert.equal(match.priceBasis, undefined);
});

test("pricing search removes obvious imported recipe noise", () => {
  assert.equal(cleanCityGrossSearchQuery("Port penne"), "penne");
  assert.equal(cleanCityGrossSearchQuery("Sesamfrön på toppen"), "Sesamfrön");
  assert.equal(
    cleanCityGrossSearchQuery("Finhackad röd paprika (1 dl)"),
    "röd paprika",
  );
  assert.equal(
    cleanCityGrossSearchQuery("Valbart dl hackad valfri färsk krydda"),
    "",
  );
});

test("weighted produce uses the estimated purchased unit weight", () => {
  const cases = [
    {
      item: { id: "pepper", name: "Röd paprika (1 st)" },
      product: pricedProduct({
        id: "pepper_KG",
        productName: "Paprika Röd",
        priceSek: 44.95,
        unitLabel: "CA200G",
        comparePrice: "44.95 kr/kg",
        searchTerms: ["röd paprika"],
      }),
      expected: 8.99,
    },
    {
      item: { id: "onion", name: "Gul lök (1 st)" },
      product: pricedProduct({
        id: "onion_KG",
        productName: "Lök Gul",
        priceSek: 10.95,
        unitLabel: "CA 175G",
        comparePrice: "10.95 kr/kg",
        searchTerms: ["gul lök"],
      }),
      expected: 1.92,
    },
  ];

  for (const { item, product, expected } of cases) {
    const match = matchListItem(item, [product]);
    assert.equal(match.estimatedCheckoutPriceSek, expected);
    assert.equal(match.priceBasis, "weighted_item_estimate");
  }
});

test("weighted meat uses the requested purchase weight", async () => {
  const product = pricedProduct({
    id: "pork_KG",
    productName: "Rimmat sidfläsk",
    priceSek: 99.35,
    unitLabel: "1 kg",
    comparePrice: "99.35 kr/kg",
    searchTerms: ["rimmat sidfläsk"],
  });
  const result = await calculateCityGrossBasket(
    {
      chain: "city_gross",
      items: [{ id: "pork", name: "Rimmat sidfläsk (300 g)" }],
    },
    { searchProducts: async () => [product] },
  );

  assert.equal(result.matches[0].estimatedCheckoutPriceSek, 29.81);
  assert.equal(result.approximateTotalSek, 29.81);
});

test("receipt-informed egg ranking prefers 10P or 15P over 24P", () => {
  const products = [
    pricedProduct({
      id: "eggs-24",
      productName: "Ägg 24P",
      priceSek: 59.95,
      unitLabel: "24 st",
      searchTerms: ["ägg"],
    }),
    pricedProduct({
      id: "eggs-10",
      productName: "Utehönsägg 10P",
      priceSek: 32.65,
      unitLabel: "10 st",
      searchTerms: ["ägg"],
    }),
    pricedProduct({
      id: "eggs-15",
      productName: "Ägg 15P Inne Medium",
      priceSek: 42.95,
      unitLabel: "15 st",
      searchTerms: ["ägg"],
    }),
  ];

  assert.ok(
    ["eggs-10", "eggs-15"].includes(
      matchListItem({ id: "eggs", name: "Ägg" }, products).product?.id ?? "",
    ),
  );
});

test("receipt-informed dairy ranking uses light and lactose-free as tiebreakers", () => {
  const cremeFraiche = [
    pricedProduct({
      id: "regular-cf",
      productName: "Crème Fraiche 34%",
      priceSek: 24.95,
      unitLabel: "2 dl",
      searchTerms: ["crème fraiche"],
    }),
    pricedProduct({
      id: "light-lf-cf",
      productName: "L/F Lätt Cr Fraiche",
      priceSek: 25.95,
      unitLabel: "2 dl",
      searchTerms: ["crème fraiche"],
    }),
  ];
  const milk = [
    pricedProduct({
      id: "uht-milk",
      productName: "Mjölk Lång Hållbarhet",
      priceSek: 22.95,
      unitLabel: "1 l",
      searchTerms: ["mjölk"],
    }),
    pricedProduct({
      id: "light-lf-milk",
      productName: "Lättmjölk 1,5% LF",
      priceSek: 19.95,
      unitLabel: "1,5 l",
      searchTerms: ["mjölk"],
    }),
  ];

  assert.equal(
    matchListItem({ id: "cf", name: "Crème fraiche" }, cremeFraiche).product?.id,
    "light-lf-cf",
  );
  assert.equal(
    matchListItem({ id: "milk", name: "Mjölk" }, milk).product?.id,
    "light-lf-milk",
  );
});

test("pasta format ranking rejects ready meals when dry pasta is available", () => {
  const products = [
    pricedProduct({
      id: "ready-penne",
      productName: "REDO Carbonara med Penne Pasta",
      priceSek: 54.95,
      unitLabel: "400 g",
      searchTerms: ["port penne"],
    }),
    pricedProduct({
      id: "dry-penne",
      productName: "Penne Pasta 500G",
      priceSek: 18.95,
      unitLabel: "500 g",
      searchTerms: ["port penne"],
    }),
  ];

  assert.equal(
    matchListItem({ id: "penne", name: "Port penne" }, products).product?.id,
    "dry-penne",
  );
});

test("returns none instead of matching penne to a prepared meal", () => {
  const products = [
    pricedProduct({
      id: "ready-penne",
      productName: "REDO Carbonara med Penne Pasta",
      priceSek: 54.95,
      unitLabel: "400 g",
      searchTerms: ["port penne"],
      category: "Kyld färdigmat",
      categoryPath: ["Färdiga rätter", "Portionsrätter"],
    }),
  ];

  const match = matchListItem({ id: "penne", name: "Port penne" }, products);
  assert.equal(match.product, null);
  assert.equal(match.confidence, "none");
});

test("returns none instead of matching a lemon ingredient to a flavored drink", () => {
  const products = [
    pricedProduct({
      id: "lemon-tonic",
      productName: "SPIRIT OF SWE Hallon&Citron Just Tonic",
      priceSek: 24.95,
      unitLabel: "20 cl",
      searchTerms: ["citron"],
      category: "Dryck",
      categoryPath: ["Dryck", "Drinkmixer"],
    }),
  ];

  const match = matchListItem({ id: "lemon", name: "Citron" }, products);
  assert.equal(match.product, null);
  assert.equal(match.confidence, "none");
});

test("potato ranking follows an explicit floury preference", () => {
  const products = [
    pricedProduct({
      id: "firm-potatoes",
      productName: "Potatis Fast 2KG",
      priceSek: 32.95,
      unitLabel: "2 kg",
      searchTerms: ["potatis mjölig"],
    }),
    pricedProduct({
      id: "floury-potatoes",
      productName: "Potatis Mjölig 2KG",
      priceSek: 32.95,
      unitLabel: "2 kg",
      searchTerms: ["potatis mjölig"],
    }),
  ];

  assert.equal(
    matchListItem({ id: "potatoes", name: "Potatis mjölig" }, products).product?.id,
    "floury-potatoes",
  );
});

test("cucumber ranking prefers a Swedish single cucumber", () => {
  const products = [
    pricedProduct({
      id: "cucumber-pack",
      productName: "Gurka 3-pack",
      priceSek: 39.95,
      unitLabel: "3 st",
      searchTerms: ["gurka"],
    }),
    pricedProduct({
      id: "cucumber-single",
      productName: "Gurka Sverige ST",
      priceSek: 14.95,
      unitLabel: "1 st",
      searchTerms: ["gurka"],
    }),
  ];

  assert.equal(
    matchListItem({ id: "cucumber", name: "Gurka" }, products).product?.id,
    "cucumber-single",
  );
});

test("falukorv ranking prefers an 800G ring", () => {
  const products = [
    pricedProduct({
      id: "falukorv-small",
      productName: "Falukorv 500G",
      priceSek: 31.95,
      unitLabel: "500 g",
      searchTerms: ["falukorv"],
    }),
    pricedProduct({
      id: "falukorv-ring",
      productName: "Falukorv Ring 800G",
      priceSek: 44.95,
      unitLabel: "800 g",
      searchTerms: ["falukorv"],
    }),
  ];

  assert.equal(
    matchListItem({ id: "falukorv", name: "Falukorv" }, products).product?.id,
    "falukorv-ring",
  );
});

test("explicit standard dairy does not automatically prefer light products", () => {
  const products = [
    pricedProduct({
      id: "standard-milk",
      productName: "Standardmjölk 3%",
      priceSek: 20.95,
      unitLabel: "1 l",
      searchTerms: ["standard mjölk"],
    }),
    pricedProduct({
      id: "light-milk",
      productName: "Lättmjölk 1,5% LF",
      priceSek: 19.95,
      unitLabel: "1 l",
      searchTerms: ["standard mjölk"],
    }),
  ];

  assert.equal(
    matchListItem({ id: "milk", name: "Standard mjölk" }, products).product?.id,
    "standard-milk",
  );
});

test("household sanity can prefer a reasonable medium-confidence egg product", () => {
  const products = [
    pricedProduct({
      id: "eggs-99-premium",
      productName: "Premium Ägg 99P",
      priceSek: 199.95,
      unitLabel: "99 st",
      searchTerms: ["ägg"],
    }),
    pricedProduct({
      id: "eggs-15-household",
      productName: "Ägg Frigående 15P",
      priceSek: 42.95,
      unitLabel: "15 st",
      searchTerms: [],
    }),
  ];

  const match = matchListItem({ id: "eggs", name: "Ägg" }, products, {
    debug: true,
  });
  assert.equal(match.product?.id, "eggs-15-household");
  assert.equal(match.confidence, "medium");
  assert.ok(match.preferenceReasons?.includes("egg_normal_pack"));
});

test("dry pasta can beat an exact search-term match for a prepared meal", () => {
  const products = [
    pricedProduct({
      id: "ready-penne-exact",
      productName: "REDO Carbonara med Penne Pasta",
      priceSek: 54.95,
      unitLabel: "400 g",
      searchTerms: ["penne"],
    }),
    pricedProduct({
      id: "dry-penne-medium",
      productName: "Penne Pasta 500G",
      priceSek: 18.95,
      unitLabel: "500 g",
      searchTerms: [],
    }),
  ];

  assert.equal(
    matchListItem({ id: "penne", name: "Penne" }, products).product?.id,
    "dry-penne-medium",
  );
});

test("ordinary chilled milk can beat an exact long-life search-term match", () => {
  const products = [
    pricedProduct({
      id: "uht-milk-exact",
      productName: "Mjölk Lång Hållbarhet UHT 1L",
      priceSek: 29.95,
      unitLabel: "1 l",
      searchTerms: ["mjölk"],
    }),
    pricedProduct({
      id: "household-milk",
      productName: "Lätt Mjölk 1,5% LF",
      priceSek: 18.95,
      unitLabel: "1,5 l",
      searchTerms: [],
    }),
  ];

  assert.equal(
    matchListItem({ id: "milk", name: "Mjölk" }, products).product?.id,
    "household-milk",
  );
});

test("explicit frozen bulk chicken keeps requested variants eligible", () => {
  const products = [
    pricedProduct({
      id: "fresh-chicken",
      productName: "Kycklingfilé Naturell 700G",
      priceSek: 79.95,
      unitLabel: "700 g",
      searchTerms: ["kycklingfilé fryst storpack"],
    }),
    pricedProduct({
      id: "frozen-bulk-chicken",
      productName: "Kycklingfilé Fryst Storpack 2KG",
      priceSek: 137.2,
      unitLabel: "2 kg",
      searchTerms: ["kycklingfilé fryst storpack"],
    }),
  ];

  assert.equal(
    matchListItem(
      { id: "chicken", name: "Kycklingfilé fryst storpack (2 kg)" },
      products,
    ).product?.id,
    "frozen-bulk-chicken",
  );
});

test("preference diagnostics are only included when pricing debug is active", async () => {
  const request = {
    chain: "city_gross" as const,
    items: [{ id: "eggs", name: "Ägg" }],
  };
  const product = pricedProduct({
    id: "eggs-12",
    productName: "Ägg 12P",
    priceSek: 34.95,
    unitLabel: "12 st",
    searchTerms: ["ägg"],
  });
  const searchProducts = async () => [product];

  const regular = await calculateCityGrossBasket(request, { searchProducts });
  const debug = await calculateCityGrossBasket(request, {
    searchProducts,
    debug: true,
  });

  assert.equal(regular.matches[0].preferenceScore, undefined);
  assert.equal(regular.matches[0].preferenceReasons, undefined);
  assert.equal(typeof debug.matches[0].preferenceScore, "number");
  assert.ok(debug.matches[0].preferenceReasons?.includes("egg_normal_pack"));
});

test("single pepper ranking prefers a normal approximate piece weight", () => {
  const products = [
    pricedProduct({
      id: "pepper-pack",
      productName: "Paprika Röd Flerpack",
      priceSek: 39.95,
      unitLabel: "3 st",
      searchTerms: ["röd paprika"],
    }),
    pricedProduct({
      id: "pepper_KG",
      productName: "Paprika Röd",
      priceSek: 44.95,
      unitLabel: "CA200G",
      comparePrice: "44.95 kr/kg",
      searchTerms: ["röd paprika"],
    }),
  ];

  assert.equal(
    matchListItem({ id: "pepper", name: "Röd paprika (1 st)" }, products)
      .product?.id,
    "pepper_KG",
  );
});

test("reasonable price breaks ties between otherwise normal egg packs", () => {
  const products = [
    pricedProduct({
      id: "eggs-expensive",
      productName: "Ägg 12P Frigående",
      priceSek: 99.95,
      unitLabel: "12 st",
      searchTerms: ["ägg"],
    }),
    pricedProduct({
      id: "eggs-reasonable",
      productName: "Ägg 12P Inne Medium",
      priceSek: 34.95,
      unitLabel: "12 st",
      searchTerms: ["ägg"],
    }),
  ];

  const match = matchListItem({ id: "eggs", name: "Ägg" }, products, {
    debug: true,
  });
  assert.equal(match.product?.id, "eggs-reasonable");
  assert.ok(match.preferenceReasons?.includes("reasonable_price"));
});

test("basket pricing validation accepts ICA Kungälv pricing source", () => {
  const validation = validateBasketPricingRequest({
    chain: "ica",
    storeId: "1004392",
    items: [{ id: "milk", name: "mjölk" }],
  });
  assert.equal(validation.ok, true);
  if (validation.ok) {
    assert.equal(validation.request.chain, "ica");
    assert.equal(validation.request.storeId, "1004392");
  }
});

test("basket pricing routes requests to the selected provider", async () => {
  const { calculateBasketPricing } = await import("./api/_lib/pricingProviders");
  const result = await calculateBasketPricing(
    { chain: "ica", storeId: "1004392", items: [{ id: "milk", name: "mjölk" }] },
    { debug: false },
  );
  assert.deepEqual(result, {
    matches: [
      {
        listItemId: "milk",
        listItemName: "mjölk",
        product: null,
        confidence: "none",
      },
    ],
    approximateTotalSek: 0,
  });
});

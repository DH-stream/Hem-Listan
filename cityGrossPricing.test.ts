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
  calculateBasketPriceEstimate,
  calculateCityGrossBasket,
  validateBasketPricingRequest,
} from "./api/_lib/basketPricing";
import {
  clearCityGrossPricingCache,
  searchCityGrossProducts,
} from "./api/_lib/cityGrossPricing";
import { parsePriceSek } from "./api/_lib/pricingProviderUtils";
import type { ProductPrice } from "./src/lib/pricing/types";
import {
  buildPricingSearchQueries,
  cleanGrocerySearchQuery,
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

test("cleans quantities and recipe notes from grocery search queries", () => {
  const examples = [
    ["Röd paprika (1 st)", "Röd paprika"],
    ["Potatis (400 g)", "Potatis"],
    ["Tomatpuré (15 ml)", "Tomatpuré"],
    ["Crème fraiche (1 dl)", "Crème fraiche"],
    ["Kycklingfilé (ca 500 g)", "Kycklingfilé"],
    ["Babyspenat (1 förp)", "Babyspenat"],
    ["Finhackad röd paprika", "röd paprika"],
    ["Stort skalat och hackat äpple", "äpple"],
    ["Sesamfrön på toppen", "Sesamfrön"],
  ];

  for (const [input, expected] of examples) {
    assert.equal(cleanGrocerySearchQuery(input), expected);
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
      searchTerms: ["eko ägg"],
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

test("simple produce queries avoid processed snack products", () => {
  const products: ProductPrice[] = [
    {
      id: "candy-banana",
      chainId: "ica",
      storeId: "1004392",
      productName: "Godispåse Banan Toffee 90g Bubs",
      priceSek: 12.2,
      unitLabel: "(135,56 kr/kg)",
      searchTerms: ["Godispåse Banan Toffee 90g Bubs"],
    },
    {
      id: "banana",
      chainId: "ica",
      storeId: "1004392",
      productName: "Banan Eko ca 180g Klass 1 ICA",
      priceSek: 5.38,
      unitLabel: "0.18kg (29,95 kr/kg)",
      searchTerms: ["Banan Eko ca 180g Klass 1 ICA"],
    },
  ];

  assert.equal(
    matchListItem({ id: "banana", name: "banan" }, products).product?.id,
    "banana",
  );
});

test("ICA compound product names get useful match confidence", () => {
  const products: ProductPrice[] = [
    {
      id: "milk",
      chainId: "ica",
      storeId: "1004392",
      productName: "Mellanmjölk Lite längre hållbarhet 1,5% 1,5l ICA",
      priceSek: 22.95,
      unitLabel: "1,5 l",
      searchTerms: ["Mellanmjölk Lite längre hållbarhet 1,5% 1,5l ICA"],
    },
    {
      id: "banana",
      chainId: "ica",
      storeId: "1004392",
      productName: "Banan Eko ca 180g Klass 1 ICA",
      priceSek: 5.38,
      unitLabel: "0.18kg (29,95 kr/kg)",
      searchTerms: ["Banan Eko ca 180g Klass 1 ICA"],
    },
    {
      id: "pork",
      chainId: "ica",
      storeId: "1004392",
      productName: "Stekfläsk Skivat 375g ICA",
      priceSek: 49.95,
      unitLabel: "375 g",
      searchTerms: ["Stekfläsk Skivat 375g ICA"],
    },
    {
      id: "rice",
      chainId: "ica",
      storeId: "1004392",
      productName: "Basmatiris 1kg ICA",
      priceSek: 32.95,
      unitLabel: "1 kg",
      searchTerms: ["Basmatiris 1kg ICA"],
    },
  ];

  assert.equal(matchListItem({ id: "milk", name: "mjölk" }, products).confidence, "medium");
  assert.equal(matchListItem({ id: "banana", name: "banan" }, products).confidence, "medium");
  assert.equal(
    matchListItem({ id: "pork", name: "rimmat fläsk" }, products).confidence,
    "medium",
  );
  assert.notEqual(matchListItem({ id: "rice", name: "ris" }, products).confidence, "high");
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

test("low-coverage ICA refresh improves final basket matches", async () => {
  const queryNames = Array.from({ length: 53 }, (_, index) => {
    const first = String.fromCharCode(97 + Math.floor(index / 26));
    const second = String.fromCharCode(97 + (index % 26));
    return `testvara ${first}${second}`;
  });
  const items = queryNames.map((name, index) => ({
    id: `row-${index}`,
    name,
    sourceTaskIds: [`task-${index}`],
  }));
  const refreshedQueries: string[] = [];
  const productFor = (query: string) => ({
    id: `ica-${query}`,
    chainId: "ica" as const,
    storeId: "1004392",
    productName: query,
    priceSek: 10,
    unitLabel: "st",
    searchTerms: [query],
  });

  const result = await calculateBasketPriceEstimate(
    {
      chain: "ica",
      storeId: "1004392",
      items,
    },
    {
      searchProducts: async (query) => {
        return queryNames.slice(0, 5).includes(query) ? [productFor(query)] : [];
      },
      refreshSearchProducts: async (query) => {
        refreshedQueries.push(query);
        return queryNames.slice(5, 15).includes(query) ? [productFor(query)] : [];
      },
    },
  );

  assert.equal(refreshedQueries.length, 48);
  assert.equal(result.matches.filter((match) => match.product).length, 15);
  assert.equal(
    result.matches.find((match) => match.listItemId === "row-10")?.product?.id,
    `ica-${queryNames[10]}`,
  );
  assert.deepEqual(
    result.matches.find((match) => match.listItemId === "row-10")?.sourceTaskIds,
    ["task-10"],
  );
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

test("production pricing examples use query cleanup and semantic ranking", () => {
  const products: ProductPrice[] = [
    {
      id: "lax-ready-meal",
      chainId: "city_gross",
      storeId: "demo",
      productName: "CITY GROSS Kallrökt Lax Dillstuvad Potatis",
      priceSek: 69.95,
      unitLabel: "400 g",
      category: "Färdigmat",
      categoryPath: ["Kyld färdigmat", "Portionsrätt"],
      searchTerms: ["Kallrökt Lax Dillstuvad Potatis"],
    },
    {
      id: "lax-raw",
      chainId: "city_gross",
      storeId: "demo",
      productName: "Kallrökt Lax Skivad 200g",
      priceSek: 59.95,
      unitLabel: "200 g",
      category: "Fisk",
      searchTerms: ["kallrökt lax", "rökt lax"],
    },
    {
      id: "keso",
      chainId: "city_gross",
      storeId: "demo",
      productName: "Arla Keso Cottage Cheese 500g",
      priceSek: 34.95,
      unitLabel: "500 g",
      category: "Mejeri",
      searchTerms: ["keso", "cottage cheese"],
    },
    {
      id: "penne",
      chainId: "city_gross",
      storeId: "demo",
      productName: "Barilla Penne Rigate Pasta 500g",
      priceSek: 24.95,
      unitLabel: "500 g",
      category: "Pasta",
      searchTerms: ["penne", "penne pasta"],
    },
    {
      id: "butter",
      chainId: "city_gross",
      storeId: "demo",
      productName: "Svenskt Smör Normalsaltat 500g",
      priceSek: 54.95,
      unitLabel: "500 g",
      category: "Smör & margarin",
      searchTerms: ["smör", "margarin"],
    },
    {
      id: "toast",
      chainId: "city_gross",
      storeId: "demo",
      productName: "Pågen Rosta Toastbröd 800g",
      priceSek: 36.95,
      unitLabel: "800 g",
      category: "Bröd",
      searchTerms: ["toastbröd", "rostbröd", "formfranska"],
    },
  ];

  assert.equal(matchListItem({ id: "lax", name: "kallrökt lax" }, products).product?.id, "lax-raw");
  assert.equal(matchListItem({ id: "keso", name: "keso cottage cheese" }, products).product?.id, "keso");
  assert.equal(matchListItem({ id: "penne", name: "penne pasta" }, products).product?.id, "penne");
  assert.equal(matchListItem({ id: "fat", name: "smör eller margarin" }, products).product?.id, "butter");
  assert.equal(matchListItem({ id: "toast-a", name: "toastbröd" }, products).product?.id, "toast");
  assert.equal(matchListItem({ id: "toast-b", name: "toastbrod" }, products).product?.id, "toast");
});

test("pricing search query variants avoid concatenated provider OR queries", () => {
  assert.deepEqual(buildPricingSearchQueries("keso cottage cheese"), ["keso"]);
  assert.deepEqual(buildPricingSearchQueries("penne pasta"), ["penne"]);
  assert.deepEqual(buildPricingSearchQueries("smör eller margarin"), ["smör", "margarin"]);
  assert.deepEqual(buildPricingSearchQueries("toastbröd"), ["toastbröd", "rostbröd", "formfranska"]);
  assert.deepEqual(buildPricingSearchQueries("toastbrod"), ["toastbröd", "rostbröd", "formfranska"]);
});

test("basket pricing searches provider variants and merges products for one intent", async () => {
  const searchedQueries: string[] = [];
  const butterProduct: ProductPrice = {
    id: "butter",
    chainId: "city_gross",
    storeId: "demo",
    productName: "Svenskt Smör Normalsaltat 500g",
    priceSek: 54.95,
    unitLabel: "500 g",
    category: "Smör & margarin",
    searchTerms: ["smör", "margarin"],
  };
  const toastProduct: ProductPrice = {
    id: "toast",
    chainId: "city_gross",
    storeId: "demo",
    productName: "Pågen Rosta Toastbröd 800g",
    priceSek: 36.95,
    unitLabel: "800 g",
    category: "Bröd",
    searchTerms: ["toastbröd", "rostbröd", "formfranska"],
  };

  const result = await calculateBasketPriceEstimate(
    {
      chain: "city_gross",
      items: [
        { id: "keso", name: "keso cottage cheese" },
        { id: "penne", name: "penne pasta" },
        { id: "fat", name: "smör eller margarin" },
        { id: "toast", name: "toastbröd" },
      ],
    },
    {
      searchProducts: async (query) => {
        searchedQueries.push(query);
        if (query === "margarin") return [butterProduct];
        if (query === "rostbröd") return [toastProduct, toastProduct];
        return [];
      },
    },
  );

  assert.deepEqual(
    searchedQueries.sort(),
    ["formfranska", "keso", "margarin", "penne", "rostbröd", "smör", "toastbröd"].sort(),
  );
  assert.equal(result.matches.find((match) => match.listItemId === "fat")?.product?.id, "butter");
  assert.equal(result.matches.find((match) => match.listItemId === "toast")?.product?.id, "toast");
});

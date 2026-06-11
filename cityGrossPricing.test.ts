import assert from "node:assert/strict";
import test from "node:test";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import basketPricingHandler, {
  createBasketPricingHandler,
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
    debugMessage: "City Gross exploded",
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
    validateBasketPricingRequest({ chain: "other", items: [{ id: "1", name: "mjölk" }] }),
    { ok: false, error: "Unsupported grocery chain." },
  );
});

test("normalizes a Swedish price string", () => {
  assert.equal(parsePriceSek("34,50 kr"), 34.5);
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
  assert.equal(result.approximateTotalSek, 31.9);
});

test("failed City Gross fetch is negative-cached briefly", async () => {
  clearCityGrossPricingCache();
  let fetchCount = 0;
  const fetchImpl = async () => {
    fetchCount += 1;
    throw new Error("network unavailable");
  };

  const first = await searchCityGrossProducts("negative cache test", undefined, {
    fetchImpl,
    liveEnabled: true,
    now: () => 1_000,
  });
  const second = await searchCityGrossProducts("negative cache test", undefined, {
    fetchImpl,
    liveEnabled: true,
    now: () => 2_000,
  });

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
  const products = await searchCityGrossProducts("ägg endpoint test", undefined, {
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
  });

  assert.equal(products.length, 1);
  assert.equal(products[0].productName, "Garant Ägg 12-pack");
  assert.equal(products[0].priceSek, 34.5);
  assert.equal(products[0].comparePrice, "2,88 kr/st");
  assert.equal(products[0].chainId, "city_gross");
});

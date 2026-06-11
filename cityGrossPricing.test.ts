import assert from "node:assert/strict";
import test from "node:test";
import type { IncomingMessage, ServerResponse } from "node:http";
import cityGrossSearchHandler from "./api/pricing/citygross/search";
import {
  clearCityGrossPricingCache,
  parsePriceSek,
  searchCityGrossProducts,
} from "./api/_lib/cityGrossPricing";

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

test("City Gross pricing endpoint returns 400 for an empty query", async () => {
  const response = createResponse();
  await cityGrossSearchHandler(
    { method: "GET", query: { q: "   " } } as unknown as IncomingMessage,
    response,
  );

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.responseBody, { error: "Query is required." });
});

test("normalizes a Swedish price string", () => {
  assert.equal(parsePriceSek("34,50 kr"), 34.5);
});

test("failed City Gross fetch falls back to an empty product list", async () => {
  clearCityGrossPricingCache();
  const products = await searchCityGrossProducts("fetch failure test", undefined, {
    fetchImpl: async () => {
      throw new Error("network unavailable");
    },
    liveEnabled: true,
  });

  assert.deepEqual(products, []);
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

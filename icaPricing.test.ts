import assert from "node:assert/strict";
import test from "node:test";
import {
  clearIcaPricingCache,
  normalizeIcaProduct,
  searchIcaProducts,
} from "./api/_lib/icaPricing";
import { parsePriceSek } from "./api/_lib/pricingProviderUtils";

test("parses Swedish colon price strings", () => {
  assert.equal(parsePriceSek("15:95 kr"), 15.95);
  assert.equal(parsePriceSek("49:9 kr"), 49.9);
});

test("ICA product normalization accepts colon price strings", () => {
  const product = normalizeIcaProduct(
    {
      id: "milk-1",
      name: "Mellanmjölk 1l",
      brand: "ICA",
      price: "15:95 kr",
      size: "1l",
    },
    "1004392",
    "2026-06-17T00:00:00.000Z",
  );

  assert.equal(product?.priceSek, 15.95);
});

test("ICA search tries the fallback endpoint after a store endpoint fetch error", async () => {
  clearIcaPricingCache();
  const requestedUrls: string[] = [];

  const products = await searchIcaProducts("mjölk", "1004392", {
    liveEnabled: true,
    now: () => 0,
    fetchImpl: async (input) => {
      requestedUrls.push(input.toString());
      if (requestedUrls.length === 1) {
        throw new Error("store endpoint timed out");
      }
      return new Response(
        JSON.stringify({
          products: [
            {
              id: "milk-1",
              name: "Mellanmjölk 1l",
              brand: "ICA",
              price: "15:95 kr",
              size: "1l",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  assert.equal(requestedUrls.length, 2);
  assert.match(requestedUrls[0], /\/stores\/1004392\/api\/products\/search/);
  assert.match(requestedUrls[1], /\/api\/products\/search/);
  assert.equal(products.length, 1);
  assert.equal(products[0].priceSek, 15.95);
});

test("ICA search ignores non-product arrays before nested product arrays", async () => {
  clearIcaPricingCache();

  const products = await searchIcaProducts("kaffe", "1004392", {
    liveEnabled: true,
    now: () => 0,
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          suggestions: [{ title: "kaffe" }],
          data: {
            facets: [{ name: "Varumärke" }],
            results: [
              {
                id: "coffee-1",
                name: "Bryggkaffe 450g",
                brand: "ICA",
                priceInfo: { currentPrice: { price: "49:90 kr" } },
                descriptiveSize: "450g",
              },
            ],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
  });

  assert.equal(products.length, 1);
  assert.equal(products[0].productName, "ICA Bryggkaffe 450g");
  assert.equal(products[0].priceSek, 49.9);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  clearIcaPricingCache,
  consumeIcaPricingDiagnostics,
  getIcaSearchQueries,
  normalizeIcaProduct,
  resetIcaPricingDiagnostics,
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

test("ICA search aliases recipe wording to grocery search terms", () => {
  assert.deepEqual(getIcaSearchQueries("sesamfrön på toppen"), ["sesamfrön"]);
  assert.deepEqual(getIcaSearchQueries("stort skalat och hackat äpple"), ["äpple"]);
  assert.deepEqual(getIcaSearchQueries("finhackad röd paprika"), ["röd paprika"]);
  assert.deepEqual(getIcaSearchQueries("keso cottage cheese"), ["keso", "cottage cheese"]);
  assert.deepEqual(getIcaSearchQueries("basmatiris"), ["basmatiris", "basmati ris"]);
  assert.deepEqual(getIcaSearchQueries("stora ägg"), ["ägg", "ägg 10-p", "ägg 6-p"]);
  assert.deepEqual(getIcaSearchQueries("mjöl"), ["vetemjöl", "mjöl"]);
  assert.deepEqual(getIcaSearchQueries("riven ost"), ["riven ost", "ost riven"]);
  assert.deepEqual(getIcaSearchQueries("crème fraiche"), [
    "crème fraiche",
    "creme fraiche",
    "crème fraîche",
  ]);
});

test("ICA 202 responses are transient and are not negative-cached", async () => {
  clearIcaPricingCache();
  resetIcaPricingDiagnostics();
  let fetchCount = 0;
  const options = {
    liveEnabled: true,
    now: () => 0,
    debug: true,
    fetchImpl: async () => {
      fetchCount += 1;
      return new Response("", {
        status: 202,
        headers: { "content-type": "text/html" },
      });
    },
  };

  assert.deepEqual(await searchIcaProducts("salt", "1004392", options), []);
  const firstFetchCount = fetchCount;
  assert.deepEqual(await searchIcaProducts("salt", "1004392", options), []);
  assert.ok(fetchCount > firstFetchCount);
  assert.ok(
    consumeIcaPricingDiagnostics().some(
      (attempt) => attempt.failureType === "ica_blocked_or_not_ready",
    ),
  );
});

test("ICA fetch errors are transient and are not negative-cached", async () => {
  clearIcaPricingCache();
  resetIcaPricingDiagnostics();
  let fetchCount = 0;
  const options = {
    liveEnabled: true,
    now: () => 0,
    debug: true,
    fetchImpl: async () => {
      fetchCount += 1;
      throw new DOMException("The operation was aborted", "AbortError");
    },
  };

  assert.deepEqual(await searchIcaProducts("salt", "1004392", options), []);
  const firstFetchCount = fetchCount;
  assert.deepEqual(await searchIcaProducts("salt", "1004392", options), []);
  assert.ok(fetchCount > firstFetchCount);
  assert.ok(
    consumeIcaPricingDiagnostics().some(
      (attempt) =>
        attempt.failureType === "ica_transient_response" &&
        attempt.error?.includes("aborted"),
    ),
  );
});

test("ICA 200 blocked HTML shells are transient and are not negative-cached", async () => {
  clearIcaPricingCache();
  resetIcaPricingDiagnostics();
  let fetchCount = 0;
  const blockedHtml = `<html><body><main><h1>Laddar</h1><p>Försök igen senare</p></main>${" ".repeat(
    2_400,
  )}</body></html>`;
  const options = {
    liveEnabled: true,
    now: () => 0,
    debug: true,
    fetchImpl: async () => {
      fetchCount += 1;
      return new Response(blockedHtml, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    },
  };

  assert.deepEqual(await searchIcaProducts("salt", "1004392", options), []);
  const firstFetchCount = fetchCount;
  assert.deepEqual(await searchIcaProducts("salt", "1004392", options), []);
  assert.ok(fetchCount > firstFetchCount);
  assert.ok(
    consumeIcaPricingDiagnostics().some(
      (attempt) =>
        attempt.status === 200 &&
        attempt.htmlLength !== undefined &&
        attempt.htmlLength >= 2_000 &&
        attempt.failureType === "ica_blocked_or_not_ready",
    ),
  );
});

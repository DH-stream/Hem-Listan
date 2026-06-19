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
import { summarizeIcaProviderAttempts } from "./api/_lib/basketPricing";

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

test("ICA product normalization accepts the current decorated price shape", () => {
  const product = normalizeIcaProduct(
    {
      productId: "milk-2",
      name: "Mellanmjölk 1,5% 1,5l",
      price: { current: { amount: "22.95" } },
      descriptiveSize: "1,5l",
    },
    "1004392",
    "2026-06-18T00:00:00.000Z",
  );

  assert.equal(product?.priceSek, 22.95);
});

test("ICA search uses the current web product page search endpoint", async () => {
  clearIcaPricingCache();
  resetIcaPricingDiagnostics();
  const requestedUrls: string[] = [];

  const products = await searchIcaProducts("mjölk", "1004392", {
    debug: true,
    liveEnabled: true,
    now: () => 0,
    fetchImpl: async (input) => {
      requestedUrls.push(input.toString());
      return new Response(
        JSON.stringify({
          productGroups: [{
            decoratedProducts: [{
              productId: "milk-1",
              name: "Mellanmjölk 1l",
              brand: "ICA",
              price: { current: { amount: "15.95" } },
              descriptiveSize: "1l",
            }],
          }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  assert.equal(requestedUrls.length, 1);
  const requestedUrl = new URL(requestedUrls[0]);
  assert.equal(
    requestedUrl.pathname,
    "/stores/1004392/api/webproductpagews/v6/product-pages/search",
  );
  assert.equal(requestedUrl.searchParams.get("q"), "mjölk");
  assert.equal(requestedUrl.searchParams.get("tag"), "web");
  assert.equal(products.length, 1);
  assert.equal(products[0].priceSek, 15.95);
  const [attempt] = consumeIcaPricingDiagnostics();
  assert.equal(attempt.normalizedProductCount, 1);
  assert.equal(attempt.resultType, "json_search_success");
  assert.equal(attempt.failureType, undefined);

  const cachedProducts = await searchIcaProducts("mjölk", "1004392", {
    debug: true,
    liveEnabled: true,
    now: () => 1,
  });
  assert.equal(cachedProducts.length, 1);
  assert.equal(consumeIcaPricingDiagnostics()[0]?.resultType, "cache_hit");
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
      (attempt) => attempt.failureType === "html_202_blocked",
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
        attempt.failureType === "html_no_product_data",
    ),
  );
});

test("ICA basket diagnostics summarize live, cache, blocked, and failed queries", () => {
  const summary = summarizeIcaProviderAttempts([
    {
      query: "polly",
      storeId: "1004392",
      urlPath: "/stores/1004392/api/webproductpagews/v6/product-pages/search",
      searchParams: "q=polly",
      mode: "json",
      status: 200,
      normalizedProductCount: 5,
      resultType: "json_search_success",
    },
    {
      query: "mjölk",
      storeId: "1004392",
      urlPath: "cache",
      searchParams: "",
      mode: "json",
      normalizedProductCount: 2,
      fromCache: true,
      resultType: "cache_hit",
    },
    {
      query: "salt",
      storeId: "1004392",
      urlPath: "/stores/1004392/api/webproductpagews/v6/product-pages/search",
      searchParams: "q=salt",
      mode: "json",
      status: 202,
      resultType: "waf_blocked",
      failureType: "html_202_blocked",
    },
  ]);

  assert.equal(summary.liveProductAttemptCount, 1);
  assert.equal(summary.cacheHitCount, 1);
  assert.equal(summary.blockedAttemptCount, 1);
  assert.equal(summary.resultTypeCounts.json_search_success, 1);
  assert.deepEqual(summary.topFailedQueries, [
    {
      query: "salt",
      failureCount: 1,
      failureTypes: { html_202_blocked: 1 },
    },
  ]);
});

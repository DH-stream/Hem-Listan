import assert from "node:assert/strict";
import test from "node:test";
import { calculateBasketPriceEstimate, validateBasketPricingRequest } from "./api/_lib/basketPricing";
import {
  clearWillysPricingCache,
  normalizeWillysProduct,
  searchWillysProducts,
} from "./api/_lib/willysPricing";

const fixtureProducts = [
  { code: "banan", name: "Banan Klass 1", priceValue: 18.8, priceUnit: "kr/kg", displayVolume: "ca: 180g", image: { url: "/images/banan.jpg" }, online: true, outOfStock: false },
  { code: "mjolk", name: "Mellanmjölk 1,5% 1 l", priceValue: 16.95, priceUnit: "st", thumbnail: { url: "https://assets.willys.se/mjolk.jpg" }, online: true, outOfStock: false },
  { code: "pasta", name: "Pasta Spaghetti 1 kg", priceValue: 21.95, priceUnit: "st", online: true, outOfStock: false },
  { code: "agg", name: "Ägg Frigående 12-pack", priceValue: 39.95, priceUnit: "st", online: true, outOfStock: false },
  { code: "kaffe", name: "Bryggkaffe Mellanrost 450 g", priceValue: 54.95, priceUnit: "st", online: true, outOfStock: false },
];

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });

test("normalizes Willys product result", () => {
  const product = normalizeWillysProduct(fixtureProducts[0], "2026-06-21T00:00:00.000Z");

  assert.ok(product);
  assert.equal(product.chainId, "willys");
  assert.equal(product.storeId, "public");
  assert.equal(product.id, "willys-banan");
  assert.equal(product.productName, "Banan Klass 1");
  assert.equal(product.priceSek, 3.38);
  assert.equal(product.unitLabel, "st");
  assert.equal(product.comparePrice, "18,80 kr/kg");
  assert.equal(product.imageUrl, "https://www.willys.se/images/banan.jpg");
  assert.equal(product.productUrl, undefined);
  assert.deepEqual(product.searchTerms, ["Banan Klass 1", "banan"]);
});


test("Willys banana without explicit weight uses controlled fallback", () => {
  const product = normalizeWillysProduct({
    code: "banan",
    name: "Banan Klass 1",
    priceValue: 18.8,
    priceUnit: "kr/kg",
  });

  assert.ok(product);
  assert.equal(product.priceSek, 3.38);
  assert.equal(product.unitLabel, "st");
  assert.equal(product.comparePrice, "18,80 kr/kg");
});

test("Willys milk and non-kg products remain unchanged", () => {
  const product = normalizeWillysProduct(fixtureProducts[1]);

  assert.ok(product);
  assert.equal(product.priceSek, 16.95);
  assert.equal(product.unitLabel, "st");
});

test("Willys kg-priced unknown product without weight remains kg price", () => {
  const product = normalizeWillysProduct({
    code: "okand",
    name: "Okänd lösvikt",
    priceValue: 44.9,
    priceUnit: "kr/kg",
  });

  assert.ok(product);
  assert.equal(product.priceSek, 44.9);
  assert.equal(product.unitLabel, "kr/kg");
});

test("Willys broad bulk produce terms are not blindly converted", () => {
  const product = normalizeWillysProduct({
    code: "bananer",
    name: "Bananer Klass 1",
    priceValue: 18.8,
    priceUnit: "kr/kg",
  });

  assert.ok(product);
  assert.equal(product.priceSek, 18.8);
  assert.equal(product.unitLabel, "kr/kg");
});

test("ignores Willys result missing numeric priceValue", () => {
  assert.equal(normalizeWillysProduct({ code: "x", name: "Utan pris" }), null);
});

test("handles empty Willys results", async () => {
  clearWillysPricingCache();
  const products = await searchWillysProducts("saknas", "public", {
    fetchImpl: async () => jsonResponse({ results: [] }),
  });

  assert.deepEqual(products, []);
});

test("handles failed Willys upstream fetch", async () => {
  clearWillysPricingCache();
  const products = await searchWillysProducts("banan", "public", {
    fetchImpl: async () => {
      throw new Error("upstream unavailable");
    },
  });

  assert.deepEqual(products, []);
});

test("basket pricing can price common items via Willys fixture", async () => {
  const result = await calculateBasketPriceEstimate(
    {
      chain: "willys",
      storeId: "public",
      items: [
        { id: "banan", name: "banan" },
        { id: "mjolk", name: "mjölk" },
        { id: "pasta", name: "pasta" },
        { id: "agg", name: "ägg" },
        { id: "kaffe", name: "kaffe" },
      ],
    },
    {
      searchProducts: async (query) =>
        fixtureProducts
          .filter((product) => product.name.toLocaleLowerCase("sv-SE").includes(query.toLocaleLowerCase("sv-SE")) || product.code === query)
          .map((product) => normalizeWillysProduct(product, "2026-06-21T00:00:00.000Z"))
          .filter((product): product is NonNullable<typeof product> => product !== null),
    },
  );

  assert.equal(result.matches.length, 5);
  assert.equal(result.matches.filter((match) => match.product).length, 5);
  assert.equal(result.matches.find((match) => match.listItemId === "banan")?.product?.priceSek, 3.38);
  assert.ok(result.approximateTotalSek > 0);
});

test("Willys request validation accepts public source", () => {
  const validation = validateBasketPricingRequest({
    chain: "willys",
    storeId: "public",
    items: [{ id: "banan", name: "banan" }],
  });

  assert.equal(validation.ok, true);
  if (validation.ok) {
    assert.equal(validation.request.chain, "willys");
    assert.equal(validation.request.storeId, "public");
  }
});

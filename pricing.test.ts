import assert from "node:assert/strict";
import test from "node:test";
import { cityGrossPriceAdapter, CITY_GROSS_DEMO_STORE } from "./src/lib/pricing/cityGrossAdapter";
import { matchListItem } from "./src/lib/pricing/matching";
import type { ProductPrice } from "./src/lib/pricing/types";
import { buildBasketPriceEstimate } from "./src/lib/pricing/useBasketPriceEstimate";

const products: ProductPrice[] = [
  {
    id: "coffee",
    chainId: "city_gross",
    storeId: "demo",
    productName: "Gevalia Mellanrost Bryggkaffe 450 g",
    priceSek: 54.95,
    unitLabel: "450 g",
    searchTerms: ["kaffe"],
  },
];

test("matches exact or nearly exact names with high confidence", () => {
  assert.equal(matchListItem({ id: "1", name: "kaffe" }, products).confidence, "high");
  assert.equal(matchListItem({ id: "2", name: "kafffe" }, products).confidence, "high");
});

test("matches query words contained in a product name with medium confidence", () => {
  assert.equal(
    matchListItem({ id: "1", name: "Gevalia bryggkaffe" }, products).confidence,
    "medium",
  );
});

test("uses low confidence for a weak fuzzy match and none for an unknown item", () => {
  assert.equal(matchListItem({ id: "1", name: "kaffetår" }, products).confidence, "low");
  assert.equal(matchListItem({ id: "2", name: "diskmedel" }, products).confidence, "none");
});

test("calculates a demo basket and keeps missing items visible", async () => {
  const result = await cityGrossPriceAdapter.calculateBasket(CITY_GROSS_DEMO_STORE.id, [
    { id: "milk", name: "2 l mjölk" },
    { id: "eggs", name: "ägg" },
    { id: "pasta", name: "pasta" },
    { id: "unknown", name: "diskmedel" },
  ]);

  assert.equal(result.matchedItemCount, 3);
  assert.equal(result.uncertainOrMissingItemCount, 1);
  assert.equal(result.matches.at(-1)?.confidence, "none");
  assert.equal(result.matches.at(-1)?.product, null);
  assert.equal(result.approximateTotalSek, 75.85);
  assert.equal(result.isEstimate, true);
});


test("basket estimate only includes unchecked tasks", () => {
  const result = buildBasketPriceEstimate(
    [
      { id: "active", text: "kaffe", checked: false },
      { id: "checked", text: "kaffe", checked: true },
    ],
    new Map([["kaffe", products]]),
  );

  assert.equal(result.approximateTotalSek, 54.95);
  assert.deepEqual(Object.keys(result.matchByTaskId), ["active"]);
});

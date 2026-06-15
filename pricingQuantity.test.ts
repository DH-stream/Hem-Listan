import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPurchasePlanLabel,
  parseComparableQuantity,
  selectPackagePurchasePlan,
} from "./shared/pricingQuantity";
import type { ProductPrice } from "./src/lib/pricing/types";

const product = (
  id: string,
  unitLabel: string,
  priceSek: number,
): ProductPrice => ({
  id,
  chainId: "city_gross",
  storeId: "test",
  productName: `Testprodukt ${unitLabel}`,
  priceSek,
  unitLabel,
  searchTerms: ["testprodukt"],
});

const plan = (
  required: string,
  products: ProductPrice[],
) => {
  const quantity = parseComparableQuantity(required);
  assert.ok(quantity);
  return selectPackagePurchasePlan(quantity, products);
};

test("normalizes common grocery and package units", () => {
  assert.deepEqual(parseComparableQuantity("Mjölk (1,5 l)"), {
    amount: 1500,
    dimension: "volume",
    approximate: false,
  });
  assert.equal(parseComparableQuantity("Vetemjöl (3 kg)")?.amount, 3000);
  assert.equal(parseComparableQuantity("Mjöl (2 hg)")?.amount, 200);
  assert.equal(parseComparableQuantity("Ägg 15P")?.amount, 15);
  assert.equal(parseComparableQuantity("Tomater 200/140G")?.amount, 140);
});

test("chooses the cheapest valid milk plan for sub-package needs", () => {
  const products = [product("milk-1", "1L", 12), product("milk-15", "1,5L", 18)];
  assert.equal(plan("0,7 l", products)?.totalPriceSek, 12);
  assert.equal(plan("1,1 l", products)?.totalPriceSek, 18);
});

test("combines package sizes when that is the cheapest covering plan", () => {
  const result = plan("2,2 l", [
    product("milk-1", "1L", 12),
    product("milk-15", "1,5L", 18),
  ]);
  assert.equal(result?.totalPriceSek, 30);
  assert.equal(result?.purchasedAmount, 2500);
  assert.deepEqual(
    result?.items.map((item) => [item.product.id, item.count]),
    [["milk-1", 1], ["milk-15", 1]],
  );
});

test("rounds a two-liter need up to two purchasable 1.5 liter packages", () => {
  const result = plan("2 l", [product("milk-15", "1,5L", 15)]);
  assert.equal(result?.totalPriceSek, 30);
  assert.equal(result?.purchasedAmount, 3000);
  assert.deepEqual(
    result?.items.map((item) => [item.product.id, item.count]),
    [["milk-15", 2]],
  );
  assert.equal(result && formatPurchasePlanLabel(result), "2 × 1,5 l");
});

test("formats a mixed mass purchase plan as real package sizes", () => {
  const result = plan("2,5 kg", [
    product("potato-2", "2KG", 28),
    product("potato-09", "900G", 15),
    product("potato-5", "5KG", 70),
  ]);
  assert.equal(result?.totalPriceSek, 43);
  assert.equal(result?.purchasedAmount, 2900);
  assert.deepEqual(
    result?.items.map((item) => [item.product.id, item.count]),
    [
      ["potato-2", 1],
      ["potato-09", 1],
    ],
  );
  assert.equal(result && formatPurchasePlanLabel(result), "2 kg + 900 g");
});

test("builds generic mass and volume package plans", () => {
  assert.equal(
    plan("3 kg", [
      product("flour-1", "1KG", 15),
      product("flour-2", "2KG", 26),
    ])?.totalPriceSek,
    41,
  );
  assert.equal(
    plan("3 dl", [
      product("cream-2", "2DL", 12),
      product("cream-5", "5DL", 25),
    ])?.totalPriceSek,
    24,
  );
});

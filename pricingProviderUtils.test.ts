import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeKgUnitPriceToEstimatedItemPrice,
  parseApproxWeightKg,
} from "./api/_lib/pricingProviderUtils";

test("parses approximate grams and kg weight hints", () => {
  assert.equal(parseApproxWeightKg("ca: 180g"), 0.18);
  assert.equal(parseApproxWeightKg("ca 180 g"), 0.18);
  assert.equal(parseApproxWeightKg("180g"), 0.18);
  assert.equal(parseApproxWeightKg("1 kg"), 1);
  assert.equal(parseApproxWeightKg("ca: 1,2kg"), 1.2);
  assert.equal(parseApproxWeightKg("ca 0.18 kg"), 0.18);
  assert.equal(parseApproxWeightKg("ingen vikt"), null);
});

test("converts kr/kg with known weight to estimated item price", () => {
  assert.deepEqual(normalizeKgUnitPriceToEstimatedItemPrice(18.8, "kr/kg", 0.18), {
    priceSek: 3.38,
    unitLabel: "st",
    comparePrice: "18,80 kr/kg",
  });
});

test("does not convert non-kg unit labels", () => {
  assert.equal(normalizeKgUnitPriceToEstimatedItemPrice(18.8, "st", 0.18), null);
});

test("does not convert kg price without weight or fallback", () => {
  assert.equal(normalizeKgUnitPriceToEstimatedItemPrice(18.8, "kr/kg", null), null);
});

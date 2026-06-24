import assert from "node:assert/strict";
import test from "node:test";
import { buildPricingMatchEvent } from "./api/_lib/pricingMatchEvents.ts";
import type { ProductPrice, ProductMatchScoreBreakdown } from "./src/lib/pricing/types.ts";

const baseProduct = (overrides: Partial<ProductPrice> = {}): ProductPrice => ({
  id: "product-1",
  chainId: "ica",
  storeId: "store-1",
  productName: "Mjölk 1,5L",
  priceSek: 18.95,
  unitLabel: "1,5 l",
  searchTerms: ["mjölk"],
  ...overrides,
});

const scoreBreakdown = (overrides: Partial<ProductMatchScoreBreakdown> = {}): ProductMatchScoreBreakdown => ({
  semantic: 40,
  categoryAffinity: 0,
  quantityPackageFit: 0,
  priceSanity: 0,
  productPenalty: 0,
  learnedPreference: 0,
  packagePlan: 0,
  total: 40,
  ...overrides,
});

const request = {
  chain: "ica" as const,
  storeId: "store-1",
  items: [{ id: "item-1", name: "mjölk" }],
};

test("classifies normal direct product-price matches as good", () => {
  const event = buildPricingMatchEvent(request, request.items[0], {
    listItemId: "item-1",
    listItemName: "mjölk",
    product: baseProduct(),
    confidence: "high",
    priceBasis: "product_price",
  });

  assert.equal(event.qualitySignal.label, "good");
  assert.ok(event.qualitySignal.reasons.includes("normal_direct_product_match"));
});

test("keeps explained package plans out of suspicious", () => {
  const product = baseProduct();
  const event = buildPricingMatchEvent(request, { id: "item-1", name: "mjölk 3,6 l" }, {
    listItemId: "item-1",
    listItemName: "mjölk 3,6 l",
    product,
    confidence: "high",
    priceBasis: "package_plan",
    estimatedCheckoutPriceSek: 56.85,
    requestedQuantity: {
      amount: 3600,
      unit: "volume",
      label: "3,6 l",
      approximate: false,
    },
    purchasePlan: {
      totalPriceSek: 56.85,
      purchasedAmount: 4000,
      items: [{ product, count: 3 }],
    },
  });

  assert.notEqual(event.qualitySignal.label, "suspicious");
  assert.ok(event.qualitySignal.reasons.includes("package_plan_explained"));
});

test("classifies prepared meals for simple ingredient queries as suspicious", () => {
  const event = buildPricingMatchEvent(request, { id: "item-1", name: "penne" }, {
    listItemId: "item-1",
    listItemName: "penne",
    product: baseProduct({
      id: "ready-meal-1",
      productName: "Penne Carbonara Färdigrätt",
      category: "Kyld färdigmat",
      searchTerms: ["penne", "carbonara", "färdigrätt"],
    }),
    confidence: "medium",
    preferenceReasons: ["prepared_food_penalty_for_simple_query"],
    scoreBreakdown: scoreBreakdown({ productPenalty: -28, total: 12 }),
  });

  assert.equal(event.qualitySignal.label, "suspicious");
  assert.ok(
    event.qualitySignal.reasons.includes("prepared_food_penalty_for_simple_query") ||
      event.qualitySignal.reasons.includes("simple_query_matched_prepared_or_processed_product"),
  );
});

test("classifies missing products as uncertain rather than good", () => {
  const event = buildPricingMatchEvent(request, request.items[0], {
    listItemId: "item-1",
    listItemName: "mjölk",
    product: null,
    confidence: "none",
  });

  assert.notEqual(event.qualitySignal.label, "good");
  assert.ok(["uncertain", "suspicious"].includes(event.qualitySignal.label));
  assert.ok(event.qualitySignal.reasons.includes("no_selected_product"));
});

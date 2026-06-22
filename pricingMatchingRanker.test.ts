import assert from "node:assert/strict";
import test from "node:test";
import { calculateBasketPriceEstimate } from "./api/_lib/basketPricing";
import { rankProductMatches } from "./api/_lib/pricingMatching";
import type { ProductPrice } from "./src/lib/pricing/types";

const product = (overrides: Partial<ProductPrice>): ProductPrice => ({
  id: "product",
  chainId: "city_gross",
  storeId: "store-1",
  productName: "Äpple Klass 1",
  priceSek: 4,
  unitLabel: "1 st",
  searchTerms: ["äpple"],
  category: "Frukt & grönt",
  ...overrides,
});

test("rankProductMatches returns deterministic candidates with score breakdown and reasons", () => {
  const ranking = rankProductMatches({ name: "äpple" }, [
    product({ id: "apple", productName: "Äpple Klass 1", priceSek: 4 }),
    product({
      id: "apple-basket",
      productName: "Äpple korg mix",
      priceSek: 49,
      unitLabel: "6 st",
      searchTerms: ["äpple"],
    }),
  ]);

  assert.equal(ranking.normalizedQuery, "apple");
  assert.equal(ranking.selected?.product.id, "apple");
  assert.equal(ranking.rankedCandidates.length, 2);
  assert.equal(typeof ranking.selected?.scoreBreakdown.semantic, "number");
  assert.ok(ranking.rankedCandidates[1].reasons.includes("singular_query_package_variant_penalty"));
});

test("learned preferences influence ranking without replacing deterministic matching", () => {
  const ranking = rankProductMatches(
    { name: "kaffe" },
    [
      product({ id: "standard", productName: "Kaffe Mellanrost", searchTerms: ["kaffe"] }),
      product({ id: "chosen", productName: "Kaffe Brygg", searchTerms: ["kaffe"] }),
    ],
    {
      learnedPreferences: [
        {
          normalizedQuery: "kaffe",
          chain: "city_gross",
          storeId: "store-1",
          preferredProductId: "chosen",
          rejectedProductIds: ["standard"],
          confidence: 0.9,
          scope: "household",
        },
      ],
    },
  );

  assert.equal(ranking.selected?.product.id, "chosen");
  assert.ok(ranking.selected?.reasons.includes("learned_preferred_product_boost"));
});

test("match event logging is fire-and-forget and does not fail basket pricing", async () => {
  let loggerCalled = false;
  const result = await calculateBasketPriceEstimate(
    {
      chain: "city_gross",
      storeId: "store-1",
      items: [{ id: "apple", name: "äpple" }],
    },
    {
      searchProducts: async () => [product({ id: "apple" })],
      matchEventLogger: {
        logMatchEvent: async () => {
          loggerCalled = true;
          throw new Error("telemetry unavailable");
        },
      },
    },
  );

  assert.equal(result.matches[0].product?.id, "apple");
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(loggerCalled, true);
});

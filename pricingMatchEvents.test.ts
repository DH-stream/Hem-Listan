import assert from "node:assert/strict";
import test from "node:test";
import { buildPricingMatchEvent, emitPricingMatchEventsFireAndForget } from "./api/_lib/pricingMatchEvents.ts";
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
  learningScore: 0,
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

test("normal base products with processed/flavor penalties are not over-flagged", () => {
  const cases = [
    {
      query: "mjölk",
      productName: "GARANT Mellanmjölk Längre Hållbarhet",
      category: "Mjölk",
    },
    {
      query: "blåbär",
      productName: "ELDORADO Blåbär",
      category: "Bär",
    },
    {
      query: "tomatpuré",
      productName: "FELIX Tomatpuré",
      category: "Tomatpuré",
    },
    {
      query: "naturell yoghurt",
      productName: "ARLA KO Lätt Naturell Mild Yoghurt",
      category: "Yoghurt",
    },
  ];

  for (const itemCase of cases) {
    const event = buildPricingMatchEvent(request, { id: "item-1", name: itemCase.query }, {
      listItemId: "item-1",
      listItemName: itemCase.query,
      product: baseProduct({
        id: `product-${itemCase.query}`,
        productName: itemCase.productName,
        category: itemCase.category,
      }),
      confidence: "medium",
      preferenceReasons: ["processed_or_flavor_product_penalty"],
      scoreBreakdown: scoreBreakdown({ productPenalty: -12, total: 28 }),
    });

    assert.notEqual(event.qualitySignal.label, "suspicious", itemCase.productName);
    assert.ok(["good", "uncertain"].includes(event.qualitySignal.label), itemCase.productName);
  }
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

test("quality classification does not alter approximatePriceSek", () => {
  const directEvent = buildPricingMatchEvent(request, request.items[0], {
    listItemId: "item-1",
    listItemName: "mjölk",
    product: baseProduct({ priceSek: 18.95 }),
    confidence: "high",
    priceBasis: "product_price",
    estimatedCheckoutPriceSek: 37.9,
  });

  const suspiciousEvent = buildPricingMatchEvent(request, { id: "item-1", name: "penne" }, {
    listItemId: "item-1",
    listItemName: "penne",
    product: baseProduct({
      id: "ready-meal-1",
      productName: "Penne Carbonara Färdigrätt",
      priceSek: 48.5,
      category: "Kyld färdigmat",
    }),
    confidence: "medium",
    priceBasis: "product_price",
    estimatedCheckoutPriceSek: 48.5,
    preferenceReasons: ["prepared_food_penalty_for_simple_query"],
  });

  assert.equal(directEvent.qualitySignal.label, "good");
  assert.equal(directEvent.approximatePriceSek, 37.9);
  assert.equal(suspiciousEvent.qualitySignal.label, "suspicious");
  assert.equal(suspiciousEvent.approximatePriceSek, 48.5);
});

test("package-plan match remains good and keeps package explanation", () => {
  const product = baseProduct({ priceSek: 18.95, unitLabel: "1,5 l" });
  const event = buildPricingMatchEvent(request, { id: "item-1", name: "mjölk 3 l" }, {
    listItemId: "item-1",
    listItemName: "mjölk 3 l",
    product,
    confidence: "high",
    priceBasis: "package_plan",
    estimatedCheckoutPriceSek: 37.9,
    purchasePlan: {
      totalPriceSek: 37.9,
      purchasedAmount: 3000,
      items: [{ product, count: 2 }],
    },
  });

  assert.equal(event.qualitySignal.label, "good");
  assert.equal(event.priceExplanation?.priceBasis, "package_plan");
  assert.equal(event.priceExplanation?.packagePlan?.packageCount, 2);
});

test("confidence none is suspicious only when a product was selected", () => {
  const selectedProductEvent = buildPricingMatchEvent(request, request.items[0], {
    listItemId: "item-1",
    listItemName: "mjölk",
    product: baseProduct(),
    confidence: "none",
  });
  const missingProductEvent = buildPricingMatchEvent(request, request.items[0], {
    listItemId: "item-1",
    listItemName: "mjölk",
    product: null,
    confidence: "none",
  });

  assert.equal(selectedProductEvent.qualitySignal.label, "suspicious");
  assert.equal(missingProductEvent.qualitySignal.label, "uncertain");
});

test("missing product stays uncertain", () => {
  const event = buildPricingMatchEvent(request, request.items[0], {
    listItemId: "item-1",
    listItemName: "mjölk",
    product: null,
    confidence: "low",
    rankedCandidates: [],
  });

  assert.equal(event.qualitySignal.label, "uncertain");
  assert.ok(event.qualitySignal.reasons.includes("no_selected_product"));
});

test("suspicious quality signal keeps selected product in event", () => {
  const event = buildPricingMatchEvent(request, { id: "item-1", name: "penne" }, {
    listItemId: "item-1",
    listItemName: "penne",
    product: baseProduct({
      id: "ready-meal-1",
      productName: "Penne Carbonara Färdigrätt",
      category: "Kyld färdigmat",
    }),
    confidence: "medium",
    preferenceReasons: ["prepared_food_penalty_for_simple_query"],
  });

  assert.equal(event.qualitySignal.label, "suspicious");
  assert.equal(event.selectedProductId, "ready-meal-1");
  assert.equal(event.selectedProductName, "Penne Carbonara Färdigrätt");
});

test("buildPricingMatchEvent emits stable normalized query and result source", () => {
  const event = buildPricingMatchEvent(request, { id: "item-1", name: "Mjölk 3,6 l!!" }, {
    listItemId: "item-1",
    listItemName: "Mjölk 3,6 l!!",
    product: baseProduct(),
    confidence: "high",
  });

  assert.equal(event.normalizedQuery, "mjolk");
  assert.equal(event.resultSource, "auto_match");
});


test("fire-and-forget telemetry catches synchronous logger failures", async () => {
  const errors: unknown[] = [];

  emitPricingMatchEventsFireAndForget(
    request,
    request.items,
    [{
      listItemId: "item-1",
      listItemName: "mjölk",
      product: baseProduct(),
      confidence: "high",
    }],
    {
      logMatchEvent: () => {
        throw new Error("logger failed");
      },
    },
    (error) => errors.push(error),
  );

  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(errors.length, 1);
});

test("Supabase logger swallows pricing_match_events insert failures", async () => {
  const { createSupabasePricingMatchEventLogger } = await import("./api/_lib/pricingMatchSupabaseLogger.ts");
  const previousEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const previousFetch = globalThis.fetch;
  const errors: unknown[] = [];

  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  globalThis.fetch = (async () =>
    new Response('{"message":"column quality_signal does not exist"}', { status: 400 })) as typeof fetch;

  try {
    const logger = createSupabasePricingMatchEventLogger({
      anonymousInstallationId: "anon-install",
      onTelemetryError: (error) => errors.push(error),
    });
    assert.ok(logger);
    await logger.logMatchEvent(buildPricingMatchEvent(request, request.items[0], {
      listItemId: "item-1",
      listItemName: "mjölk",
      product: baseProduct(),
      confidence: "high",
    }));
    assert.equal(errors.length, 1);
  } finally {
    if (previousEnv.SUPABASE_URL === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousEnv.SUPABASE_URL;
    if (previousEnv.SUPABASE_ANON_KEY === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = previousEnv.SUPABASE_ANON_KEY;
    if (previousEnv.SUPABASE_SERVICE_ROLE_KEY === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousEnv.SUPABASE_SERVICE_ROLE_KEY;
    globalThis.fetch = previousFetch;
  }
});

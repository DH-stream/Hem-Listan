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

test("basket request validation accepts anonymous pricing context without auth", async () => {
  const { validateBasketPricingRequest } = await import("./api/_lib/basketPricing");
  const validation = validateBasketPricingRequest({
    chain: "city_gross",
    items: [{ id: "apple", name: "äpple" }],
    clientContext: {
      anonymousInstallationId: "01890f75-6d75-4b1f-9d12-2fd6a09a7c65",
    },
  });

  assert.equal(validation.ok, true);
  assert.equal(
    validation.ok ? validation.request.clientContext?.anonymousInstallationId : null,
    "01890f75-6d75-4b1f-9d12-2fd6a09a7c65",
  );
});

test("Supabase match logger writes anonymous event rows without list item names", async () => {
  const { createSupabasePricingMatchEventLogger } = await import(
    "./api/_lib/pricingMatchSupabaseLogger"
  );
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalAnonKey = process.env.SUPABASE_ANON_KEY;
  const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let insertedBody: any;
  let insertAuthorizationHeader: string | null = null;

  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    insertedBody = JSON.parse(String(init?.body));
    insertAuthorizationHeader = new Headers(init?.headers).get("Authorization");
    return new Response(null, { status: 201 });
  }) as typeof fetch;

  try {
    const logger = createSupabasePricingMatchEventLogger({
      anonymousInstallationId: "01890f75-6d75-4b1f-9d12-2fd6a09a7c65",
    });
    assert.ok(logger);
    await logger.logMatchEvent({
      chain: "city_gross",
      normalizedQuery: "apple",
      selectedProductId: "apple-1",
      selectedProductName: "Äpple Klass 1",
      selectedConfidence: "high",
      selectedScore: 42,
      topCandidates: [{ productId: "apple-1", productName: "Äpple Klass 1" }],
      qualitySignal: {
        label: "good",
        strength: 0.9,
        reasons: ["normal_direct_product_match"],
        version: 1,
      },
      resultSource: "auto_match",
      timestamp: "2026-06-23T12:00:00.000Z",
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalAnonKey === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = originalAnonKey;
    if (originalServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
  }

  assert.equal(insertAuthorizationHeader, "Bearer service-role-key");
  assert.equal(insertedBody.user_id, null);
  assert.equal(insertedBody.anonymous_installation_id, "01890f75-6d75-4b1f-9d12-2fd6a09a7c65");
  assert.equal(insertedBody.normalized_query, "apple");
  assert.equal(insertedBody.price_explanation, null);
  assert.equal(Object.hasOwn(insertedBody, "list_item_name"), false);
});

const learningLookup = (...summaries: Array<{
  normalizedQuery?: string;
  selectedProductId: string;
  sampleCount: number;
  suspiciousCount?: number;
  confidenceScore: number;
}>) =>
  new Map(
    summaries.map((summary) => [
      `${summary.normalizedQuery ?? "apple"}\0${summary.selectedProductId}`,
      {
        chain: "city_gross" as const,
        normalizedQuery: summary.normalizedQuery ?? "apple",
        selectedProductId: summary.selectedProductId,
        sampleCount: summary.sampleCount,
        suspiciousCount: summary.suspiciousCount ?? 0,
        confidenceScore: summary.confidenceScore,
      },
    ]),
  );

const appleCandidates = () => [
  product({ id: "apple-a", productName: "Äpple Klass 1", priceSek: 4 }),
  product({ id: "apple-b", productName: "Äpple Eko", priceSek: 4.2 }),
];

test("learning summaries are inert when absent or below sample thresholds", () => {
  const baseline = rankProductMatches({ name: "äpple" }, appleCandidates());
  const oneGood = rankProductMatches({ name: "äpple" }, appleCandidates(), {
    learningSummaries: learningLookup({ selectedProductId: "apple-b", sampleCount: 1, confidenceScore: 0.9 }),
  });
  const oneSuspicious = rankProductMatches({ name: "äpple" }, appleCandidates(), {
    learningSummaries: learningLookup({ selectedProductId: "apple-a", sampleCount: 1, suspiciousCount: 1, confidenceScore: -0.9 }),
  });

  assert.equal(oneGood.selected?.product.id, baseline.selected?.product.id);
  assert.equal(oneGood.selected?.scoreBreakdown.learningScore, 0);
  assert.equal(oneSuspicious.selected?.product.id, baseline.selected?.product.id);
  assert.equal(oneSuspicious.selected?.scoreBreakdown.learningScore, 0);
  assert.ok(!oneGood.rankedCandidates.some((candidate) => candidate.reasons.includes("learned_preference_boost")));
  assert.ok(!oneSuspicious.rankedCandidates.some((candidate) => candidate.reasons.includes("learned_suspicious_penalty")));
});

test("repeated positive learning gives a small boost to compatible candidates", () => {
  const ranking = rankProductMatches({ name: "äpple" }, appleCandidates(), {
    learningSummaries: learningLookup({ selectedProductId: "apple-b", sampleCount: 3, confidenceScore: 0.8 }),
  });

  const learned = ranking.rankedCandidates.find((candidate) => candidate.product.id === "apple-b");
  assert.ok(learned);
  assert.equal(learned.scoreBreakdown.learningScore, 4.800000000000001);
  assert.ok(learned.reasons.includes("learned_preference_boost"));
});

test("repeated suspicious learning applies a guarded penalty", () => {
  const ranking = rankProductMatches({ name: "äpple" }, appleCandidates(), {
    learningSummaries: learningLookup({ selectedProductId: "apple-a", sampleCount: 4, suspiciousCount: 2, confidenceScore: -0.9 }),
  });

  const penalized = ranking.rankedCandidates.find((candidate) => candidate.product.id === "apple-a");
  assert.ok(penalized);
  assert.equal(penalized.scoreBreakdown.learningScore, -13.5);
  assert.ok(penalized.reasons.includes("learned_suspicious_penalty"));
});

test("learning cannot rescue a prepared-food mismatch for a simple ingredient query", () => {
  const ranking = rankProductMatches(
    { name: "potatis" },
    [
      product({ id: "plain-potato", productName: "Potatis Fast", searchTerms: ["potatis"], category: "Frukt & grönt" }),
      product({ id: "ready-potato", productName: "Dillstuvad potatis", searchTerms: ["potatis"], category: "Färdigmat" }),
    ],
    {
      learningSummaries: learningLookup({ normalizedQuery: "potatis", selectedProductId: "ready-potato", sampleCount: 20, confidenceScore: 1 }),
    },
  );

  const mismatch = ranking.rankedCandidates.find((candidate) => candidate.product.id === "ready-potato");
  assert.equal(ranking.selected?.product.id, "plain-potato");
  assert.equal(mismatch?.scoreBreakdown.learningScore, 0);
  assert.ok(!mismatch?.reasons.includes("learned_preference_boost"));
});

test("learning can rerank but does not directly change basket totals", async () => {
  const result = await calculateBasketPriceEstimate(
    { chain: "city_gross", storeId: "store-1", items: [{ id: "apple", name: "äpple" }] },
    {
      searchProducts: async () => [
        product({ id: "apple-a", productName: "Äpple", priceSek: 4 }),
        product({ id: "apple-b", productName: "Äpple", priceSek: 4.2 }),
      ],
      learningSummaries: learningLookup({ selectedProductId: "apple-b", sampleCount: 3, confidenceScore: 0.9 }),
    },
  );

  assert.equal(result.matches[0].product?.id, "apple-b");
  assert.equal(result.matches[0].preferenceReasons?.includes("learned_preference_boost"), true);
  assert.equal(result.approximateTotalSek, result.matches[0].product?.priceSek);
});

test("basmatiris matches compound and spaced basmati rice names", () => {
  const spaced = rankProductMatches({ name: "basmatiris" }, [
    product({
      id: "basmati-spaced",
      productName: "Basmati Ris 1kg",
      priceSek: 39,
      unitLabel: "1 kg",
      searchTerms: ["Basmati Ris 1kg ICA"],
      category: "Ris",
    }),
  ]);
  const compound = rankProductMatches({ name: "basmati ris" }, [
    product({
      id: "basmati-compound",
      productName: "Basmatiris",
      priceSek: 39,
      unitLabel: "1 kg",
      searchTerms: ["Basmatiris ICA"],
      category: "Ris",
    }),
  ]);

  assert.equal(spaced.selected?.product.id, "basmati-spaced");
  assert.notEqual(spaced.selected?.confidence, "none");
  assert.equal(compound.selected?.product.id, "basmati-compound");
  assert.notEqual(compound.selected?.confidence, "none");
});

test("basmatiris rejects rice pudding and ready-meal rice products", () => {
  const ranking = rankProductMatches({ name: "basmatiris" }, [
    product({
      id: "rice-pudding",
      productName: "Risgrynsgröt",
      priceSek: 18,
      unitLabel: "500 g",
      searchTerms: ["Risgrynsgröt"],
      category: "Gröt",
    }),
    product({
      id: "ready-meal-rice",
      productName: "Kyckling med ris färdigrätt",
      priceSek: 45,
      unitLabel: "400 g",
      searchTerms: ["ris", "färdigrätt"],
      category: "Färdigmat",
    }),
  ]);

  assert.equal(ranking.selected, null);
  assert.equal(ranking.rankedCandidates.length, 0);
  assert.deepEqual(
    ranking.rejectedCandidates.map((candidate) => candidate.productId),
    ["rice-pudding", "ready-meal-rice"],
  );
});

test("filtered-out diagnostics include product names and rejection reasons", async () => {
  const result = await calculateBasketPriceEstimate(
    { chain: "ica", storeId: "1004392", items: [{ id: "basmati", name: "basmatiris" }] },
    {
      debug: true,
      searchProducts: async () => [
        product({
          id: "rice-pudding",
          productName: "Risgrynsgröt",
          priceSek: 18,
          unitLabel: "500 g",
          searchTerms: ["Risgrynsgröt"],
          category: "Gröt",
        }),
      ],
      learningSummaries: new Map(),
    },
  );
  const debug = JSON.parse(result.debugMessage ?? "{}");
  const diagnostic = debug.noCandidateDiagnostics[0];

  assert.equal(diagnostic.filteredOutProducts[0].productName, "Risgrynsgröt");
  assert.equal(diagnostic.filteredOutProducts[0].productId, "rice-pudding");
  assert.equal(diagnostic.filteredOutProducts[0].category, "Gröt");
  assert.equal(diagnostic.filteredOutProducts[0].unitLabel, "500 g");
  assert.deepEqual(diagnostic.filteredOutProducts[0].searchTerms, ["Risgrynsgröt"]);
  assert.equal(diagnostic.filteredOutProducts[0].reason, "no_semantic_match");
});

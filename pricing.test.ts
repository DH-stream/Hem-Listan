import assert from "node:assert/strict";
import test from "node:test";
import {
  cityGrossPriceAdapter,
  CITY_GROSS_DEMO_STORE,
} from "./src/lib/pricing/cityGrossAdapter";
import { matchListItem } from "./src/lib/pricing/matching";
import type { ProductPrice } from "./src/lib/pricing/types";
import {
  BASKET_PRICING_CACHE_TTL_MS,
  createActiveShoppingRows,
  createShoppingRowDisplay,
  createShoppingProgressRows,
  createBasketItemSignature,
  createActivePricingItems,
  createBasketPricingCacheKey,
  logBasketPricingResult,
  readBasketPricingCache,
  resolveBasketPricingCacheState,
  selectActiveBasketEstimate,
  writeBasketPricingCache,
} from "./src/lib/pricing/useBasketPriceEstimate";
import {
  DEFAULT_PRICING_SOURCE,
  normalizePricingSource,
  resolveNearestIcaStore,
  SEEDED_ICA_STORES,
} from "./src/lib/pricing/sources";
import { getStoreLogoPath } from "./src/components/StoreLogo";

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
  assert.equal(
    matchListItem({ id: "1", name: "kaffe" }, products).confidence,
    "high",
  );
  assert.equal(
    matchListItem({ id: "2", name: "kafffe" }, products).confidence,
    "high",
  );
});

test("matches query words contained in a product name with medium confidence", () => {
  assert.equal(
    matchListItem({ id: "1", name: "Gevalia bryggkaffe" }, products).confidence,
    "medium",
  );
});

test("uses low confidence for a weak fuzzy match and none for an unknown item", () => {
  assert.equal(
    matchListItem({ id: "1", name: "kaffetår" }, products).confidence,
    "low",
  );
  assert.equal(
    matchListItem({ id: "2", name: "diskmedel" }, products).confidence,
    "none",
  );
});

test("keeps common ICA compound matches out of low confidence", () => {
  const icaProducts: ProductPrice[] = [
    {
      id: "milk",
      chainId: "ica",
      storeId: "1004392",
      productName: "Mellanmjölk Lite längre hållbarhet 1,5% 1,5l ICA",
      priceSek: 22.95,
      unitLabel: "1,5 l",
      searchTerms: ["Mellanmjölk Lite längre hållbarhet 1,5% 1,5l ICA"],
    },
    {
      id: "banana",
      chainId: "ica",
      storeId: "1004392",
      productName: "Banan Eko ca 180g Klass 1 ICA",
      priceSek: 5.38,
      unitLabel: "0.18kg (29,95 kr/kg)",
      searchTerms: ["Banan Eko ca 180g Klass 1 ICA"],
    },
    {
      id: "pork",
      chainId: "ica",
      storeId: "1004392",
      productName: "Stekfläsk Skivat 375g ICA",
      priceSek: 49.95,
      unitLabel: "375 g",
      searchTerms: ["Stekfläsk Skivat 375g ICA"],
    },
    {
      id: "rice",
      chainId: "ica",
      storeId: "1004392",
      productName: "Basmatiris 1kg ICA",
      priceSek: 32.95,
      unitLabel: "1 kg",
      searchTerms: ["Basmatiris 1kg ICA"],
    },
  ];

  assert.equal(matchListItem({ id: "milk", name: "mjölk" }, icaProducts).confidence, "medium");
  assert.equal(matchListItem({ id: "banana", name: "banan" }, icaProducts).confidence, "medium");
  assert.equal(
    matchListItem({ id: "pork", name: "rimmat fläsk" }, icaProducts).confidence,
    "medium",
  );
  assert.notEqual(matchListItem({ id: "rice", name: "ris" }, icaProducts).confidence, "high");
});

test("calculates a demo basket and keeps missing items visible", async () => {
  const result = await cityGrossPriceAdapter.calculateBasket(
    CITY_GROSS_DEMO_STORE.id,
    [
      { id: "milk", name: "2 l mjölk" },
      { id: "eggs", name: "ägg" },
      { id: "pasta", name: "pasta" },
      { id: "unknown", name: "diskmedel" },
    ],
  );

  assert.equal(result.matchedItemCount, 3);
  assert.equal(result.uncertainOrMissingItemCount, 1);
  assert.equal(result.matches.at(-1)?.confidence, "none");
  assert.equal(result.matches.at(-1)?.product, null);
  assert.equal(result.approximateTotalSek, 92.8);
  assert.equal(result.isEstimate, true);
});

test("basket estimate only includes unchecked tasks", () => {
  const activeMatch = matchListItem({ id: "active", name: "kaffe" }, products);
  const checkedMatch = matchListItem(
    { id: "checked", name: "kaffe" },
    products,
  );
  const result = selectActiveBasketEstimate(
    [
      { id: "active", text: "kaffe", checked: false },
      { id: "checked", text: "kaffe", checked: true },
    ],
    {
      matches: [activeMatch, checkedMatch],
      approximateTotalSek: 109.9,
    },
  );

  assert.equal(result.approximateTotalSek, 54.95);
  assert.deepEqual(Object.keys(result.matchByTaskId), ["active"]);
});

test("basket estimate keeps previous prices for active items during revalidation", () => {
  const existingMatch = matchListItem(
    { id: "existing", name: "kaffe" },
    products,
  );
  const completedMatch = matchListItem(
    { id: "completed", name: "kaffe" },
    products,
  );
  const result = selectActiveBasketEstimate(
    [
      { id: "existing", text: "kaffe", checked: false },
      { id: "completed", text: "kaffe", checked: true },
      { id: "new", text: "diskmedel", checked: false },
    ],
    {
      matches: [existingMatch, completedMatch],
      approximateTotalSek: 109.9,
    },
  );

  assert.equal(result.approximateTotalSek, 54.95);
  assert.deepEqual(Object.keys(result.matchByTaskId), ["existing"]);
  assert.equal(result.matchByTaskId.new, undefined);
});

test("basket estimate follows an active item when only its id changes", () => {
  const importedMatch = matchListItem(
    { id: "task-imported-1", name: "  Kaffe " },
    products,
  );
  const result = selectActiveBasketEstimate(
    [{ id: "supabase-uuid", text: "kaffe", checked: false }],
    { matches: [importedMatch], approximateTotalSek: 54.95 },
  );

  assert.equal(result.approximateTotalSek, 54.95);
  assert.equal(
    result.matchByTaskId["supabase-uuid"]?.listItemId,
    "supabase-uuid",
  );
});

test("basket estimate remaps an aggregated temp-id match to persisted shopping rows", () => {
  const milk15: ProductPrice = {
    ...products[0],
    id: "milk-15",
    productName: "Mjölk 1,5L",
    priceSek: 18,
    unitLabel: "1,5 l",
    searchTerms: ["mjölk"],
  };
  const result = selectActiveBasketEstimate(
    [
      { id: "uuid-a", text: "Mjölk (1 l)", checked: false },
      { id: "uuid-b", text: "Standardmjölk (5 dl)", checked: false },
    ],
    {
      matches: [
        {
          listItemId: "task-imported-a",
          listItemName: "mjölk (1,5 l)",
          sourceTaskIds: ["task-imported-a", "task-imported-b"],
          product: milk15,
          confidence: "high",
          estimatedCheckoutPriceSek: 18,
          priceBasis: "package_plan",
          purchasePlan: {
            totalPriceSek: 18,
            purchasedAmount: 1500,
            items: [{ product: milk15, count: 1 }],
          },
        },
      ],
      approximateTotalSek: 18,
    },
  );

  assert.equal(result.approximateTotalSek, 18);
  assert.equal(
    result.matchByTaskId["uuid-a"]?.purchasePlan?.purchasedAmount,
    1500,
  );
  assert.equal(
    result.matchByTaskId["uuid-b"]?.purchasePlan?.purchasedAmount,
    1500,
  );
});

test("basket estimate counts temp and persisted matches for one item once", () => {
  const importedMatch = matchListItem(
    { id: "task-imported-1", name: "kaffe" },
    products,
  );
  const persistedMatch = matchListItem(
    { id: "supabase-uuid", name: "kaffe" },
    products,
  );
  const result = selectActiveBasketEstimate(
    [{ id: "supabase-uuid", text: "kaffe", checked: false }],
    {
      matches: [importedMatch, persistedMatch],
      approximateTotalSek: 109.9,
    },
  );

  assert.equal(result.approximateTotalSek, 54.95);
  assert.ok(result.matchByTaskId["supabase-uuid"]);
});

test("pricing debug result logging includes safe error diagnostics", () => {
  const originalWindow = globalThis.window;
  const originalConsoleLog = console.log;
  const calls: unknown[][] = [];
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { search: "?debug=1" },
      localStorage: { getItem: () => null },
    },
  });
  console.log = (...args: unknown[]) => calls.push(args);

  try {
    const result = {
      matches: [],
      approximateTotalSek: 0,
      error: "Basket pricing unavailable",
      debugCode: "module_load_failed",
      debugMessage: "Cannot find module",
    };
    logBasketPricingResult(result);

    const resultCall = calls.find(
      ([message]) => message === "[pricing] result",
    );
    assert.deepEqual(resultCall?.[1], {
      matchCount: 0,
      pricedCount: 0,
      approximateTotalSek: 0,
      error: "Basket pricing unavailable",
      debugCode: "module_load_failed",
      debugMessage: "Cannot find module",
      matches: [],
      rawResult: result,
    });
    assert.ok(calls.some(([message]) => message === "[pricing] unavailable"));
  } finally {
    console.log = originalConsoleLog;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  }
});

test("basket pricing cache key and active item signature are stable", () => {
  const first = createBasketItemSignature([
    { id: "b", text: "Mjölk", checked: false },
    { id: "done", text: "Kaffe", checked: true },
    { id: "a", text: "Bröd", checked: false },
  ]);
  const second = createBasketItemSignature([
    { id: "new-a", text: "  BRÖD ", checked: false },
    { id: "new-b", text: "Mjölk", checked: false },
  ]);

  assert.equal(first, second);
  assert.equal(first, "bröd|mjölk");
  assert.equal(
    createBasketPricingCacheKey("city_gross", "public", "list-1", first),
    `hem-listan-pricing-basket:v3:city_gross:public:list-1:${first}`,
  );
  assert.notEqual(
    createBasketPricingCacheKey("city_gross", "public", "list-1", first),
    createBasketPricingCacheKey("ica", "1004392", "list-1", first),
  );
  assert.notEqual(
    createBasketPricingCacheKey("ica", SEEDED_ICA_STORES[0].storeId, "list-1", first),
    createBasketPricingCacheKey("ica", SEEDED_ICA_STORES[1].storeId, "list-1", first),
  );
  assert.notEqual(
    first,
    createBasketItemSignature([
      { id: "a", text: "Surdegsbröd", checked: false },
      { id: "b", text: "Mjölk", checked: false },
    ]),
  );
  assert.notEqual(
    first,
    createBasketItemSignature([
      { id: "a", text: "Bröd", checked: false },
      { id: "b", text: "Mjölk", checked: true },
    ]),
  );
});

test("basket pricing signature normalizes equivalent quantity formatting", () => {
  const first = createBasketItemSignature([
    { id: "temp", text: "Mjölk (1,5 l)", checked: false },
  ]);
  const second = createBasketItemSignature([
    { id: "uuid", text: "Standardmjölk (15 dl)", checked: false },
  ]);

  assert.equal(first, second);
  assert.equal(first, "mjölk:volume:1500");
});

test("basket pricing signature aggregates identical quantities", () => {
  assert.equal(
    createBasketItemSignature([
      { id: "milk-1", text: "Mjölk (1 l)", checked: false },
      { id: "milk-2", text: "Mjölk (1 l)", checked: false },
    ]),
    "mjölk:volume:2000",
  );
});

test("basket pricing signature aggregates equivalent units", () => {
  assert.equal(
    createBasketItemSignature([
      { id: "milk-1", text: "Mjölk (1 l)", checked: false },
      { id: "milk-2", text: "Standardmjölk (5 dl)", checked: false },
    ]),
    "mjölk:volume:1500",
  );
});

test("basket pricing signature aggregates count requirements", () => {
  assert.equal(
    createBasketItemSignature([
      { id: "lemon-1", text: "Citron (1 st)", checked: false },
      { id: "lemon-2", text: "Citron (1 st)", checked: false },
    ]),
    "citron:count:2",
  );
});

test("basket pricing signature ignores temp-id reconciliation duplicates", () => {
  const optimistic = createBasketItemSignature([
    { id: "task-imported-1", text: "Mjölk (1 l)", checked: false },
  ]);
  const reconciling = createBasketItemSignature([
    { id: "task-imported-1", text: "Mjölk (1 l)", checked: false },
    { id: "supabase-uuid", text: "Mjölk (1 l)", checked: false },
  ]);
  const persisted = createBasketItemSignature([
    { id: "supabase-uuid", text: "Mjölk (1 l)", checked: false },
  ]);

  assert.equal(optimistic, reconciling);
  assert.equal(reconciling, persisted);
});

test("pricing input aggregates quantities before the API request", () => {
  assert.deepEqual(
    createActivePricingItems([
      { id: "milk-1", text: "Mjölk (1 l)", checked: false },
      { id: "milk-2", text: "Standardmjölk (5 dl)", checked: false },
      { id: "done", text: "Mjölk (2 l)", checked: true },
    ]),
    [{
      id: "milk-1",
      name: "mjölk (1,5 l)",
      sourceTaskIds: ["milk-1", "milk-2"],
    }],
  );
});

test("pricing input aggregates count requirements", () => {
  assert.deepEqual(
    createActivePricingItems([
      { id: "lemon-1", text: "Citron (1 st)", checked: false },
      { id: "lemon-2", text: "Citron (1 st)", checked: false },
    ]),
    [{
      id: "lemon-1",
      name: "citron (2 st)",
      sourceTaskIds: ["lemon-1", "lemon-2"],
    }],
  );
});

test("shopping rows expose aggregated count before pricing", () => {
  const rows = createActiveShoppingRows([
    { id: "pepper-1", text: "Paprika (1 st)", checked: false },
    { id: "pepper-2", text: "Paprika (1 st)", checked: false },
  ]);

  assert.deepEqual(rows, [
    {
      id: "pepper-1",
      name: "paprika (2 st)",
      normalizedName: "paprika",
      sourceTaskIds: ["pepper-1", "pepper-2"],
      dimension: "count",
      amount: 2,
    },
  ]);
});

test("shopping rows stay stable through temp-id reconciliation and checked tasks", () => {
  const reconciling = createActiveShoppingRows([
    { id: "task-imported-1", text: "Paprika (1 st)", checked: false },
    { id: "supabase-uuid", text: "Paprika (1 st)", checked: false },
    { id: "checked", text: "Paprika (1 st)", checked: true },
  ]);
  const persisted = createActiveShoppingRows([
    { id: "supabase-uuid", text: "Paprika (1 st)", checked: false },
  ]);

  assert.deepEqual(reconciling, persisted);
  assert.equal(reconciling[0]?.name, "paprika (1 st)");
});

test("progress rows aggregate quantified requirements and count completion once", () => {
  const active = createShoppingProgressRows([
    { id: "milk-1", text: "Mjölk (1 l)", checked: false },
    { id: "milk-2", text: "Standardmjölk (5 dl)", checked: false },
  ]);
  const completed = createShoppingProgressRows([
    { id: "milk-1", text: "Mjölk (1 l)", checked: true },
    { id: "milk-2", text: "Standardmjölk (5 dl)", checked: true },
  ]);

  assert.equal(active.length, 1);
  assert.equal(active[0]?.name, "mjölk (1,5 l)");
  assert.equal(active[0]?.checked, false);
  assert.equal(completed.length, 1);
  assert.equal(completed[0]?.checked, true);
  assert.deepEqual(completed[0]?.sourceTaskIds, ["milk-1", "milk-2"]);
});

test("completed shopping display keeps the purchasable quantity and package parts", () => {
  const milk1 = {
    ...products[0],
    id: "milk-1",
    productName: "Mjölk 1L",
    priceSek: 12,
    unitLabel: "1 l",
  };
  const milk15 = {
    ...products[0],
    id: "milk-15",
    productName: "Mjölk 1,5L",
    priceSek: 18,
    unitLabel: "1,5 l",
  };
  const row = createShoppingProgressRows([
    { id: "milk-a", text: "Mjölk (1 l)", checked: true },
    { id: "milk-b", text: "Mjölk (1,2 l)", checked: true },
  ])[0]!;
  const display = createShoppingRowDisplay(row, {
    listItemId: row.id,
    listItemName: row.name,
    sourceTaskIds: row.sourceTaskIds,
    product: milk15,
    confidence: "high",
    estimatedCheckoutPriceSek: 30,
    priceBasis: "package_plan",
    purchasePlan: {
      totalPriceSek: 30,
      purchasedAmount: 2500,
      items: [
        { product: milk1, count: 1 },
        { product: milk15, count: 1 },
      ],
    },
  });

  assert.deepEqual(display, {
    text: "Mjölk (2,5 l)",
    parts: "1 l + 1,5 l",
  });
});

test("progress rows preserve unquantified rows and ignore temp duplicates", () => {
  const rows = createShoppingProgressRows([
    { id: "milk-1", text: "Mjölk", checked: false },
    { id: "milk-2", text: "Mjölk", checked: true },
    { id: "task-imported-1", text: "Citron (1 st)", checked: false },
    { id: "supabase-uuid", text: "Citron (1 st)", checked: false },
  ]);

  assert.equal(rows.length, 3);
  assert.deepEqual(
    rows.filter((row) => row.normalizedName === "mjölk").map((row) => row.checked),
    [false, true],
  );
  assert.deepEqual(
    rows
      .filter((row) => row.normalizedName === "mjölk")
      .map((row) => row.sourceTaskIds),
    [["milk-1"], ["milk-2"]],
  );
  assert.deepEqual(
    rows.find((row) => row.normalizedName === "citron")?.sourceTaskIds,
    ["supabase-uuid"],
  );
});

test("pricing input preserves separate unquantified requirements", () => {
  const items = createActivePricingItems([
    { id: "milk-1", text: "Mjölk", checked: false },
    { id: "milk-2", text: "Mjölk", checked: false },
  ]);

  assert.deepEqual(items, [
    { id: "milk-1", name: "mjölk", sourceTaskIds: ["milk-1"] },
    { id: "milk-2", name: "mjölk", sourceTaskIds: ["milk-2"] },
  ]);
  assert.equal(
    createBasketItemSignature([
      { id: "milk-1", text: "Mjölk", checked: false },
      { id: "milk-2", text: "Mjölk", checked: false },
    ]),
    "mjölk:unquantified:2",
  );
});

test("aggregated pricing matches map back to every contributing visible task", () => {
  const match = matchListItem(
    {
      id: "coffee-1",
      name: "kaffe",
      sourceTaskIds: ["coffee-1", "coffee-2"],
    },
    products,
  );
  const result = selectActiveBasketEstimate(
    [
      { id: "coffee-1", text: "Kaffe", checked: false },
      { id: "coffee-2", text: "Kaffe", checked: false },
    ],
    {
      matches: [match],
      approximateTotalSek:
        match.estimatedCheckoutPriceSek ?? match.product?.priceSek ?? 0,
    },
  );

  assert.equal(result.matchByTaskId["coffee-1"]?.listItemId, "coffee-1");
  assert.equal(result.matchByTaskId["coffee-2"]?.listItemId, "coffee-2");
  assert.equal(
    result.approximateTotalSek,
    match.estimatedCheckoutPriceSek ?? match.product?.priceSek,
  );
});

test("basket pricing cache identifies fresh and stale entries", () => {
  const originalWindow = globalThis.window;
  const key = "hem-listan-pricing-basket:v1:city_gross:public:list-cache:items";
  const fetchedAt = "2026-06-13T00:00:00.000Z";
  const entry = {
    result: { matches: [], approximateTotalSek: 42 },
    fetchedAt,
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (requestedKey: string) =>
          requestedKey === key ? JSON.stringify(entry) : null,
      },
    },
  });

  try {
    assert.deepEqual(
      readBasketPricingCache(key, Date.parse(fetchedAt) + 1_000),
      { entry, isStale: false },
    );
    assert.deepEqual(
      readBasketPricingCache(
        key,
        Date.parse(fetchedAt) + BASKET_PRICING_CACHE_TTL_MS,
      ),
      { entry, isStale: true },
    );
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  }
});

test("basket pricing cache state clears stale source when selected source has no cache", () => {
  const state = resolveBasketPricingCacheState({ entry: null, isStale: false });
  assert.equal(state.isLoading, true);
  assert.equal(state.shouldFetch, true);
  assert.deepEqual(state.estimate, { matches: [], approximateTotalSek: 0 });
});

test("basket pricing cache state uses fresh same-source cache without loading", () => {
  const result = {
    matches: [],
    approximateTotalSek: 123,
  };
  const state = resolveBasketPricingCacheState({
    entry: { result, fetchedAt: "2026-06-17T00:00:00.000Z" },
    isStale: false,
  });
  assert.equal(state.isLoading, false);
  assert.equal(state.shouldFetch, false);
  assert.equal(state.estimate, result);
});

test("basket pricing cache state can show stale same-source cache while refreshing", () => {
  const result = {
    matches: [],
    approximateTotalSek: 45,
  };
  const state = resolveBasketPricingCacheState({
    entry: { result, fetchedAt: "2026-06-10T00:00:00.000Z" },
    isStale: true,
  });
  assert.equal(state.isLoading, true);
  assert.equal(state.shouldFetch, true);
  assert.equal(state.estimate, result);
});

test("low-coverage ICA basket cache becomes stale after 60 seconds", () => {
  const key = createBasketPricingCacheKey(
    "ica",
    "1004392",
    "coverage-list",
    "53-shopping-rows",
  );
  const matches = Array.from({ length: 53 }, (_, index) => ({
    listItemId: `row-${index}`,
    listItemName: `vara ${index}`,
    product:
      index < 5
        ? {
            id: `product-${index}`,
            chainId: "ica" as const,
            storeId: "1004392",
            productName: `Vara ${index}`,
            priceSek: 10,
            unitLabel: "st",
            searchTerms: [`vara ${index}`],
          }
        : null,
    confidence: index < 5 ? ("high" as const) : ("none" as const),
  }));
  const beforeWrite = Date.now();

  writeBasketPricingCache(key, {
    matches,
    approximateTotalSek: 50,
  });

  assert.equal(
    readBasketPricingCache(key, beforeWrite + 59_999).isStale,
    false,
  );
  assert.equal(
    readBasketPricingCache(key, beforeWrite + 60_001).isStale,
    true,
  );
});

test("pricing source accepts static City Gross", () => {
  assert.equal(DEFAULT_PRICING_SOURCE.chain, "city_gross");
  const cityGross = normalizePricingSource({ chain: "city_gross", storeId: "public" });
  assert.equal(cityGross.chain, "city_gross");
  assert.equal(cityGross.storeId, "public");
  assert.equal(cityGross.label, "City Gross");
});

test("pricing source accepts static ICA", () => {
  const ica = normalizePricingSource({ chain: "ica", storeId: "1004392" });
  assert.equal(ica.chain, "ica");
  assert.equal(ica.storeId, "1004392");
  assert.equal(ica.label, "ICA Maxi Kungälv");
});

test("pricing source accepts dynamic ICA store with numeric store id and label", () => {
  const ica = normalizePricingSource({
    chain: "ica",
    storeId: "12345",
    label: "ICA Nära Test",
    storeUrl: "https://example.test/ica/12345",
  });
  assert.equal(ica.chain, "ica");
  assert.equal(ica.storeId, "12345");
  assert.equal(ica.label, "ICA Nära Test");
  assert.equal(ica.storeUrl, "https://example.test/ica/12345");
});

test("pricing source defaults ICA store url when missing", () => {
  const ica = normalizePricingSource({
    chain: "ica",
    storeId: "98765",
    label: "ICA Supermarket Test",
  });
  assert.equal(ica.storeUrl, "https://handlaprivatkund.ica.se/stores/98765");
});

test("pricing source rejects invalid ICA sources", () => {
  assert.equal(normalizePricingSource({ chain: "ica", storeId: "", label: "ICA" }), DEFAULT_PRICING_SOURCE);
  assert.equal(normalizePricingSource({ chain: "ica", storeId: "abc", label: "ICA" }), DEFAULT_PRICING_SOURCE);
  assert.equal(normalizePricingSource({ chain: "ica", storeId: "12345" }), DEFAULT_PRICING_SOURCE);
  assert.equal(normalizePricingSource({ chain: "unknown", storeId: "12345", label: "ICA" }), DEFAULT_PRICING_SOURCE);
  assert.equal(normalizePricingSource(null), DEFAULT_PRICING_SOURCE);
});

test("seeded ICA stores are valid pricing sources", () => {
  assert.ok(SEEDED_ICA_STORES.length > 1);
  for (const store of SEEDED_ICA_STORES) {
    assert.equal(store.chain, "ica");
    assert.match(store.storeId, /^\d+$/);
    assert.ok(store.label.trim());
    assert.equal(normalizePricingSource(store), store);
  }
});

test("nearest ICA resolver returns the default seeded ICA pricing source", async () => {
  const ica = await resolveNearestIcaStore();
  assert.equal(ica, SEEDED_ICA_STORES[0]);
  assert.equal(ica.chain, "ica");
  assert.match(ica.storeId, /^\d+$/);
  assert.ok(ica.label.trim());
});

test("store logo helper resolves City Gross and ICA logos", () => {
  assert.equal(getStoreLogoPath("city_gross"), "/store-logos/citygross.svg");
  assert.equal(getStoreLogoPath("ica"), "/store-logos/ica.svg");
});

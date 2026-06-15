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
  createBasketItemSignature,
  createBasketPricingCacheKey,
  logBasketPricingResult,
  readBasketPricingCache,
  selectActiveBasketEstimate,
} from "./src/lib/pricing/useBasketPriceEstimate";

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
    { id: "duplicate", text: "mjölk", checked: false },
  ]);

  assert.equal(first, second);
  assert.equal(first, "bröd|mjölk");
  assert.equal(
    createBasketPricingCacheKey("city_gross", "list-1", first),
    `hem-listan-pricing-basket:v1:city_gross:list-1:${first}`,
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

test("basket pricing cache identifies fresh and stale entries", () => {
  const originalWindow = globalThis.window;
  const key = "hem-listan-pricing-basket:v1:city_gross:list-cache:items";
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

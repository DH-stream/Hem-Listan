import { useCallback, useEffect, useMemo, useState } from "react";
import type { TaskItem } from "../../types";
import {
  formatComparableQuantity,
  formatPurchasePlanLabel,
  parseComparableQuantity,
} from "../../../shared/pricingQuantity";
import { normalizeGroceryName } from "../grocery/normalize";
import type { BasketPriceEstimate, ListItemPriceMatch } from "./types";
import type { PricingSource } from "./sources";

const BASKET_DEBOUNCE_MS = 3_000;
const BASKET_COMPARISON_STALE_MS = 6 * 60 * 60 * 1_000;
export const BASKET_PRICING_CACHE_TTL_MS = 6 * 60 * 60 * 1_000;
const EMPTY_BASKET_PRICING_CACHE_TTL_MS = 5 * 60 * 1_000;
const PARTIAL_ICA_BASKET_PRICING_CACHE_TTL_MS = 60 * 1_000;
const MIN_SAFE_ICA_COVERAGE = 0.6;
const PRICING_DEBUG_STORAGE_KEY = "hem-listan-debug-enabled";
const BASKET_PRICING_CACHE_PREFIX = "hem-listan-pricing-basket:v3";
const basketPricingMemoryCache = new Map<string, BasketPricingCacheEntry>();

interface BasketPricingCacheEntry {
  result: BasketPriceEstimate;
  fetchedAt: string;
}

export type ActiveShoppingRow = {
  id: string;
  name: string;
  normalizedName: string;
  sourceTaskIds: string[];
  dimension?: "mass" | "volume" | "count";
  amount?: number;
};

export type ShoppingProgressRow = ActiveShoppingRow & {
  checked: boolean;
};

const formatRequirementAmount = (
  amount: number,
  dimension: ActiveShoppingRow["dimension"],
) => {
  const format = (value: number) =>
    Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
  if (dimension === "volume") {
    if (amount >= 1000) return `${format(amount / 1000)} l`;
    if (amount >= 100 && amount % 100 === 0) return `${format(amount / 100)} dl`;
    return `${format(amount)} ml`;
  }
  if (dimension === "mass") {
    return amount >= 1000
      ? `${format(amount / 1000)} kg`
      : `${format(amount)} g`;
  }
  return `${format(amount)} st`;
};

const createShoppingRows = (
  tasks: TaskItem[],
  includeChecked: boolean,
): ShoppingProgressRow[] => {
  const requirements = tasks
    .filter((task) => includeChecked || !task.checked)
    .map((task) => {
      const name = normalizeGroceryName(
        task.text.replace(/\s*\([^)]+\)\s*$/, ""),
      );
      const quantity = parseComparableQuantity(task.text);
      return {
        id: task.id,
        name,
        checked: task.checked,
        quantity,
        identity: quantity
          ? `${name}:${quantity.dimension}:${quantity.amount}`
          : name,
      };
    })
    .filter((requirement) => requirement.name);

  const persistedByIdentity = new Map<string, number>();
  requirements.forEach((requirement) => {
    if (requirement.id.startsWith("task-imported-")) return;
    persistedByIdentity.set(
      requirement.identity,
      (persistedByIdentity.get(requirement.identity) ?? 0) + 1,
    );
  });

  const totals = new Map<string, number>();
  const quantified = new Map<
    string,
    {
      id: string;
      normalizedName: string;
      dimension: "mass" | "volume" | "count";
      sourceTaskIds: string[];
      checked: boolean;
    }
  >();
  const unquantified: ShoppingProgressRow[] = [];

  requirements.forEach((requirement) => {
    if (requirement.id.startsWith("task-imported-")) {
      const persistedCount = persistedByIdentity.get(requirement.identity) ?? 0;
      if (persistedCount > 0) {
        persistedByIdentity.set(requirement.identity, persistedCount - 1);
        return;
      }
    }

    if (!requirement.quantity) {
      unquantified.push({
        id: requirement.id,
        name: requirement.name,
        normalizedName: requirement.name,
        sourceTaskIds: [requirement.id],
        checked: requirement.checked,
      });
      return;
    }

    const key = `${requirement.name}:${requirement.quantity.dimension}`;
    totals.set(key, (totals.get(key) ?? 0) + requirement.quantity.amount);
    const current = quantified.get(key);
    if (!current || current.id.startsWith("task-imported-")) {
      quantified.set(key, {
        id: requirement.id,
        normalizedName: requirement.name,
        dimension: requirement.quantity.dimension,
        checked: (current?.checked ?? true) && requirement.checked,
        sourceTaskIds: [...(current?.sourceTaskIds ?? []), requirement.id],
      });
    } else {
      current.sourceTaskIds.push(requirement.id);
      current.checked = current.checked && requirement.checked;
    }
  });

  return [
    ...unquantified,
    ...Array.from(totals, ([key, amount]) => {
      const requirement = quantified.get(key)!;
      return {
        ...requirement,
        amount,
        name: `${requirement.normalizedName} (${formatRequirementAmount(
          amount,
          requirement.dimension,
        )})`,
      };
    }),
  ];
};

export const createActiveShoppingRows = (
  tasks: TaskItem[],
): ActiveShoppingRow[] =>
  createShoppingRows(tasks, false).map(({ checked: _checked, ...row }) => row);

export const createShoppingProgressRows = (
  tasks: TaskItem[],
): ShoppingProgressRow[] => createShoppingRows(tasks, true);

export const createShoppingRowDisplay = (
  row: ActiveShoppingRow,
  match?: ListItemPriceMatch,
): { text: string; parts: string | null } => {
  const normalizedName =
    row.normalizedName ||
    match?.listItemName.replace(/\s*\([^)]+\)\s*$/, "").trim() ||
    row.name;
  const name = normalizedName
    ? normalizedName[0].toLocaleUpperCase("sv-SE") + normalizedName.slice(1)
    : normalizedName;
  const quantity =
    row.dimension && row.amount !== undefined
      ? {
          amount: match?.purchasePlan?.purchasedAmount ?? row.amount,
          dimension: row.dimension,
        }
      : null;
  const plan = match?.purchasePlan;
  return {
    text: quantity ? `${name} (${formatComparableQuantity(quantity)})` : name,
    parts:
      plan && (plan.items.length > 1 || plan.items[0]?.count > 1)
        ? formatPurchasePlanLabel(plan)
        : null,
  };
};

const createShoppingRowIdentity = (
  normalizedName: string,
  dimension?: ActiveShoppingRow["dimension"],
  amount?: number,
) =>
  dimension && amount !== undefined
    ? `${normalizedName}:${dimension}:${amount}`
    : normalizedName;

const createMatchShoppingRowIdentity = (match: ListItemPriceMatch) => {
  const quantity = parseComparableQuantity(match.listItemName);
  const normalizedName = normalizeGroceryName(
    match.listItemName.replace(/\s*\([^)]+\)\s*$/, ""),
  );
  return createShoppingRowIdentity(
    normalizedName,
    quantity?.dimension,
    quantity?.amount,
  );
};

export const createActivePricingItems = (
  tasks: TaskItem[],
): Array<{ id: string; name: string; sourceTaskIds: string[] }> =>
  createActiveShoppingRows(tasks).map(({ id, name, sourceTaskIds }) => ({
    id,
    name,
    sourceTaskIds,
  }));

export const createBasketItemSignature = (tasks: TaskItem[]): string => {
  const unquantifiedCounts = new Map<string, number>();
  const parts: string[] = [];
  createActiveShoppingRows(tasks).forEach((requirement) => {
    if (requirement.dimension && requirement.amount !== undefined) {
      parts.push(
        `${requirement.normalizedName}:${requirement.dimension}:${requirement.amount}`,
      );
      return;
    }
    unquantifiedCounts.set(
      requirement.normalizedName,
      (unquantifiedCounts.get(requirement.normalizedName) ?? 0) + 1,
    );
  });
  parts.push(
    ...Array.from(unquantifiedCounts, ([name, count]) =>
      count === 1 ? name : `${name}:unquantified:${count}`,
    ),
  );
  return parts.sort().join("|");
};

export const createBasketItemSignatureFromRows = (
  rows: ActiveShoppingRow[],
): string => {
  const unquantifiedCounts = new Map<string, number>();
  const parts: string[] = [];
  rows.forEach((requirement) => {
    if (requirement.dimension && requirement.amount !== undefined) {
      parts.push(
        `${requirement.normalizedName}:${requirement.dimension}:${requirement.amount}`,
      );
      return;
    }
    unquantifiedCounts.set(
      requirement.normalizedName,
      (unquantifiedCounts.get(requirement.normalizedName) ?? 0) + 1,
    );
  });
  parts.push(
    ...Array.from(unquantifiedCounts, ([name, count]) =>
      count === 1 ? name : `${name}:unquantified:${count}`,
    ),
  );
  return parts.sort().join("|");
};

export const createBasketPricingCacheKey = (
  chain: string,
  storeId: string,
  listId: string,
  signature: string,
): string =>
  `${BASKET_PRICING_CACHE_PREFIX}:${chain}:${storeId}:${listId}:${signature}`;

const hasPricedMatches = (result: BasketPriceEstimate) =>
  result.matches.some((match) => Boolean(match.product));

const cacheTtlMsFor = (key: string, result: BasketPriceEstimate) => {
  const pricedCount = result.matches.filter((match) => match.product).length;
  const coverageRatio =
    result.matches.length > 0 ? pricedCount / result.matches.length : 0;
  if (key.includes(":ica:") && coverageRatio < MIN_SAFE_ICA_COVERAGE) {
    return PARTIAL_ICA_BASKET_PRICING_CACHE_TTL_MS;
  }
  return hasPricedMatches(result)
    ? BASKET_PRICING_CACHE_TTL_MS
    : EMPTY_BASKET_PRICING_CACHE_TTL_MS;
};

const isCacheEntry = (value: unknown): value is BasketPricingCacheEntry => {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<BasketPricingCacheEntry>;
  return (
    typeof entry.fetchedAt === "string" &&
    !!entry.result &&
    Array.isArray(entry.result.matches) &&
    typeof entry.result.approximateTotalSek === "number"
  );
};

export const readBasketPricingCache = (
  key: string,
  now = Date.now(),
): { entry: BasketPricingCacheEntry | null; isStale: boolean } => {
  let entry = basketPricingMemoryCache.get(key) ?? null;

  if (!entry && typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(key);
      const parsed: unknown = stored ? JSON.parse(stored) : null;
      if (isCacheEntry(parsed)) {
        entry = parsed;
        basketPricingMemoryCache.set(key, parsed);
      }
    } catch {
      // Pricing still works when localStorage is unavailable or malformed.
    }
  }

  if (!entry) return { entry: null, isStale: false };
  const fetchedAtMs = Date.parse(entry.fetchedAt);
  return {
    entry,
    isStale:
      !Number.isFinite(fetchedAtMs) ||
      now - fetchedAtMs >= cacheTtlMsFor(key, entry.result),
  };
};

export const resolveBasketPricingCacheState = (
  cached: { entry: BasketPricingCacheEntry | null; isStale: boolean },
): { estimate: BasketPriceEstimate; isLoading: boolean; shouldFetch: boolean } => {
  if (cached.entry && !cached.isStale) {
    return { estimate: cached.entry.result, isLoading: false, shouldFetch: false };
  }
  if (cached.entry) {
    return { estimate: cached.entry.result, isLoading: true, shouldFetch: true };
  }
  return { estimate: EMPTY_ESTIMATE, isLoading: true, shouldFetch: true };
};

export const writeBasketPricingCache = (
  key: string,
  result: BasketPriceEstimate,
): void => {
  const entry = { result, fetchedAt: new Date().toISOString() };
  basketPricingMemoryCache.set(key, entry);
  try {
    window.localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // The memory cache still avoids duplicate requests in this session.
  }
  pricingLog("cache write", {
    key,
    fetchedAt: entry.fetchedAt,
    ttlMs: cacheTtlMsFor(key, result),
    pricedCount: result.matches.filter((match) => match.product).length,
    coverageRatio:
      result.matches.length > 0
        ? result.matches.filter((match) => match.product).length /
          result.matches.length
        : 0,
  });
};

const isPricingDebugEnabled = () => {
  if (typeof window === "undefined") return false;

  try {
    const params = new URLSearchParams(window.location.search);
    return (
      params.get("debug") === "1" ||
      params.get("pricingDebug") === "1" ||
      window.localStorage.getItem(PRICING_DEBUG_STORAGE_KEY) === "true"
    );
  } catch {
    return false;
  }
};

const pricingLog = (message: string, details?: unknown) => {
  if (!isPricingDebugEnabled()) return;
  if (details === undefined) {
    console.log(`[pricing] ${message}`);
    return;
  }
  console.log(`[pricing] ${message}`, details);
};

const EMPTY_ESTIMATE: BasketPriceEstimate = {
  matches: [],
  approximateTotalSek: 0,
};

export const logBasketPricingResult = (result: BasketPriceEstimate) => {
  const rawResult = result;
  pricingLog("raw result", rawResult);
  pricingLog("result", {
    matchCount: result.matches.length,
    pricedCount: result.matches.filter((match) => match.product).length,
    approximateTotalSek: result.approximateTotalSek,
    error: result.error,
    debugCode: result.debugCode,
    debugMessage: result.debugMessage,
    matches: result.matches,
    rawResult,
  });
  pricingLog("result.error", result.error);
  pricingLog("result.debugMessage", result.debugMessage);
  pricingLog("result.debugCode", result.debugCode);
  if (result.error) {
    pricingLog("unavailable", {
      error: result.error,
      debugCode: result.debugCode,
      debugMessage: result.debugMessage,
      rawResult,
    });
  }
};

export interface BasketPriceEstimateView {
  matchByTaskId: Record<string, ListItemPriceMatch>;
  approximateTotalSek: number;
  pricedCount: number;
  hasResult: boolean;
  isLoading: boolean;
}

export const selectActiveBasketEstimate = (
  tasks: TaskItem[],
  estimate: BasketPriceEstimate,
): BasketPriceEstimateView => {
  const activeTasks = tasks.filter((task) => !task.checked);
  const activeShoppingRows = createActiveShoppingRows(tasks);
  const shoppingRowByIdentity = new Map(
    activeShoppingRows.map((row) => [
      createShoppingRowIdentity(row.normalizedName, row.dimension, row.amount),
      row,
    ]),
  );
  const shoppingRowBySourceTaskId = new Map(
    activeShoppingRows.flatMap((row) =>
      row.sourceTaskIds.map((taskId) => [taskId, row] as const),
    ),
  );
  const allTaskIds = new Set(tasks.map((task) => task.id));
  const activeTaskIds = new Set(activeTasks.map((task) => task.id));
  const activeTaskByName = new Map(
    activeTasks.map((task) => [
      task.text.trim().toLocaleLowerCase().replace(/\s+/g, " "),
      task,
    ]),
  );
  const matchByTaskId: Record<string, ListItemPriceMatch> = {};
  const seenTaskIds = new Set<string>();
  const seenShoppingRowIds = new Set<string>();
  let approximateTotalSek = 0;

  estimate.matches.forEach((match) => {
    if (!match.product) return;
    let sourceTasks = (match.sourceTaskIds ?? [])
      .filter((id) => activeTaskIds.has(id))
      .map((id) => activeTasks.find((task) => task.id === id))
      .filter((task): task is TaskItem => Boolean(task));
    let shoppingRowId: string | undefined;
    const directShoppingRow = sourceTasks
      .map((task) => shoppingRowBySourceTaskId.get(task.id))
      .find(Boolean);
    if (
      directShoppingRow &&
      sourceTasks.length < (match.sourceTaskIds?.length ?? 0)
    ) {
      shoppingRowId = directShoppingRow.id;
      sourceTasks = directShoppingRow.sourceTaskIds
        .map((id) => activeTasks.find((task) => task.id === id))
        .filter((task): task is TaskItem => Boolean(task));
    }
    if (sourceTasks.length === 0) {
      const shoppingRow = shoppingRowByIdentity.get(
        createMatchShoppingRowIdentity(match),
      );
      if (shoppingRow) {
        shoppingRowId = shoppingRow.id;
        sourceTasks = shoppingRow.sourceTaskIds
          .map((id) => activeTasks.find((task) => task.id === id))
          .filter((task): task is TaskItem => Boolean(task));
      }
    }
    if (sourceTasks.length > 0) {
      const rowId = shoppingRowId ?? sourceTasks[0].id;
      if (seenShoppingRowIds.has(rowId)) return;
      seenShoppingRowIds.add(rowId);
      sourceTasks.forEach((task) => {
        matchByTaskId[task.id] =
          task.id === match.listItemId
            ? match
            : { ...match, listItemId: task.id };
      });
      approximateTotalSek +=
        match.estimatedCheckoutPriceSek ?? match.product.priceSek;
      return;
    }
    const currentTask = activeTaskIds.has(match.listItemId)
      ? activeTasks.find((task) => task.id === match.listItemId)
      : allTaskIds.has(match.listItemId)
        ? undefined
        : activeTaskByName.get(
            match.listItemName.trim().toLocaleLowerCase().replace(/\s+/g, " "),
          );
    if (!currentTask) return;
    if (seenTaskIds.has(currentTask.id)) return;
    seenTaskIds.add(currentTask.id);
    matchByTaskId[currentTask.id] =
      currentTask.id === match.listItemId
        ? match
        : { ...match, listItemId: currentTask.id };
    approximateTotalSek +=
      match.estimatedCheckoutPriceSek ?? match.product.priceSek;
  });

  return {
    matchByTaskId,
    approximateTotalSek: Math.round(approximateTotalSek * 100) / 100,
    pricedCount: Object.values(matchByTaskId).filter((match) => match.product).length,
    hasResult: true,
    isLoading: false,
  };
};


export interface BasketPriceComparisonResult {
  source: PricingSource;
  sourceKey: string;
  approximateTotalSek: number;
  pricedCount: number;
  matchCount: number;
  rowCount: number;
  coverageRatio: number;
  isLoading: boolean;
  error?: string;
}

export interface BasketPriceComparisonView {
  results: BasketPriceComparisonResult[];
  isLoading: boolean;
  refresh: () => void;
}

const createPricingSourceKey = (source: PricingSource) =>
  `${source.chain}:${source.storeId}`;

const fetchBasketPriceEstimate = async (
  source: PricingSource,
  items: Array<{ id: string; name: string; sourceTaskIds: string[] }>,
  signal: AbortSignal,
): Promise<BasketPriceEstimate> => {
  const debugEnabled = isPricingDebugEnabled();
  const response = await fetch(`/api/pricing/basket${debugEnabled ? "?debug=1" : ""}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chain: source.chain,
      storeId: source.storeId,
      items,
    }),
    signal,
  });
  pricingLog("response", { status: response.status, ok: response.ok });
  if (!response.ok) {
    const responseText = await response.text();
    let body: unknown = responseText;
    try {
      body = JSON.parse(responseText);
    } catch {
      // Keep the original response text when the error body is not JSON.
    }
    pricingLog("response error body", {
      status: response.status,
      body,
    });
    throw new Error("Basket pricing request failed");
  }
  return (await response.json()) as BasketPriceEstimate;
};

export const useBasketPriceEstimate = (
  listId: string,
  tasks: TaskItem[],
  pricingSource: PricingSource,
): BasketPriceEstimateView => {
  const [estimate, setEstimate] = useState<BasketPriceEstimate>(EMPTY_ESTIMATE);
  const [estimateCacheKey, setEstimateCacheKey] = useState<string | null>(null);
  const [resultCacheKey, setResultCacheKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const activeItems = useMemo(
    () => createActivePricingItems(tasks),
    [tasks],
  );
  pricingLog("hook input", {
    taskCount: tasks.length,
    activeCount: activeItems.length,
    activeItems,
  });

  const activeShoppingRows = useMemo(() => createActiveShoppingRows(tasks), [tasks]);
  const itemSignature = createBasketItemSignatureFromRows(activeShoppingRows);
  const { chain, storeId } = pricingSource;
  const cacheKey = createBasketPricingCacheKey(chain, storeId, listId, itemSignature);

  useEffect(() => {
    if (activeItems.length === 0) {
      setEstimate(EMPTY_ESTIMATE);
      setEstimateCacheKey(null);
      setResultCacheKey(null);
      setIsLoading(false);
      pricingLog("skip: no active items");
      return;
    }

    const cached = readBasketPricingCache(cacheKey);
    const cacheState = resolveBasketPricingCacheState(cached);
    setEstimate(cacheState.estimate);
    setEstimateCacheKey(cacheKey);
    setResultCacheKey(cached.entry ? cacheKey : null);
    setIsLoading(cacheState.isLoading);
    if (!cacheState.shouldFetch) {
      pricingLog("cache hit", { key: cacheKey, fetchedAt: cached.entry?.fetchedAt });
      return;
    } else if (cached.entry) {
      pricingLog("cache stale", { key: cacheKey, fetchedAt: cached.entry.fetchedAt });
    } else {
      pricingLog("cache miss", { key: cacheKey });
    }

    const controller = new AbortController();
    pricingLog("debounce scheduled", {
      delayMs: BASKET_DEBOUNCE_MS,
      activeCount: activeItems.length,
    });
    const timeoutId = window.setTimeout(() => {
      pricingLog("request basket", { chain, storeId, items: activeItems });
      void fetchBasketPriceEstimate(pricingSource, activeItems, controller.signal)
        .then((result) => {
          logBasketPricingResult(result);
          if (result.error) {
            throw new Error(result.error);
          }
          writeBasketPricingCache(cacheKey, result);
          setEstimate(result);
          setEstimateCacheKey(cacheKey);
          setResultCacheKey(cacheKey);
          setIsLoading(false);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) {
            pricingLog("request aborted");
            return;
          }
          pricingLog("request failed", error);
          if (cached.entry) {
            pricingLog("using stale cache after request failed", {
              key: cacheKey,
              fetchedAt: cached.entry.fetchedAt,
            });
            setEstimate(cached.entry.result);
            setResultCacheKey(cacheKey);
          } else {
            setEstimate(EMPTY_ESTIMATE);
            setResultCacheKey(null);
          }
          setEstimateCacheKey(cacheKey);
          setIsLoading(false);
        });
    }, BASKET_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [activeItems, cacheKey, chain, storeId]);

  const effectiveEstimate = estimateCacheKey === cacheKey ? estimate : EMPTY_ESTIMATE;
  const effectiveIsLoading =
    activeItems.length > 0 && (estimateCacheKey === cacheKey ? isLoading : true);
  const effectiveHasResult = resultCacheKey === cacheKey;

  return useMemo(
    () => ({
      ...selectActiveBasketEstimate(tasks, effectiveEstimate),
      hasResult: effectiveHasResult,
      isLoading: effectiveIsLoading,
    }),
    [tasks, effectiveEstimate, effectiveHasResult, effectiveIsLoading],
  );
};


export const useBasketPriceComparison = (
  listId: string,
  tasks: TaskItem[],
  sources: PricingSource[],
  enabled: boolean,
): BasketPriceComparisonView => {
  const [resultsBySourceKey, setResultsBySourceKey] = useState<Record<string, BasketPriceComparisonResult>>({});
  const [refreshNonce, setRefreshNonce] = useState(0);
  const activeItems = useMemo(() => createActivePricingItems(tasks), [tasks]);
  const activeShoppingRows = useMemo(() => createActiveShoppingRows(tasks), [tasks]);
  const itemSignature = createBasketItemSignatureFromRows(activeShoppingRows);
  const sourcePrimitiveSignature = sources
    .map((source) =>
      [source.chain, source.storeId, source.label, source.storeUrl ?? ""].join("::"),
    )
    .join("|");
  const stableSources = useMemo(
    () =>
      sources.map((source) => ({
        chain: source.chain,
        storeId: source.storeId,
        label: source.label,
        storeUrl: source.storeUrl,
      })),
    [sourcePrimitiveSignature],
  );
  const sourceKeySignature = stableSources.map(createPricingSourceKey).join("|");
  const sourceOrderByKey = useMemo(
    () =>
      new Map(
        stableSources.map((source, index) => [createPricingSourceKey(source), index]),
      ),
    [sourceKeySignature],
  );

  const refresh = useCallback(() => {
    setRefreshNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!enabled || activeItems.length === 0 || stableSources.length === 0) return;

    const controllers: AbortController[] = [];
    stableSources.forEach((source) => {
      const sourceKey = createPricingSourceKey(source);
      const cacheKey = createBasketPricingCacheKey(source.chain, source.storeId, listId, itemSignature);
      const cached = readBasketPricingCache(cacheKey);
      const cachedFetchedAtMs = cached.entry ? Date.parse(cached.entry.fetchedAt) : NaN;
      const canUseCached =
        cached.entry &&
        !cached.isStale &&
        Number.isFinite(cachedFetchedAtMs) &&
        Date.now() - cachedFetchedAtMs < BASKET_COMPARISON_STALE_MS;

      const applyResult = (estimate: BasketPriceEstimate, isLoading: boolean, error?: string) => {
        const view = selectActiveBasketEstimate(tasks, estimate);
        const rowCount = activeShoppingRows.length;
        const matchCount = Object.keys(view.matchByTaskId).length;
        const pricedCount = view.pricedCount;
        setResultsBySourceKey((current) => ({
          ...current,
          [sourceKey]: {
            source,
            sourceKey,
            approximateTotalSek: view.approximateTotalSek,
            pricedCount,
            matchCount,
            rowCount,
            coverageRatio: rowCount > 0 ? pricedCount / rowCount : 0,
            isLoading,
            error,
          },
        }));
      };

      if (canUseCached) {
        applyResult(cached.entry.result, false, cached.entry.result.error);
        return;
      }

      applyResult(cached.entry?.result ?? EMPTY_ESTIMATE, true);
      const controller = new AbortController();
      controllers.push(controller);
      pricingLog("request basket comparison", { sourceKey, items: activeItems });
      void fetchBasketPriceEstimate(source, activeItems, controller.signal)
        .then((result) => {
          logBasketPricingResult(result);
          if (result.error) throw new Error(result.error);
          writeBasketPricingCache(cacheKey, result);
          applyResult(result, false);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          pricingLog("comparison request failed", { sourceKey, error });
          applyResult(cached.entry?.result ?? EMPTY_ESTIMATE, false, "Kunde inte jämföra just nu");
        });
    });

    return () => controllers.forEach((controller) => controller.abort());
  }, [enabled, itemSignature, listId, refreshNonce, sourceKeySignature]);

  const results = useMemo(() => {
    const values = stableSources.map((source) => {
      const sourceKey = createPricingSourceKey(source);
      const result = resultsBySourceKey[sourceKey];
      return result
        ? { ...result, source }
        : {
            source,
            sourceKey,
            approximateTotalSek: 0,
            pricedCount: 0,
            matchCount: 0,
            rowCount: activeShoppingRows.length,
            coverageRatio: 0,
            isLoading: enabled && activeItems.length > 0,
          };
    });
    return values.sort((left, right) => {
      const leftOk = !left.isLoading && !left.error && left.pricedCount > 0;
      const rightOk = !right.isLoading && !right.error && right.pricedCount > 0;
      if (leftOk && rightOk) return left.approximateTotalSek - right.approximateTotalSek;
      if (leftOk) return -1;
      if (rightOk) return 1;
      if (left.isLoading !== right.isLoading) return left.isLoading ? -1 : 1;
      return (sourceOrderByKey.get(left.sourceKey) ?? 0) - (sourceOrderByKey.get(right.sourceKey) ?? 0);
    });
  }, [
    activeItems.length,
    activeShoppingRows.length,
    enabled,
    resultsBySourceKey,
    sourceKeySignature,
    sourceOrderByKey,
    sourcePrimitiveSignature,
  ]);

  return {
    results,
    isLoading: results.some((result) => result.isLoading),
    refresh,
  };
};

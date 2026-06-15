import { useEffect, useMemo, useState } from "react";
import type { TaskItem } from "../../types";
import type { BasketPriceEstimate, ListItemPriceMatch } from "./types";

const BASKET_DEBOUNCE_MS = 3_000;
export const BASKET_PRICING_CACHE_TTL_MS = 6 * 60 * 60 * 1_000;
const PRICING_DEBUG_STORAGE_KEY = "hem-listan-debug-enabled";
const BASKET_PRICING_CACHE_PREFIX = "hem-listan-pricing-basket:v1";
const basketPricingMemoryCache = new Map<string, BasketPricingCacheEntry>();

interface BasketPricingCacheEntry {
  result: BasketPriceEstimate;
  fetchedAt: string;
}

export const createBasketItemSignature = (
  tasks: TaskItem[],
): string =>
  [...new Set(
    tasks
      .filter((task) => !task.checked)
      .map((task) => task.text.trim().toLocaleLowerCase().replace(/\s+/g, " "))
      .filter(Boolean),
  )]
    .sort()
    .join("|");

export const createBasketPricingCacheKey = (
  chain: string,
  listId: string,
  signature: string,
): string =>
  `${BASKET_PRICING_CACHE_PREFIX}:${chain}:${listId}:${signature}`;

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
      now - fetchedAtMs >= BASKET_PRICING_CACHE_TTL_MS,
  };
};

const writeBasketPricingCache = (
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
  pricingLog("cache write", { key, fetchedAt: entry.fetchedAt });
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
}

export const selectActiveBasketEstimate = (
  tasks: TaskItem[],
  estimate: BasketPriceEstimate,
): BasketPriceEstimateView => {
  const activeTasks = tasks.filter((task) => !task.checked);
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
  let approximateTotalSek = 0;

  estimate.matches.forEach((match) => {
    if (!match.product) return;
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
  };
};

export const useBasketPriceEstimate = (
  listId: string,
  tasks: TaskItem[],
): BasketPriceEstimateView => {
  const [estimate, setEstimate] = useState<BasketPriceEstimate>(EMPTY_ESTIMATE);
  const activeItems = useMemo(
    () =>
      tasks
        .filter((task) => !task.checked)
        .map((task) => ({ id: task.id, name: task.text })),
    [tasks],
  );
  pricingLog("hook input", {
    taskCount: tasks.length,
    activeCount: activeItems.length,
    activeItems,
  });

  const itemSignature = createBasketItemSignature(tasks);

  useEffect(() => {
    if (activeItems.length === 0) {
      setEstimate(EMPTY_ESTIMATE);
      pricingLog("skip: no active items");
      return;
    }

    const chain = "city_gross";
    const cacheKey = createBasketPricingCacheKey(chain, listId, itemSignature);
    const cached = readBasketPricingCache(cacheKey);
    if (cached.entry) {
      setEstimate(cached.entry.result);
    }
    if (cached.entry && !cached.isStale) {
      pricingLog("cache hit", { key: cacheKey, fetchedAt: cached.entry.fetchedAt });
      return;
    } else if (cached.entry) {
      pricingLog("cache stale", { key: cacheKey, fetchedAt: cached.entry.fetchedAt });
    } else {
      pricingLog("cache miss", { key: cacheKey });
    }

    const debugEnabled = isPricingDebugEnabled();
    const controller = new AbortController();
    pricingLog("debounce scheduled", {
      delayMs: BASKET_DEBOUNCE_MS,
      activeCount: activeItems.length,
    });
    const timeoutId = window.setTimeout(() => {
      pricingLog("request basket", { chain, items: activeItems });
      void fetch(`/api/pricing/basket${debugEnabled ? "?debug=1" : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chain,
          items: activeItems,
        }),
        signal: controller.signal,
      })
        .then(async (response) => {
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
        })
        .then((result) => {
          logBasketPricingResult(result);
          if (result.error) {
            throw new Error(result.error);
          }
          writeBasketPricingCache(cacheKey, result);
          setEstimate(result);
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
          }
        });
    }, BASKET_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [itemSignature, listId]);

  return useMemo(
    () => selectActiveBasketEstimate(tasks, estimate),
    [tasks, estimate],
  );
};

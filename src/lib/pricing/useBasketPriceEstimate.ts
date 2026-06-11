import { useEffect, useMemo, useState } from "react";
import type { TaskItem } from "../../types";
import type { BasketPriceEstimate, ListItemPriceMatch } from "./types";

const BASKET_DEBOUNCE_MS = 3_000;
const PRICING_DEBUG_STORAGE_KEY = "hem-listan-debug-enabled";

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
  const activeTaskIds = new Set(
    tasks.filter((task) => !task.checked).map((task) => task.id),
  );
  const matchByTaskId: Record<string, ListItemPriceMatch> = {};
  let approximateTotalSek = 0;

  estimate.matches.forEach((match) => {
    if (!activeTaskIds.has(match.listItemId) || !match.product) return;
    matchByTaskId[match.listItemId] = match;
    approximateTotalSek += match.product.priceSek;
  });

  return {
    matchByTaskId,
    approximateTotalSek: Math.round(approximateTotalSek * 100) / 100,
  };
};

export const useBasketPriceEstimate = (
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

  const itemSignature = activeItems
    .map((item) => `${item.id}:${item.name}`)
    .join("|");

  useEffect(() => {
    setEstimate(EMPTY_ESTIMATE);
    if (activeItems.length === 0) {
      pricingLog("skip: no active items");
      return;
    }

    const debugEnabled = isPricingDebugEnabled();
    const controller = new AbortController();
    pricingLog("debounce scheduled", {
      delayMs: BASKET_DEBOUNCE_MS,
      activeCount: activeItems.length,
    });
    const timeoutId = window.setTimeout(() => {
      const chain = "city_gross";
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
          setEstimate(result);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) {
            pricingLog("request aborted");
            return;
          }
          pricingLog("request failed", error);
          setEstimate(EMPTY_ESTIMATE);
        });
    }, BASKET_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [itemSignature]);

  return useMemo(
    () => selectActiveBasketEstimate(tasks, estimate),
    [tasks, estimate],
  );
};

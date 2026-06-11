import { useEffect, useMemo, useState } from "react";
import type { TaskItem } from "../../types";
import type {
  BasketPriceEstimate,
  ListItemPriceMatch,
} from "./types";

const BASKET_DEBOUNCE_MS = 3_000;
const EMPTY_ESTIMATE: BasketPriceEstimate = {
  matches: [],
  approximateTotalSek: 0,
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
  const itemSignature = activeItems
    .map((item) => `${item.id}:${item.name}`)
    .join("|");

  useEffect(() => {
    setEstimate(EMPTY_ESTIMATE);
    if (activeItems.length === 0) return;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void fetch("/api/pricing/basket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chain: "city_gross",
          items: activeItems,
        }),
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("Basket pricing request failed");
          return (await response.json()) as BasketPriceEstimate;
        })
        .then((result) => setEstimate(result))
        .catch(() => {
          if (!controller.signal.aborted) setEstimate(EMPTY_ESTIMATE);
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

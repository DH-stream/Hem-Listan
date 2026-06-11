import { useEffect, useMemo, useState } from "react";
import type { TaskItem } from "../../types";
import { matchListItem, normalizePriceQuery } from "./matching";
import type { ListItemPriceMatch, ProductPrice } from "./types";

const SEARCH_DEBOUNCE_MS = 500;
const MAX_CONCURRENT_REQUESTS = 4;
const productRequestCache = new Map<string, Promise<ProductPrice[]>>();

const fetchProducts = (query: string): Promise<ProductPrice[]> => {
  const cached = productRequestCache.get(query);
  if (cached) return cached;

  const request = fetch(`/api/pricing/citygross/search?q=${encodeURIComponent(query)}`)
    .then(async (response) => {
      if (!response.ok) throw new Error("Pricing request failed");
      const payload: unknown = await response.json();
      return Array.isArray(payload) ? (payload as ProductPrice[]) : [];
    })
    .catch(() => {
      productRequestCache.delete(query);
      return [];
    });
  productRequestCache.set(query, request);
  return request;
};

const fetchWithConcurrency = async (
  queries: string[],
): Promise<Array<[string, ProductPrice[]]>> => {
  const results: Array<[string, ProductPrice[]]> = [];
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < queries.length) {
      const query = queries[nextIndex];
      nextIndex += 1;
      results.push([query, await fetchProducts(query)]);
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(MAX_CONCURRENT_REQUESTS, queries.length) },
      () => worker(),
    ),
  );
  return results;
};

export interface BasketPriceEstimate {
  matchByTaskId: Record<string, ListItemPriceMatch>;
  approximateTotalSek: number;
}

export const buildBasketPriceEstimate = (
  tasks: TaskItem[],
  productsByQuery: ReadonlyMap<string, ProductPrice[]>,
): BasketPriceEstimate => {
  const matchByTaskId: Record<string, ListItemPriceMatch> = {};
  let approximateTotalSek = 0;

  for (const task of tasks) {
    if (task.checked) continue;
    const query = normalizePriceQuery(task.text);
    const products = productsByQuery.get(query) ?? [];
    const match = matchListItem({ id: task.id, name: task.text }, products);
    if (!match.product) continue;
    matchByTaskId[task.id] = match;
    approximateTotalSek += match.product.priceSek;
  }

  return {
    matchByTaskId,
    approximateTotalSek: Math.round(approximateTotalSek * 100) / 100,
  };
};

export const useBasketPriceEstimate = (tasks: TaskItem[]): BasketPriceEstimate => {
  const [productsByQuery, setProductsByQuery] = useState<Map<string, ProductPrice[]>>(
    () => new Map(),
  );
  const activeQueries = useMemo(
    () =>
      Array.from(
        new Set(
          tasks
            .filter((task) => !task.checked)
            .map((task) => normalizePriceQuery(task.text))
            .filter(Boolean),
        ),
      ),
    [tasks],
  );
  const querySignature = activeQueries.join("|");

  useEffect(() => {
    if (activeQueries.length === 0) return;
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void fetchWithConcurrency(activeQueries).then((entries) => {
        if (cancelled) return;
        setProductsByQuery((current) => {
          const next = new Map(current);
          entries.forEach(([query, products]) => next.set(query, products));
          return next;
        });
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [querySignature]);

  return useMemo(
    () => buildBasketPriceEstimate(tasks, productsByQuery),
    [tasks, productsByQuery],
  );
};

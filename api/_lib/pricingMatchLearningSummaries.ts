import type { GroceryChainId } from "../../src/lib/pricing/types";

export interface PricingMatchLearningSummary {
  chain: GroceryChainId;
  storeId?: string;
  storeKey?: string;
  normalizedQuery: string;
  selectedProductId: string;
  sampleCount: number;
  suspiciousCount: number;
  confidenceScore: number;
}

export type PricingMatchLearningSummaryLookup = Map<string, PricingMatchLearningSummary>;

const getEnv = (key: string) =>
  typeof process !== "undefined" ? process.env[key] : undefined;

const getSupabaseRestConfig = () => {
  const url =
    getEnv("SUPABASE_URL") ??
    getEnv("VITE_SUPABASE_URL") ??
    getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) return null;
  return { url: url.replace(/\/$/, ""), serviceRoleKey };
};

const summaryKey = (normalizedQuery: string, productId: string) =>
  `${normalizedQuery}\0${productId}`;

export const createPricingMatchLearningSummaryLookup = (
  summaries: PricingMatchLearningSummary[],
): PricingMatchLearningSummaryLookup =>
  new Map(
    summaries
      .filter((summary) => summary.normalizedQuery && summary.selectedProductId)
      .map((summary) => [
        summaryKey(summary.normalizedQuery, summary.selectedProductId),
        summary,
      ] as const),
  );

export const findPricingMatchLearningSummary = (
  lookup: PricingMatchLearningSummaryLookup | undefined,
  normalizedQuery: string,
  productId: string,
) => lookup?.get(summaryKey(normalizedQuery, productId));

const parseSummaryRow = (row: Record<string, unknown>): PricingMatchLearningSummary | null => {
  if (
    typeof row.chain !== "string" ||
    typeof row.normalized_query !== "string" ||
    typeof row.selected_product_id !== "string"
  ) {
    return null;
  }

  return {
    chain: row.chain as GroceryChainId,
    storeId: typeof row.store_id === "string" ? row.store_id : undefined,
    storeKey: typeof row.store_key === "string" ? row.store_key : undefined,
    normalizedQuery: row.normalized_query,
    selectedProductId: row.selected_product_id,
    sampleCount: typeof row.sample_count === "number" ? row.sample_count : 0,
    suspiciousCount: typeof row.suspicious_count === "number" ? row.suspicious_count : 0,
    confidenceScore: typeof row.confidence_score === "number" ? row.confidence_score : 0,
  };
};

export const loadPricingMatchLearningSummaries = async (params: {
  chain: GroceryChainId;
  storeId?: string;
  normalizedQueries: string[];
  onError?: (error: unknown) => void;
}): Promise<PricingMatchLearningSummaryLookup> => {
  const config = getSupabaseRestConfig();
  const normalizedQueries = [...new Set(params.normalizedQueries.filter(Boolean))];
  if (!config || normalizedQueries.length === 0) {
    return createPricingMatchLearningSummaryLookup([]);
  }

  const query = new URLSearchParams();
  query.set("select", "chain,store_id,store_key,normalized_query,selected_product_id,sample_count,suspicious_count,confidence_score");
  query.set("chain", `eq.${params.chain}`);
  query.set("normalized_query", `in.(${normalizedQueries.map((value) => `\"${value.replace(/\"/g, "\\\"")}\"`).join(",")})`);
  if (params.storeId) {
    query.set("or", `(store_id.eq.${params.storeId},store_key.eq.${params.storeId})`);
  }

  try {
    const response = await fetch(`${config.url}/rest/v1/pricing_match_learning_summaries?${query}`, {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
      },
    });
    if (!response.ok) throw new Error(`pricing_match_learning_summaries_fetch_failed:${response.status}`);
    const rows = (await response.json().catch(() => [])) as unknown;
    if (!Array.isArray(rows)) return createPricingMatchLearningSummaryLookup([]);
    return createPricingMatchLearningSummaryLookup(
      rows
        .map((row) => (row && typeof row === "object" ? parseSummaryRow(row as Record<string, unknown>) : null))
        .filter((summary): summary is PricingMatchLearningSummary => Boolean(summary)),
    );
  } catch (error) {
    params.onError?.(error);
    return createPricingMatchLearningSummaryLookup([]);
  }
};

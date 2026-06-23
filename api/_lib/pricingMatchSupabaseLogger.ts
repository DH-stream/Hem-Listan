import type { PricingMatchEvent, PricingMatchEventLogger } from "./pricingMatchEvents.js";

export interface PricingMatchEventActor {
  userId?: string;
  anonymousInstallationId?: string;
}

const getEnv = (key: string) =>
  typeof process !== "undefined" ? process.env[key] : undefined;

const getSupabaseRestConfig = () => {
  const url =
    getEnv("SUPABASE_URL") ??
    getEnv("VITE_SUPABASE_URL") ??
    getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey =
    getEnv("SUPABASE_ANON_KEY") ??
    getEnv("VITE_SUPABASE_ANON_KEY") ??
    getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!url || !anonKey) return null;
  return { url: url.replace(/\/$/, ""), anonKey };
};

export const parseBearerUserId = (authorizationHeader: string | undefined) => {
  const token = authorizationHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return undefined;

  const [, payload] = token.split(".");
  if (!payload) return undefined;

  try {
    const decoded = JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64url").toString("utf8"),
    ) as { sub?: unknown };
    return typeof decoded.sub === "string" && decoded.sub ? decoded.sub : undefined;
  } catch {
    return undefined;
  }
};

const toEventRow = (event: PricingMatchEvent, actor: PricingMatchEventActor) => ({
  created_at: event.timestamp,
  user_id: actor.userId ?? null,
  anonymous_installation_id: actor.userId ? null : actor.anonymousInstallationId ?? null,
  chain: event.chain,
  store_id: event.storeId ?? null,
  normalized_query: event.normalizedQuery,
  selected_product_id: event.selectedProductId ?? null,
  selected_product_name: event.selectedProductName ?? null,
  confidence: event.selectedConfidence,
  score: event.selectedScore ?? null,
  score_reasons: event.scoreReasons ?? [],
  score_breakdown: event.scoreBreakdown ?? null,
  candidate_snapshot: event.topCandidates,
  approximate_price: event.approximatePriceSek ?? null,
  result_type: event.resultSource,
});

export const createSupabasePricingMatchEventLogger = (options: {
  actor: PricingMatchEventActor;
  authorizationHeader?: string;
  onError?: (error: unknown) => void;
}): PricingMatchEventLogger | null => {
  if (!options.actor.userId && !options.actor.anonymousInstallationId) return null;

  const config = getSupabaseRestConfig();
  if (!config) return null;

  return {
    async logMatchEvent(event) {
      const response = await fetch(`${config.url}/rest/v1/pricing_match_events`, {
        method: "POST",
        headers: {
          apikey: config.anonKey,
          Authorization: options.actor.userId
            ? options.authorizationHeader ?? `Bearer ${config.anonKey}`
            : `Bearer ${config.anonKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(toEventRow(event, options.actor)),
      });

      if (!response.ok) {
        const responseText = await response.text().catch(() => "");
        throw new Error(
          `pricing_match_event_insert_failed:${response.status}${
            responseText ? `:${responseText.slice(0, 200)}` : ""
          }`,
        );
      }
    },
  };
};

import type { PricingMatchEvent, PricingMatchEventLogger } from "./pricingMatchEvents.js";

export interface PricingMatchEventActor {
  authorizationHeader?: string;
  anonymousInstallationId?: string;
  onTelemetryError?: (error: unknown) => void;
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
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !anonKey || !serviceRoleKey) return null;
  return { url: url.replace(/\/$/, ""), anonKey, serviceRoleKey };
};

const bearerTokenFrom = (authorizationHeader: string | undefined) =>
  authorizationHeader?.match(/^Bearer\s+(.+)$/i)?.[1];

const fetchAuthenticatedUserId = async (
  config: { url: string; anonKey: string },
  authorizationHeader: string | undefined,
) => {
  const token = bearerTokenFrom(authorizationHeader);
  if (!token) return undefined;

  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) return undefined;

  const user = (await response.json().catch(() => null)) as { id?: unknown } | null;
  return typeof user?.id === "string" && user.id ? user.id : undefined;
};

const toEventRow = (
  event: PricingMatchEvent,
  actor: { userId?: string; anonymousInstallationId?: string },
) => ({
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
  price_explanation: event.priceExplanation ?? null,
  quality_signal: event.qualitySignal,
  result_type: event.resultSource,
});

export const createSupabasePricingMatchEventLogger = (
  actor: PricingMatchEventActor,
): PricingMatchEventLogger | null => {
  if (!actor.authorizationHeader && !actor.anonymousInstallationId) return null;

  const config = getSupabaseRestConfig();
  if (!config) return null;

  let userIdPromise: Promise<string | undefined> | undefined;
  const getUserId = () => {
    userIdPromise ??= fetchAuthenticatedUserId(config, actor.authorizationHeader);
    return userIdPromise;
  };

  return {
    async logMatchEvent(event) {
      const userId = await getUserId();
      const anonymousInstallationId = userId ? undefined : actor.anonymousInstallationId;
      if (!userId && !anonymousInstallationId) return;

      const response = await fetch(`${config.url}/rest/v1/pricing_match_events`, {
        method: "POST",
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(toEventRow(event, { userId, anonymousInstallationId })),
      });

      if (!response.ok) {
        const responseText = await response.text().catch(() => "");
        actor.onTelemetryError?.(
          new Error(
            `pricing_match_event_insert_failed:${response.status}${
              responseText ? `:${responseText.slice(0, 200)}` : ""
            }`,
          ),
        );
      }
    },
  };
};
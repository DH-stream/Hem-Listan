import type { ListItemPriceMatch } from "../../src/lib/pricing/types";
import { cleanGrocerySearchQuery, normalizePriceQuery } from "./pricingMatching.js";
import type { PricingBasketItem, PricingBasketRequest } from "./basketPricing.js";

export interface PricingMatchEvent {
  chain: PricingBasketRequest["chain"];
  storeId?: string;
  listItemName: string;
  normalizedQuery: string;
  selectedProductId?: string;
  selectedProductName?: string;
  selectedConfidence: ListItemPriceMatch["confidence"];
  selectedScore?: number;
  scoreBreakdown?: ListItemPriceMatch["scoreBreakdown"];
  scoreReasons?: string[];
  topCandidates: Array<{ productId: string; productName: string }>;
  approximatePriceSek?: number;
  resultSource: "auto_match";
  timestamp: string;
}

export interface PricingMatchEventLogger {
  logMatchEvent(event: PricingMatchEvent): Promise<void> | void;
}

const defaultLogger: PricingMatchEventLogger = {
  logMatchEvent: () => undefined,
};

export const buildPricingMatchEvent = (
  request: PricingBasketRequest,
  item: PricingBasketItem,
  match: ListItemPriceMatch,
  timestamp = new Date().toISOString(),
): PricingMatchEvent => ({
  chain: request.chain,
  ...(request.storeId ? { storeId: request.storeId } : {}),
  listItemName: cleanGrocerySearchQuery(item.name),
  normalizedQuery: normalizePriceQuery(cleanGrocerySearchQuery(item.name)),
  ...(match.product?.id ? { selectedProductId: match.product.id } : {}),
  ...(match.product?.productName ? { selectedProductName: match.product.productName } : {}),
  selectedConfidence: match.confidence,
  ...(match.preferenceScore === undefined ? {} : { selectedScore: match.preferenceScore }),
  ...(match.scoreBreakdown ? { scoreBreakdown: match.scoreBreakdown } : {}),
  ...(match.preferenceReasons ? { scoreReasons: match.preferenceReasons } : {}),
  topCandidates:
    match.rankedCandidates?.map((candidate) => ({
      productId: candidate.productId,
      productName: candidate.productName,
    })) ?? [],
  ...(match.estimatedCheckoutPriceSek ?? match.product?.priceSek
    ? { approximatePriceSek: match.estimatedCheckoutPriceSek ?? match.product?.priceSek }
    : {}),
  resultSource: "auto_match",
  timestamp,
});

export const emitPricingMatchEventsFireAndForget = (
  request: PricingBasketRequest,
  items: PricingBasketItem[],
  matches: ListItemPriceMatch[],
  logger: PricingMatchEventLogger = defaultLogger,
  onError: (error: unknown) => void = () => undefined,
) => {
  const matchByItemId = new Map(matches.map((match) => [match.listItemId, match]));
  const events = items
    .map((item) => {
      const match = matchByItemId.get(item.id);
      return match ? buildPricingMatchEvent(request, item, match) : null;
    })
    .filter((event): event is PricingMatchEvent => event !== null);

  if (events.length === 0) return;

  setTimeout(() => {
    events.forEach((event) => {
      Promise.resolve(logger.logMatchEvent(event)).catch(onError);
    });
  }, 0);
};

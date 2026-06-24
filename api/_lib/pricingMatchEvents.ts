import type { ListItemPriceMatch } from "../../src/lib/pricing/types";
import { buildPricingSearchQuery, normalizePriceQuery } from "./pricingMatching.js";
import type { PricingBasketItem, PricingBasketRequest } from "./basketPricing.js";

export interface PricingMatchPriceExplanation {
  productPriceSek?: number;
  estimatedCheckoutPriceSek?: number;
  unitLabel?: string;
  priceBasis?: ListItemPriceMatch["priceBasis"];
  packagePlan?: {
    totalPriceSek: number;
    purchasedAmount: number;
    packageCount: number;
    items: Array<{
      productId: string;
      productName: string;
      unitLabel: string;
      productPriceSek: number;
      count: number;
    }>;
  };
  requestedQuantity?: ListItemPriceMatch["requestedQuantity"];
  requestedUnit?: string;
  sourceTaskCount: number;
  sourceTaskIdCount: number;
  estimatedDiffersFromProductPrice: boolean;
}

export interface PricingMatchEvent {
  chain: PricingBasketRequest["chain"];
  storeId?: string;
  normalizedQuery: string;
  selectedProductId?: string;
  selectedProductName?: string;
  selectedConfidence: ListItemPriceMatch["confidence"];
  selectedScore?: number;
  scoreBreakdown?: ListItemPriceMatch["scoreBreakdown"];
  scoreReasons?: string[];
  topCandidates: Array<{ productId: string; productName: string }>;
  approximatePriceSek?: number;
  priceExplanation?: PricingMatchPriceExplanation;
  resultSource: "auto_match";
  timestamp: string;
}

export interface PricingMatchEventLogger {
  logMatchEvent(event: PricingMatchEvent): Promise<void> | void;
}

const defaultLogger: PricingMatchEventLogger = {
  logMatchEvent: () => undefined,
};

const roundPrice = (value: number) => Math.round((value + 1e-9) * 100) / 100;

const pricesDiffer = (left: number | undefined, right: number | undefined) =>
  left !== undefined && right !== undefined && Math.abs(left - right) >= 0.01;

const buildPackagePlanSummary = (purchasePlan: ListItemPriceMatch["purchasePlan"]) =>
  purchasePlan
    ? {
        totalPriceSek: purchasePlan.totalPriceSek,
        purchasedAmount: purchasePlan.purchasedAmount,
        packageCount: purchasePlan.items.reduce((sum, item) => sum + item.count, 0),
        items: purchasePlan.items.map(({ product, count }) => ({
          productId: product.id,
          productName: product.productName,
          unitLabel: product.unitLabel,
          productPriceSek: product.priceSek,
          count,
        })),
      }
    : undefined;

const buildPriceExplanation = (match: ListItemPriceMatch): PricingMatchPriceExplanation | undefined => {
  const productPriceSek = match.product?.priceSek;
  const estimatedCheckoutPriceSek = match.estimatedCheckoutPriceSek;
  if (
    productPriceSek === undefined &&
    estimatedCheckoutPriceSek === undefined &&
    !match.priceBasis &&
    !match.purchasePlan &&
    !match.requestedQuantity &&
    !match.sourceTaskIds
  ) {
    return undefined;
  }

  const packagePlan = buildPackagePlanSummary(match.purchasePlan);

  return {
    ...(productPriceSek === undefined ? {} : { productPriceSek }),
    ...(estimatedCheckoutPriceSek === undefined ? {} : { estimatedCheckoutPriceSek }),
    ...(match.product?.unitLabel ? { unitLabel: match.product.unitLabel } : {}),
    priceBasis: match.priceBasis ?? "product_price",
    ...(packagePlan ? { packagePlan } : {}),
    ...(match.requestedQuantity
      ? {
          requestedQuantity: match.requestedQuantity,
          requestedUnit: match.requestedQuantity.label,
        }
      : {}),
    sourceTaskCount: match.sourceTaskIds?.length ?? 1,
    sourceTaskIdCount: match.sourceTaskIds?.length ?? 0,
    estimatedDiffersFromProductPrice: pricesDiffer(
      estimatedCheckoutPriceSek === undefined ? undefined : roundPrice(estimatedCheckoutPriceSek),
      productPriceSek === undefined ? undefined : roundPrice(productPriceSek),
    ),
  };
};

export const buildPricingMatchEvent = (
  request: PricingBasketRequest,
  item: PricingBasketItem,
  match: ListItemPriceMatch,
  timestamp = new Date().toISOString(),
): PricingMatchEvent => {
  const priceExplanation = buildPriceExplanation(match);

  return {
    chain: request.chain,
    ...(request.storeId ? { storeId: request.storeId } : {}),
    normalizedQuery: normalizePriceQuery(buildPricingSearchQuery(item.name)),
    ...(match.product?.id ? { selectedProductId: match.product.id } : {}),
    ...(match.product?.productName ? { selectedProductName: match.product.productName } : {}),
    selectedConfidence: match.confidence,
    ...(match.preferenceScore === undefined ? {} : { selectedScore: match.preferenceScore }),
    ...(match.scoreBreakdown ? { scoreBreakdown: match.scoreBreakdown } : {}),
    ...(match.preferenceReasons ? { scoreReasons: match.preferenceReasons } : {}),
    topCandidates:
      match.rankedCandidates?.slice(0, 5).map((candidate) => ({
        productId: candidate.productId,
        productName: candidate.productName,
      })) ?? [],
    ...((match.estimatedCheckoutPriceSek ?? match.product?.priceSek) === undefined
      ? {}
      : { approximatePriceSek: match.estimatedCheckoutPriceSek ?? match.product?.priceSek }),
    ...(priceExplanation ? { priceExplanation } : {}),
    resultSource: "auto_match",
    timestamp,
  };
};

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

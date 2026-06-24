import type { ListItemPriceMatch, ProductPrice } from "../../src/lib/pricing/types";
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

export type PricingMatchQualityLabel = "good" | "uncertain" | "suspicious";

export interface PricingMatchQualitySignal {
  label: PricingMatchQualityLabel;
  strength: number;
  reasons: string[];
  version: 1;
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
  qualitySignal: PricingMatchQualitySignal;
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

const readyMealRequestTerms =
  /\b(?:fardigratt|fardigmat|middag|lunch|portion|maltid|matlada|gryta|gratang|paj|soppa|sallad|meal|ready)\b/;

const preparedOrProcessedProductTerms =
  /(?:\b(?:fardigratt|fardigratter|fardigmat|middag|portion|portionsratt|maltid|gryta|gratang|paj|soppa|sallad|dillstuvad\s+potatis|meal|ready|godis|godispase|toffee|kola|chips|snacks|barnsnacks|barnmat|mellis|fruktmellis|smoothie|fruktsmoothie|grotsmoothie|dryck|drickyoghurt|yoghurt|grot|pure|dessert|bar|proteinbar|juice|nektar|glass|kaka|kex|marmelad|sylt)\b|(?:godispase|barnsnacks|barnmat|fruktmellis|mellis|fruktsmoothie|grotsmoothie|drickyoghurt|smoothie))/;

const isSimpleIngredientQuery = (normalizedQuery: string) => {
  if (!normalizedQuery || readyMealRequestTerms.test(normalizedQuery)) return false;
  const words = normalizedQuery.split(" ").filter(Boolean);
  return words.length > 0 && words.length <= 4;
};

const normalizeProductText = (product: ProductPrice) =>
  normalizePriceQuery(
    [product.productName, product.category, ...(product.categoryPath ?? [])]
      .filter(Boolean)
      .join(" "),
  );

const hasReason = (match: ListItemPriceMatch, reason: string) =>
  match.preferenceReasons?.includes(reason) ||
  match.rankedCandidates?.some((candidate) => candidate.reasons.includes(reason)) ||
  false;

const createQualitySignal = (
  label: PricingMatchQualityLabel,
  strength: number,
  reasons: string[],
): PricingMatchQualitySignal => ({
  label,
  strength: Math.round(Math.max(0, Math.min(1, strength)) * 100) / 100,
  reasons: [...new Set(reasons)],
  version: 1,
});

export const buildPricingMatchQualitySignal = (
  normalizedQuery: string,
  match: ListItemPriceMatch,
  priceExplanation?: PricingMatchPriceExplanation,
): PricingMatchQualitySignal => {
  const reasons: string[] = [];

  if (!match.product) {
    reasons.push("no_selected_product");
    if (match.confidence === "none") reasons.push("confidence_none");
    if (!match.rankedCandidates || match.rankedCandidates.length === 0) {
      reasons.push("no_ranked_candidates");
    }
    return createQualitySignal("uncertain", 0.7, reasons);
  }

  if (match.confidence === "none") {
    return createQualitySignal("suspicious", 0.85, ["product_selected_with_no_confidence"]);
  }

  const packagePlanExplained =
    match.priceBasis === "package_plan" ||
    Boolean(match.purchasePlan) ||
    Boolean(priceExplanation?.packagePlan);
  if (packagePlanExplained) reasons.push("package_plan_explained");

  const simpleIngredientQuery = isSimpleIngredientQuery(normalizedQuery);
  const productText = normalizeProductText(match.product);
  const productLooksPreparedOrProcessed = preparedOrProcessedProductTerms.test(productText);
  const strongPreparedFoodPenalty = hasReason(match, "prepared_food_penalty_for_simple_query");
  const strongProcessedPenalty =
    hasReason(match, "processed_or_flavor_product_penalty") && simpleIngredientQuery;
  const strongProductPenalty = (match.scoreBreakdown?.productPenalty ?? 0) <= -20;

  if (simpleIngredientQuery && productLooksPreparedOrProcessed) {
    reasons.push("simple_query_matched_prepared_or_processed_product");
  }
  if (strongPreparedFoodPenalty) reasons.push("prepared_food_penalty_for_simple_query");
  if (strongProcessedPenalty) reasons.push("processed_or_flavor_product_penalty_for_simple_query");
  if (strongProductPenalty) reasons.push("strong_product_penalty");

  const suspiciousReasons = reasons.filter(
    (reason) =>
      reason !== "package_plan_explained" &&
      (reason.includes("prepared") ||
        reason.includes("processed") ||
        reason === "strong_product_penalty"),
  );
  if (suspiciousReasons.length > 0) {
    return createQualitySignal("suspicious", 0.9, reasons);
  }

  if (packagePlanExplained) {
    return createQualitySignal("good", 0.82, reasons);
  }

  if (
    (match.confidence === "high" || match.confidence === "medium") &&
    (match.priceBasis === undefined || match.priceBasis === "product_price")
  ) {
    return createQualitySignal("good", match.confidence === "high" ? 0.9 : 0.78, [
      "normal_direct_product_match",
      ...(match.confidence === "high" ? ["high_confidence"] : ["medium_confidence"]),
    ]);
  }

  if (match.confidence === "low") {
    return createQualitySignal("uncertain", 0.65, ["low_confidence"]);
  }

  return createQualitySignal("uncertain", 0.6, ["unclassified_match_shape"]);
};

export const buildPricingMatchEvent = (
  request: PricingBasketRequest,
  item: PricingBasketItem,
  match: ListItemPriceMatch,
  timestamp = new Date().toISOString(),
): PricingMatchEvent => {
  const normalizedQuery = normalizePriceQuery(buildPricingSearchQuery(item.name));
  const priceExplanation = buildPriceExplanation(match);
  const qualitySignal = buildPricingMatchQualitySignal(
    normalizedQuery,
    match,
    priceExplanation,
  );

  return {
    chain: request.chain,
    ...(request.storeId ? { storeId: request.storeId } : {}),
    normalizedQuery,
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
    qualitySignal,
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
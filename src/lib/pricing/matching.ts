import type {
  ListItemPriceMatch,
  PriceMatchConfidence,
  ProductPrice,
} from "./types";
import {
  estimateWeightedCheckoutPrice,
  formatComparableQuantity,
  isApproximatePieceMassProduct,
  isWeightPricedProduct,
  parseComparableQuantity,
  parseProductPackageQuantity,
  selectPackagePurchasePlan,
} from "../../../shared/pricingQuantity";
import { evaluateReceiptInformedPreference } from "./productPreferenceRules";

export interface ProductMatchScoreBreakdown {
  semantic: number;
  categoryAffinity: number;
  quantityPackageFit: number;
  priceSanity: number;
  productPenalty: number;
  learnedPreference: number;
  packagePlan: number;
  total: number;
}

export interface RankedProductCandidate {
  product: ProductPrice;
  confidence: PriceMatchConfidence;
  score: number;
  scoreBreakdown: ProductMatchScoreBreakdown;
  reasons: string[];
}


export const normalizePriceQuery = (value: string) =>
  value
    .toLocaleLowerCase("sv-SE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(
      /\b\d+(?:[.,]\d+)?\s*(?:st|stycken|pack|paket|förp|kg|g|l|dl|cl|klase|klasar|burk|flaska|påse)?\b/g,
      " ",
    )
    .replace(/[^a-zåäö\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const explicitQueryAliases: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bkeso\s+cottage\s+cheese\b/gi, replacement: "keso" },
  { pattern: /\bcottage\s+cheese\b/gi, replacement: "keso" },
  { pattern: /\bpenne\s+pasta\b/gi, replacement: "penne" },
  { pattern: /\btoastbrod\b/gi, replacement: "toastbröd" },
  { pattern: /\btoastbröd\b/gi, replacement: "toastbröd" },
];

const searchQueryVariantAliases: Array<{ pattern: RegExp; replacements: string[] }> = [
  { pattern: /^toastbröd$/i, replacements: ["toastbröd", "rostbröd", "formfranska"] },
  { pattern: /^smör\s+margarin$/i, replacements: ["smör", "margarin"] },
];

const applySearchAliases = (value: string) =>
  explicitQueryAliases.reduce(
    (current, alias) => current.replace(alias.pattern, alias.replacement),
    value,
  );

export const cleanGrocerySearchQuery = (value: string) => {
  if (/^\s*valbart\b.*\bvalfri\b/i.test(value)) return "";
  return value
    .normalize("NFKC")
    .replace(/^port\s+(?=penne\b)/i, "")
    .replace(
      /^(?:(?:stort?|stora|skalad|skalat|skalade|finhackad|finhackat|finhackade|hackad|hackat|hackade|skivad|skivat|skivade|tärnad|tärnat|tärnade)\s+|och\s+)+/i,
      "",
    )
    .replace(/\s+på toppen\b.*$/i, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(
      /\b(?:ca|cirka)?\s*\d+(?:[.,]\d+)?\s*(?:st|stycken|pack|paket|förp|kg|g|l|dl|cl|ml|klase|klasar|burk|flaska|påse)\b/gi,
      " ",
    )
    .replace(/\s*[,;]\s*.*$/, "")
    .replace(/\b(?:eller|alternativt)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export const buildPricingSearchQuery = (value: string) =>
  applySearchAliases(cleanGrocerySearchQuery(value))
    .replace(/\s+/g, " ")
    .trim();

export const buildPricingSearchQueries = (value: string) => {
  const searchQuery = buildPricingSearchQuery(value);
  const variant = searchQueryVariantAliases.find((alias) =>
    alias.pattern.test(searchQuery),
  );
  return [...new Set((variant?.replacements ?? [searchQuery]).filter(Boolean))];
};

const normalizedPricingQuery = (value: string) =>
  normalizePriceQuery(buildPricingSearchQuery(value));

const normalizedPricingQueryVariants = (value: string) => {
  const normalized = normalizedPricingQuery(value);
  const variants = [normalized];
  if (normalized === "toastbrod") {
    variants.push("rostbrod", "formfranska");
  }
  if (normalized === "smor margarin") {
    variants.push("smor", "margarin");
  }
  return [...new Set(variants.filter(Boolean))];
};

const editDistance = (left: string, right: string) => {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
};

const confidenceDescriptorWords = new Set([
  "rimmat",
  "rimmad",
  "rokt",
  "skivad",
  "skivat",
  "farsk",
  "farskt",
]);

const confidenceFor = (
  query: string,
  candidate: string,
): PriceMatchConfidence => {
  if (!query || !candidate) return "none";
  if (query === candidate) return "high";

  const maxLength = Math.max(query.length, candidate.length);
  if (maxLength >= 4 && editDistance(query, candidate) / maxLength <= 0.2)
    return "high";

  const queryWords = query.split(" ");
  const candidateWords = new Set(candidate.split(" "));
  if (queryWords.every((word) => candidateWords.has(word))) return "medium";

  const essentialQueryWords = queryWords.filter(
    (word) => !confidenceDescriptorWords.has(word),
  );
  const candidateWordList = Array.from(candidateWords);
  if (
    essentialQueryWords.length > 0 &&
    essentialQueryWords.every(
      (word) =>
        candidateWords.has(word) ||
        (word.length >= 4 &&
          candidateWordList.some(
            (candidateWord) =>
              candidateWord.length > word.length + 2 &&
              candidateWord.endsWith(word),
          )),
    )
  ) {
    return "medium";
  }

  if (
    maxLength >= 5 &&
    (editDistance(query, candidate) / maxLength <= 0.42 ||
      queryWords.some(
        (word) => word.length >= 4 && candidate.includes(word.slice(0, -1)),
      ))
  ) {
    return "low";
  }

  return "none";
};

const confidenceRank: Record<PriceMatchConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
};

const simpleProduceQueries = new Set([
  "banan",
  "apple",
  "apelsin",
  "citron",
  "lime",
  "gurka",
  "kiwi",
  "tomat",
  "potatis",
  "morot",
  "lok",
  "paron",
  "paprika",
  "avokado",
  "vitlok",
]);

const processedProductTerms =
  /(?:\b(?:godis|godispase|toffee|kola|chips|snacks|barnsnacks|barnmat|mellis|fruktmellis|smoothie|fruktsmoothie|grotsmoothie|dryck|drickyoghurt|yoghurt|grot|pure|dessert|bar|proteinbar|juice|nektar|glass|kaka|kex|marmelad|sylt)\b|(?:godispase|barnsnacks|barnmat|fruktmellis|mellis|fruktsmoothie|grotsmoothie|drickyoghurt|smoothie))/;

const isClearlyIncompatibleProduct = (
  query: string,
  product: ProductPrice,
) => {
  const productName = normalizePriceQuery(product.productName);
  const category = normalizePriceQuery(
    [...(product.categoryPath ?? []), product.category ?? ""].join(" "),
  );

  if (
    simpleProduceQueries.has(query) &&
    processedProductTerms.test(`${productName} ${category}`)
  ) {
    return true;
  }

  if (
    query === "citron" &&
    (/\b(?:dryck|drinkmixer|essens|tonic)\b/.test(category) ||
      /\b(?:tonic|drinkmixer|essens)\b/.test(productName))
  ) {
    return true;
  }

  if (
    /\b(?:penne|fusilli|spaghetti|makaron|conchiglie|pasta)\b/.test(query) &&
    (/\b(?:kyld fardigmat|fardigmat|fardiga ratter|portionsratt)\b/.test(category) ||
      /\b(?:carbonara|fardigratt|fardigmat|redo)\b/.test(productName))
  ) {
    return true;
  }

  return false;
};

const parseAmount = parseComparableQuantity;
const productPackageAmount = parseProductPackageQuantity;

const productPreferenceScore = (
  itemName: string,
  product: ProductPrice,
) => {
  const productName = normalizePriceQuery(product.productName);
  const normalizedItemName = normalizedPricingQuery(itemName);
  const receiptPreference = evaluateReceiptInformedPreference(
    itemName,
    product.productName,
    product.unitLabel,
  );
  let score = receiptPreference.score;
  const reasons = [...receiptPreference.reasons];

  const requested = parseAmount(itemName);
  const packageAmount = productPackageAmount(product);
  if (
    requested &&
    packageAmount &&
    requested.dimension === packageAmount.dimension &&
    requested.dimension !== "count" &&
    !isWeightPricedProduct(product)
  ) {
    const packages = Math.max(1, Math.ceil(requested.amount / packageAmount.amount));
    const ratio = (packages * packageAmount.amount) / requested.amount;
    score += Math.max(0, 20 - Math.log2(ratio) * 8);
    reasons.push(packages > 1 ? "multi_package_plan" : "requested_pack_size");
  }

  if (!requested && packageAmount) {
    const isExtremeCount =
      packageAmount.dimension === "count" && packageAmount.amount >= 24;
    const isExtremeMass =
      packageAmount.dimension === "mass" && packageAmount.amount >= 5000;
    const isExtremeVolume =
      packageAmount.dimension === "volume" && packageAmount.amount >= 3000;
    if (isExtremeCount || isExtremeMass || isExtremeVolume) {
      score -= 10;
      reasons.push("avoided_extreme_pack_size");
    }
  }

  const requestsBulk = /\b(?:storpack|familjepack|bulk)\b/.test(
    normalizedItemName,
  );
  if (
    !requestsBulk &&
    /\b(?:storpack|familjepack|bulk)\b/.test(productName)
  ) {
    score -= 14;
    reasons.push("avoided_bulk");
  }

  const requestsFrozen = /\bfryst\b/.test(normalizedItemName);
  if (!requestsFrozen && /\bfryst\b/.test(productName)) {
    score -= 8;
    reasons.push("avoided_frozen");
  }

  if (
    /\bkycklingfile\b/.test(normalizedItemName) &&
    !requestsFrozen &&
    /\b(?:farsk|naturell)\b/.test(productName)
  ) {
    score += 5;
    reasons.push("fresh_natural_chicken");
  }

  return { score, reasons: [...new Set(reasons)] };
};


const categoryAffinityScore = (
  query: string,
  product: ProductPrice,
) => {
  const category = normalizePriceQuery(
    [...(product.categoryPath ?? []), product.category ?? ""].join(" "),
  );
  if (!query || !category) return { score: 0, reasons: [] as string[] };

  const queryWords = query.split(" ").filter((word) => word.length >= 3);
  const categoryWords = new Set(category.split(" "));
  const overlapCount = queryWords.filter((word) => categoryWords.has(word)).length;
  if (overlapCount > 0) {
    return { score: Math.min(8, overlapCount * 4), reasons: ["category_overlap"] };
  }

  if (simpleProduceQueries.has(query) && /\b(?:frukt|gront|gronsaker|frukt och grönt)\b/.test(category)) {
    return { score: 6, reasons: ["produce_category_affinity"] };
  }

  return { score: 0, reasons: [] as string[] };
};

const preparedFoodTerms =
  /\b(?:fardigratt|fardigratter|fardigmat|middag|portion|portionsratt|maltid|gryta|gratang|paj|soppa|sallad|dillstuvad\s+potatis|meal|ready)\b/;

const readyMealRequestTerms =
  /\b(?:fardigratt|fardigmat|middag|lunch|portion|maltid|matlada|gryta|gratang|paj|soppa|sallad|meal|ready)\b/;

const looksLikeSimpleIngredientQuery = (query: string) => {
  if (!query || readyMealRequestTerms.test(query)) return false;
  const words = query.split(" ").filter(Boolean);
  return words.length > 0 && words.length <= 4;
};

const isPreparedFoodProduct = (product: ProductPrice) => {
  const productName = normalizePriceQuery(product.productName);
  const category = normalizePriceQuery(
    [...(product.categoryPath ?? []), product.category ?? ""].join(" "),
  );
  return preparedFoodTerms.test(`${productName} ${category}`);
};

const productPenaltyScore = (
  itemName: string,
  product: ProductPrice,
) => {
  const normalizedItemName = normalizedPricingQuery(itemName);
  const productName = normalizePriceQuery(product.productName);
  const category = normalizePriceQuery(
    [...(product.categoryPath ?? []), product.category ?? ""].join(" "),
  );
  const combined = `${productName} ${category}`;
  let score = 0;
  const reasons: string[] = [];

  if (processedProductTerms.test(combined)) {
    score -= 10;
    reasons.push("processed_or_flavor_product_penalty");
  }

  if (
    looksLikeSimpleIngredientQuery(normalizedItemName) &&
    isPreparedFoodProduct(product)
  ) {
    score -= 28;
    reasons.push("prepared_food_penalty_for_simple_query");
  }

  const requested = parseAmount(itemName);
  const packageAmount = productPackageAmount(product);
  const asksForPackage = /\b(?:pack|paket|forp|storpack|familjepack|korg|lada|mix)\b/.test(
    normalizedItemName,
  );
  if (!requested && !asksForPackage && packageAmount) {
    const isBasketVariant = /\b(?:korg|lada|mix|blandade|presentforpackning)\b/.test(
      productName,
    );
    const isLargeCount = packageAmount.dimension === "count" && packageAmount.amount > 1;
    if (isBasketVariant || isLargeCount) {
      score -= isBasketVariant ? 16 : 6;
      reasons.push("singular_query_package_variant_penalty");
    }
  }

  return { score, reasons };
};


const medianPrice = (products: ProductPrice[]) => {
  if (products.length === 0) return undefined;
  const prices = products
    .map((product) => product.priceSek)
    .sort((a, b) => a - b);
  const middle = Math.floor(prices.length / 2);
  return prices.length % 2 === 0 ? prices[middle - 1] : prices[middle];
};

const priceSanity = (priceSek: number, medianPriceSek: number | undefined) => {
  if (!medianPriceSek || medianPriceSek <= 0) {
    return { score: 0, reasons: [] as string[] };
  }
  const ratio = priceSek / medianPriceSek;
  if (ratio >= 2.5) {
    return { score: -14, reasons: ["unreasonable_high_price"] };
  }
  if (ratio >= 1.75) return { score: -8, reasons: ["high_price"] };
  if (ratio >= 0.7 && ratio <= 1.3) {
    return { score: 2, reasons: ["reasonable_price"] };
  }
  return { score: 0, reasons: [] };
};

const confidenceScore: Record<PriceMatchConfidence, number> = {
  high: 40,
  medium: 25,
  low: 10,
  none: Number.NEGATIVE_INFINITY,
};

export const rankProductMatches = (
  item: { name: string },
  products: ProductPrice[],
) => {
  const query = normalizedPricingQuery(item.name);
  const queryVariants = normalizedPricingQueryVariants(item.name);
  const candidates = products.map((product) => {
    if (queryVariants.some((variant) => isClearlyIncompatibleProduct(variant, product))) {
      return { product, confidence: "none" as const };
    }
    const productConfidence = [product.productName, ...product.searchTerms]
      .map(normalizePriceQuery)
      .reduce<PriceMatchConfidence>((best, candidate) => {
        const confidence = queryVariants.reduce<PriceMatchConfidence>(
          (variantBest, variant) => {
            const variantConfidence = confidenceFor(variant, candidate);
            return confidenceRank[variantConfidence] > confidenceRank[variantBest]
              ? variantConfidence
              : variantBest;
          },
          "none",
        );
        return confidenceRank[confidence] > confidenceRank[best]
          ? confidence
          : best;
      }, "none");

    return { product, confidence: productConfidence };
  });
  const comparableMedianPrice = medianPrice(
    candidates
      .filter((candidate) => candidate.confidence !== "none")
      .map((candidate) => candidate.product),
  );
  const requested = parseAmount(item.name);
  const packagePlan = requested
    ? selectPackagePurchasePlan(
        requested,
        candidates
          .filter((candidate) => candidate.confidence !== "none")
          .map((candidate) => candidate.product),
      )
    : null;
  const plannedProductIds = new Set(
    packagePlan?.items.map((item) => item.product.id) ?? [],
  );

  const rankedCandidates: RankedProductCandidate[] = candidates
    .filter((candidate) => candidate.confidence !== "none")
    .map((candidate) => {
      const preference = productPreferenceScore(item.name, candidate.product);
      const categoryAffinity = categoryAffinityScore(query, candidate.product);
      const productPenalty = productPenaltyScore(item.name, candidate.product);
      const pricePreference = priceSanity(
        candidate.product.priceSek,
        comparableMedianPrice,
      );
      const planScore = plannedProductIds.has(candidate.product.id) ? 100 : 0;
      const scoreBreakdown: ProductMatchScoreBreakdown = {
        semantic: confidenceScore[candidate.confidence],
        categoryAffinity: categoryAffinity.score,
        quantityPackageFit: preference.score,
        priceSanity: pricePreference.score,
        productPenalty: productPenalty.score,
        learnedPreference: 0,
        packagePlan: planScore,
        total: 0,
      };
      scoreBreakdown.total = Object.entries(scoreBreakdown)
        .filter(([key]) => key !== "total")
        .reduce((total, [, score]) => total + score, 0);

      return {
        ...candidate,
        score: scoreBreakdown.total,
        scoreBreakdown,
        reasons: [
          ...new Set([
            ...preference.reasons,
            ...categoryAffinity.reasons,
            ...pricePreference.reasons,
            ...productPenalty.reasons,
            ...(planScore > 0 ? ["package_plan_selected"] : []),
          ]),
        ],
      };
    })
    .sort((left, right) => right.score - left.score);

  return {
    normalizedQuery: query,
    selected: rankedCandidates[0] ?? null,
    rankedCandidates,
    packagePlan,
    requested,
  };
};

export const matchListItem = (
  item: { id: string; name: string; sourceTaskIds?: string[] },
  products: ProductPrice[],
  options: { debug?: boolean } = {},
): ListItemPriceMatch => {
  void options;
  const ranked = rankProductMatches(item, products);
  const product = ranked.selected?.product ?? null;
  const weightedPrice = product
    ? estimateWeightedCheckoutPrice(ranked.requested, product)
    : undefined;
  const piecePrice =
    product &&
    ranked.requested?.dimension === "count" &&
    isApproximatePieceMassProduct(product)
      ? Math.round(product.priceSek * ranked.requested.amount * 100) / 100
      : undefined;
  const selectedPurchasePlan =
    ranked.packagePlan && product && ranked.packagePlan.items.some((item) => item.product.id === product.id)
      ? ranked.packagePlan
      : piecePrice !== undefined && product && ranked.requested
        ? {
            totalPriceSek: piecePrice,
            purchasedAmount: ranked.requested.amount,
            items: [{ product, count: ranked.requested.amount }],
          }
        : undefined;
  const packagePrice = selectedPurchasePlan?.totalPriceSek;
  const estimatedCheckoutPriceSek = weightedPrice ?? packagePrice;

  return {
    listItemId: item.id,
    listItemName: item.name,
    ...(item.sourceTaskIds ? { sourceTaskIds: item.sourceTaskIds } : {}),
    product,
    confidence: ranked.selected?.confidence ?? "none",
    ...(ranked.selected
      ? {
          preferenceScore: ranked.selected.score,
          preferenceReasons: ranked.selected.reasons,
          scoreBreakdown: ranked.selected.scoreBreakdown,
          rankedCandidates: ranked.rankedCandidates.slice(0, 5).map((candidate) => ({
            productId: candidate.product.id,
            productName: candidate.product.productName,
            confidence: candidate.confidence,
            score: candidate.score,
            scoreBreakdown: candidate.scoreBreakdown,
            reasons: candidate.reasons,
          })),
        }
      : {}),
    ...(ranked.requested
      ? {
          requestedQuantity: {
            amount: ranked.requested.amount,
            unit: ranked.requested.dimension,
            label: formatComparableQuantity(ranked.requested),
            approximate: ranked.requested.approximate,
          },
        }
      : {}),
    ...(estimatedCheckoutPriceSek === undefined
      ? {}
      : {
          estimatedCheckoutPriceSek,
          priceBasis:
            weightedPrice !== undefined
              ? ("weighted_item_estimate" as const)
              : ("package_plan" as const),
          ...(weightedPrice === undefined && selectedPurchasePlan
            ? { purchasePlan: selectedPurchasePlan }
            : {}),
        }),
  };
};

import type {
  ListItemPriceMatch,
  PriceMatchConfidence,
  ProductPrice,
} from "../../src/lib/pricing/types";

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

export const cleanCityGrossSearchQuery = (value: string) =>
  value
    .normalize("NFKC")
    .replace(/\([^)]*\)/g, " ")
    .replace(
      /\b(?:ca|cirka)?\s*\d+(?:[.,]\d+)?\s*(?:st|stycken|pack|paket|förp|kg|g|l|dl|cl|ml|klase|klasar|burk|flaska|påse)\b/gi,
      " ",
    )
    .replace(/\s*[,;]\s*.*$/, "")
    .replace(/\s+/g, " ")
    .trim();

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

type ParsedAmount = { amount: number; dimension: "mass" | "volume" | "count" };

const parseAmount = (value: string): ParsedAmount | null => {
  const match = value.match(/(?:ca\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|l|dl|cl|ml|st)\b/i);
  if (!match) return null;

  const amount = Number(match[1].replace(",", "."));
  const unit = match[2].toLocaleLowerCase("sv-SE");
  if (!Number.isFinite(amount)) return null;
  if (unit === "kg") return { amount: amount * 1000, dimension: "mass" };
  if (unit === "g") return { amount, dimension: "mass" };
  if (unit === "l") return { amount: amount * 1000, dimension: "volume" };
  if (unit === "dl") return { amount: amount * 100, dimension: "volume" };
  if (unit === "cl") return { amount: amount * 10, dimension: "volume" };
  if (unit === "ml") return { amount, dimension: "volume" };
  return { amount, dimension: "count" };
};

const productPackageAmount = (product: ProductPrice) =>
  parseAmount(product.unitLabel) ?? parseAmount(product.productName);

const isWeightedProduct = (product: ProductPrice) =>
  /_kg$/i.test(product.id) ||
  (/kr\s*\/\s*kg/i.test(product.comparePrice ?? "") &&
    /\bca\s*\d+(?:[.,]\d+)?\s*(?:kg|g)\b/i.test(product.unitLabel));

const weightedCheckoutPrice = (itemName: string, product: ProductPrice) => {
  if (!isWeightedProduct(product)) return undefined;

  const requested = parseAmount(itemName);
  const averageUnit = parseAmount(product.unitLabel);
  let weightGrams: number | undefined;

  if (requested?.dimension === "mass") {
    weightGrams = requested.amount;
  } else if (
    requested?.dimension === "count" &&
    averageUnit?.dimension === "mass"
  ) {
    weightGrams = requested.amount * averageUnit.amount;
  } else if (averageUnit?.dimension === "mass") {
    weightGrams = averageUnit.amount;
  }

  if (weightGrams === undefined) return undefined;
  return (
    Math.round((product.priceSek * (weightGrams / 1000) + 1e-9) * 100) /
    100
  );
};

const productPreferenceScore = (
  query: string,
  itemName: string,
  product: ProductPrice,
) => {
  const productName = normalizePriceQuery(product.productName);
  let score = 0;

  if (query === "agg" || query === "eko agg") {
    const packMatch = product.productName.match(/\b(\d+)\s*(?:p|pack)\b/i);
    const packSize = packMatch ? Number(packMatch[1]) : undefined;
    if (packSize && [6, 10, 12].includes(packSize)) score += 10;
    if (packSize && packSize >= 24) score -= 10;

    const requestsEco = query.includes("eko");
    const isEcoOrPremium = /\b(?:eko|ekologisk|premium)\b/.test(productName);
    if (requestsEco) {
      if (/\b(?:eko|ekologisk)\b/.test(productName)) score += 8;
    } else if (isEcoOrPremium) {
      score -= 4;
    }
  }

  const requested = parseAmount(itemName);
  const packageAmount = productPackageAmount(product);
  if (
    requested &&
    packageAmount &&
    requested.dimension === packageAmount.dimension &&
    requested.dimension !== "count" &&
    !isWeightedProduct(product)
  ) {
    const ratio = packageAmount.amount / requested.amount;
    if (ratio >= 1) score += Math.max(0, 20 - Math.log2(ratio) * 6);
    else score -= 12 + (1 - ratio) * 8;
  }

  const requestsBulk = /\b(?:storpack|familjepack)\b/.test(
    normalizePriceQuery(itemName),
  );
  if (!requestsBulk && /\b(?:storpack|familjepack)\b/.test(productName)) score -= 12;

  const requestsFrozen = /\bfryst\b/.test(normalizePriceQuery(itemName));
  if (!requestsFrozen && /\bfryst\b/.test(productName)) score -= 6;

  return score;
};

export const matchListItem = (
  item: { id: string; name: string },
  products: ProductPrice[],
): ListItemPriceMatch => {
  const query = normalizePriceQuery(cleanCityGrossSearchQuery(item.name));
  let bestProduct: ProductPrice | null = null;
  let bestConfidence: PriceMatchConfidence = "none";
  let bestPreferenceScore = Number.NEGATIVE_INFINITY;

  for (const product of products) {
    const candidates = [product.productName, ...product.searchTerms].map(
      normalizePriceQuery,
    );
    const productConfidence = candidates.reduce<PriceMatchConfidence>(
      (best, candidate) => {
        const confidence = confidenceFor(query, candidate);
        return confidenceRank[confidence] > confidenceRank[best]
          ? confidence
          : best;
      },
      "none",
    );

    const preferenceScore = productPreferenceScore(query, item.name, product);
    if (
      confidenceRank[productConfidence] > confidenceRank[bestConfidence] ||
      (productConfidence === bestConfidence &&
        preferenceScore > bestPreferenceScore)
    ) {
      bestProduct = product;
      bestConfidence = productConfidence;
      bestPreferenceScore = preferenceScore;
    }
  }

  const product = bestConfidence === "none" ? null : bestProduct;
  const estimatedCheckoutPriceSek = product
    ? weightedCheckoutPrice(item.name, product)
    : undefined;

  return {
    listItemId: item.id,
    listItemName: item.name,
    product,
    confidence: bestConfidence,
    ...(estimatedCheckoutPriceSek === undefined
      ? {}
      : {
          estimatedCheckoutPriceSek,
          priceBasis: "weighted_item_estimate" as const,
        }),
  };
};

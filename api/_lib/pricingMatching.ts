import type {
  ListItemPriceMatch,
  PriceMatchConfidence,
  ProductPrice,
} from "../../src/lib/pricing/types";
import { evaluateReceiptInformedPreference } from "./productPreferenceRules.js";

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

export const cleanCityGrossSearchQuery = (value: string) => {
  if (/^\s*valbart\b.*\bvalfri\b/i.test(value)) return "";
  return value
    .normalize("NFKC")
    .replace(/^port\s+(?=penne\b)/i, "")
    .replace(
      /^(?:finhackad|finhackade|hackad|hackade|skivad|skivade|tärnad|tärnade)\s+/i,
      "",
    )
    .replace(/\s+på toppen\b.*$/i, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(
      /\b(?:ca|cirka)?\s*\d+(?:[.,]\d+)?\s*(?:st|stycken|pack|paket|förp|kg|g|l|dl|cl|ml|klase|klasar|burk|flaska|påse)\b/gi,
      " ",
    )
    .replace(/\s*[,;]\s*.*$/, "")
    .replace(/\s+/g, " ")
    .trim();
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

const isClearlyIncompatibleProduct = (
  query: string,
  product: ProductPrice,
) => {
  const productName = normalizePriceQuery(product.productName);
  const category = normalizePriceQuery(
    [...(product.categoryPath ?? []), product.category ?? ""].join(" "),
  );

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

const packageCheckoutPrice = (itemName: string, product: ProductPrice) => {
  if (isWeightedProduct(product)) return undefined;
  const requested = parseAmount(itemName);
  if (!requested) return undefined;
  const packageAmount = productPackageAmount(product);

  if (requested.dimension === "count" && packageAmount?.dimension === "mass") {
    return Math.round(product.priceSek * requested.amount * 100) / 100;
  }
  if (!packageAmount || requested.dimension !== packageAmount.dimension) {
    return undefined;
  }

  const packageCount = Math.max(1, Math.ceil(requested.amount / packageAmount.amount));
  const coveredAmount = packageCount * packageAmount.amount;
  const overbuyRatio = coveredAmount / requested.amount;
  if (overbuyRatio > 2.5) return undefined;
  return Math.round(product.priceSek * packageCount * 100) / 100;
};

const productPreferenceScore = (
  itemName: string,
  product: ProductPrice,
) => {
  const productName = normalizePriceQuery(product.productName);
  const normalizedItemName = normalizePriceQuery(itemName);
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
    !isWeightedProduct(product)
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
  return { score: 0, reasons: [] as string[] };
};

const confidenceScore: Record<PriceMatchConfidence, number> = {
  high: 40,
  medium: 25,
  low: 10,
  none: Number.NEGATIVE_INFINITY,
};

export const matchListItem = (
  item: { id: string; name: string },
  products: ProductPrice[],
  options: { debug?: boolean } = {},
): ListItemPriceMatch => {
  const query = normalizePriceQuery(cleanCityGrossSearchQuery(item.name));
  const candidates = products.map((product) => {
    if (isClearlyIncompatibleProduct(query, product)) {
      return { product, confidence: "none" as const };
    }
    const productConfidence = [product.productName, ...product.searchTerms]
      .map(normalizePriceQuery)
      .reduce<PriceMatchConfidence>((best, candidate) => {
        const confidence = confidenceFor(query, candidate);
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
  const plannedPrices = candidates
    .filter((candidate) => candidate.confidence !== "none")
    .map((candidate) => packageCheckoutPrice(item.name, candidate.product))
    .filter((price): price is number => price !== undefined);
  const cheapestPlannedPrice =
    plannedPrices.length > 0 ? Math.min(...plannedPrices) : undefined;

  let best:
    | {
        product: ProductPrice;
        confidence: PriceMatchConfidence;
        preferenceScore: number;
        preferenceReasons: string[];
        rankingScore: number;
      }
    | undefined;

  for (const candidate of candidates) {
    if (candidate.confidence === "none") continue;
    const preference = productPreferenceScore(item.name, candidate.product);
    const pricePreference = priceSanity(
      candidate.product.priceSek,
      comparableMedianPrice,
    );
    const preferenceScore = preference.score + pricePreference.score;
    const plannedPrice = packageCheckoutPrice(item.name, candidate.product);
    const planScore =
      plannedPrice && cheapestPlannedPrice
        ? Math.max(0, 50 - ((plannedPrice / cheapestPlannedPrice) - 1) * 100)
        : 0;
    const rankingScore =
      confidenceScore[candidate.confidence] + preferenceScore + planScore;

    if (!best || rankingScore > best.rankingScore) {
      best = {
        ...candidate,
        preferenceScore,
        preferenceReasons: [
          ...new Set([...preference.reasons, ...pricePreference.reasons]),
        ],
        rankingScore,
      };
    }
  }

  const product = best?.product ?? null;
  const weightedPrice = product
    ? weightedCheckoutPrice(item.name, product)
    : undefined;
  const packagePrice = product
    ? packageCheckoutPrice(item.name, product)
    : undefined;
  const estimatedCheckoutPriceSek = weightedPrice ?? packagePrice;

  return {
    listItemId: item.id,
    listItemName: item.name,
    product,
    confidence: best?.confidence ?? "none",
    ...(options.debug && best
      ? {
          preferenceScore: best.preferenceScore,
          preferenceReasons: best.preferenceReasons,
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
        }),
  };
};

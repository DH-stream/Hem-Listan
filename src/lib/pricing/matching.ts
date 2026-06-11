import type { ListItemPriceMatch, PriceMatchConfidence, ProductPrice } from "./types";

const normalize = (value: string) =>
  value
    .toLocaleLowerCase("sv-SE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:st|stycken|pack|kg|g|l|dl|cl)?\b/g, " ")
    .replace(/[^a-zåäö\s]/g, " ")
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
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
};

const confidenceFor = (query: string, candidate: string): PriceMatchConfidence => {
  if (!query || !candidate) return "none";
  if (query === candidate) return "high";

  const maxLength = Math.max(query.length, candidate.length);
  if (maxLength >= 4 && editDistance(query, candidate) / maxLength <= 0.2) return "high";

  const queryWords = query.split(" ");
  const candidateWords = new Set(candidate.split(" "));
  if (queryWords.every((word) => candidateWords.has(word))) return "medium";

  if (
    maxLength >= 5 &&
    (editDistance(query, candidate) / maxLength <= 0.42 ||
      queryWords.some((word) => word.length >= 4 && candidate.includes(word.slice(0, -1))))
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

export const matchListItem = (
  item: { id: string; name: string },
  products: ProductPrice[],
): ListItemPriceMatch => {
  const query = normalize(item.name);
  let bestProduct: ProductPrice | null = null;
  let bestConfidence: PriceMatchConfidence = "none";

  for (const product of products) {
    const candidates = [product.productName, ...product.searchTerms].map(normalize);
    const productConfidence = candidates.reduce<PriceMatchConfidence>((best, candidate) => {
      const confidence = confidenceFor(query, candidate);
      return confidenceRank[confidence] > confidenceRank[best] ? confidence : best;
    }, "none");

    if (confidenceRank[productConfidence] > confidenceRank[bestConfidence]) {
      bestProduct = product;
      bestConfidence = productConfidence;
    }
  }

  return {
    listItemId: item.id,
    listItemName: item.name,
    product: bestConfidence === "none" ? null : bestProduct,
    confidence: bestConfidence,
  };
};

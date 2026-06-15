import type {
  ProductPrice,
  PurchasePlan,
} from "../src/lib/pricing/types";

export type ComparableQuantity = {
  amount: number;
  dimension: "mass" | "volume" | "count";
  approximate: boolean;
};

export type PackagePurchasePlan = PurchasePlan;

const roundPrice = (value: number) =>
  Math.round((value + 1e-9) * 100) / 100;

export const parseComparableQuantity = (
  value: string,
): ComparableQuantity | null => {
  const normalized = value.normalize("NFKC");
  const drained = normalized.match(
    /(?:ca\s*)?\d+(?:[.,]\d+)?\s*\/\s*(\d+(?:[.,]\d+)?)\s*g\b/i,
  );
  const match =
    drained ??
    normalized.match(
      /(ca\s*)?(\d+(?:[.,]\d+)?)\s*(kg|hg|g|l|dl|cl|ml|st|styck|p|pack|paket|förp)\b/i,
    );
  if (!match) return null;

  const amountIndex = drained ? 1 : 2;
  const unitIndex = drained ? 0 : 3;
  const amount = Number(match[amountIndex].replace(",", "."));
  const unit = drained ? "g" : match[unitIndex].toLocaleLowerCase("sv-SE");
  if (!Number.isFinite(amount) || amount <= 0) return null;

  if (unit === "kg") return { amount: amount * 1000, dimension: "mass", approximate: Boolean(match[1]) };
  if (unit === "hg") return { amount: amount * 100, dimension: "mass", approximate: Boolean(match[1]) };
  if (unit === "g") return { amount, dimension: "mass", approximate: Boolean(match[1]) };
  if (unit === "l") return { amount: amount * 1000, dimension: "volume", approximate: Boolean(match[1]) };
  if (unit === "dl") return { amount: amount * 100, dimension: "volume", approximate: Boolean(match[1]) };
  if (unit === "cl") return { amount: amount * 10, dimension: "volume", approximate: Boolean(match[1]) };
  if (unit === "ml") return { amount, dimension: "volume", approximate: Boolean(match[1]) };
  return { amount, dimension: "count", approximate: Boolean(match[1]) };
};

export const parseProductPackageQuantity = (product: ProductPrice) =>
  parseComparableQuantity(product.unitLabel) ??
  parseComparableQuantity(product.productName);

export const isWeightPricedProduct = (product: ProductPrice) =>
  /_kg$/i.test(product.id);

export const isApproximatePieceMassProduct = (product: ProductPrice) => {
  const unit = product.unitLabel.normalize("NFKC").toLocaleLowerCase("sv-SE");
  return (
    /^ca\s*\d+(?:[.,]\d+)?\s*g\b/.test(unit) &&
    !isWeightPricedProduct(product)
  );
};

export const estimateWeightedCheckoutPrice = (
  required: ComparableQuantity | null,
  product: ProductPrice,
) => {
  if (!isWeightPricedProduct(product)) return undefined;
  const averageUnit = parseProductPackageQuantity(product);
  let grams: number | undefined;
  if (required?.dimension === "mass") grams = required.amount;
  if (
    required?.dimension === "count" &&
    averageUnit?.dimension === "mass"
  ) {
    grams = required.amount * averageUnit.amount;
  }
  if (!required && averageUnit?.dimension === "mass") grams = averageUnit.amount;
  return grams === undefined
    ? undefined
    : roundPrice(product.priceSek * (grams / 1000));
};

export const selectPackagePurchasePlan = (
  required: ComparableQuantity,
  products: ProductPrice[],
): PackagePurchasePlan | null => {
  const options = products
    .filter((product) => !isWeightPricedProduct(product))
    .map((product) => ({
      product,
      quantity: parseProductPackageQuantity(product),
    }))
    .filter(
      (
        option,
      ): option is { product: ProductPrice; quantity: ComparableQuantity } =>
        option.quantity?.dimension === required.dimension,
    );
  if (options.length === 0) return null;

  let best: PackagePurchasePlan | null = null;
  const consider = (
    firstIndex: number,
    firstCount: number,
    secondIndex?: number,
    secondCount = 0,
  ) => {
    const first = options[firstIndex];
    const second =
      secondIndex === undefined ? undefined : options[secondIndex];
    const purchasedAmount =
      first.quantity.amount * firstCount +
      (second?.quantity.amount ?? 0) * secondCount;
    if (purchasedAmount < required.amount) return;
    if (purchasedAmount / required.amount > 2.5) return;
    const totalPriceSek = roundPrice(
      first.product.priceSek * firstCount +
        (second?.product.priceSek ?? 0) * secondCount,
    );
    if (
      best &&
      (best.totalPriceSek < totalPriceSek ||
        (best.totalPriceSek === totalPriceSek &&
          best.purchasedAmount <= purchasedAmount))
    ) {
      return;
    }
    best = {
      totalPriceSek,
      purchasedAmount,
      items: [
        { product: first.product, count: firstCount },
        ...(second && secondCount > 0
          ? [{ product: second.product, count: secondCount }]
          : []),
      ],
    };
  };

  options.forEach((option, firstIndex) => {
    const maxFirst = Math.ceil(required.amount / option.quantity.amount) + 1;
    for (let firstCount = 1; firstCount <= maxFirst; firstCount += 1) {
      consider(firstIndex, firstCount);
      for (
        let secondIndex = firstIndex + 1;
        secondIndex < options.length;
        secondIndex += 1
      ) {
        const second = options[secondIndex];
        const maxSecond =
          Math.ceil(required.amount / second.quantity.amount) + 1;
        for (let secondCount = 1; secondCount <= maxSecond; secondCount += 1) {
          consider(firstIndex, firstCount, secondIndex, secondCount);
        }
      }
    }
  });

  return best;
};

import type { CanonicalGroceryItem, ParsedQuantity } from "./types";

const titleCase = (value: string) => value === "penne pasta"
  ? "Penne Pasta"
  : value.charAt(0).toUpperCase() + value.slice(1);
const formatNumber = (value: number) => Number.isInteger(value) ? String(value) : String(value).replace(".", ",");

const formatExact = (quantity: ParsedQuantity): string => {
  const prefix = quantity.approximate ? "ca " : "";
  if (quantity.unit === "ml") {
    if (quantity.amount >= 1000) return `${prefix}${formatNumber(quantity.amount / 1000)} l`;
    if (quantity.amount >= 100 && quantity.amount % 100 === 0) return `${prefix}${formatNumber(quantity.amount / 100)} dl`;
    return `${prefix}${formatNumber(quantity.amount)} ml`;
  }
  if (quantity.unit === "g") {
    if (quantity.amount >= 1000 && quantity.amount % 1000 === 0) return `${prefix}${formatNumber(quantity.amount / 1000)} kg`;
    return `${prefix}${formatNumber(quantity.amount)} g`;
  }
  if (quantity.unit === "förp") return `${formatNumber(quantity.amount)} förp`;
  return `${formatNumber(quantity.amount)} st`;
};

const formatPackageRound = (item: CanonicalGroceryItem): string | null => {
  const quantity = item.quantity;
  return quantity ? formatExact(quantity) : null;
};

export const displayGroceryItem = (item: CanonicalGroceryItem): string => {
  const name = titleCase(item.name);
  if (item.policy === "skip" || item.policy === "hide" || !item.quantity) return name;
  const quantity = item.policy === "package_round" ? formatPackageRound(item) : formatExact(item.quantity);
  return quantity ? `${name} (${quantity})` : name;
};

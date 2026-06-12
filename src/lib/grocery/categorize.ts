import type { ProductPrice } from "../pricing/types";
import type { GroceryCategory } from "./types";

const includesAny = (value: string, terms: string[]) => terms.some(term => value.includes(term));

const normalizeCityGrossCategory = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("sv-SE")
    .replace(/&/g, " och ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const inferCategoryFromCityGrossProduct = (
  product: ProductPrice,
): GroceryCategory | null => {
  if (product.chainId !== "city_gross") return null;

  const explicitCategory = normalizeCityGrossCategory(
    [...(product.categoryPath ?? []), product.category]
      .filter((value): value is string => typeof value === "string")
      .join(" "),
  );

  const infer = (value: string): GroceryCategory | null => {
    const padded = ` ${value} `;
    if (value.includes("frukt och gront")) return "Frukt & Grönt";
    if (value.includes("mejeri ost och agg")) return "Mejeri";
    if (value.includes("skafferiet")) return "Skafferi";
    if (
      value.includes("fisk och skaldjur") ||
      value.includes("chark och palagg")
    ) {
      return "Kött & Fisk";
    }
    if (padded.includes(" fryst ")) return "Fryst";
    if (value.includes("brod och kakor")) return "Skafferi";
    return null;
  };

  if (explicitCategory) {
    const category = infer(explicitCategory);
    if (category) return category;
  }

  return product.productUrl
    ? infer(normalizeCityGrossCategory(product.productUrl))
    : null;
};

export const categorizeGroceryItem = (name: string, raw = name): GroceryCategory => {
  const value = `${name} ${raw}`.toLowerCase();
  if (/\b(fryst|frysta|tinad|tinade)\b/.test(value)) return "Fryst";

  if (includesAny(name, [
    "lax", "torsk", "räkor", "kycklingfilé", "köttfärs", "sidfläsk", "bacon", "pancetta", "chorizo", "korv",
    "vegokorv", "vegetarisk korv",
  ])) return "Kött & Fisk";

  if (includesAny(name, [
    "mjölk", "grädde", "ägg", "smör", "ost", "parmesan", "yoghurt", "crème fraiche",
    "keso", "cottage cheese", "havredryck", "sojadryck", "mandeldryck", "växtgrädde", "växtyoghurt",
  ])) return "Mejeri";

  if (includesAny(name, [
    "potatis", "morötter", "gul lök", "röd lök", "schalottenlök", "vitlök", "paprika",
    "babyspenat", "grönkål", "citron", "lime",
  ])) return "Frukt & Grönt";
  if (/\b(färsk|färska)\b/.test(value) && includesAny(name, ["basilika", "oregano", "persilja", "örter"])) {
    return "Frukt & Grönt";
  }

  if (includesAny(name, [
    "pasta", "penne", "ris", "vetemjöl", "socker", "salt", "svartpeppar", "oregano",
    "basilika", "cayennepeppar", "kanel", "olivolja", "vinäger", "honung", "tomatpuré",
    "krossade tomater", "passerade tomater", "soltorkade tomater", "röda linser", "buljong", "fond",
    "lingonsylt", "sylt",
  ])) return "Skafferi";

  return "Övrigt";
};

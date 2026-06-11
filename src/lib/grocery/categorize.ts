import type { GroceryCategory } from "./types";

const includesAny = (value: string, terms: string[]) => terms.some(term => value.includes(term));

export const categorizeGroceryItem = (name: string, raw = name): GroceryCategory => {
  const value = `${name} ${raw}`.toLowerCase();
  if (/\b(fryst|frysta|tinad|tinade)\b/.test(value)) return "Fryst";

  if (includesAny(name, [
    "lax", "torsk", "räkor", "kycklingfilé", "köttfärs", "bacon", "chorizo", "korv",
    "vegokorv", "vegetarisk korv",
  ])) return "Kött & Fisk";

  if (includesAny(name, [
    "mjölk", "grädde", "ägg", "smör", "ost", "parmesan", "yoghurt", "crème fraiche",
    "havredryck", "sojadryck", "mandeldryck", "växtgrädde", "växtyoghurt",
  ])) return "Mejeri";

  if (includesAny(name, [
    "potatis", "morötter", "gul lök", "röd lök", "schalottenlök", "vitlök", "paprika",
    "babyspenat", "citron", "lime",
  ])) return "Frukt & Grönt";
  if (/\b(färsk|färska)\b/.test(value) && includesAny(name, ["basilika", "oregano", "persilja", "örter"])) {
    return "Frukt & Grönt";
  }

  if (includesAny(name, [
    "pasta", "penne", "ris", "vetemjöl", "socker", "salt", "svartpeppar", "oregano",
    "basilika", "cayennepeppar", "kanel", "olivolja", "vinäger", "honung", "tomatpuré",
    "krossade tomater", "passerade tomater", "röda linser", "buljong", "fond",
  ])) return "Skafferi";

  return "Övrigt";
};

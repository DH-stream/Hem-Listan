import type { RecipeIngredient } from "../../types";
import { categorizeGroceryItem } from "./categorize";
import { parseQuantity } from "./parseQuantity";
import type { CanonicalGroceryItem, QuantityPolicy } from "./types";

const clean = (value: string) => value
  .toLowerCase()
  .normalize("NFKC")
  .replace(/[®™]/g, "")
  .replace(/\([^)]*\)/g, " ")
  .replace(/,.*$/, " ")
  .replace(/\btill\s+(stekning|servering)\b.*$/, " ")
  .replace(/[^a-zåäöéèü&\-\s]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const STORE_PREPARATION_PREFIX =
  /^(?:kokt|kokta|kokade|hackad|hackade|skivad|skivade|tärnad|tärnade|skalad|skalade|pressad|pressade)\s+(.+)$/i;

const preserveInitialCasing = (source: string, value: string): string => {
  const first = source.charAt(0);
  if (
    first &&
    first === first.toLocaleUpperCase("sv-SE") &&
    first !== first.toLocaleLowerCase("sv-SE")
  ) {
    return value.charAt(0).toLocaleUpperCase("sv-SE") + value.slice(1);
  }
  return value;
};

export const normalizeShoppingItemNameForStore = (name: string): string => {
  const trimmed = name.trim();
  const match = trimmed.match(STORE_PREPARATION_PREFIX);
  if (!match) return trimmed;

  const preparedName = match[1].trim();
  if (/^tomater?$/i.test(preparedName)) return trimmed;

  const shoppingName = /^potatis(?:ar)?$/i.test(preparedName)
    ? "potatis"
    : preparedName;
  return preserveInitialCasing(trimmed, shoppingName);
};

const canonicalize = (input: string): string => {
  const value = clean(input)
    .replace(/^(arla(?: köket| ko)?|zeta|ica|coop)\s+/, "")
    .replace(/^vanliga?\s+/, "")
    .trim();

  if (/\bvatten\b/.test(value)) return "vatten";
  if (/smör\s*[-&]\s*rapsolja/.test(value)) return "smör- & rapsolja";
  if (/\bstandardmjölk\b|^mjölk$/.test(value)) return "mjölk";
  if (/\bvispgrädde\b/.test(value)) return "vispgrädde";
  if (/\bmatlagningsgrädde\b/.test(value)) return "matlagningsgrädde";
  if (/\bvitlöks?klyft(?:a|or)\b|\bvitlök vanlig\b|^vitlök$/.test(value)) return "vitlök";
  if (/\bsvartpeppar\b/.test(value)) return "svartpeppar";
  if (/\bmorötter?\b/.test(value)) return "morötter";
  if (/\bröda? linser\b/.test(value)) return "röda linser";
  if (/\bhonung\b/.test(value)) return "honung";
  if (/\bkrossade tomater\b/.test(value)) return "krossade tomater";
  if (/\bsoltorkade tomater\b/.test(value)) {
    return /\bstrimlade\b/.test(value) ? "strimlade soltorkade tomater" : "soltorkade tomater";
  }
  if (/\btomatpuré\b/.test(value)) return "tomatpuré";
  if (/\bpenne\b/.test(value)) return "penne pasta";
  if (/\bbasilika\b/.test(value)) {
    if (/\b(färsk|färska)\b/.test(value)) return "färsk basilika";
    if (/\b(torkad|torkade)\b/.test(value) || /basilika\s*-\s*torkad/.test(value)) return "torkad basilika";
  }
  if (/\boregano\b/.test(value) && /\btorkad/.test(value)) return "torkad oregano";
  if (/\bcrème fraiche\b/.test(value)) return "crème fraiche";
  if (/\bfinriven parmesan\b/.test(value)) return "parmesan";
  if (/\briven parmesan\b/.test(value)) return "riven parmesan";
  if (/\bparmesan\b/.test(value)) return "parmesan";
  if (/\blaxfilé\b/.test(value)) return "laxfilé";
  if (/\bkallrökt lax\b/.test(value)) return "kallrökt lax";
  if (/\blax\b/.test(value)) return "lax";
  if (/\bschalottenlök\b/.test(value)) return "schalottenlök";
  if (/\bröd lök\b|\brödlök\b/.test(value)) return "röd lök";
  if (/\bgul lök\b/.test(value)) return "gul lök";
  if (/\b(?:kokt|kokta) potatis(?:ar)?\b/.test(value)) return "potatis";
  if (/\bpotatis\b/.test(value)) return "potatis";
  if (/\bkycklingfilé\b/.test(value)) return "kycklingfilé";
  if (/\bbabyspenat\b/.test(value)) return "babyspenat";
  if (/\bgrönkål\b/.test(value)) return "grönkål";
  if (/\bägg\b/.test(value)) return "ägg";
  if (/\bvetemjöl\b/.test(value)) return "vetemjöl";
  if (/\bolivolja\b/.test(value)) return "olivolja";
  if (/^salt\b/.test(value)) return "salt";
  return value;
};

const HIDE = new Set([
  "salt", "svartpeppar", "honung", "vetemjöl", "socker", "ris", "pasta", "röda linser",
  "buljong", "fond", "olivolja", "vinäger", "torkad basilika", "torkad oregano", "vitlök",
  "smör- & rapsolja", "tomatpuré", "soltorkade tomater", "strimlade soltorkade tomater",
  "parmesan", "crème fraiche",
]);
const PACKAGE_ROUND = new Set(["mjölk", "vispgrädde", "grädde", "ägg"]);

const quantityPolicy = (name: string, quantity: ReturnType<typeof parseQuantity>): QuantityPolicy => {
  if (name === "vatten") return "skip";
  if (HIDE.has(name) || name.endsWith("mjöl") || /(?:ris|pasta|penne|linser|buljong|fond|socker|honung|salt|peppar|olja|vinäger|krydd)/.test(name)) {
    return "hide";
  }
  if (PACKAGE_ROUND.has(name) || quantity?.dimension === "package") return "package_round";
  return "exact";
};

export const normalizeGroceryName = (value: string): string => canonicalize(value);

export const normalizeRecipeIngredient = (ingredient: RecipeIngredient): CanonicalGroceryItem => {
  const raw = ingredient.rawText || ingredient.text;
  const name = canonicalize(ingredient.text || raw);
  const quantity = parseQuantity(ingredient.quantity) || parseQuantity(raw);
  return {
    raw,
    name,
    quantity,
    category: categorizeGroceryItem(name, raw),
    policy: quantityPolicy(name, quantity),
  };
};

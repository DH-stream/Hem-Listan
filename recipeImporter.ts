export type RecipeIngredient = {
  text: string;
  quantity: string;
  category: string;
};

export type ExtractionMethod = "json_ld" | "dom_fallback" | "site_adapter";
export type ImportConfidence = "high" | "medium" | "low";

export type ExtractedRecipe = {
  recipeName: string;
  mealName: string;
  ingredients: RecipeIngredient[];
  sourceUrl: string;
  sourceDomain: string;
  extractionMethod: ExtractionMethod;
  confidence: ImportConfidence;
  qualityWarnings: string[];
};

type RecipeCandidate = {
  recipeName?: string;
  ingredients: unknown[];
  extractionMethod: ExtractionMethod;
};

const SUPPORTED_SITES = ["ica.se", "arla.se", "koket.se"];
const FETCH_TIMEOUT_MS = 8_000;
const MAX_HTML_LENGTH = 2_000_000;
const MAX_REDIRECTS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const htmlEntities: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  hellip: "…",
  laquo: "«",
  ldquo: "“",
  lt: "<",
  nbsp: " ",
  ndash: "–",
  quot: '"',
  raquo: "»",
  rdquo: "”",
};

function decodeHtml(value: string): string {
  return value.replace(/&(#x?[\da-f]+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith("#")) {
      const radix = code[1]?.toLowerCase() === "x" ? 16 : 10;
      const number = Number.parseInt(code.slice(radix === 16 ? 2 : 1), radix);
      return Number.isFinite(number) ? String.fromCodePoint(number) : entity;
    }

    return htmlEntities[code.toLowerCase()] ?? entity;
  });
}

function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return decodeHtml(value.replace(/<[^>]*>/g, " "))
    .replace(/[\u00a0\s]+/g, " ")
    .trim();
}

function getHostname(url: URL): string {
  return url.hostname.toLowerCase().replace(/^www\./, "");
}

function isSupportedSite(hostname: string): boolean {
  return SUPPORTED_SITES.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
}

export function validateRecipeUrl(value: unknown): URL {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Ange en giltig receptlänk.");
  }

  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Ange en giltig receptlänk.");
  }

  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Receptlänken måste vara en vanlig http- eller https-länk.");
  }

  const hostname = getHostname(url);
  if (
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    /^(127\.|10\.|192\.168\.|169\.254\.)/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    hostname === "::1"
  ) {
    throw new Error("Den receptlänken kan inte hämtas.");
  }

  return url;
}

function findRecipeNode(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const recipe = findRecipeNode(item);
      if (recipe) return recipe;
    }
    return null;
  }

  const object = value as Record<string, unknown>;
  const types = Array.isArray(object["@type"])
    ? object["@type"]
    : [object["@type"]];
  if (types.some((type) => typeof type === "string" && type.toLowerCase() === "recipe")) {
    return object;
  }

  for (const child of Object.values(object)) {
    const recipe = findRecipeNode(child);
    if (recipe) return recipe;
  }

  return null;
}

function parseJsonScriptContents(html: string, typePattern: RegExp): unknown[] {
  const values: unknown[] = [];
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptPattern.exec(html))) {
    if (!typePattern.test(match[1])) continue;
    const content = match[2]
      .trim()
      .replace(/^<!--/, "")
      .replace(/-->$/, "")
      .trim();
    if (!content) continue;

    try {
      values.push(JSON.parse(content));
    } catch {
      // Ignore malformed embedded data and continue with the next deterministic source.
    }
  }

  return values;
}

function extractJsonLd(html: string): RecipeCandidate | null {
  const documents = parseJsonScriptContents(
    html,
    /\btype\s*=\s*["']application\/ld\+json(?:\s*;[^"']*)?["']/i,
  );

  for (const document of documents) {
    const recipe = findRecipeNode(document);
    if (!recipe) continue;

    const ingredients = Array.isArray(recipe.recipeIngredient)
      ? recipe.recipeIngredient
      : Array.isArray(recipe.ingredients)
        ? recipe.ingredients
        : [];

    if (ingredients.length > 0) {
      return {
        recipeName: cleanText(recipe.name ?? recipe.headline),
        ingredients,
        extractionMethod: "json_ld",
      };
    }
  }

  return null;
}

function ingredientFromObject(value: Record<string, unknown>): string {
  const name = cleanText(
    value.name ?? value.ingredient ?? value.text ?? value.title ?? value.label,
  );
  if (!name) return "";

  const amount = cleanText(value.amount ?? value.quantity ?? value.value);
  const unit = cleanText(value.unit ?? value.measurementUnit ?? value.unitText);
  return [amount, unit, name].filter(Boolean).join(" ");
}

function findIngredientArray(value: unknown): unknown[] | null {
  if (!value || typeof value !== "object") return null;

  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findIngredientArray(child);
      if (found) return found;
    }
    return null;
  }

  const object = value as Record<string, unknown>;
  for (const key of ["recipeIngredient", "recipeIngredients", "ingredients"]) {
    const candidate = object[key];
    if (
      Array.isArray(candidate) &&
      candidate.some(
        (item) =>
          cleanText(item).length > 0 ||
          (item && typeof item === "object" && ingredientFromObject(item as Record<string, unknown>)),
      )
    ) {
      return candidate;
    }
  }

  for (const child of Object.values(object)) {
    const found = findIngredientArray(child);
    if (found) return found;
  }

  return null;
}

function extractMetaContent(html: string, property: string): string {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return cleanText(match[1]);
  }
  return "";
}

function extractPageTitle(html: string): string {
  const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  return (
    (heading ? cleanText(heading[1]) : "") ||
    extractMetaContent(html, "og:title") ||
    cleanText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1])
  );
}

function extractDomIngredients(html: string): string[] {
  const results: string[] = [];
  const patterns = [
    /<([a-z\d]+)\b[^>]*itemprop=["']recipeIngredient["'][^>]*>([\s\S]*?)<\/\1>/gi,
    /<([a-z\d]+)\b[^>]*(?:class|data-testid)=["'][^"']*(?:recipe[-_ ]?ingredient|ingredient[-_ ]?(?:item|row)|ingredients-list__item)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html))) {
      const text = cleanText(match[2]);
      if (text) results.push(text);
    }
  }

  return results;
}

function extractSiteFallback(html: string, hostname: string): RecipeCandidate | null {
  let ingredients: unknown[] = [];

  if (isSupportedSite(hostname)) {
    const documents = parseJsonScriptContents(
      html,
      /\btype\s*=\s*["']application\/json["']|\bid\s*=\s*["']__NEXT_DATA__["']/i,
    );
    for (const document of documents) {
      const found = findIngredientArray(document);
      if (found) {
        ingredients = found;
        break;
      }
    }
  }

  if (ingredients.length === 0) ingredients = extractDomIngredients(html);
  if (ingredients.length === 0) return null;

  return {
    recipeName: extractPageTitle(html),
    ingredients,
    extractionMethod: isSupportedSite(hostname) ? "site_adapter" : "dom_fallback",
  };
}

function simplifyMealName(recipeName: string): string {
  return recipeName
    .split(/\s(?:\||–|—)\s/)[0]
    .replace(/\s*[|–—-]?\s*recept(?:et)?\s*$/i, "")
    .trim();
}

function splitIngredient(
  value: unknown,
): { text: string; quantity: string } | null {
  const raw =
    typeof value === "string"
      ? cleanText(value)
      : value && typeof value === "object"
        ? cleanText(ingredientFromObject(value as Record<string, unknown>))
        : "";
  if (!raw) return null;

  const normalized = raw
    .replace(/^[-–—•*]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
  const quantityMatch = normalized.match(
    /^((?:ca\s+|cirka\s+)?(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?[½⅓⅔¼¾⅛]?|[½⅓⅔¼¾⅛]|\d+\s*[-–]\s*\d+)(?:\s*(?:st|stycken|g|kg|mg|ml|cl|dl|l|msk|tsk|krm|förp(?:ackning)?|burk(?:ar)?|påse|påsar|paket|knippe|klyfta|klyftor|skiva|skivor|nypa|nävar?|portion(?:er)?))?\b)\s*/i,
  );
  const quantity = quantityMatch
    ? quantityMatch[1].replace(/\s+/g, " ").trim()
    : "";
  const text = cleanText(
    quantityMatch ? normalized.slice(quantityMatch[0].length) : normalized,
  )
    .replace(/^av\s+/i, "")
    .trim();

  if (!text || text.length > 180) return null;
  return { text, quantity };
}

function categorizeIngredient(text: string): string {
  const value = text.toLowerCase();
  const categories: Array<[string, string[]]> = [
    ["Frukt & Grönt", ["äpp", "banan", "avokado", "päron", "lök", "vitlök", "morot", "tomat", "sallad", "potatis", "paprika", "gurka", "citron", "lime", "örter", "persilja", "dill", "basilika", "svamp", "broccoli", "spenat"]],
    ["Mejeri", ["mjölk", "grädde", "smör", "ost", "crème fraiche", "creme fraiche", "yoghurt", "kvarg", "ägg"]],
    ["Kött & Fisk", ["kött", "färs", "kyckling", "lax", "fisk", "torsk", "fläsk", "bacon", "korv", "räk"]],
    ["Fryst", ["fryst", "glass"]],
    ["Skafferi", ["pasta", "ris", "mjöl", "socker", "salt", "peppar", "olja", "vinäger", "buljong", "bön", "linser", "krossade tomater", "konserv", "krydda", "senap", "honung"]],
  ];

  return (
    categories.find(([, terms]) =>
      terms.some((term) => value.includes(term)),
    )?.[0] ?? "Övrigt"
  );
}

function isCredibleIngredient(ingredient: RecipeIngredient): boolean {
  const value = ingredient.text.toLowerCase();
  return (
    value.length >= 2 &&
    value.length <= 100 &&
    !/^(ingredienser?|gör så här|tillagning|servering|portioner?)[:\s]*$/i.test(value) &&
    !/^https?:\/\//.test(value)
  );
}

function normalizeCandidate(
  candidate: RecipeCandidate,
  sourceUrl: URL,
): ExtractedRecipe | null {
  const seen = new Set<string>();
  const ingredients = candidate.ingredients
    .map(splitIngredient)
    .filter(
      (ingredient): ingredient is { text: string; quantity: string } =>
        Boolean(ingredient),
    )
    .map((ingredient) => ({
      ...ingredient,
      category: categorizeIngredient(ingredient.text),
    }))
    .filter((ingredient) => {
      const key = `${ingredient.quantity}|${ingredient.text}`.toLocaleLowerCase("sv");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  if (ingredients.length === 0) return null;

  const recipeName = cleanText(candidate.recipeName) || "Importerat recept";
  const normalizedRecipeName = recipeName.toLocaleLowerCase("sv");
  const filteredIngredients = ingredients.filter((ingredient) => {
    if (ingredient.quantity) return true;
    const text = ingredient.text.toLocaleLowerCase("sv").replace(/:$/, "");
    return (
      text !== normalizedRecipeName &&
      !/^(ingredienser?|fyllning|garnering|dekoration|till fyllning|till servering|serveras med)$/.test(text)
    );
  });
  if (filteredIngredients.length === 0) return null;

  const credibleCount = filteredIngredients.filter(isCredibleIngredient).length;
  const qualityWarnings: string[] = [];
  if (!cleanText(candidate.recipeName)) {
    qualityWarnings.push("Receptnamnet kunde inte identifieras säkert.");
  }
  if (credibleCount < 3) {
    qualityWarnings.push("Färre än tre tydliga ingredienser hittades.");
  }
  if (credibleCount < filteredIngredients.length) {
    qualityWarnings.push("Någon rad ser inte ut som en vanlig ingrediens.");
  }

  let confidence: ImportConfidence = "low";
  if (cleanText(candidate.recipeName) && credibleCount >= 3) confidence = "high";
  else if (credibleCount >= 2) confidence = "medium";

  return {
    recipeName,
    mealName: simplifyMealName(recipeName) || recipeName,
    ingredients: filteredIngredients,
    sourceUrl: sourceUrl.toString(),
    sourceDomain: getHostname(sourceUrl),
    extractionMethod: candidate.extractionMethod,
    confidence,
    qualityWarnings,
  };
}

export function extractRecipeFromHtml(
  html: string,
  sourceUrl: URL,
): ExtractedRecipe | null {
  const hostname = getHostname(sourceUrl);
  const jsonLdCandidate = extractJsonLd(html);
  const normalizedJsonLd = jsonLdCandidate
    ? normalizeCandidate(jsonLdCandidate, sourceUrl)
    : null;

  const credibleJsonLdCount =
    normalizedJsonLd?.ingredients.filter(isCredibleIngredient).length ?? 0;
  if (normalizedJsonLd && credibleJsonLdCount >= 2) return normalizedJsonLd;

  const fallbackCandidate = extractSiteFallback(html, hostname);
  const normalizedFallback = fallbackCandidate
    ? normalizeCandidate(fallbackCandidate, sourceUrl)
    : null;

  return normalizedFallback ?? normalizedJsonLd;
}

export async function importRecipeFromUrl(value: unknown): Promise<ExtractedRecipe> {
  let currentUrl = validateRecipeUrl(value);
  let response: Response | null = null;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    try {
      response = await fetch(currentUrl, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "Hem-Listan Recipe Importer/1.0",
        },
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError")
      ) {
        throw new Error("Receptsidan tog för lång tid att hämta.");
      }
      throw new Error("Receptsidan kunde inte hämtas.");
    }

    if (!REDIRECT_STATUSES.has(response.status)) break;
    if (redirectCount === MAX_REDIRECTS) {
      throw new Error("Receptsidan skickade vidare för många gånger.");
    }

    const location = response.headers.get("location");
    if (!location) {
      throw new Error("Receptsidan skickade vidare utan en giltig adress.");
    }

    currentUrl = validateRecipeUrl(new URL(location, currentUrl).toString());
  }

  if (!response) {
    throw new Error("Receptsidan kunde inte hämtas.");
  }

  if (!response.ok) {
    throw new Error(`Receptsidan svarade med status ${response.status}.`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (
    contentType &&
    !contentType.includes("text/html") &&
    !contentType.includes("application/xhtml+xml")
  ) {
    throw new Error("Länken verkar inte gå till en receptsida.");
  }

  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_HTML_LENGTH) {
    throw new Error("Receptsidan är för stor för att importera.");
  }

  const html = await response.text();
  if (html.length > MAX_HTML_LENGTH) {
    throw new Error("Receptsidan är för stor för att importera.");
  }

  const recipe = extractRecipeFromHtml(html, currentUrl);
  if (!recipe) {
    throw new Error("Inga ingredienser hittades på receptsidan.");
  }

  return recipe;
}

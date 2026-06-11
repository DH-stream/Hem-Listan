export type RecipeIngredient = {
  rawText?: string;
  text: string;
  quantity: string;
  category: string;
  note?: string;
};

export type ExtractionMethod =
  | "json_ld"
  | "dom_fallback"
  | "text_section_fallback"
  | "site_adapter";
export type ExtractionAttemptMethod = ExtractionMethod | "coop_adapter";
export type ImportConfidence = "high" | "medium" | "low";
export type RecipeImportErrorCode =
  | "invalid_url"
  | "fetch_failed"
  | "fetch_timeout"
  | "too_many_redirects"
  | "unsafe_redirect"
  | "unsupported_content_type"
  | "page_too_large"
  | "no_recipe_found";

export class RecipeImportError extends Error {
  constructor(
    public readonly code: RecipeImportErrorCode,
    message: string,
    public readonly attemptedMethods: ExtractionAttemptMethod[] = [],
  ) {
    super(message);
    this.name = "RecipeImportError";
  }

  get canRetryWithAi(): boolean {
    return this.code === "no_recipe_found";
  }
}

export type ExtractedRecipe = {
  recipeName: string;
  mealName: string;
  ingredients: RecipeIngredient[];
  instructions?: string[];
  imageUrl?: string;
  sourceUrl: string;
  sourceDomain: string;
  extractionMethod: ExtractionMethod;
  confidence: ImportConfidence;
  qualityWarnings: string[];
  attemptedMethods: ExtractionAttemptMethod[];
  usedFallback: boolean;
  canRetryWithAi: boolean;
};

type ExtractionAttempt = {
  recipe: ExtractedRecipe | null;
  attemptedMethods: ExtractionAttemptMethod[];
};

type RecipeCandidate = {
  recipeName?: string;
  ingredients: unknown[];
  instructions?: string[];
  imageUrl?: string;
  extractionMethod: ExtractionMethod;
};

const SUPPORTED_SITES = [
  "ica.se",
  "arla.se",
  "koket.se",
  "mathem.se",
  "coop.se",
  "tasteline.com",
  "recepten.se",
  "landleyskok.se",
  "undertian.com",
  "zeinas.se",
  "valio.se",
];
const FETCH_TIMEOUT_MS = 8_000;
const MAX_HTML_LENGTH = 2_000_000;
const MAX_REDIRECTS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

type RecipeImportOptions = { requestId?: string };

function logRecipeImport(
  event: string,
  requestId: string | undefined,
  details: Record<string, unknown> = {},
) {
  console.info("[HL_RECIPE_IMPORT_API]", { event, requestId, ...details });
}

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
  return url.hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/^www\./, "");
}

function isPrivateIpv6(hostname: string): boolean {
  return (
    hostname === "::1" ||
    /^f[cd][0-9a-f]{2}:/.test(hostname) ||
    /^fe[89ab][0-9a-f]:/.test(hostname)
  );
}

function isSupportedSite(hostname: string): boolean {
  return SUPPORTED_SITES.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
}

export function validateRecipeUrl(
  value: unknown,
  errorCode: "invalid_url" | "unsafe_redirect" = "invalid_url",
): URL {
  const invalidUrl = (message: string): never => {
    throw new RecipeImportError(errorCode, message);
  };

  if (typeof value !== "string" || !value.trim()) {
    return invalidUrl("Ange en giltig receptlänk.");
  }

  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return invalidUrl("Ange en giltig receptlänk.");
  }

  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    return invalidUrl(
      "Receptlänken måste vara en vanlig http- eller https-länk.",
    );
  }

  const hostname = getHostname(url);
  if (
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    /^(127\.|10\.|192\.168\.|169\.254\.)/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    isPrivateIpv6(hostname)
  ) {
    return invalidUrl("Den receptlänken kan inte hämtas.");
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

function normalizeInstructionStep(value: unknown): string[] {
  if (typeof value === "string") {
    const text = cleanText(value);
    return text && text.length <= 2_000 ? [text] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(normalizeInstructionStep);
  }

  if (!value || typeof value !== "object") return [];

  const object = value as Record<string, unknown>;
  if (Array.isArray(object.itemListElement)) {
    return object.itemListElement.flatMap(normalizeInstructionStep);
  }

  const text = cleanText(object.text);
  const name = cleanText(object.name);
  const instruction =
    name && text && name.toLocaleLowerCase("sv") !== text.toLocaleLowerCase("sv")
      ? `${name}: ${text}`
      : text || name;

  return instruction && instruction.length <= 2_000 ? [instruction] : [];
}

function extractImageUrl(value: unknown): string {
  if (typeof value === "string") return cleanText(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = extractImageUrl(item);
      if (url) return url;
    }
    return "";
  }
  if (!value || typeof value !== "object") return "";
  const object = value as Record<string, unknown>;
  return extractImageUrl(object.url ?? object.contentUrl);
}

function resolveImageUrl(value: string | undefined, sourceUrl: URL): string | undefined {
  if (!value) return undefined;
  try {
    const imageUrl = new URL(value, sourceUrl);
    return ["http:", "https:"].includes(imageUrl.protocol)
      ? imageUrl.toString()
      : undefined;
  } catch {
    return undefined;
  }
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
        instructions: normalizeInstructionStep(recipe.recipeInstructions),
        imageUrl: extractImageUrl(recipe.image),
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

function extractElementTexts(
  html: string,
  tagPattern = "[a-z\\d]+",
): string[] {
  const results: string[] = [];
  const pattern = new RegExp(
    `<(${tagPattern})\\b[^>]*>([\\s\\S]*?)<\\/\\1>`,
    "gi",
  );
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const text = cleanText(match[2]);
    if (text) results.push(text);
  }
  return results;
}

const INGREDIENT_HEADING = /^(?:ingredienser|du behöver|det här behöver du)(?:\s*[(:].*)?$/i;
const STOP_HEADING = /^(?:gör så här|så här gör du|tillagning|instruktioner|metod)(?:\s*:.*)?$/i;

function extractIngredientSection(html: string): string | null {
  const headingPattern = /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi;
  const headings: Array<{ start: number; end: number; text: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = headingPattern.exec(html))) {
    headings.push({
      start: match.index,
      end: headingPattern.lastIndex,
      text: cleanText(match[1]),
    });
  }

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    if (!INGREDIENT_HEADING.test(heading.text)) continue;

    const stop = headings
      .slice(index + 1)
      .find((candidate) => STOP_HEADING.test(candidate.text));
    return html.slice(heading.end, stop?.start ?? html.length);
  }

  return null;
}

function extractSemanticDomIngredients(html: string): string[] {
  const results: string[] = [];
  const pattern =
    /<([a-z\d]+)\b[^>]*itemprop=["'](?:recipeIngredient|ingredients)["'][^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html))) {
    const nestedItems = extractElementTexts(match[2], "li");
    if (nestedItems.length) results.push(...nestedItems);
    else {
      const text = cleanText(match[2]);
      if (text) results.push(text);
    }
  }

  return results;
}

function extractSupportedDomIngredients(html: string): string[] {
  const results: string[] = [];
  const pattern =
    /<([a-z\d]+)\b[^>]*(?:class|data-testid)=["'][^"']*(?:recipe[-_ ]?ingredient|recipeIngredient|ingredient-list|ingredients-list|ingredient[-_ ]?(?:item|row)|recipe__ingredients|recipeIngredients)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html))) {
    const nestedItems = extractElementTexts(match[2], "li");
    if (nestedItems.length) results.push(...nestedItems);
    else {
      const text = cleanText(match[2]);
      if (text) results.push(text);
    }
  }

  const section = extractIngredientSection(html);
  if (section) results.push(...extractElementTexts(section, "li"));

  return results;
}

function extractTextSectionIngredients(html: string): string[] {
  const section = extractIngredientSection(html);
  if (!section) return [];

  const withoutScripts = section
    .replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|tr)>/gi, "\n");

  return decodeHtml(withoutScripts.replace(/<[^>]*>/g, " "))
    .split(/\n+/)
    .map((line) => line.replace(/[\u00a0\s]+/g, " ").trim())
    .filter(Boolean);
}

function extractEmbeddedData(html: string): RecipeCandidate | null {
  const documents = parseJsonScriptContents(
    html,
    /\btype\s*=\s*["']application\/json(?:\s*;[^"']*)?["']|\bid\s*=\s*["']__NEXT_DATA__["']/i,
  );
  for (const document of documents) {
    const ingredients = findIngredientArray(document);
    if (ingredients) {
      return {
        recipeName: extractPageTitle(html),
        ingredients,
        imageUrl: extractMetaContent(html, "og:image"),
        extractionMethod: "site_adapter",
      };
    }
  }
  return null;
}

function extractCoopAdapter(html: string): RecipeCandidate | null {
  const propsPattern = /\bdata-react-props\s*=\s*(["'])([\s\S]*?)\1/gi;
  let match: RegExpExecArray | null;

  while ((match = propsPattern.exec(html))) {
    try {
      const props = JSON.parse(decodeHtml(match[2])) as Record<string, unknown>;
      const mainBody = typeof props.mainBody === "string" ? props.mainBody : "";
      if (!mainBody) continue;
      const section = extractIngredientSection(mainBody);
      const ingredients = section ? extractElementTexts(section, "li") : [];
      if (ingredients.length === 0) continue;

      return {
        recipeName: cleanText(
          props.headline ?? props.moduleHeadline ?? props.name ?? props.title,
        ),
        ingredients,
        imageUrl: extractImageUrl(props.moduleImage ?? props.heroImage),
        extractionMethod: "site_adapter",
      };
    } catch {
      // Continue with another Coop component or the generic fallbacks.
    }
  }

  return null;
}

function simplifyMealName(recipeName: string): string {
  return recipeName
    .split(/\s(?:\||–|—)\s/)[0]
    .replace(/\s*[|–—-]?\s*recept(?:et)?\s*$/i, "")
    .trim();
}

export function separateIngredientNote(value: string): { text: string; note?: string } {
  let text = cleanText(value);
  const notes: string[] = [];

  const parenthetical = text.match(/\s*(\((?:obs!|se tips)[^)]*\))\s*$/i);
  if (parenthetical) {
    notes.unshift(parenthetical[1].replace(/^\((.*)\)$/, "$1"));
    text = text.slice(0, parenthetical.index).trim();
  }

  const commaPrep = text.match(/,\s*((?:(?:fin)?hackad(?:e)?|skivad(?:e)?|riven|rivet|rivna|skalad(?:e)?|tinad(?:e)?|kokt(?:a)?)(?:\s+.*)?)$/i);
  if (commaPrep) {
    notes.unshift(commaPrep[1].trim());
    text = text.slice(0, commaPrep.index).trim();
  }

  const trailingPhrase = text.match(/\s+(i (?:ljummet|kallt|varmt) vatten|till servering|efter smak|(?:valfritt|gärna)(?:\s+.*)?)\s*$/i);
  if (trailingPhrase) {
    notes.unshift(trailingPhrase[1].trim());
    text = text.slice(0, trailingPhrase.index).trim();
  }

  const freshOrFrozenPrefix = text.match(/^färska eller (?:tinade )?frysta\s+(.+)$/i);
  if (freshOrFrozenPrefix) {
    notes.unshift("Färska eller frysta.");
    text = freshOrFrozenPrefix[1].trim();
  }

  const thawedFrozenPrefix = text.match(/^tinad(?:e)?\s+((?:fryst|frysta)\s+.+)$/i);
  if (thawedFrozenPrefix) {
    notes.unshift("Tinade.");
    text = thawedFrozenPrefix[1].trim();
  }

  return { text, ...(notes.length ? { note: notes.join(" ") } : {}) };
}

function splitIngredient(
  value: unknown,
): Omit<RecipeIngredient, "category"> | null {
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
  const ingredientText = cleanText(
    quantityMatch ? normalized.slice(quantityMatch[0].length) : normalized,
  )
    .replace(/^av\s+/i, "")
    .trim();
  const { text, note } = separateIngredientNote(ingredientText);

  if (!text || text.length > 180) return null;
  return { rawText: raw, text, quantity, ...(note ? { note } : {}) };
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
  const rejectedContent =
    /^(?:gör så här|så här gör du|tillagning|instruktioner|metod|servering|portioner?|annons|sponsrat|betyg|recensioner?|kommentarer?|näringsvärde|energi|kalorier|protein|kolhydrater|fett|läs mer|visa mer|logga in|meny|recept)(?:[:\s]|$)/i;
  const instructionStart =
    /^(?:blanda|hacka|skär|lägg|sätt|värm|stek|koka|grädda|servera|rör|häll|tillsätt|smaka|låt|skala|riv|vispa|rosta|fördela|toppa|ringla|pressa|baka)\b/i;

  return (
    value.length >= 2 &&
    value.length <= 100 &&
    !rejectedContent.test(value) &&
    !instructionStart.test(value) &&
    !/^https?:\/\//.test(value)
  );
}

function assessRecipeQuality(
  hasRecipeName: boolean,
  ingredients: RecipeIngredient[],
): { confidence: ImportConfidence; qualityWarnings: string[] } {
  const credibleCount = ingredients.filter(isCredibleIngredient).length;
  const qualityWarnings: string[] = [];

  if (!hasRecipeName) {
    qualityWarnings.push("Receptnamnet kunde inte identifieras säkert.");
  }
  if (credibleCount < 3) {
    qualityWarnings.push("Färre än tre tydliga ingredienser hittades.");
  }
  if (credibleCount < ingredients.length) {
    qualityWarnings.push("Någon rad ser inte ut som en vanlig ingrediens.");
  }

  let confidence: ImportConfidence = "low";
  if (hasRecipeName && credibleCount >= 3) confidence = "high";
  else if (credibleCount >= 2) confidence = "medium";

  return { confidence, qualityWarnings };
}

function normalizeCandidate(
  candidate: RecipeCandidate,
  sourceUrl: URL,
): ExtractedRecipe | null {
  const seen = new Set<string>();
  const ingredients = candidate.ingredients
    .map(splitIngredient)
    .filter(
      (ingredient): ingredient is Omit<RecipeIngredient, "category"> =>
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

  const { confidence, qualityWarnings } = assessRecipeQuality(
    Boolean(cleanText(candidate.recipeName)),
    filteredIngredients,
  );

  return {
    recipeName,
    mealName: simplifyMealName(recipeName) || recipeName,
    ingredients: filteredIngredients,
    instructions: candidate.instructions?.length
      ? candidate.instructions
      : undefined,
    imageUrl: resolveImageUrl(candidate.imageUrl, sourceUrl),
    sourceUrl: sourceUrl.toString(),
    sourceDomain: getHostname(sourceUrl),
    extractionMethod: candidate.extractionMethod,
    confidence,
    qualityWarnings,
    attemptedMethods: [candidate.extractionMethod],
    usedFallback: candidate.extractionMethod !== "json_ld",
    canRetryWithAi: confidence === "low",
  };
}

function withExtractionMetadata(
  recipe: ExtractedRecipe,
  attemptedMethods: ExtractionAttemptMethod[],
): ExtractedRecipe {
  return {
    ...recipe,
    attemptedMethods,
    usedFallback: recipe.extractionMethod !== "json_ld",
    canRetryWithAi: recipe.confidence === "low",
  };
}

function attemptRecipeExtraction(
  html: string,
  sourceUrl: URL,
): ExtractionAttempt {
  const hostname = getHostname(sourceUrl);
  const attemptedMethods: ExtractionAttemptMethod[] = ["json_ld"];
  const jsonLdCandidate = extractJsonLd(html);
  const normalizedJsonLd = jsonLdCandidate
    ? normalizeCandidate(jsonLdCandidate, sourceUrl)
    : null;

  const credibleJsonLdCount =
    normalizedJsonLd?.ingredients.filter(isCredibleIngredient).length ?? 0;
  if (normalizedJsonLd && credibleJsonLdCount >= 2) {
    return {
      recipe: withExtractionMetadata(normalizedJsonLd, attemptedMethods),
      attemptedMethods,
    };
  }

  const tryFallback = (
    attemptMethod: ExtractionAttemptMethod,
    candidate: RecipeCandidate | null,
  ): ExtractedRecipe | null => {
    if (!attemptedMethods.includes(attemptMethod)) {
      attemptedMethods.push(attemptMethod);
    }
    if (!candidate) return null;
    const normalized = normalizeCandidate(candidate, sourceUrl);
    if (!normalized) return null;
    const credibleIngredients = normalized.ingredients.filter(isCredibleIngredient);
    if (credibleIngredients.length < 3) return null;
    return withExtractionMetadata(
      { ...normalized, ingredients: credibleIngredients },
      attemptedMethods,
    );
  };

  if (isSupportedSite(hostname)) {
    const embeddedRecipe = tryFallback(
      "site_adapter",
      extractEmbeddedData(html),
    );
    if (embeddedRecipe) return { recipe: embeddedRecipe, attemptedMethods };
  }

  if (hostname === "coop.se" || hostname.endsWith(".coop.se")) {
    const coopRecipe = tryFallback("coop_adapter", extractCoopAdapter(html));
    if (coopRecipe) return { recipe: coopRecipe, attemptedMethods };
  }

  const semanticDomCandidate: RecipeCandidate = {
    recipeName: extractPageTitle(html),
    ingredients: extractSemanticDomIngredients(html),
    imageUrl: extractMetaContent(html, "og:image"),
    extractionMethod: isSupportedSite(hostname) ? "site_adapter" : "dom_fallback",
  };
  const semanticDomRecipe = tryFallback("dom_fallback", semanticDomCandidate);
  if (semanticDomRecipe) {
    return { recipe: semanticDomRecipe, attemptedMethods };
  }

  if (isSupportedSite(hostname)) {
    const supportedDomCandidate: RecipeCandidate = {
      recipeName: extractPageTitle(html),
      ingredients: extractSupportedDomIngredients(html),
      imageUrl: extractMetaContent(html, "og:image"),
      extractionMethod: "site_adapter",
    };
    const supportedDomRecipe = tryFallback(
      "site_adapter",
      supportedDomCandidate,
    );
    if (supportedDomRecipe) {
      return { recipe: supportedDomRecipe, attemptedMethods };
    }

    const textCandidate: RecipeCandidate = {
      recipeName: extractPageTitle(html),
      ingredients: extractTextSectionIngredients(html),
      imageUrl: extractMetaContent(html, "og:image"),
      extractionMethod: "text_section_fallback",
    };
    const textRecipe = tryFallback("text_section_fallback", textCandidate);
    if (textRecipe) {
      return {
        recipe: {
          ...textRecipe,
          confidence:
            textRecipe.confidence === "high" ? "medium" : textRecipe.confidence,
        },
        attemptedMethods,
      };
    }
  }

  return {
    recipe: normalizedJsonLd
      ? withExtractionMetadata(normalizedJsonLd, attemptedMethods)
      : null,
    attemptedMethods,
  };
}

export function extractRecipeFromHtml(
  html: string,
  sourceUrl: URL,
): ExtractedRecipe | null {
  return attemptRecipeExtraction(html, sourceUrl).recipe;
}

export async function importRecipeFromUrl(
  value: unknown,
  options: RecipeImportOptions = {},
): Promise<ExtractedRecipe> {
  const { requestId } = options;
  logRecipeImport("validate_url_start", requestId);
  let currentUrl = validateRecipeUrl(value);
  logRecipeImport("validate_url_success", requestId, {
    hostname: getHostname(currentUrl),
  });
  let response: Response | null = null;

  for (
    let redirectCount = 0;
    redirectCount <= MAX_REDIRECTS;
    redirectCount += 1
  ) {
    logRecipeImport("fetch_start", requestId, {
      hostname: getHostname(currentUrl),
      redirectCount,
    });

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
        throw new RecipeImportError(
          "fetch_timeout",
          "Receptsidan tog för lång tid att hämta.",
        );
      }
      throw new RecipeImportError(
        "fetch_failed",
        "Receptsidan kunde inte hämtas.",
      );
    }

    logRecipeImport("fetch_response", requestId, {
      status: response.status,
      contentType: response.headers.get("content-type"),
      contentLength: response.headers.get("content-length"),
      finalUrlHostname: getHostname(currentUrl),
    });

    if (!REDIRECT_STATUSES.has(response.status)) break;

    const fromHostname = getHostname(currentUrl);
    const location = response.headers.get("location");
    let redirectUrl: URL | null = null;
    if (location) {
      try {
        redirectUrl = new URL(location, currentUrl);
      } catch {
        redirectUrl = null;
      }
    }
    logRecipeImport("redirect_seen", requestId, {
      status: response.status,
      fromHostname,
      toHostname: redirectUrl ? getHostname(redirectUrl) : undefined,
    });

    if (redirectCount === MAX_REDIRECTS) {
      logRecipeImport("redirect_blocked", requestId, {
        reason: "maximum redirect count reached",
        errorCode: "too_many_redirects",
      });
      throw new RecipeImportError(
        "too_many_redirects",
        "Receptsidan skickade vidare för många gånger.",
      );
    }

    if (!location) {
      logRecipeImport("redirect_blocked", requestId, {
        reason: "missing location header",
        errorCode: "unsafe_redirect",
      });
      throw new RecipeImportError(
        "unsafe_redirect",
        "Receptsidan skickade vidare utan en giltig adress.",
      );
    }

    if (!redirectUrl) {
      logRecipeImport("redirect_blocked", requestId, {
        reason: "invalid redirect URL",
        errorCode: "unsafe_redirect",
      });
      throw new RecipeImportError(
        "unsafe_redirect",
        "Receptsidan skickade vidare till en ogiltig adress.",
      );
    }

    try {
      currentUrl = validateRecipeUrl(redirectUrl.toString(), "unsafe_redirect");
    } catch (error) {
      logRecipeImport("redirect_blocked", requestId, {
        reason:
          error instanceof Error ? error.message : "redirect validation failed",
        errorCode:
          error instanceof RecipeImportError ? error.code : "unsafe_redirect",
      });
      throw error;
    }
  }

  if (!response) {
    throw new RecipeImportError(
      "fetch_failed",
      "Receptsidan kunde inte hämtas.",
    );
  }

  if (!response.ok) {
    throw new RecipeImportError(
      "fetch_failed",
      `Receptsidan svarade med status ${response.status}.`,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (
    contentType &&
    !contentType.includes("text/html") &&
    !contentType.includes("application/xhtml+xml")
  ) {
    throw new RecipeImportError(
      "unsupported_content_type",
      "Länken verkar inte gå till en receptsida.",
    );
  }

  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_HTML_LENGTH) {
    throw new RecipeImportError(
      "page_too_large",
      "Receptsidan är för stor för att importera.",
    );
  }

  const html = await response.text();
  logRecipeImport("html_loaded", requestId, { length: html.length });
  if (html.length > MAX_HTML_LENGTH) {
    throw new RecipeImportError(
      "page_too_large",
      "Receptsidan är för stor för att importera.",
    );
  }

  logRecipeImport("extraction_start", requestId);
  const extraction = attemptRecipeExtraction(html, currentUrl);
  if (!extraction.recipe) {
    logRecipeImport("extraction_none", requestId, {
      attemptedMethods: extraction.attemptedMethods,
    });
    throw new RecipeImportError(
      "no_recipe_found",
      "Inga ingredienser hittades på receptsidan.",
      extraction.attemptedMethods,
    );
  }

  logRecipeImport("extraction_result", requestId, {
    attemptedMethods: extraction.attemptedMethods,
    selectedMethod: extraction.recipe.extractionMethod,
    recipeName: extraction.recipe.recipeName,
    ingredientCount: extraction.recipe.ingredients.length,
    instructionCount: extraction.recipe.instructions?.length ?? 0,
    confidence: extraction.recipe.confidence,
    qualityWarnings: extraction.recipe.qualityWarnings,
  });
  return extraction.recipe;
}

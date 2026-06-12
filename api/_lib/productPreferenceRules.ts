export type ProductPreferenceRule = {
  queryTerms: string[];
  preferTerms?: string[];
  avoidTerms?: string[];
  preferredUnitPatterns?: RegExp[];
  score: number;
};

const normalizePreferenceText = (value: string) =>
  value
    .toLocaleLowerCase("sv-SE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9%/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const containsAny = (value: string, terms: string[]) =>
  terms.some((term) => value.includes(term));

const RECEIPT_INFORMED_RULES: ProductPreferenceRule[] = [
  {
    queryTerms: ["mjolk", "graddfil", "creme fraiche", "yoghurt", "filmjolk", "kvarg"],
    preferTerms: ["latt", "1 5%", "laktosfri", "lfri", "l f", "l/f", "1 5l"],
    score: 4,
  },
  {
    queryTerms: ["mjolk"],
    avoidTerms: ["lang hallbarhet", "uht"],
    score: -5,
  },
  {
    queryTerms: ["penne", "fusilli", "spaghetti", "makaron", "conchiglie", "pasta"],
    preferTerms: ["fullkorn"],
    score: 3,
  },
  {
    queryTerms: ["penne", "fusilli", "spaghetti", "makaron", "conchiglie", "pasta"],
    avoidTerms: ["carbonara", "fardigratt", "redo", "fardigmat"],
    score: -30,
  },
  {
    queryTerms: ["gurka"],
    preferTerms: ["sverige"],
    preferredUnitPatterns: [/\b(?:st|styck)\b/i],
    score: 5,
  },
  {
    queryTerms: ["falukorv"],
    preferTerms: ["ring"],
    preferredUnitPatterns: [/\b800\s*g\b/i],
    score: 7,
  },
  {
    queryTerms: ["blandfars"],
    preferTerms: ["50/50", "50 50"],
    score: 7,
  },
];

export const receiptInformedPreferenceScore = (
  query: string,
  productName: string,
  unitLabel: string,
) => {
  const normalizedQuery = normalizePreferenceText(query);
  const normalizedProduct = normalizePreferenceText(productName);
  let score = 0;

  for (const rule of RECEIPT_INFORMED_RULES) {
    if (!containsAny(normalizedQuery, rule.queryTerms)) continue;
    if (rule.preferTerms && containsAny(normalizedProduct, rule.preferTerms)) {
      score += rule.score;
    }
    if (rule.avoidTerms && containsAny(normalizedProduct, rule.avoidTerms)) {
      score += rule.score;
    }
    if (rule.preferredUnitPatterns?.some((pattern) => pattern.test(unitLabel))) {
      score += rule.score;
    }
  }

  const eggQuery = /\bagg\b/.test(normalizedQuery);
  if (eggQuery) {
    const packMatch = `${productName} ${unitLabel}`.match(/\b(\d+)\s*(?:p|pack|st)\b/i);
    const packSize = packMatch ? Number(packMatch[1]) : undefined;
    if (packSize && [10, 15].includes(packSize)) score += 12;
    else if (packSize && [6, 12].includes(packSize)) score += 6;
    else if (packSize && packSize >= 24) score -= 12;

    const requestsEco = /\beko(?:logisk)?\b/.test(normalizedQuery);
    const isEcoOrPremium = /\b(?:eko|ekologisk|premium)\b/.test(normalizedProduct);
    if (requestsEco && isEcoOrPremium) score += 8;
    else if (!requestsEco && isEcoOrPremium) score -= 3;
  }

  const requestsStandardDairy = /\b(?:standard|fullfet|helfet)\b/.test(
    normalizedQuery,
  );
  if (
    requestsStandardDairy &&
    containsAny(normalizedProduct, ["latt", "1 5%", "laktosfri", "lfri", "l f", "l/f", "1 5l"])
  ) {
    score -= 8;
  }

  if (/\bpotatis\b/.test(normalizedQuery)) {
    if (/\bmjolig\b/.test(normalizedQuery) && /\bmjolig\b/.test(normalizedProduct)) {
      score += 10;
    }
    if (/\bfast\b/.test(normalizedQuery) && /\bfast\b/.test(normalizedProduct)) {
      score += 10;
    }
    const packageMatch = `${productName} ${unitLabel}`.match(/\b(\d+(?:[.,]\d+)?)\s*kg\b/i);
    const kilos = packageMatch ? Number(packageMatch[1].replace(",", ".")) : undefined;
    if (!/\b(?:storpack|bulk)\b/.test(normalizedQuery) && kilos) {
      if (kilos <= 3) score += 4;
      else if (kilos >= 5) score -= 8;
    }
  }

  if (/\bmorot/.test(normalizedQuery)) {
    const packageMatch = `${productName} ${unitLabel}`.match(/\b(500\s*g|1\s*kg)\b/i);
    if (packageMatch) score += 5;
  }

  if (/\bgurka\b/.test(normalizedQuery) && /\b(?:st|styck)\b/i.test(unitLabel)) {
    score += 6;
  }

  const pastaFormats = ["penne", "fusilli", "spaghetti", "makaron", "conchiglie"];
  const requestedFormat = pastaFormats.find((format) => normalizedQuery.includes(format));
  if (requestedFormat && normalizedProduct.startsWith(requestedFormat)) score += 10;
  if (requestedFormat && normalizedProduct.includes(`med ${requestedFormat} pasta`)) score -= 12;

  return score;
};

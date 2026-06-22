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

const containsAnyWord = (value: string, terms: string[]) =>
  terms.some((term) => new RegExp(`\\b${term}\\b`).test(value));

const SIMPLE_PRODUCE_TERMS = [
  "apple",
  "apelsin",
  "banan",
  "citron",
  "gurka",
  "kiwi",
  "lime",
  "lok",
  "morot",
  "paron",
  "paprika",
  "potatis",
  "tomat",
  "avokado",
  "vitlok",
];

const SIMPLE_PRODUCE_PROCESSED_TERMS = [
  "barnmat",
  "barnsnacks",
  "bar",
  "chips",
  "dessert",
  "drickyoghurt",
  "dryck",
  "essens",
  "fruktmellis",
  "fruktsmoothie",
  "fruktstang",
  "godis",
  "godispase",
  "grot",
  "grotsmoothie",
  "choklad",
  "inlagd",
  "juice",
  "kaka",
  "kex",
  "krossade",
  "marmelad",
  "mellis",
  "nektar",
  "passerade",
  "pure",
  "smoothie",
  "snacks",
  "sylt",
  "tomatpure",
  "tonic",
  "proteinbar",
];

const RECEIPT_INFORMED_RULES: ProductPreferenceRule[] = [
  {
    queryTerms: [
      "mjolk",
      "graddfil",
      "creme fraiche",
      "yoghurt",
      "filmjolk",
      "kvarg",
    ],
    preferTerms: ["latt", "1 5%", "laktosfri", "lfri", "l f", "l/f", "1 5l"],
    score: 4,
  },
  {
    queryTerms: ["mjolk"],
    avoidTerms: ["lang hallbarhet", "uht"],
    score: -14,
  },
  {
    queryTerms: [
      "penne",
      "fusilli",
      "spaghetti",
      "makaron",
      "conchiglie",
      "pasta",
    ],
    preferTerms: ["fullkorn"],
    score: 3,
  },
  {
    queryTerms: [
      "penne",
      "fusilli",
      "spaghetti",
      "makaron",
      "conchiglie",
      "pasta",
    ],
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

export type ProductPreferenceEvaluation = {
  score: number;
  reasons: string[];
};

export const evaluateReceiptInformedPreference = (
  query: string,
  productName: string,
  unitLabel: string,
): ProductPreferenceEvaluation => {
  const normalizedQuery = normalizePreferenceText(query);
  const normalizedProduct = normalizePreferenceText(productName);
  const normalizedUnitLabel = normalizePreferenceText(unitLabel);
  let score = 0;
  const reasons: string[] = [];

  for (const rule of RECEIPT_INFORMED_RULES) {
    if (!containsAny(normalizedQuery, rule.queryTerms)) continue;
    if (rule.preferTerms && containsAny(normalizedProduct, rule.preferTerms)) {
      score += rule.score;
      reasons.push("receipt_preferred_variant");
    }
    if (rule.avoidTerms && containsAny(normalizedProduct, rule.avoidTerms)) {
      score += rule.score;
      reasons.push("avoided_prepared_or_special_product");
    }
    if (rule.preferredUnitPatterns?.some((pattern) => pattern.test(unitLabel))) {
      score += rule.score;
      reasons.push("receipt_preferred_size");
    }
  }

  const exactSimpleProduceQuery = SIMPLE_PRODUCE_TERMS.includes(normalizedQuery);
  if (exactSimpleProduceQuery) {
    const productAndUnit = `${normalizedProduct} ${normalizedUnitLabel}`;

    if (containsAnyWord(productAndUnit, SIMPLE_PRODUCE_PROCESSED_TERMS)) {
      score -= 28;
      reasons.push("avoided_processed_produce_product");
    }

    if (normalizedProduct.startsWith(normalizedQuery)) {
      score += 12;
      reasons.push("simple_produce_name_match");
    }

    if (/\bklass\s*1\b/.test(productAndUnit)) {
      score += 8;
      reasons.push("preferred_produce_class_1");
    } else if (/\bklass\s*2\b/.test(productAndUnit)) {
      score -= 8;
      reasons.push("avoided_lower_produce_class");
    }

    if (/\b(?:losvikt|kr\/kg|kg)\b/.test(productAndUnit)) {
      score += 6;
      reasons.push("preferred_weighted_produce");
    }

    if (/\bmerpack\b/.test(productAndUnit)) {
      score -= 6;
      reasons.push("avoided_prepacked_produce_when_unspecified");
    }
  }

  const eggQuery = /\bagg\b/.test(normalizedQuery);
  if (eggQuery) {
    const packMatch = `${productName} ${unitLabel}`.match(
      /\b(\d+)\s*(?:p|pack|st)\b/i,
    );
    const packSize = packMatch ? Number(packMatch[1]) : undefined;
    if (packSize && [10, 12, 15].includes(packSize)) {
      score += 14;
      reasons.push("egg_normal_pack");
    } else if (packSize === 6) {
      score += 5;
      reasons.push("egg_acceptable_pack");
    } else if (packSize && packSize >= 24) {
      score -= 18;
      reasons.push("avoided_bulk");
    }

    const requestsEco = /\beko(?:logisk)?\b/.test(normalizedQuery);
    const isEcoOrPremium = /\b(?:eko|ekologisk|premium)\b/.test(
      normalizedProduct,
    );
    if (requestsEco && isEcoOrPremium) {
      score += 8;
      reasons.push("requested_eco");
    } else if (!requestsEco && isEcoOrPremium) {
      score -= 5;
      reasons.push("avoided_unrequested_premium");
    }
  }

  const requestsStandardDairy = /\b(?:standard|fullfet|helfet)\b/.test(
    normalizedQuery,
  );
  if (
    requestsStandardDairy &&
    containsAny(normalizedProduct, [
      "latt",
      "1 5%",
      "laktosfri",
      "lfri",
      "l f",
      "l/f",
      "1 5l",
    ])
  ) {
    score -= 8;
    reasons.push("respected_standard_dairy");
  }

  if (/\bpotatis\b/.test(normalizedQuery)) {
    if (
      /\bmjolig\b/.test(normalizedQuery) &&
      /\bmjolig\b/.test(normalizedProduct)
    ) {
      score += 10;
      reasons.push("requested_potato_type");
    }
    if (
      /\bfast\b/.test(normalizedQuery) &&
      /\bfast\b/.test(normalizedProduct)
    ) {
      score += 10;
      reasons.push("requested_potato_type");
    }
    const packageMatch = `${productName} ${unitLabel}`.match(
      /\b(\d+(?:[.,]\d+)?)\s*kg\b/i,
    );
    const kilos = packageMatch
      ? Number(packageMatch[1].replace(",", "."))
      : undefined;
    if (!/\b(?:storpack|bulk)\b/.test(normalizedQuery) && kilos) {
      if (kilos <= 2) {
        score += 6;
        reasons.push("household_pack_size");
      } else if (kilos >= 5) {
        score -= 10;
        reasons.push("avoided_bulk");
      }
    }
  }

  if (/\bmorot/.test(normalizedQuery)) {
    const packageMatch = `${productName} ${unitLabel}`.match(
      /\b(500\s*g|1\s*kg)\b/i,
    );
    if (packageMatch) {
      score += 5;
      reasons.push("household_pack_size");
    }
  }

  if (
    /\bgurka\b/.test(normalizedQuery) &&
    /\b(?:st|styck)\b/i.test(unitLabel)
  ) {
    score += 6;
    reasons.push("single_cucumber");
  }

  if (/\bpaprika\b/.test(normalizedQuery) && /\b1\s*st\b/.test(normalizedQuery)) {
    const typicalWeight = unitLabel.match(
      /\bca\s*(\d+(?:[.,]\d+)?)\s*g\b/i,
    );
    const grams = typicalWeight
      ? Number(typicalWeight[1].replace(",", "."))
      : undefined;
    if (grams && grams >= 100 && grams <= 300) {
      score += 7;
      reasons.push("typical_piece_weight");
    }
  }

  const pastaFormats = [
    "penne",
    "fusilli",
    "spaghetti",
    "makaron",
    "conchiglie",
  ];
  const requestedFormat = pastaFormats.find((format) =>
    normalizedQuery.includes(format),
  );
  if (requestedFormat && normalizedProduct.startsWith(requestedFormat)) {
    score += 12;
    reasons.push("dry_pasta_format");
  }
  if (
    requestedFormat &&
    normalizedProduct.includes(`med ${requestedFormat} pasta`)
  ) {
    score -= 18;
    reasons.push("avoided_prepared_meal");
  }

  const dairyQuery =
    /\b(?:mjolk|graddfil|creme fraiche|yoghurt|filmjolk|kvarg)\b/.test(
      normalizedQuery,
    );
  if (dairyQuery) {
    const volumeMatch = `${productName} ${unitLabel}`.match(
      /\b(\d+(?:[.,]\d+)?)\s*(l|dl)\b/i,
    );
    if (volumeMatch) {
      const amount = Number(volumeMatch[1].replace(",", "."));
      const liters =
        volumeMatch[2].toLowerCase() === "dl" ? amount / 10 : amount;
      const isMilkLike = /\b(?:mjolk|filmjolk|yoghurt)\b/.test(normalizedQuery);
      if (isMilkLike && liters >= 1 && liters <= 1.5) {
        score += 6;
        reasons.push("household_pack_size");
      } else if (!isMilkLike && liters >= 0.2 && liters <= 0.5) {
        score += 5;
        reasons.push("household_pack_size");
      }
    }
  }

  const requestsPremium = /\b(?:eko|ekologisk|premium|lyx)\b/.test(normalizedQuery);
  if (
    !requestsPremium &&
    /\b(?:eko|ekologisk|premium|lyx)\b/.test(normalizedProduct) &&
    !reasons.includes("avoided_unrequested_premium")
  ) {
    score -= 5;
    reasons.push("avoided_unrequested_premium");
  }

  return { score, reasons: [...new Set(reasons)] };
};

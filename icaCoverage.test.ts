import assert from "node:assert/strict";
import test from "node:test";
import { calculateBasketPriceEstimate } from "./api/_lib/basketPricing";
import {
  clearIcaPricingCache,
  searchIcaProducts,
} from "./api/_lib/icaPricing";

const basketRows = [
  "ägg",
  "mjölk",
  "crème fraiche",
  "riven ost",
  "potatis",
  "morötter",
  "gul lök",
  "röd paprika",
  "citron",
  "blåbär",
  "basmatiris",
  "linser",
  "pasta",
  "bakpulver",
  "salt",
  "oregano",
  "basilika",
  "olivolja",
  "rapsolja",
  "balsamvinäger",
  "krossade tomater",
  "vetemjöl",
  "strösocker",
  "smör",
  "vispgrädde",
  "naturell yoghurt",
  "havregryn",
  "kaffe",
  "te",
  "knäckebröd",
  "formfranska",
  "banan",
  "äpple",
  "apelsin",
  "gurka",
  "tomat",
  "vitlök",
  "broccoli",
  "champinjoner",
  "kycklingfilé",
  "köttfärs",
  "falukorv",
  "laxfilé",
  "tonfisk",
  "majs",
  "frysta ärtor",
  "lingonsylt",
  "diskmedel",
  "toalettpapper",
  "schampo",
  "hundmat",
  "tändstickor",
  "aluminiumfolie",
] as const;

const missingRows = new Set([
  "frysta ärtor",
  "diskmedel",
  "toalettpapper",
  "schampo",
  "hundmat",
  "tändstickor",
  "aluminiumfolie",
]);

const mustPriceRows = [
  "ägg",
  "bakpulver",
  "balsamvinäger",
  "basmatiris",
  "blåbär",
  "citron",
  "crème fraiche",
  "mjölk",
  "potatis",
  "krossade tomater",
  "morötter",
  "gul lök",
  "riven ost",
  "röd paprika",
  "linser",
  "salt",
  "oregano",
  "basilika",
  "olivolja",
  "rapsolja",
] as const;

const productNames: Record<string, string> = {
  ägg: "Ägg Frigående 10-p ICA",
  mjölk: "Mellanmjölk 1,5% 1,5l ICA",
  "crème fraiche": "Crème Fraiche 34% 2dl ICA",
  "riven ost": "Riven Ost Pizza 150g ICA",
  potatis: "Potatis Fast 2kg Klass 1 ICA",
  morötter: "Morötter 1kg Klass 1 ICA",
  "gul lök": "Gul Lök 1kg Klass 1 ICA",
  "röd paprika": "Paprika Röd Klass 1 ICA",
  citron: "Citron Klass 1 ICA",
  basmatiris: "Basmatiris 1kg ICA",
  linser: "Röda Linser 500g ICA",
  pasta: "Penne Pasta 500g ICA",
  bakpulver: "Bakpulver 225g ICA",
  salt: "Fint Salt med Jod 1kg ICA",
  oregano: "Oregano 10g ICA",
  basilika: "Basilika 10g ICA",
  olivolja: "Olivolja Extra Virgin 500ml ICA",
  rapsolja: "Rapsolja 1l ICA",
  balsamvinäger: "Balsamvinäger 250ml ICA",
  "krossade tomater": "Krossade Tomater 500g ICA",
  vetemjöl: "Vetemjöl 2kg ICA",
  strösocker: "Strösocker 2kg ICA",
  smör: "Normalsaltat Smör 500g ICA",
  vispgrädde: "Vispgrädde 36% 5dl ICA",
  "naturell yoghurt": "Yoghurt Naturell 1kg ICA",
  havregryn: "Havregryn 1,5kg ICA",
  kaffe: "Bryggkaffe Mellanrost 450g ICA",
  te: "Svart Te Earl Grey 25-p ICA",
  knäckebröd: "Knäckebröd Husman 520g Wasabröd",
  formfranska: "Formfranska 700g ICA",
  banan: "Banan Eko Klass 1 ICA",
  äpple: "Äpple Royal Gala Klass 1 ICA",
  apelsin: "Apelsin Klass 1 ICA",
  gurka: "Gurka Klass 1 ICA",
  tomat: "Tomat Klass 1 ICA",
  vitlök: "Vitlök Klass 1 ICA",
  broccoli: "Broccoli 250g Klass 1 ICA",
  champinjoner: "Champinjoner 250g ICA",
  kycklingfilé: "Kycklingfilé 1kg ICA",
  köttfärs: "Köttfärs Nöt 12% 500g ICA",
  falukorv: "Falukorv 800g ICA",
  laxfilé: "Laxfilé 4-p Fryst ICA",
  tonfisk: "Tonfisk i Vatten 3-p ICA",
  majs: "Majs 340g ICA",
  lingonsylt: "Lingonsylt 800g ICA",
};

const normalize = (value: string) =>
  value.normalize("NFKC").toLocaleLowerCase("sv-SE").trim();

test("realistic ICA basket prices at least 40 of 53 common shopping rows", async () => {
  assert.equal(basketRows.length, 53);
  clearIcaPricingCache();
  const requestedPaths: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(input.toString());
    requestedPaths.push(`${url.pathname}?${url.searchParams.toString()}`);
    const query = normalize(
      url.searchParams.get("q") ?? url.searchParams.get("query") ?? "",
    );
    const htmlProducts = (keys: string[]) =>
      keys
        .map(
          (key) =>
            `<article><h2>${productNames[key]}</h2><p>1 st</p><span>Pris 29,95 kr</span></article>`,
        )
        .join("\n");
    const categoryProducts: Array<[string, string[]]> = [
      ["/categories/skafferi/kryddor", ["oregano", "basilika"]],
      ["/categories/skafferi/bakning", ["bakpulver"]],
      ["/categories/skafferi/olja-vinager", ["balsamvinäger"]],
      ["/categories/skafferi/konserver-tomat", ["krossade tomater"]],
      [
        "/categories/mejeri-ost/bf3acda4-568d-4aad-b971-4c5412307e95",
        ["mjölk"],
      ],
    ];
    const categoryMatch = categoryProducts.find(([path]) =>
      url.pathname.includes(path),
    );
    if (categoryMatch) {
      return new Response(
        htmlProducts(categoryMatch[1]),
        { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }
    if (
      query === "blåbär frysta" &&
      url.pathname.endsWith("/search")
    ) {
      return new Response(
        `<article><h2>Blåbär Frysta 500g ICA</h2><p>500 g</p><span>Pris 29,95 kr</span></article>`,
        { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }
    const aliasProducts: Record<string, string> = {
      "ägg 10-p": "ägg",
      "creme fraiche": "crème fraiche",
      "basmati ris": "basmatiris",
    };
    const directOnlyMisses = new Set([
      "ägg",
      "mjölk",
      "crème fraiche",
      "creme fraiche",
      "basmatiris",
      "blåbär",
      "bakpulver",
      "oregano",
      "basilika",
      "balsamvinäger",
      "krossade tomater",
    ]);
    const productKey =
      aliasProducts[query] ??
      (productNames[query] && !directOnlyMisses.has(query) ? query : "");
    const productName = productNames[productKey];

    return new Response(
      JSON.stringify({
        products: productName
          ? [
              {
                id: `fixture-${productKey}`,
                name: productName,
                price: "29:95 kr",
                size: "1 st",
              },
            ]
          : [],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  const searchProducts = (query: string, storeId?: string) =>
    searchIcaProducts(query, storeId, {
      fetchImpl,
      liveEnabled: true,
      now: () => 1_000,
    });

  const result = await calculateBasketPriceEstimate(
    {
      chain: "ica",
      storeId: "1004392",
      items: basketRows.map((name, index) => ({
        id: `shopping-row-${index}`,
        name,
        sourceTaskIds: [`source-task-${index}`],
      })),
    },
    {
      searchProducts,
      refreshSearchProducts: searchProducts,
    },
  );

  const pricedRows = result.matches
    .filter((match) => match.product)
    .map((match) => match.listItemName);
  const unpricedRows = result.matches
    .filter((match) => !match.product)
    .map((match) => match.listItemName);

  assert.ok(
    pricedRows.length >= 40,
    `Expected at least 40/53 priced rows, got ${pricedRows.length}. Missing: ${unpricedRows.join(", ")}`,
  );
  assert.deepEqual(unpricedRows.sort(), Array.from(missingRows).sort());
  for (const requiredRow of mustPriceRows) {
    assert.ok(pricedRows.includes(requiredRow), `${requiredRow} must receive a price`);
  }
  assert.ok(requestedPaths.some((path) => path.includes("q=%C3%A4gg+10-p")));
  assert.ok(requestedPaths.some((path) => path.includes("q=creme+fraiche")));
  assert.ok(requestedPaths.some((path) => path.includes("q=basmati+ris")));
  assert.ok(
    requestedPaths.some((path) =>
      path.includes("/categories/skafferi/kryddor"),
    ),
  );
  assert.ok(
    requestedPaths.some((path) => path.includes("bl%C3%A5b%C3%A4r+frysta")),
  );
  assert.ok(
    requestedPaths.some((path) =>
      path.includes("/categories/skafferi/konserver-tomat"),
    ),
  );
});

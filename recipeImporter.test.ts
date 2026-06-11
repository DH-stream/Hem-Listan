import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  extractRecipeFromHtml,
  importRecipeFromUrl,
  RecipeImportError,
  separateIngredientNote,
  validateRecipeUrl,
} from "./api/_lib/recipeImporter";

test("extracts and normalizes a JSON-LD Recipe with high confidence", () => {
  const html = `
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Recipe",
        "name": "Krämig lax – recept",
        "recipeIngredient": [
          "500 g laxfilé",
          "2½ dl grädde",
          "1/2 st citron",
          "salt och peppar"
        ],
        "recipeInstructions": [
          {"@type":"HowToStep","text":"<p>Blanda &amp; vispa.</p>"},
          {"@type":"HowToStep","name":"Grädda","text":"Ställ in i ugnen."}
        ]
      }
    </script>
  `;

  const result = extractRecipeFromHtml(html, new URL("https://www.ica.se/recept/lax"));

  assert.ok(result);
  assert.equal(result.recipeName, "Krämig lax – recept");
  assert.equal(result.mealName, "Krämig lax");
  assert.equal(result.extractionMethod, "json_ld");
  assert.equal(result.sourceDomain, "ica.se");
  assert.equal(result.confidence, "high");
  assert.deepEqual(result.qualityWarnings, []);
  assert.deepEqual(result.attemptedMethods, ["json_ld"]);
  assert.equal(result.usedFallback, false);
  assert.equal(result.canRetryWithAi, false);
  assert.deepEqual(result.ingredients[0], {
    rawText: "500 g laxfilé",
    text: "laxfilé",
    quantity: "500 g",
    category: "Kött & Fisk",
  });
  assert.equal(result.ingredients[1].quantity, "2½ dl");
  assert.equal(result.ingredients[2].quantity, "1/2 st");
  assert.deepEqual(result.instructions, [
    "Blanda & vispa.",
    "Grädda: Ställ in i ugnen.",
  ]);
});

test("flattens JSON-LD HowToSection instructions in order", () => {
  const html = `
    <script type="application/ld+json">
      {
        "@type": "Recipe",
        "name": "Bröd",
        "recipeIngredient": ["5 dl mjöl", "2 dl vatten", "1 tsk salt"],
        "recipeInstructions": [
          {
            "@type": "HowToSection",
            "name": "Deg",
            "itemListElement": [
              {"@type":"HowToStep","text":"Blanda degen."},
              {"@type":"HowToStep","text":"Låt jäsa."}
            ]
          },
          {"@type":"HowToStep","text":"Grädda brödet."}
        ]
      }
    </script>
  `;

  const result = extractRecipeFromHtml(html, new URL("https://recept.example/brod"));

  assert.ok(result);
  assert.deepEqual(result.instructions, [
    "Blanda degen.",
    "Låt jäsa.",
    "Grädda brödet.",
  ]);
});

test("uses a supported-site embedded data fallback when JSON-LD is absent", () => {
  const html = `
    <html>
      <head><meta property="og:title" content="Pasta med tomat | Köket.se"></head>
      <body>
        <script id="__NEXT_DATA__" type="application/json">
          {"props":{"recipe":{"ingredients":[
            {"amount":"400", "unit":"g", "name":"pasta"},
            {"amount":"1", "unit":"burk", "name":"krossade tomater"},
            {"amount":"1", "unit":"st", "name":"gul lök"}
          ]}}}
        </script>
      </body>
    </html>
  `;

  const result = extractRecipeFromHtml(html, new URL("https://www.koket.se/pasta"));

  assert.ok(result);
  assert.equal(result.extractionMethod, "site_adapter");
  assert.equal(result.confidence, "high");
  assert.equal(result.ingredients.length, 3);
  assert.deepEqual(result.attemptedMethods, ["json_ld", "site_adapter"]);
  assert.equal(result.usedFallback, true);
  assert.equal(result.canRetryWithAi, false);
});

test("marks a one-ingredient import as low confidence", () => {
  const html = `
    <script type="application/ld+json">
      {"@type":"Recipe","name":"Enkel rätt","recipeIngredient":["1 st avokado"]}
    </script>
  `;

  const result = extractRecipeFromHtml(html, new URL("https://www.arla.se/recept/enkel"));

  assert.ok(result);
  assert.equal(result.confidence, "low");
  assert.match(result.qualityWarnings.join(" "), /Färre än tre/);
  assert.deepEqual(result.attemptedMethods, [
    "json_ld",
    "site_adapter",
    "dom_fallback",
    "text_section_fallback",
  ]);
  assert.equal(result.usedFallback, false);
  assert.equal(result.canRetryWithAi, true);
});

test("returns null when no ingredients can be found", () => {
  const result = extractRecipeFromHtml(
    "<html><head><title>Bara en sida</title></head><body></body></html>",
    new URL("https://www.ica.se/utan-recept"),
  );

  assert.equal(result, null);
});

test("rejects invalid and local URLs", () => {
  assert.throws(
    () => validateRecipeUrl("not a url"),
    (error) =>
      error instanceof RecipeImportError && error.code === "invalid_url",
  );
  assert.throws(() => validateRecipeUrl("http://localhost/recipe"), /kan inte hämtas/);
  assert.throws(() => validateRecipeUrl("http://[::1]/recipe"), /kan inte hämtas/);
  assert.throws(() => validateRecipeUrl("http://[fc00::1]/recipe"), /kan inte hämtas/);
  assert.throws(() => validateRecipeUrl("http://[fd00::1]/recipe"), /kan inte hämtas/);
  assert.throws(() => validateRecipeUrl("http://[fe80::1]/recipe"), /kan inte hämtas/);
  assert.throws(() => validateRecipeUrl("file:///tmp/recipe"), /http- eller https/);
});

test("uses a simple DOM fallback when embedded JSON is unavailable", () => {
  const html = `
    <html>
      <head><title>Tomatsallad</title></head>
      <body>
        <ul>
          <li itemprop="recipeIngredient">3 st tomater</li>
          <li itemprop="recipeIngredient">1 st rödlök</li>
          <li itemprop="recipeIngredient">2 msk olivolja</li>
        </ul>
      </body>
    </html>
  `;

  const result = extractRecipeFromHtml(html, new URL("https://recept.example/tomatsallad"));

  assert.ok(result);
  assert.equal(result.extractionMethod, "dom_fallback");
  assert.equal(result.confidence, "high");
  assert.equal(result.ingredients.length, 3);
  assert.deepEqual(result.attemptedMethods, ["json_ld", "dom_fallback"]);
  assert.equal(result.usedFallback, true);
});

test("extracts the Coop parmesanpotatis recipe from encoded component data", () => {
  const html = readFileSync(
    new URL("./test-fixtures/coop-parmesanpotatis.html", import.meta.url),
    "utf8",
  );

  const result = extractRecipeFromHtml(
    html,
    new URL(
      "https://www.coop.se/recept/lunch-pa-4-minuter/parmesanpotatis-med-kallrokt-lax/",
    ),
  );

  assert.ok(result);
  assert.equal(result.extractionMethod, "site_adapter");
  assert.equal(result.confidence, "high");
  assert.deepEqual(result.attemptedMethods, [
    "json_ld",
    "site_adapter",
    "coop_adapter",
  ]);
  assert.deepEqual(
    result.ingredients.map((ingredient) => ingredient.rawText),
    [
      "ca 8 kokta potatisar",
      "1 msk olivolja",
      "1 dl finriven parmesan",
      "flingsalt",
      "1 dl crème fraiche",
      "1 citron, finrivet skal och saft",
      "30 g grönkål",
      "½ msk olivolja",
      "200 g kallrökt lax",
      "salt och peppar",
    ],
  );
  assert.ok(
    result.ingredients.every(
      (ingredient) => !ingredient.rawText?.includes("Sätt ugnen"),
    ),
  );
});

test("uses only the conservative Swedish ingredient text section", () => {
  const html = `
    <html>
      <head><title>Enkel gryta</title></head>
      <body>
        <h2>Ingredienser</h2>
        <p>2 st morötter</p>
        <p>1 st gul lök</p>
        <p>4 dl buljong</p>
        <h2>Gör så här</h2>
        <p>Hacka morötterna och löken.</p>
        <p>Koka allt i 20 minuter.</p>
      </body>
    </html>
  `;

  const result = extractRecipeFromHtml(
    html,
    new URL("https://recept.example/enkel-gryta"),
  );

  assert.ok(result);
  assert.equal(result.extractionMethod, "text_section_fallback");
  assert.equal(result.confidence, "medium");
  assert.deepEqual(
    result.ingredients.map((ingredient) => ingredient.rawText),
    ["2 st morötter", "1 st gul lök", "4 dl buljong"],
  );
  assert.ok(
    result.ingredients.every(
      (ingredient) =>
        !ingredient.rawText?.includes("Hacka") &&
        !ingredient.rawText?.includes("Koka"),
    ),
  );
});

test("accepts supported Swedish recipe domains for embedded recipe data", () => {
  const html = `
    <script type="application/json">
      {"recipe":{"ingredients":["1 st tomat","2 st ägg","3 dl mjölk"]}}
    </script>
  `;
  const domains = [
    "coop.se",
    "tasteline.com",
    "recepten.se",
    "landleyskok.se",
    "undertian.com",
    "zeinas.se",
    "valio.se",
  ];

  for (const domain of domains) {
    const result = extractRecipeFromHtml(
      html,
      new URL(`https://${domain}/recept`),
    );
    assert.ok(result, domain);
    assert.equal(result.extractionMethod, "site_adapter", domain);
  }
});

const recipeHtml = `
  <script type="application/ld+json">
    {"@type":"Recipe","name":"Redirect-recept","recipeIngredient":[
      "1 st tomat", "2 st ägg", "3 dl mjölk"
    ]}
  </script>
`;

test("rejects a redirect to localhost before fetching the target", async (t) => {
  const fetchedUrls: string[] = [];
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = input.toString();
    fetchedUrls.push(url);
    return new Response(null, {
      status: 302,
      headers: { Location: "http://localhost/internal" },
    });
  });

  await assert.rejects(
    importRecipeFromUrl("https://public.example/recipe"),
    (error) =>
      error instanceof RecipeImportError && error.code === "unsafe_redirect",
  );
  assert.deepEqual(fetchedUrls, ["https://public.example/recipe"]);
});

test("rejects a redirect to private IPv4 before fetching the target", async (t) => {
  const fetchedUrls: string[] = [];
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = input.toString();
    fetchedUrls.push(url);
    return new Response(null, {
      status: 302,
      headers: { Location: "http://127.0.0.1:3000/internal" },
    });
  });

  await assert.rejects(
    importRecipeFromUrl("https://public.example/recipe"),
    (error) =>
      error instanceof RecipeImportError && error.code === "unsafe_redirect",
  );
  assert.deepEqual(fetchedUrls, ["https://public.example/recipe"]);
});

test("rejects internal IPv6 redirects before fetching the target", async (t) => {
  for (const location of [
    "http://[::1]/internal",
    "http://[fd00::1]/internal",
    "http://[fe80::1]/internal",
  ]) {
    const fetchedUrls: string[] = [];
    t.mock.method(globalThis, "fetch", async (input) => {
      fetchedUrls.push(input.toString());
      return new Response(null, {
        status: 302,
        headers: { Location: location },
      });
    });

    await assert.rejects(
      importRecipeFromUrl("https://public.example/recipe"),
      (error) =>
        error instanceof RecipeImportError && error.code === "unsafe_redirect",
    );
    assert.deepEqual(fetchedUrls, ["https://public.example/recipe"]);
    t.mock.restoreAll();
  }
});

test("follows a validated public redirect and uses the final source URL", async (t) => {
  const fetchedUrls: string[] = [];
  t.mock.method(globalThis, "fetch", async (input, init) => {
    const url = input.toString();
    fetchedUrls.push(url);
    assert.equal(init?.redirect, "manual");

    if (url === "https://public.example/recipe") {
      return new Response(null, {
        status: 302,
        headers: { Location: "https://recipes.example/final" },
      });
    }

    return new Response(recipeHtml, {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  });

  const result = await importRecipeFromUrl("https://public.example/recipe");

  assert.deepEqual(fetchedUrls, [
    "https://public.example/recipe",
    "https://recipes.example/final",
  ]);
  assert.equal(result.sourceUrl, "https://recipes.example/final");
  assert.equal(result.sourceDomain, "recipes.example");
});

test("fails after three redirects without fetching a fourth target", async (t) => {
  const fetchedUrls: string[] = [];
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = input.toString();
    fetchedUrls.push(url);
    const redirectNumber = fetchedUrls.length;
    return new Response(null, {
      status: 302,
      headers: { Location: `/redirect-${redirectNumber}` },
    });
  });

  await assert.rejects(
    importRecipeFromUrl("https://public.example/recipe"),
    (error) =>
      error instanceof RecipeImportError &&
      error.code === "too_many_redirects",
  );
  assert.deepEqual(fetchedUrls, [
    "https://public.example/recipe",
    "https://public.example/redirect-1",
    "https://public.example/redirect-2",
    "https://public.example/redirect-3",
  ]);
});

test("returns retry metadata for a page with no recipe", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    new Response("<html><body>Ingen receptdata</body></html>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    }),
  );

  await assert.rejects(
    importRecipeFromUrl("https://public.example/not-a-recipe"),
    (error) => {
      assert.ok(error instanceof RecipeImportError);
      assert.equal(error.code, "no_recipe_found");
      assert.equal(error.canRetryWithAi, true);
      assert.deepEqual(error.attemptedMethods, [
        "json_ld",
        "dom_fallback",
        "text_section_fallback",
      ]);
      return true;
    },
  );
});

test("separates conservative preparation notes from purchasable ingredient names", () => {
  assert.deepEqual(separateIngredientNote("hallon i ljummet vatten"), {
    text: "hallon",
    note: "i ljummet vatten",
  });
  assert.deepEqual(separateIngredientNote("vitlöksklyftor, finhackade"), {
    text: "vitlöksklyftor",
    note: "finhackade",
  });
  assert.deepEqual(separateIngredientNote("citron, rivet skal och saft"), {
    text: "citron",
    note: "rivet skal och saft",
  });
  assert.deepEqual(separateIngredientNote("riven parmesanost"), {
    text: "riven parmesanost",
  });
  assert.deepEqual(
    separateIngredientNote("färska eller tinade frysta hallon (Obs! se tips vid frysta hallon)"),
    {
      text: "hallon",
      note: "Färska eller frysta. Obs! se tips vid frysta hallon",
    },
  );
  const thawedBlueberries = separateIngredientNote("tinade frysta blåbär");
  assert.equal(thawedBlueberries.text, "frysta blåbär");
  assert.doesNotMatch(thawedBlueberries.text, /tinade/i);
});

test("keeps raw ingredient text and extracts recipe image metadata", () => {
  const html = `
    <script type="application/ld+json">
      {
        "@type": "Recipe",
        "name": "Hallondessert",
        "image": {"url": "/images/hallon.jpg"},
        "recipeIngredient": [
          "100 g hallon i ljummet vatten",
          "2 vitlöksklyftor, finhackade",
          "1 citron, rivet skal och saft",
          "225 g färska eller tinade frysta hallon (Obs! se tips vid frysta hallon)"
        ]
      }
    </script>
  `;

  const result = extractRecipeFromHtml(html, new URL("https://recept.example/hallon"));

  assert.ok(result);
  assert.equal(result.imageUrl, "https://recept.example/images/hallon.jpg");
  assert.deepEqual(result.ingredients[0], {
    rawText: "100 g hallon i ljummet vatten",
    text: "hallon",
    quantity: "100 g",
    category: "Övrigt",
    note: "i ljummet vatten",
  });
  assert.equal(result.ingredients[1].text, "vitlöksklyftor");
  assert.equal(result.ingredients[1].note, "finhackade");
  assert.equal(result.ingredients[2].text, "citron");
  assert.equal(result.ingredients[2].note, "rivet skal och saft");
  assert.equal(result.ingredients[3].text, "hallon");
  assert.equal(result.ingredients[3].quantity, "225 g");
  assert.match(result.ingredients[3].note ?? "", /Färska eller frysta/);
  assert.match(result.ingredients[3].note ?? "", /Obs! se tips vid frysta hallon/);
});

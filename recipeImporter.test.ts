import assert from "node:assert/strict";
import test from "node:test";
import {
  extractRecipeFromHtml,
  importRecipeFromUrl,
  validateRecipeUrl,
} from "./recipeImporter";

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
  assert.deepEqual(result.ingredients[0], {
    text: "laxfilé",
    quantity: "500 g",
    category: "Kött & Fisk",
  });
  assert.equal(result.ingredients[1].quantity, "2½ dl");
  assert.equal(result.ingredients[2].quantity, "1/2 st");
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
});

test("returns null when no ingredients can be found", () => {
  const result = extractRecipeFromHtml(
    "<html><head><title>Bara en sida</title></head><body></body></html>",
    new URL("https://www.ica.se/utan-recept"),
  );

  assert.equal(result, null);
});

test("rejects invalid and local URLs", () => {
  assert.throws(() => validateRecipeUrl("not a url"), /giltig receptlänk/);
  assert.throws(() => validateRecipeUrl("http://localhost/recipe"), /kan inte hämtas/);
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
    /kan inte hämtas/,
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
    /kan inte hämtas/,
  );
  assert.deepEqual(fetchedUrls, ["https://public.example/recipe"]);
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
    /för många gånger/,
  );
  assert.deepEqual(fetchedUrls, [
    "https://public.example/recipe",
    "https://public.example/redirect-1",
    "https://public.example/redirect-2",
    "https://public.example/redirect-3",
  ]);
});

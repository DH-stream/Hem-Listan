import assert from "node:assert/strict";
import test from "node:test";
import {
  clearIcaPricingCache,
  parseIcaHtmlProducts,
  searchIcaProducts,
} from "./api/_lib/icaPricing";

test("parses ICA HTML product cards with normal prices", () => {
  const products = parseIcaHtmlProducts(
    `
      <article>
        <img alt="Mellanmjölk Lite längre hållbarhet 1,5% 1,5l ICA" />
        <h2>Mellanmjölk Lite längre hållbarhet 1,5% 1,5l ICA</h2>
        <p>1.5L (15,30 kr/l), Sverige</p>
        <span>Pris 22,95 kr</span>
        <button>Lägg till</button>
      </article>
    `,
    "mjölk",
    "1004554",
    "2026-06-17T00:00:00.000Z",
  );

  assert.equal(products.length, 1);
  assert.equal(products[0].productName, "Mellanmjölk Lite längre hållbarhet 1,5% 1,5l ICA");
  assert.equal(products[0].priceSek, 22.95);
  assert.equal(products[0].comparePrice, "15,30 kr/l");
});

test("parses ICA HTML weighted ca prices", () => {
  const products = parseIcaHtmlProducts(
    `
      <a href="/stores/1004554/products/banan-eko">
        <img alt="Banan Eko ca 180g Klass 1 ICA" />
        <span>Banan Eko ca 180g Klass 1 ICA</span>
        <p>0.18kg (29,95 kr/kg)</p>
        <span>Pris Ca Ca 5,38 kr</span>
      </a>
    `,
    "banan",
    "1004554",
    "2026-06-17T00:00:00.000Z",
  );

  assert.equal(products.length, 1);
  assert.equal(products[0].productName, "Banan Eko ca 180g Klass 1 ICA");
  assert.equal(products[0].priceSek, 5.38);
  assert.equal(products[0].comparePrice, "29,95 kr/kg");
});

test("uses ICA ordinary price for multi-buy HTML offers", () => {
  const products = parseIcaHtmlProducts(
    `
      <article>
        <img alt="Penne Rigate 500g ICA" />
        <h2>Penne Rigate 500g ICA</h2>
        <span>Pris 3 för 25 kr</span>
        <span>Ord.pris 12,77 kr/st</span>
        <p>0.5kg, (Ord jmf 25,54 kr/kg)</p>
      </article>
    `,
    "penne",
    "1003614",
    "2026-06-17T00:00:00.000Z",
  );

  assert.equal(products.length, 1);
  assert.equal(products[0].priceSek, 12.77);
});

test("does not interpret ICA multi-buy offer count as a product price", () => {
  const products = parseIcaHtmlProducts(
    `
      <article>
        <img alt="Nudlar Kycklingsmak 85g Samyang" />
        <h2>Nudlar Kycklingsmak 85g Samyang</h2>
        <span>Pris 10 för 40 kr</span>
        <p>0.085kg, (Ord jmf 70,00 kr/kg)</p>
      </article>
    `,
    "nudlar",
    "1004694",
    "2026-06-17T00:00:00.000Z",
  );

  assert.equal(products.length, 0);
});

test("ICA search tries query-matched category fallback before generic HTML fallbacks", async () => {
  clearIcaPricingCache();
  const requestedUrls: string[] = [];

  const products = await searchIcaProducts("mjölk", "1004554", {
    liveEnabled: true,
    now: () => 0,
    fetchImpl: async (input) => {
      requestedUrls.push(input.toString());
      if (requestedUrls.length <= 3) {
        return new Response(JSON.stringify({ products: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(
        `
          <article>
            <img alt="Mellanmjölk Lite längre hållbarhet 1,5% 1,5l ICA" />
            <h2>Mellanmjölk Lite längre hållbarhet 1,5% 1,5l ICA</h2>
            <p>1.5L (15,30 kr/l), Sverige</p>
            <span>Pris 22,95 kr</span>
          </article>
        `,
        { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
      );
    },
  });

  assert.equal(products.length, 1);
  assert.equal(products[0].chainId, "ica");
  assert.equal(products[0].priceSek, 22.95);
  assert.ok(
    requestedUrls.some((url) => {
      const requestedUrl = new URL(url);
      return (
        requestedUrl.pathname ===
          "/stores/1004554/categories/mejeri-ost/bf3acda4-568d-4aad-b971-4c5412307e95" &&
        requestedUrl.searchParams.get("sortBy") === "favorite"
      );
    }),
  );
});

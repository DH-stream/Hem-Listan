import assert from "node:assert/strict";
import test from "node:test";
import type { ProductPrice } from "./src/lib/pricing/types";
import { matchListItem } from "./api/_lib/pricingMatching";

const product = (
  overrides: Partial<ProductPrice> & Pick<ProductPrice, "id" | "productName">,
): ProductPrice => ({
  chainId: "ica",
  storeId: "1004392",
  priceSek: 10,
  unitLabel: "(10,00 kr/kg)",
  searchTerms: [overrides.productName],
  ...overrides,
});

test("plain apple prefers class 1 loose fruit over class 2 merpack", () => {
  const products: ProductPrice[] = [
    product({
      id: "class-2-merpack",
      productName: "Äpple Merpack 1kg Klass 2 ICA",
      priceSek: 14.5,
      unitLabel: "(14,50 kr/kg)",
    }),
    product({
      id: "class-1-loose",
      productName: "Äpple Klass 1 ICA",
      priceSek: 25.5,
      unitLabel: "Lösvikt (25,50 kr/kg)",
    }),
  ];

  assert.equal(
    matchListItem({ id: "apple", name: "äpple" }, products).product?.id,
    "class-1-loose",
  );
});

test("plain banana prefers raw produce over baby snacks and smoothies", () => {
  const products: ProductPrice[] = [
    product({
      id: "baby-snack",
      productName: "Barnsnacks Banan jordgubb Ekologisk 8m 20g ICA I love eco",
      priceSek: 9.92,
      unitLabel: "(496,00 kr/kg)",
    }),
    product({
      id: "smoothie",
      productName: "Grötsmoothie jordgubb, banan, havre & dinkel 6m 120g ICA I love eco",
      priceSek: 10.85,
      unitLabel: "(90,42 kr/kg)",
    }),
    product({
      id: "banana",
      productName: "Banan Eko ca 180g Klass 1 ICA",
      priceSek: 47.39,
      unitLabel: "CA 180G (47,39 kr/kg)",
    }),
  ];

  assert.equal(
    matchListItem({ id: "banana", name: "banan" }, products).product?.id,
    "banana",
  );
});

test("plain tomato prefers fresh tomato over crushed or puree products", () => {
  const products: ProductPrice[] = [
    product({
      id: "crushed",
      productName: "Krossade Tomater 500g ICA",
      priceSek: 12.95,
      unitLabel: "500 g",
      searchTerms: ["Krossade Tomater", "tomat"],
    }),
    product({
      id: "puree",
      productName: "Tomatpuré 200g ICA",
      priceSek: 15.95,
      unitLabel: "200 g",
      searchTerms: ["Tomatpuré", "tomat"],
    }),
    product({
      id: "fresh",
      productName: "Tomat Klass 1 ICA",
      priceSek: 39.95,
      unitLabel: "Lösvikt (39,95 kr/kg)",
      searchTerms: ["Tomat Klass 1 ICA"],
    }),
  ];

  assert.equal(
    matchListItem({ id: "tomato", name: "tomat" }, products).product?.id,
    "fresh",
  );
});

test("plain citron prefers fresh citrus over drink mixers", () => {
  const products: ProductPrice[] = [
    product({
      id: "tonic",
      productName: "Citron Tonic 1l",
      priceSek: 18.95,
      unitLabel: "1 l",
      searchTerms: ["Citron Tonic"],
    }),
    product({
      id: "fresh",
      productName: "Citron Klass 1 ICA",
      priceSek: 5.95,
      unitLabel: "1 st",
      searchTerms: ["Citron Klass 1 ICA"],
    }),
  ];

  assert.equal(
    matchListItem({ id: "lemon", name: "citron" }, products).product?.id,
    "fresh",
  );
});

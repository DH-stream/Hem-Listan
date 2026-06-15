import assert from "node:assert/strict";
import test from "node:test";
import type { RecipeIngredient, TaskItem } from "./src/types";
import {
  categorizeGroceryItem,
  inferCategoryFromCityGrossProduct,
} from "./src/lib/grocery/categorize";
import type { ProductPrice } from "./src/lib/pricing/types";
import { buildGroceryMergePlan } from "./src/lib/grocery/merge";
import {
  normalizeRecipeIngredient,
  normalizeShoppingItemNameForStore,
} from "./src/lib/grocery/normalize";

const ingredient = (text: string, quantity = ""): RecipeIngredient => ({
  text,
  quantity,
  category: "Övrigt",
});
const task = (text: string, checked = false, notes = "Övrigt", id = text): TaskItem => ({
  id,
  text,
  checked,
  notes,
});
const plan = (tasks: TaskItem[], ingredients: RecipeIngredient[]) =>
  buildGroceryMergePlan(tasks, ingredients, index => `new-${index}`);

test("removes clear preparation prefixes from imported shopping item names", () => {
  const cases = [
    ["Kokta potatisar", "Potatis"],
    ["Kokt potatis", "Potatis"],
    ["Kokade potatisar", "Potatis"],
    ["Hackad gul lök", "Gul lök"],
    ["Hackade morötter", "Morötter"],
    ["Skivad gurka", "Gurka"],
    ["Tärnad potatis", "Potatis"],
  ] as const;

  for (const [name, expected] of cases) {
    assert.equal(normalizeShoppingItemNameForStore(name), expected);
  }
});

test("preserves purchasable product forms in imported shopping item names", () => {
  for (const name of [
    "Riven parmesan",
    "Strimlade soltorkade tomater",
    "Krossade tomater",
    "Kallrökt lax",
    "Rimmat sidfläsk",
    "Hackade tomater",
  ]) {
    assert.equal(normalizeShoppingItemNameForStore(name), name);
  }
});

test("uses store-friendly names when recipe ingredients become list items", () => {
  assert.equal(
    plan([], [ingredient("Kokta potatisar")]).tasks[0].text,
    "Potatis",
  );
  assert.equal(plan([], [ingredient("Skivad gurka")]).tasks[0].text, "Gurka");
});

test("Arla Standardmjölk merges into existing milk and keeps required quantity", () => {
  const result = plan([task("Mjölk", false, "Mejeri")], [ingredient("Arla Ko® Standardmjölk", "6 dl")]);
  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].text, "Mjölk (6 dl)");
  assert.equal(result.updates.length, 1);
});

test("merges persisted milk quantities into the required shopping amount", () => {
  const result = plan([task("Mjölk (1 l)", false, "Mejeri")], [ingredient("Mjölk", "1 l")]);
  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].text, "Mjölk (2 l)");
});

test("merges a bare lemon with one imported lemon as two pieces", () => {
  const result = plan(
    [task("Citron", false, "Frukt & Grönt")],
    [ingredient("Citron", "1 st")],
  );
  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].text, "Citron (2 st)");
});

test("merges persisted cream quantities", () => {
  const result = plan([task("Vispgrädde (5 dl)", false, "Mejeri")], [ingredient("Vispgrädde", "1 dl")]);
  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].text, "Vispgrädde (6 dl)");
});

test("keeps persisted package quantities when adding more of the same item", () => {
  const result = plan([task("Mjölk (2 l)", false, "Mejeri")], [ingredient("Mjölk", "2 dl")]);
  assert.equal(result.tasks[0].text, "Mjölk (2,2 l)");
});

test("normalizes Arla Smör- & rapsolja", () => {
  assert.equal(normalizeRecipeIngredient(ingredient("Arla Köket® Smör- & rapsolja, till stekning", "3 msk")).name, "smör- & rapsolja");
});

test("garlic clove and Vitlök Vanlig merge without an exact quantity", () => {
  const result = plan([task("Vitlöksklyfta", false, "Frukt & Grönt")], [ingredient("Vitlök Vanlig", "3 klyfta")]);
  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].text, "Vitlök");
});

test("ground black pepper merges and hides quantities", () => {
  const result = plan([task("Svartpeppar", false, "Skafferi")], [ingredient("Svartpeppar Malen", "1 krm")]);
  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].text, "Svartpeppar");
});

test("cream quantities sum to the exact required amount", () => {
  const result = plan([], [ingredient("Vispgrädde", "2 dl"), ingredient("Vispgrädde", "2 1/2 dl")]);
  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].text, "Vispgrädde (450 ml)");
});

test("salt quantities are hidden", () => {
  assert.equal(plan([], [ingredient("Salt", "1 krm")]).tasks[0].text, "Salt");
});

test("water is skipped", () => {
  const result = plan([], [ingredient("Vatten", "5 dl")]);
  assert.equal(result.tasks.length, 0);
  assert.equal(result.skipped.length, 1);
});

test("important pantry and category corrections", () => {
  assert.equal(categorizeGroceryItem("krossade tomater"), "Skafferi");
  assert.equal(categorizeGroceryItem("tomatpuré"), "Skafferi");
  assert.equal(categorizeGroceryItem("torkad basilika"), "Skafferi");
  assert.equal(categorizeGroceryItem("färsk basilika", "färsk basilika"), "Frukt & Grönt");
  assert.equal(categorizeGroceryItem("lax"), "Kött & Fisk");
  assert.equal(categorizeGroceryItem("riven parmesan"), "Mejeri");
  assert.equal(categorizeGroceryItem("morötter"), "Frukt & Grönt");
});

test("unsafe variants remain separate", () => {
  assert.equal(plan([task("Gul lök")], [ingredient("Schalottenlök", "1 st")]).tasks.length, 2);
  assert.equal(plan([task("Vispgrädde")], [ingredient("Matlagningsgrädde", "2 dl")]).tasks.length, 2);
  assert.equal(plan([task("Parmesan")], [ingredient("Riven parmesan", "100 g")]).tasks.length, 2);
});

test("repeated imports merge obvious duplicates", () => {
  const first = plan([], [ingredient("Krossade Tomater", "380 g")]);
  const second = plan(first.tasks, [ingredient("Krossade Tomater", "380 g")]);
  assert.equal(second.tasks.length, 1);
  assert.equal(second.tasks[0].text, "Krossade tomater (760 g)");
});

test("checked tasks are never merge candidates", () => {
  const result = plan([task("Mjölk", true, "Mejeri", "checked")], [ingredient("Standardmjölk", "6 dl")]);
  assert.equal(result.tasks.length, 2);
  assert.equal(result.tasks.find(item => item.id === "checked")?.checked, true);
  assert.equal(result.creates.length, 1);
});

test("normalizes penne variants to Penne Pasta in Skafferi", () => {
  for (const text of [
    "port penne",
    "penne",
    "penne (eller annan kort pasta)",
    "4 port penne (eller annan kort pasta)",
  ]) {
    const normalized = normalizeRecipeIngredient(ingredient(text));
    assert.equal(normalized.name, "penne pasta");
    assert.equal(normalized.category, "Skafferi");
    assert.equal(plan([], [ingredient(text)]).tasks[0].text, "Penne Pasta");
  }
});

test("categorizes soltorkade tomater as Skafferi and preserves strimlade", () => {
  const plain = normalizeRecipeIngredient(ingredient("Soltorkade tomater", "1 dl"));
  const sliced = normalizeRecipeIngredient(ingredient("Strimlade soltorkade tomater", "1 dl"));

  assert.equal(plain.name, "soltorkade tomater");
  assert.equal(plain.category, "Skafferi");
  assert.equal(sliced.name, "strimlade soltorkade tomater");
  assert.equal(sliced.category, "Skafferi");
  assert.equal(plan([], [ingredient("Strimlade soltorkade tomater", "1 dl")]).tasks[0].text, "Strimlade soltorkade tomater");
});

test("categorizes sidfläsk, bacon, and pancetta as Kött & Fisk", () => {
  for (const text of ["Sidfläsk", "Rimmat sidfläsk", "Bacon", "Pancetta"]) {
    const result = plan([], [ingredient(text, "300 g")]).tasks[0];
    assert.equal(result.notes, "Kött & Fisk");
  }
});

test("categorizes keso and cottage cheese as Mejeri", () => {
  for (const text of ["Keso", "Cottage cheese", "Keso cottage cheese"]) {
    const result = plan([], [ingredient(text, "250 g")]).tasks[0];
    assert.equal(result.notes, "Mejeri");
  }
  assert.equal(plan([], [ingredient("Keso cottage cheese", "250 g")]).tasks[0].text, "Keso cottage cheese (250 g)");
});

test("categorizes lingonsylt and sylt as Skafferi", () => {
  assert.equal(plan([], [ingredient("Lingonsylt", "1 dl")]).tasks[0].notes, "Skafferi");
  assert.equal(plan([], [ingredient("Sylt", "1 dl")]).tasks[0].notes, "Skafferi");
});

test("tomatpuré hides small recipe quantities", () => {
  assert.equal(plan([], [ingredient("Tomatpuré", "1 msk")]).tasks[0].text, "Tomatpuré");
  assert.equal(plan([], [ingredient("Tomatpuré", "15 ml")]).tasks[0].text, "Tomatpuré");
  assert.equal(normalizeRecipeIngredient(ingredient("Tomatpuré", "15 ml")).category, "Skafferi");
});

test("cleans up Coop parmesanpotatis grocery items", () => {
  const cases = [
    ["ca 8 kokta potatisar", "Potatis", "Frukt & Grönt"],
    ["30 g grönkål", "Grönkål (30 g)", "Frukt & Grönt"],
    ["1 dl finriven parmesan", "Parmesan", "Mejeri"],
    ["1 dl crème fraiche", "Crème fraiche", "Mejeri"],
  ] as const;

  for (const [text, expectedText, expectedCategory] of cases) {
    const normalized = normalizeRecipeIngredient(ingredient(text));
    const result = plan([], [ingredient(text)]).tasks[0];
    assert.equal(result.text, expectedText);
    assert.equal(normalized.category, expectedCategory);
    assert.equal(result.notes, expectedCategory);
  }
});

const cityGrossProduct = (
  overrides: Partial<ProductPrice> = {},
): ProductPrice => ({
  id: "city-gross-product",
  chainId: "city_gross",
  storeId: "public",
  productName: "Testprodukt",
  priceSek: 10,
  unitLabel: "st",
  searchTerms: [],
  ...overrides,
});

test("uses explicit City Gross categories before product URLs", () => {
  const cases = [
    ["Frukt och grönt", "Frukt & Grönt"],
    ["Mejeri, ost och ägg", "Mejeri"],
    ["Skafferiet", "Skafferi"],
    ["Fisk och skaldjur", "Kött & Fisk"],
    ["Chark och pålägg", "Kött & Fisk"],
    ["Fryst", "Fryst"],
    ["Bröd och kakor", "Skafferi"],
  ] as const;

  for (const [category, expected] of cases) {
    assert.equal(
      inferCategoryFromCityGrossProduct(
        cityGrossProduct({
          categoryPath: [category],
          productUrl: "/matvaror/frukt-och-gront/fel-kategori",
        }),
      ),
      expected,
    );
  }
});

test("uses the City Gross product URL as category fallback", () => {
  const cases = [
    ["/matvaror/mejeri-ost-och-agg/keso", "Mejeri"],
    ["/matvaror/skafferiet/sylt", "Skafferi"],
    ["/matvaror/skafferiet/konserver/tomater", "Skafferi"],
    ["/matvaror/chark-och-palagg/flask", "Kött & Fisk"],
    ["/matvaror/frukt-och-gront/gronsaker", "Frukt & Grönt"],
    ["/matvaror/fisk-och-skaldjur/lax", "Kött & Fisk"],
  ] as const;

  for (const [productUrl, expected] of cases) {
    assert.equal(
      inferCategoryFromCityGrossProduct(cityGrossProduct({ productUrl })),
      expected,
    );
  }
});

test("returns null without City Gross category data so text fallback can run", () => {
  const product = cityGrossProduct();
  assert.equal(inferCategoryFromCityGrossProduct(product), null);
  assert.equal(
    inferCategoryFromCityGrossProduct(product) ??
      categorizeGroceryItem("vegetarisk korv chorizo"),
    "Kött & Fisk",
  );
});

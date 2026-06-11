import assert from "node:assert/strict";
import test from "node:test";
import type { RecipeIngredient, TaskItem } from "./src/types";
import { categorizeGroceryItem } from "./src/lib/grocery/categorize";
import { buildGroceryMergePlan } from "./src/lib/grocery/merge";
import { normalizeRecipeIngredient } from "./src/lib/grocery/normalize";

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

test("Arla Standardmjölk merges into existing milk and package-rounds", () => {
  const result = plan([task("Mjölk", false, "Mejeri")], [ingredient("Arla Ko® Standardmjölk", "6 dl")]);
  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].text, "Mjölk (1 l)");
  assert.equal(result.updates.length, 1);
});

test("does not reuse a package-rounded milk display as exact recipe need", () => {
  const result = plan([task("Mjölk (1 l)", false, "Mejeri")], [ingredient("Mjölk", "2 dl")]);
  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].text, "Mjölk");
  assert.notEqual(result.tasks[0].text, "Mjölk (2 l)");
});

test("does not over-round an existing cream shopping suggestion", () => {
  const result = plan([task("Vispgrädde (5 dl)", false, "Mejeri")], [ingredient("Vispgrädde", "1 dl")]);
  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].text, "Vispgrädde");
});

test("treats persisted package-rounded text as display rather than recipe-needed quantity", () => {
  const result = plan([task("Mjölk (2 l)", false, "Mejeri")], [ingredient("Mjölk", "2 dl")]);
  assert.equal(result.tasks[0].text, "Mjölk");
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

test("cream quantities sum and package-round", () => {
  const result = plan([], [ingredient("Vispgrädde", "2 dl"), ingredient("Vispgrädde", "2 1/2 dl")]);
  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].text, "Vispgrädde (5 dl)");
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

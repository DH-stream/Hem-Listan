import assert from "node:assert/strict";
import test from "node:test";

import { mergePendingMeals } from "./src/lib/optimisticMeals";
import { getMealRecipeMeta } from "./src/lib/supabase";
import type { List, MealSlot } from "./src/types";

const list = (meals: MealSlot[] = []): List => ({
  id: "list-1",
  name: "Veckan",
  icon: "restaurant",
  themeColor: "green",
  category: "grocery",
  tasks: [],
  meals,
});

test("keeps an optimistic meal visible when a realtime fetch does not contain it yet", () => {
  const optimisticMeal: MealSlot = {
    id: "meal-client-1",
    clientId: "client-1",
    day: "Onsdag",
    type: "middag",
    name: "Pannkakor",
  };

  const merged = mergePendingMeals(
    [list()],
    [{ listId: "list-1", meal: optimisticMeal }],
  );

  assert.deepEqual(merged[0].meals, [optimisticMeal]);
  assert.equal(getMealRecipeMeta(optimisticMeal), null);
});

test("pending meal replaces stale server data in the same slot without duplicating it", () => {
  const staleMeal: MealSlot = {
    id: "server-old",
    day: "Onsdag",
    type: "middag",
    name: "Soppa",
  };
  const savedMeal: MealSlot = {
    id: "server-new",
    clientId: "client-1",
    day: "Onsdag",
    type: "middag",
    name: "Pannkakor",
  };

  const merged = mergePendingMeals(
    [list([staleMeal])],
    [{ listId: "list-1", meal: savedMeal }],
  );

  assert.deepEqual(merged[0].meals, [savedMeal]);
});

test("keeps imported recipe metadata on the optimistic meal during a realtime fetch", () => {
  const importedMeal: MealSlot = {
    id: "meal-client-recipe",
    clientId: "client-recipe",
    day: "Fredag",
    type: "middag",
    name: "Pasta",
    source: "recipe_import",
    recipeSourceUrl: "https://example.com/pasta",
    recipeSourceDomain: "example.com",
    recipeIngredients: [
      { text: "Pasta", quantity: "400 g", category: "Skafferi" },
    ],
    recipeInstructions: ["Koka pastan."],
    recipeImageUrl: "https://example.com/pasta.jpg",
    importedAt: "2026-06-10T12:00:00.000Z",
  };

  const merged = mergePendingMeals(
    [list()],
    [{ listId: "list-1", meal: importedMeal }],
  );

  assert.deepEqual(merged[0].meals, [importedMeal]);
  assert.deepEqual(getMealRecipeMeta(importedMeal), {
    source: "recipe_import",
    recipeSourceUrl: importedMeal.recipeSourceUrl,
    recipeSourceDomain: importedMeal.recipeSourceDomain,
    recipeIngredients: importedMeal.recipeIngredients,
    recipeInstructions: importedMeal.recipeInstructions,
    recipeImageUrl: importedMeal.recipeImageUrl,
    importedAt: importedMeal.importedAt,
  });
});

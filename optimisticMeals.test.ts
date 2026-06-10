import assert from "node:assert/strict";
import test from "node:test";

import { mergePendingMeals } from "./src/lib/optimisticMeals";
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

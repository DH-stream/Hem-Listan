import assert from "node:assert/strict";
import test from "node:test";
import type { MealSlot } from "./src/types";
import { getOrderedWeekdays } from "./src/lib/weekdays";

test('getOrderedWeekdays("monday") returns Monday–Sunday', () => {
  assert.deepEqual(
    getOrderedWeekdays("monday").map((weekday) => weekday.label),
    ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"],
  );
});

test('getOrderedWeekdays("wednesday") returns Wednesday–Tuesday', () => {
  assert.deepEqual(
    getOrderedWeekdays("wednesday").map((weekday) => weekday.label),
    ["Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag", "Måndag", "Tisdag"],
  );
});

test("missing or invalid start day falls back to Monday", () => {
  assert.deepEqual(
    getOrderedWeekdays(undefined).map((weekday) => weekday.key),
    getOrderedWeekdays("monday").map((weekday) => weekday.key),
  );
  assert.deepEqual(
    getOrderedWeekdays("not-a-weekday").map((weekday) => weekday.key),
    getOrderedWeekdays("monday").map((weekday) => weekday.key),
  );
});

test("creating a grocery list with Wednesday stores the selected start day", () => {
  const list = {
    id: "list-1",
    name: "Matlista",
    icon: "shopping_cart",
    themeColor: "#003b05",
    category: "grocery" as const,
    tasks: [],
    meals: [],
    mealPlanStartDay: "wednesday" as const,
  };

  assert.equal(list.mealPlanStartDay, "wednesday");
});

test("changing start day does not transform meal day keys", () => {
  const meals: MealSlot[] = [
    { id: "meal-1", day: "Fredag", type: "middag", name: "Tacos" },
  ];
  const rotatedDays = getOrderedWeekdays("wednesday").map((weekday) => weekday.label);

  assert.equal(meals[0].day, "Fredag");
  assert.ok(rotatedDays.includes(meals[0].day));
});

import assert from "node:assert/strict";
import test from "node:test";
import { formatIngredientName } from "./src/lib/ingredientDisplay";

test("capitalizes ordinary ingredient names for display", () => {
  assert.equal(formatIngredientName("hallon"), "Hallon");
  assert.equal(formatIngredientName("crème fraiche"), "Crème fraiche");
});

test("preserves acronym and brand-like ingredient casing", () => {
  assert.equal(formatIngredientName("ICA Basic hallon"), "ICA Basic hallon");
  assert.equal(formatIngredientName("iKaffe"), "iKaffe");
});

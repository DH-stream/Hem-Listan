import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRecipeSourceUrl } from "./src/lib/supabase";

test("normalizes recipe URLs for saved recipe and feedback dedupe", () => {
  assert.equal(
    normalizeRecipeSourceUrl("https://WWW.ICA.SE/recept/pasta/?utm_source=test&fbclid=abc#ingredients"),
    "https://www.ica.se/recept/pasta",
  );
});

test("leaves non-URL input untouched", () => {
  assert.equal(normalizeRecipeSourceUrl("not a url"), "not a url");
});

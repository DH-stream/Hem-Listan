import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRecipeSourceUrl } from "./src/lib/supabase";
import { getSavedRecipeImageUrl } from "./src/lib/savedRecipes";

test("normalizes recipe URLs for saved recipe and feedback dedupe", () => {
  assert.equal(
    normalizeRecipeSourceUrl("https://WWW.ICA.SE/recept/pasta/?utm_source=test&fbclid=abc#ingredients"),
    "https://www.ica.se/recept/pasta",
  );
});

test("leaves non-URL input untouched", () => {
  assert.equal(normalizeRecipeSourceUrl("not a url"), "not a url");
});

test("gets a saved recipe image from current, legacy, and import preview fields", () => {
  assert.equal(
    getSavedRecipeImageUrl({ imageUrl: " https://example.com/current.jpg " }),
    "https://example.com/current.jpg",
  );
  assert.equal(
    getSavedRecipeImageUrl({ cover_url: "https://example.com/cover.jpg" }),
    "https://example.com/cover.jpg",
  );
  assert.equal(
    getSavedRecipeImageUrl({
      preview: { image_url: "https://example.com/preview.jpg" },
    }),
    "https://example.com/preview.jpg",
  );
  assert.equal(getSavedRecipeImageUrl({ image: "" }), null);
});

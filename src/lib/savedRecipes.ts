import type { SavedRecipe } from "../types";

const SAVED_RECIPE_IMAGE_FIELDS = [
  "imageUrl",
  "image_url",
  "image",
  "coverUrl",
  "cover_url",
  "thumbnailUrl",
  "thumbnail_url",
  "heroImage",
  "sourceImageUrl",
  "importedImageUrl",
] as const;

const getStringUrl = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export const getSavedRecipeImageUrl = (
  recipe: SavedRecipe | Record<string, unknown>,
): string | null => {
  const record = recipe as unknown as Record<string, unknown>;

  for (const field of SAVED_RECIPE_IMAGE_FIELDS) {
    const imageUrl = getStringUrl(record[field]);
    if (imageUrl) return imageUrl;
  }

  const preview = record.preview;
  if (preview && typeof preview === "object") {
    const previewRecord = preview as Record<string, unknown>;
    return (
      getStringUrl(previewRecord.imageUrl) ??
      getStringUrl(previewRecord.image_url) ??
      getStringUrl(previewRecord.image)
    );
  }

  return null;
};

export interface SavedRecipeTipCacheValue {
  recipeId: string;
  date: string;
}

export const parseSavedRecipeTipCacheValue = (
  value: unknown,
): { cache: SavedRecipeTipCacheValue | null; migratedLegacyObject: boolean } => {
  if (!value || typeof value !== "object") {
    return { cache: null, migratedLegacyObject: false };
  }

  const record = value as Record<string, unknown>;
  if (typeof record.recipeId === "string" && record.recipeId) {
    return {
      cache: {
        recipeId: record.recipeId,
        date: typeof record.date === "string" ? record.date : "",
      },
      migratedLegacyObject: false,
    };
  }

  if (typeof record.id === "string" && record.id) {
    return {
      cache: { recipeId: record.id, date: "" },
      migratedLegacyObject: true,
    };
  }

  return { cache: null, migratedLegacyObject: false };
};

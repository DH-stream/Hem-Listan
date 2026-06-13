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

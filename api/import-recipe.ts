import type { IncomingMessage, ServerResponse } from "node:http";
import {
  importRecipeFromUrl,
  RecipeImportError,
  type RecipeImportErrorCode,
} from "../recipeImporter";

type ApiRequest = IncomingMessage & { body?: { url?: unknown } };
type ApiResponse = ServerResponse & {
  status(statusCode: number): ApiResponse;
  json(body: unknown): ApiResponse;
};

const importErrorStatuses: Partial<Record<RecipeImportErrorCode, number>> = {
  invalid_url: 400,
  unsafe_redirect: 400,
  unsupported_content_type: 422,
  no_recipe_found: 422,
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const recipe = await importRecipeFromUrl(req.body?.url);
    return res.status(200).json(recipe);
  } catch (error) {
    const importError =
      error instanceof RecipeImportError
        ? error
        : new RecipeImportError(
            "fetch_failed",
            "Receptet kunde inte importeras.",
          );
    const status = importErrorStatuses[importError.code] ?? 502;

    console.error("Failed in /api/import-recipe:", error);
    return res.status(status).json({
      error: importError.message,
      code: importError.code,
      attemptedMethods: importError.attemptedMethods,
      canRetryWithAi: importError.canRetryWithAi,
    });
  }
}

import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  importRecipeFromUrl,
  RecipeImportError,
  type RecipeImportErrorCode,
} from "./_lib/recipeImporter";

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

function getRequestId(req: ApiRequest): string {
  const header = req.headers["x-hl-request-id"];
  const value = Array.isArray(header) ? header[0] : header;
  return value?.trim().slice(0, 128) || randomUUID();
}

function logImport(
  level: "info" | "error",
  event: string,
  requestId: string,
  details: Record<string, unknown> = {},
) {
  console[level]("[HL_RECIPE_IMPORT_API]", { event, requestId, ...details });
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const requestId = getRequestId(req);
  const hasBody = req.body !== undefined && req.body !== null;
  const hasUrl =
    typeof req.body?.url === "string" && req.body.url.trim() !== "";
  res.setHeader("x-hl-request-id", requestId);

  logImport("info", "request_received", requestId, {
    method: req.method,
    hasBody,
    hasUrl,
  });

  if (req.method !== "POST") {
    logImport("info", "method_not_allowed", requestId, { method: req.method });
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  logImport("info", "importer_loaded", requestId);

  try {
    let hostname: string | undefined;
    try {
      hostname =
        typeof req.body?.url === "string"
          ? new URL(req.body.url).hostname
          : undefined;
    } catch {
      hostname = undefined;
    }
    logImport("info", "import_start", requestId, { hostname });

    const recipe = await importRecipeFromUrl(req.body?.url, { requestId });
    logImport("info", "import_success", requestId, {
      recipeName: recipe.recipeName,
      ingredientCount: recipe.ingredients.length,
      instructionCount: recipe.instructions?.length ?? 0,
      extractionMethod: recipe.extractionMethod,
      confidence: recipe.confidence,
      sourceDomain: recipe.sourceDomain,
      attemptedMethods: recipe.attemptedMethods,
    });
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

    logImport("error", "import_error", requestId, {
      code: importError.code,
      message: importError.message,
      attemptedMethods: importError.attemptedMethods,
      canRetryWithAi: importError.canRetryWithAi,
      errorName: error instanceof Error ? error.name : typeof error,
      stack: error instanceof Error ? error.stack?.split("\n")[0] : undefined,
    });
    return res.status(status).json({
      error: importError.message,
      code: importError.code,
      attemptedMethods: importError.attemptedMethods,
      canRetryWithAi: importError.canRetryWithAi,
    });
  }
}

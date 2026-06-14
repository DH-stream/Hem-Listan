import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

type ApiRequest = IncomingMessage & { body?: { url?: unknown; debug?: unknown } };
type ApiResponse = ServerResponse & {
  status(statusCode: number): ApiResponse;
  json(body: unknown): ApiResponse;
};

const importErrorStatuses: Partial<Record<string, number>> = {
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
  const requestUrl = new URL(req.url ?? "/", "http://localhost");
  const debug =
    req.body?.debug === true || requestUrl.searchParams.get("debug") === "1";
  let hostname: string | undefined;
  try {
    hostname =
      typeof req.body?.url === "string"
        ? new URL(req.body.url).hostname
        : undefined;
  } catch {
    hostname = undefined;
  }
  console.info("[recipe-import] received", {
    url: req.body?.url,
    debug,
    hostname,
  });
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

  let importer: typeof import("./_lib/recipeImporter.js");
  try {
    // Vercel compiles this route to JS and runs it as native Node ESM.
    // The explicit .js specifier is required at runtime; TypeScript resolves it
    // to the sibling .ts source during tests/build.
    importer = await import("./_lib/recipeImporter.js");
    logImport("info", "importer_loaded", requestId);
  } catch (error) {
    logImport("error", "route_module_load_failed", requestId, {
      errorName: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split("\n")[0] : undefined,
    });
    return res.status(500).json({
      error: "Receptimporten kunde inte startas.",
      code: "route_module_load_failed",
      requestId,
    });
  }

  try {
    logImport("info", "import_start", requestId, { hostname });

    const recipe = await importer.importRecipeFromUrl(req.body?.url, {
      requestId,
      debug,
    });
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
      error instanceof importer.RecipeImportError
        ? error
        : new importer.RecipeImportError(
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

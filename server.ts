import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import {
  importRecipeFromUrl,
  RecipeImportError,
  type RecipeImportErrorCode,
} from "./api/_lib/recipeImporter";
import {
  searchCityGrossProducts,
  validatePricingQuery,
} from "./api/_lib/cityGrossPricing";

const app = express();
const PORT = 3000;

app.use(express.json());

const importErrorStatuses: Partial<Record<RecipeImportErrorCode, number>> = {
  invalid_url: 400,
  unsafe_redirect: 400,
  unsupported_content_type: 422,
  no_recipe_found: 422,
};

app.get(
  "/api/pricing/citygross/search",
  async (req: express.Request, res: express.Response) => {
    const validation = validatePricingQuery(req.query.q);
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error });
    }

    const storeId = typeof req.query.storeId === "string" ? req.query.storeId : undefined;
    const products = await searchCityGrossProducts(validation.query, storeId);
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
    return res.json(products);
  },
);

app.post(
  "/api/import-recipe",
  async (req: express.Request, res: express.Response) => {
    try {
      const recipe = await importRecipeFromUrl(req.body?.url);
      return res.json(recipe);
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
  },
);

// Configure Vite entry middleware / Production router
async function bootstrap() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: express.Request, res: express.Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Hem-Listan Full-Stack server running on ingress port ${PORT}`);
  });
}

bootstrap();

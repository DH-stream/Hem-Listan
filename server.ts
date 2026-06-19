import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import {
  importRecipeFromUrl,
  RecipeImportError,
  type RecipeImportErrorCode,
} from "./api/_lib/recipeImporter";
import {
  calculateCityGrossBasket,
  validateBasketPricingRequest,
} from "./api/_lib/basketPricing";
import {
  searchIcaStoresWithDebug,
  type IcaStoreSearchDebug,
} from "./api/_lib/icaStoreSearch";

const app = express();
const PORT = 3000;

app.use(express.json());

const importErrorStatuses: Partial<Record<RecipeImportErrorCode, number>> = {
  invalid_url: 400,
  unsafe_redirect: 400,
  unsupported_content_type: 422,
  no_recipe_found: 422,
};

app.post(
  "/api/pricing/basket",
  async (req: express.Request, res: express.Response) => {
    const debug =
      req.query.debug === "1" || req.header("x-pricing-debug") === "1";
    const validation = validateBasketPricingRequest(req.body);
    if (validation.ok === false) {
      return res.status(400).json({ error: validation.error });
    }

    try {
      return res.json(
        await calculateCityGrossBasket(validation.request, { debug }),
      );
    } catch (error) {
      console.error("Failed in /api/pricing/basket:", error);
      return res.status(200).json({
        matches: [],
        approximateTotalSek: 0,
        error: "Basket pricing unavailable",
        ...(debug
          ? {
              debugMessage:
                error instanceof Error ? error.message : String(error),
            }
          : {}),
      });
    }
  },
);

app.get(
  "/api/ica/stores/search",
  async (req: express.Request, res: express.Response) => {
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    console.info("[ica-store-search] handler entered", { query });

    if (query.toLocaleLowerCase("sv-SE") === "healthcheck") {
      const debug: IcaStoreSearchDebug = {
        query,
        upstreamUrl: "https://www.ica.se/butiker/",
        parsedStoreCount: 0,
        filteredStoreCount: 0,
        firstParsedStores: [],
        source: "cache",
        fallbackUsed: false,
      };
      console.info("[ica-store-search] healthcheck", debug);
      return res.json({ stores: [], debug, healthcheck: true });
    }

    if (query.length < 2) {
      const debug: IcaStoreSearchDebug = {
        query,
        upstreamUrl: "https://www.ica.se/butiker/",
        parsedStoreCount: 0,
        filteredStoreCount: 0,
        firstParsedStores: [],
        source: "cache",
        fallbackUsed: false,
      };
      console.info("[ica-store-search] skipped short query", debug);
      return res.json({ stores: [], debug });
    }

    try {
      const result = await searchIcaStoresWithDebug(query);
      console.info("[ica-store-search] result", result.debug);
      return res.json(result);
    } catch (error) {
      const debug: IcaStoreSearchDebug = {
        query,
        upstreamUrl: "https://www.ica.se/butiker/",
        parsedStoreCount: 0,
        filteredStoreCount: 0,
        firstParsedStores: [],
        source: "ica_html",
        fallbackUsed: false,
        error: error instanceof Error ? error.message : String(error),
      };
      console.error("[ica-store-search] failed", debug);
      return res.status(502).json({ error: "ICA store search unavailable", stores: [], debug });
    }
  },
);

app.post(
  "/api/import-recipe",
  async (req: express.Request, res: express.Response) => {
    const debug = req.body?.debug === true || req.query.debug === "1";
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
    try {
      const recipe = await importRecipeFromUrl(req.body?.url, { debug });
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

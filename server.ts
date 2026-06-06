import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { importRecipeFromUrl, validateRecipeUrl } from "./recipeImporter";

const app = express();
const PORT = 3000;

app.use(express.json());

app.post(
  "/api/import-recipe",
  async (req: express.Request, res: express.Response) => {
    try {
      validateRecipeUrl(req.body?.url);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Ange en giltig receptlänk.";
      return res.status(400).json({ error: message });
    }

    try {
      const recipe = await importRecipeFromUrl(req.body.url);
      return res.json(recipe);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Receptet kunde inte importeras.";
      const status = message.includes("Inga ingredienser") ? 422 : 502;
      console.error("Failed in /api/import-recipe:", error);
      return res.status(status).json({ error: message });
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

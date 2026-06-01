import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize standard Gemini Client using server-only process.env.GEMINI_API_KEY
// User-Agent set to 'aistudio-build' for telemetry tracking.
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

app.post("/api/import-recipe", async (req: express.Request, res: express.Response) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    console.log("Importing recipe from:", url);

    // Fetch the raw page HTML, strip content, and feed clean paragraphs to Gemini for robust extraction
    let websiteText = "";
    try {
      const fetchResponse = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        },
        signal: AbortSignal.timeout(6000)
      });
      if (fetchResponse.ok) {
        const html = await fetchResponse.text();
        websiteText = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .substring(0, 15000); // Capture up to 15,000 characters
      } else {
        console.warn(`Unsuccessful status from URL: ${fetchResponse.status}`);
      }
    } catch (e) {
      console.warn("Could not fetch page text content, calling Gemini with URL context only:", e);
    }

    // Call Gemini 3.5-flash to extract recipe attributes and format into a strong structural schema
    const prompt = `Parse the grocery cooking recipe from the following website/details or URL: "${url}".
${websiteText ? `Scraped text content from webpage is: "${websiteText}"` : "The URL to extract ingredients from is provided above."}

Tasks:
1. Identify the Recipe Name or food title (output under "recipeName").
2. Formulate a short, simplified title suitable for a weekly meal schedule card (output under "mealName" e.g., "Pasta Bolognese", "Lax med potatis").
3. Extract each ingredient and map its category name to one of these Swedish sections: 'Frukt & Grönt', 'Mejeri', 'Skafferi', 'Fryst', 'Kött & Fisk', 'Övrigt'. Each object elements must have:
   - "text": The ingredient name in Swedish (e.g. "krossade tomater", "gul lök")
   - "quantity": The amount/measurement (e.g. "2 burkar", "1 st", "500g")
   - "category": The exact category mapped (one of those listed above).

Please return ONLY a JSON response strictly adhering to the schema. Output in Swedish.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["recipeName", "mealName", "ingredients"],
          properties: {
            recipeName: { type: Type.STRING },
            mealName: { type: Type.STRING },
            ingredients: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["text", "quantity", "category"],
                properties: {
                  text: { type: Type.STRING },
                  quantity: { type: Type.STRING },
                  category: { 
                    type: Type.STRING, 
                    description: "Must be exactly one of: 'Frukt & Grönt', 'Mejeri', 'Skafferi', 'Fryst', 'Kött & Fisk', 'Övrigt'" 
                  }
                }
              }
            }
          }
        }
      }
    });

    const strippedText = (response.text || "").trim();
    const resultObj = JSON.parse(strippedText);
    res.json(resultObj);

  } catch (error: any) {
    console.error("Failed in /api/import-recipe:", error);
    res.status(500).json({ error: error.message || "Failed to parse recipe details via Gemini AI." });
  }
});

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

import type { IncomingMessage, ServerResponse } from "node:http";

type ApiRequest = IncomingMessage & { body?: unknown };
type ApiResponse = ServerResponse & {
  status(statusCode: number): ApiResponse;
  json(body: unknown): ApiResponse;
};

type BasketPricingModule = typeof import("../_lib/basketPricing.js");
type LoadBasketPricing = () => Promise<BasketPricingModule>;

const isPricingDebugRequest = (req: ApiRequest) => {
  const requestUrl = new URL(req.url ?? "/", "http://localhost");
  const debugHeader = req.headers?.["x-pricing-debug"];
  return (
    requestUrl.searchParams.get("debug") === "1" ||
    (Array.isArray(debugHeader) ? debugHeader[0] : debugHeader) === "1"
  );
};

const pricingApiLog = (
  enabled: boolean,
  message: string,
  details?: unknown,
) => {
  if (enabled) console.log(`[pricing-api] ${message}`, details ?? "");
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export async function readJsonBody(req: ApiRequest): Promise<unknown> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body !== "string") return req.body;

    try {
      return JSON.parse(req.body);
    } catch {
      throw new SyntaxError("Invalid JSON body.");
    }
  }

  let rawBody = "";
  for await (const chunk of req) {
    rawBody +=
      typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
  }

  if (!rawBody.trim()) return undefined;

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new SyntaxError("Invalid JSON body.");
  }
}

export function createBasketPricingHandler(
  loadBasketPricing: LoadBasketPricing = () => import("../_lib/basketPricing.js"),
) {
  return async function handler(req: ApiRequest, res: ApiResponse) {
    const debug = isPricingDebugRequest(req);
    pricingApiLog(debug, "basket request", { method: req.method, url: req.url });

    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      pricingApiLog(debug, "invalid JSON body", error);
      return res.status(400).json({ error: "Invalid JSON body." });
    }

    let pricing: BasketPricingModule;
    try {
      pricing = await loadBasketPricing();
    } catch (error) {
      pricingApiLog(debug, "route module load failed", error);
      return res.status(200).json({
        matches: [],
        approximateTotalSek: 0,
        error: "Basket pricing unavailable",
        ...(debug ? { debugMessage: getErrorMessage(error) } : {}),
      });
    }

    const validation = pricing.validateBasketPricingRequest(body);
    if (validation.ok === false) {
      pricingApiLog(debug, "validation failed", { error: validation.error });
      return res.status(400).json({ error: validation.error });
    }

    pricingApiLog(debug, "validated request", {
      chain: validation.request.chain,
      storeId: validation.request.storeId,
      itemCount: validation.request.items.length,
      items: validation.request.items,
    });

    try {
      const result = await pricing.calculateCityGrossBasket(validation.request, {
        debug,
      });
      pricingApiLog(debug, "basket response", {
        matchCount: result.matches.length,
        pricedCount: result.matches.filter((match) => match.product).length,
        approximateTotalSek: result.approximateTotalSek,
      });
      return res.status(200).json(result);
    } catch (error) {
      pricingApiLog(debug, "basket pricing unavailable", error);
      return res.status(200).json({
        matches: [],
        approximateTotalSek: 0,
        error: "Basket pricing unavailable",
        ...(debug ? { debugMessage: getErrorMessage(error) } : {}),
      });
    }
  };
}

export default createBasketPricingHandler();

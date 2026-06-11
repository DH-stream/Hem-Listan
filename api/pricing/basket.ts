import type { IncomingMessage, ServerResponse } from "node:http";
import {
  calculateCityGrossBasket,
  validateBasketPricingRequest,
} from "../_lib/basketPricing.js";

type ApiRequest = IncomingMessage & { body?: unknown };
type ApiResponse = ServerResponse & {
  status(statusCode: number): ApiResponse;
  json(body: unknown): ApiResponse;
};

const isPricingDebugRequest = (req: ApiRequest) => {
  const requestUrl = new URL(req.url ?? "/", "http://localhost");
  return (
    requestUrl.searchParams.get("debug") === "1" ||
    req.headers?.["x-pricing-debug"] === "1"
  );
};

const pricingApiLog = (
  enabled: boolean,
  message: string,
  details?: unknown,
) => {
  if (enabled) console.log(`[pricing-api] ${message}`, details ?? "");
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const debug = isPricingDebugRequest(req);
  pricingApiLog(debug, "basket request", { method: req.method, url: req.url });

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const validation = validateBasketPricingRequest(req.body);
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
    const result = await calculateCityGrossBasket(validation.request, { debug });
    pricingApiLog(debug, "basket response", {
      matchCount: result.matches.length,
      pricedCount: result.matches.filter((match) => match.product).length,
      approximateTotalSek: result.approximateTotalSek,
    });
    return res.status(200).json(result);
  } catch (error) {
    pricingApiLog(debug, "error", error);
    return res.status(500).json({ error: "Basket pricing request failed" });
  }
}

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

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const validation = validateBasketPricingRequest(req.body);
  if (validation.ok === false) {
    return res.status(400).json({ error: validation.error });
  }

  const result = await calculateCityGrossBasket(validation.request);
  return res.status(200).json(result);
}

import type { IncomingMessage, ServerResponse } from "node:http";
import {
  searchCityGrossProducts,
  validatePricingQuery,
} from "../../_lib/cityGrossPricing.js";

type ApiRequest = IncomingMessage & {
  query?: { q?: unknown; storeId?: unknown };
  url?: string;
};
type ApiResponse = ServerResponse & {
  status(statusCode: number): ApiResponse;
  json(body: unknown): ApiResponse;
};

const readQuery = (req: ApiRequest) => {
  if (req.query) return req.query;
  const url = new URL(req.url ?? "/", "http://localhost");
  return {
    q: url.searchParams.get("q") ?? undefined,
    storeId: url.searchParams.get("storeId") ?? undefined,
  };
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const query = readQuery(req);
  const validation = validatePricingQuery(query.q);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }

  const storeId = typeof query.storeId === "string" ? query.storeId : undefined;
  const products = await searchCityGrossProducts(validation.query, storeId);
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  return res.status(200).json(products);
}

import type { IncomingMessage, ServerResponse } from "node:http";
import { searchIcaStores } from "../../_lib/icaStoreSearch";

type ApiResponse = ServerResponse & {
  status(statusCode: number): ApiResponse;
  json(body: unknown): ApiResponse;
};

export default async function handler(req: IncomingMessage, res: ApiResponse) {
  const requestUrl = new URL(req.url ?? "/", "http://localhost");
  const query = requestUrl.searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) return res.status(200).json({ stores: [] });

  try {
    return res.status(200).json({ stores: await searchIcaStores(query) });
  } catch (error) {
    console.error("Failed in /api/ica/stores/search:", error);
    return res.status(502).json({ error: "ICA store search unavailable", stores: [] });
  }
}

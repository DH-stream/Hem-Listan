import type { IncomingMessage, ServerResponse } from "node:http";
import { searchIcaStoresWithDebug, type IcaStoreSearchDebug } from "../../_lib/icaStoreSearch";

type ApiResponse = ServerResponse & {
  status(statusCode: number): ApiResponse;
  json(body: unknown): ApiResponse;
};

export default async function handler(req: IncomingMessage, res: ApiResponse) {
  const requestUrl = new URL(req.url ?? "/", "http://localhost");
  const query = requestUrl.searchParams.get("q")?.trim() ?? "";
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
    return res.status(200).json({ stores: [], debug, healthcheck: true });
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
    return res.status(200).json({ stores: [], debug });
  }

  try {
    const result = await searchIcaStoresWithDebug(query);
    console.info("[ica-store-search] result", result.debug);
    return res.status(200).json(result);
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
}

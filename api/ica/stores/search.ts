import type { IncomingMessage, ServerResponse } from "node:http";

type ApiResponse = ServerResponse & {
  status(statusCode: number): ApiResponse;
  json(body: unknown): ApiResponse;
};

type IcaStoreSearchModule = Pick<
  typeof import("../../_lib/icaStoreSearch.js"),
  "searchIcaStoresWithDebug"
>;
type LoadIcaStoreSearch = () => Promise<IcaStoreSearchModule>;

const ICA_STORES_URL = "https://www.ica.se/butiker/";

const fallbackDebug = (query: string, stage: string, error?: unknown) => ({
  query,
  upstreamUrl: ICA_STORES_URL,
  parsedStoreCount: 0,
  filteredStoreCount: 0,
  firstParsedStores: [],
  source: "ica_html",
  fallbackUsed: false,
  stage,
  ...(error ? { error: error instanceof Error ? error.message : String(error) } : {}),
});

export function createIcaStoreSearchHandler(
  loadIcaStoreSearch: LoadIcaStoreSearch = async () => import("../../_lib/icaStoreSearch.js"),
) {
  return async function handler(req: IncomingMessage, res: ApiResponse) {
    let query = "";
    try {
      const requestUrl = new URL(req.url ?? "/", "http://localhost");
      query = requestUrl.searchParams.get("q")?.trim() ?? "";
      console.info("[ica-store-search] handler entered", { query });

      if (query.toLocaleLowerCase("sv-SE") === "healthcheck") {
        const debug = fallbackDebug(query, "healthcheck");
        console.info("[ica-store-search] healthcheck", debug);
        return res.status(200).json({ ok: true, stores: [], debug });
      }

      if (query.length < 2) {
        const debug = fallbackDebug(query, "short_query");
        console.info("[ica-store-search] skipped short query", debug);
        return res.status(200).json({ stores: [], debug });
      }

      let storeSearch: IcaStoreSearchModule;
      try {
        console.info("[ica-store-search] module-load-start");
        storeSearch = await loadIcaStoreSearch();
        console.info("[ica-store-search] module-load-ok");
      } catch (error) {
        const debug = fallbackDebug(query, "module_load_failed", error);
        console.error("[ica-store-search] module-load-failed", debug);
        return res.status(200).json({
          stores: [],
          error: "ICA store search module unavailable",
          debug,
        });
      }

      try {
        const result = await storeSearch.searchIcaStoresWithDebug(query);
        console.info("[ica-store-search] result", result.debug);
        return res.status(200).json(result);
      } catch (error) {
        const debug = fallbackDebug(query, "search_failed", error);
        console.error("[ica-store-search] search-failed", debug);
        return res.status(200).json({
          stores: [],
          error: "ICA store search unavailable",
          debug,
        });
      }
    } catch (error) {
      const debug = fallbackDebug(query, "route_crashed", error);
      console.error("[ica-store-search] route-crashed", debug);
      return res.status(200).json({
        stores: [],
        error: "ICA store search route crashed",
        debug,
      });
    }
  };
}

export default createIcaStoreSearchHandler();

import type { IncomingMessage, ServerResponse } from "node:http";

type ApiResponse = ServerResponse & {
  status(statusCode: number): ApiResponse;
  json(body: unknown): ApiResponse;
};

type IcaNearestModule = Pick<typeof import("../../_lib/icaStoreSearch.js"), "findNearestIcaStoreWithDebug">;
type LoadIcaNearest = () => Promise<IcaNearestModule>;

const fallbackDebug = (lat: number, lng: number, stage: string, error?: unknown) => ({
  lat,
  lng,
  parsedStoreCount: 0,
  storesWithCoordinatesCount: 0,
  nearestDistanceKm: null,
  fallbackUsed: true,
  stage,
  ...(error ? { error: error instanceof Error ? error.message : String(error) } : {}),
});

const parseCoordinate = (value: string | null): number | null => {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function createIcaNearestStoreHandler(
  loadIcaNearest: LoadIcaNearest = async () => import("../../_lib/icaStoreSearch.js"),
) {
  return async function handler(req: IncomingMessage, res: ApiResponse) {
    const requestUrl = new URL(req.url ?? "/", "http://localhost");
    const lat = parseCoordinate(requestUrl.searchParams.get("lat"));
    const lng = parseCoordinate(requestUrl.searchParams.get("lng"));

    if (lat === null || lng === null) {
      return res.status(400).json({
        store: null,
        stores: [],
        error: "Valid lat and lng query parameters are required",
        debug: fallbackDebug(lat ?? Number.NaN, lng ?? Number.NaN, "invalid_coordinates"),
      });
    }

    try {
      const nearest = await loadIcaNearest();
      const result = await nearest.findNearestIcaStoreWithDebug({ latitude: lat, longitude: lng });
      console.info("[ica-store-nearest] result", result.debug);
      return res.status(200).json(result);
    } catch (error) {
      const debug = fallbackDebug(lat, lng, "nearest_failed", error);
      console.error("[ica-store-nearest] failed", debug);
      return res.status(200).json({
        store: null,
        stores: [],
        error: "ICA nearest store unavailable",
        debug,
      });
    }
  };
}

export default createIcaNearestStoreHandler();

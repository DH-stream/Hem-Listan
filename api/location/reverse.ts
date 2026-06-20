import type { IncomingMessage, ServerResponse } from "node:http";

type ApiResponse = ServerResponse & {
  status(statusCode: number): ApiResponse;
  json(body: unknown): ApiResponse;
};

type LocationModule = Pick<typeof import("../_lib/icaStoreSearch.js"), "reverseGeocodeLocation">;
type LoadLocation = () => Promise<LocationModule>;

const parseCoordinate = (value: string | null): number | null => {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function createReverseLocationHandler(
  loadLocation: LoadLocation = async () => import("../_lib/icaStoreSearch.js"),
) {
  return async function handler(req: IncomingMessage, res: ApiResponse) {
    const requestUrl = new URL(req.url ?? "/", "http://localhost");
    const lat = parseCoordinate(requestUrl.searchParams.get("lat"));
    const lng = parseCoordinate(requestUrl.searchParams.get("lng"));

    if (lat === null || lng === null) {
      return res.status(400).json({
        query: "",
        error: "Valid lat and lng query parameters are required",
        debug: { fallbackUsed: true, stage: "invalid_coordinates" },
      });
    }

    try {
      const location = await loadLocation();
      return res.status(200).json(await location.reverseGeocodeLocation({ latitude: lat, longitude: lng }));
    } catch (error) {
      return res.status(200).json({
        query: "",
        error: "Reverse geocoding unavailable",
        debug: {
          fallbackUsed: true,
          stage: "reverse_geocode_failed",
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  };
}

export default createReverseLocationHandler();

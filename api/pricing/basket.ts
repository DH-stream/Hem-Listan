import type { IncomingMessage, ServerResponse } from "node:http";

type ApiRequest = IncomingMessage & { body?: unknown };
type ApiResponse = ServerResponse & {
  status(statusCode: number): ApiResponse;
  json(body: unknown): ApiResponse;
};

type BasketPricingModule = Pick<typeof import("../_lib/basketPricing.js"), "validateBasketPricingRequest"> &
  Partial<Pick<typeof import("../_lib/basketPricing.js"), "calculateCityGrossBasket">> &
  Partial<Pick<typeof import("../_lib/pricingProviders.js"), "calculateBasketPricing">>;
type LoadBasketPricing = () => Promise<BasketPricingModule>;

interface SerializedPricingError {
  name: string;
  message: string;
  code?: string;
  causeMessage?: string;
}

const isPricingDebugRequest = (req: ApiRequest) => {
  const requestUrl = new URL(req.url ?? "/", "http://localhost");
  const debugHeader = req.headers?.["x-pricing-debug"];
  return (
    requestUrl.searchParams.get("debug") === "1" ||
    requestUrl.searchParams.get("pricingDebug") === "1" ||
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

const safeErrorMessage = (value: unknown) =>
  value instanceof Error
    ? value.message
    : typeof value === "string"
      ? value
      : "Unknown pricing error";

export const serializePricingError = (
  error: unknown,
): SerializedPricingError => {
  if (!(error instanceof Error)) {
    return {
      name: "Error",
      message: safeErrorMessage(error),
    };
  }

  const errorWithDetails = error as Error & {
    code?: unknown;
    cause?: unknown;
  };
  const code = errorWithDetails.code;
  const cause = errorWithDetails.cause;

  return {
    name: error.name || "Error",
    message: error.message || "Unknown pricing error",
    ...(typeof code === "string" || typeof code === "number"
      ? { code: String(code) }
      : {}),
    ...(cause !== undefined ? { causeMessage: safeErrorMessage(cause) } : {}),
  };
};

const logPricingError = (debug: boolean, message: string, error: unknown) => {
  if (!debug) return;
  console.error(`[pricing-api] ${message}`, error);
};

const fallbackResponse = (
  debug: boolean,
  debugCode: string,
  error: unknown,
) => {
  const serializedError = serializePricingError(error);
  const debugMessage = serializedError.message;
  pricingApiLog(debug, "stage fallback", {
    debugCode,
    debugMessage,
    error: serializedError,
  });
  logPricingError(debug, `${debugCode} stack`, error);

  return {
    matches: [],
    approximateTotalSek: 0,
    error: "Basket pricing unavailable",
    ...(debug ? { debugCode, debugMessage } : {}),
  };
};

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
  loadBasketPricing: LoadBasketPricing = async () => ({
    ...(await import("../_lib/basketPricing.js")),
    ...(await import("../_lib/pricingProviders.js")),
  }),
) {
  return async function handler(req: ApiRequest, res: ApiResponse) {
    const debug = isPricingDebugRequest(req);
    pricingApiLog(debug, "stage received", {
      method: req.method,
      url: req.url,
    });

    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    let body: unknown;
    try {
      pricingApiLog(debug, "stage body-read-start");
      body = await readJsonBody(req);
      pricingApiLog(debug, "stage body-read-ok", {
        bodyKind: Array.isArray(body) ? "array" : typeof body,
        ...(!Array.isArray(body) &&
        body &&
        typeof body === "object" &&
        Array.isArray((body as { items?: unknown }).items)
          ? { itemCount: (body as { items: unknown[] }).items.length }
          : {}),
      });
    } catch (error) {
      const serializedError = serializePricingError(error);
      pricingApiLog(debug, "stage fallback", {
        debugCode: "invalid_json",
        debugMessage: serializedError.message,
      });
      logPricingError(debug, "invalid_json stack", error);
      return res.status(400).json({
        error: "Invalid JSON body.",
        ...(debug
          ? {
              debugCode: "invalid_json",
              debugMessage: serializedError.message,
            }
          : {}),
      });
    }

    let pricing: BasketPricingModule;
    try {
      pricingApiLog(debug, "stage module-load-start");
      pricing = await loadBasketPricing();
      pricingApiLog(debug, "stage module-load-ok");
    } catch (error) {
      return res
        .status(200)
        .json(fallbackResponse(debug, "module_load_failed", error));
    }

    const validation = pricing.validateBasketPricingRequest(body);
    if (validation.ok === false) {
      pricingApiLog(debug, "stage fallback", {
        debugCode: "validation_failed",
        debugMessage: validation.error,
      });
      return res.status(400).json({
        error: validation.error,
        ...(debug
          ? {
              debugCode: "validation_failed",
              debugMessage: validation.error,
            }
          : {}),
      });
    }

    pricingApiLog(debug, "stage validation-ok", {
      itemCount: validation.request.items.length,
    });

    try {
      pricingApiLog(debug, "stage calculation-start");
      const calculateBasket =
        pricing.calculateBasketPricing ??
        (validation.request.chain === "city_gross"
          ? pricing.calculateCityGrossBasket
          : undefined);
      if (!calculateBasket) {
        throw new Error("Basket pricing calculator unavailable for selected chain");
      }
      const result = await calculateBasket(
        validation.request,
        {
          debug,
        },
      );
      pricingApiLog(debug, "stage calculation-ok", {
        matchCount: result.matches.length,
        pricedCount: result.matches.filter((match) => match.product).length,
        approximateTotalSek: result.approximateTotalSek,
      });
      return res.status(200).json(result);
    } catch (error) {
      return res
        .status(200)
        .json(fallbackResponse(debug, "calculation_failed", error));
    }
  };
}

export default createBasketPricingHandler();

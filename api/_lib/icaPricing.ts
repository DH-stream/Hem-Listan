import type { ProductPrice } from "../../src/lib/pricing/types";

const ICA_ORIGIN = "https://handlaprivatkund.ica.se";

interface IcaSearchOptions {
  debug?: boolean;
}

const pricingApiLog = (enabled: boolean, message: string, details?: unknown) => {
  if (enabled) console.log(`[pricing-api] ${message}`, details ?? "");
};

export async function searchIcaProducts(
  query: string,
  storeId = "1004392",
  options: IcaSearchOptions = {},
): Promise<ProductPrice[]> {
  const debug = options.debug ?? false;
  const normalizedStoreId = storeId.trim() || "1004392";
  const storeUrl = `${ICA_ORIGIN}/stores/${encodeURIComponent(normalizedStoreId)}`;

  pricingApiLog(debug, "ica search scaffold", {
    query,
    storeId: normalizedStoreId,
    storeUrl,
  });

  // ICA's customer site is store/session driven and no stable public product
  // search endpoint is wired yet. Return no fabricated prices; the basket
  // pricing pipeline will surface the same controlled no-match estimate shape.
  return [];
}

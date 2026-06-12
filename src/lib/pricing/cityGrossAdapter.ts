import { matchListItem } from "./matching";
import type { GroceryPriceAdapter, ProductPrice, Store } from "./types";

export const CITY_GROSS_DEMO_STORE: Store = {
  id: "city-gross-demo",
  chainId: "city_gross",
  name: "City Gross Demo-butik",
  isDemo: true,
};

const demoProducts: ProductPrice[] = [
  { chainId: "city_gross", id: "cg-mjolk", storeId: CITY_GROSS_DEMO_STORE.id, productName: "Arla Ko Mellanmjölk 1,5% 1 l", priceSek: 16.95, unitLabel: "1 l", searchTerms: ["mjölk", "mellanmjölk"] },
  { chainId: "city_gross", id: "cg-agg", storeId: CITY_GROSS_DEMO_STORE.id, productName: "Svenska frigående ägg 12-pack", priceSek: 39.95, unitLabel: "12 st", searchTerms: ["ägg", "agg"] },
  { chainId: "city_gross", id: "cg-pasta", storeId: CITY_GROSS_DEMO_STORE.id, productName: "Barilla Spaghetti 500 g", priceSek: 18.95, unitLabel: "500 g", searchTerms: ["pasta", "spaghetti"] },
  { chainId: "city_gross", id: "cg-kottfars", storeId: CITY_GROSS_DEMO_STORE.id, productName: "Svensk nötfärs 12% 500 g", priceSek: 59.95, unitLabel: "500 g", searchTerms: ["köttfärs", "kottfars", "nötfärs"] },
  { chainId: "city_gross", id: "cg-kaffe", storeId: CITY_GROSS_DEMO_STORE.id, productName: "Gevalia Mellanrost Bryggkaffe 450 g", priceSek: 54.95, unitLabel: "450 g", searchTerms: ["kaffe", "bryggkaffe"] },
  { chainId: "city_gross", id: "cg-banan", storeId: CITY_GROSS_DEMO_STORE.id, productName: "Banan klass 1", priceSek: 29.95, unitLabel: "ca 1 kg", searchTerms: ["banan", "bananer"] },
  { chainId: "city_gross", id: "cg-brod", storeId: CITY_GROSS_DEMO_STORE.id, productName: "Pågen Lingongrova 500 g", priceSek: 31.95, unitLabel: "500 g", searchTerms: ["bröd", "brod", "limpa"] },
  { chainId: "city_gross", id: "cg-ost", storeId: CITY_GROSS_DEMO_STORE.id, productName: "Arla Hushållsost 26% ca 1 kg", priceSek: 109, unitLabel: "ca 1 kg", searchTerms: ["ost", "hushållsost"] },
  { chainId: "city_gross", id: "cg-yoghurt", storeId: CITY_GROSS_DEMO_STORE.id, productName: "Valio Yoghurt Naturell 1 kg", priceSek: 27.95, unitLabel: "1 kg", searchTerms: ["yoghurt", "yogurt"] },
];

export const cityGrossPriceAdapter: GroceryPriceAdapter = {
  chain: { id: "city_gross", name: "City Gross" },
  stores: [CITY_GROSS_DEMO_STORE],
  async calculateBasket(storeId, items) {
    const store = this.stores.find((candidate) => candidate.id === storeId);
    if (!store) throw new Error("Den valda demo-butiken kunde inte hittas.");

    const matches = items.map((item) => matchListItem(item, demoProducts));
    return {
      store,
      matches,
      approximateTotalSek: Math.round(
        matches.reduce(
          (total, match) => total + (match.estimatedCheckoutPriceSek ?? match.product?.priceSek ?? 0),
          0,
        ) * 100,
      ) / 100,
      matchedItemCount: matches.filter((match) => match.product).length,
      uncertainOrMissingItemCount: matches.filter(
        (match) => match.confidence !== "high",
      ).length,
      calculatedAt: new Date().toISOString(),
      isEstimate: true,
    };
  },
};

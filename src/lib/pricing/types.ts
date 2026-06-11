export type PriceMode = "manual_store" | "cheapest_store";

export type GroceryChainId = "city_gross" | (string & {});

export interface GroceryChain {
  id: GroceryChainId;
  name: string;
}

export interface Store {
  id: string;
  chainId: GroceryChainId;
  name: string;
  isDemo?: boolean;
}

export type PriceMatchConfidence = "high" | "medium" | "low" | "none";

export interface ProductPrice {
  id: string;
  storeId: string;
  productName: string;
  priceSek: number;
  unitLabel: string;
  searchTerms: string[];
}

export interface ListItemPriceMatch {
  listItemId: string;
  listItemName: string;
  product: ProductPrice | null;
  confidence: PriceMatchConfidence;
}

export interface BasketPriceResult {
  store: Store;
  matches: ListItemPriceMatch[];
  approximateTotalSek: number;
  matchedItemCount: number;
  uncertainOrMissingItemCount: number;
  calculatedAt: string;
  isEstimate: true;
}

export interface GroceryPriceAdapter {
  chain: GroceryChain;
  stores: Store[];
  calculateBasket(
    storeId: string,
    items: Array<{ id: string; name: string }>,
  ): Promise<BasketPriceResult>;
}

export interface UserStorePreferences {
  priceMode: PriceMode;
  selectedStoreId: string | null;
}

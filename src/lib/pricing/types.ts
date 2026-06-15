export type PriceMode = "manual_store" | "cheapest_store";

export type GroceryChainId =
  | "city_gross"
  | "ica"
  | "coop"
  | (string & {});

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
  chainId: GroceryChainId;
  storeId: string;
  productName: string;
  priceSek: number;
  unitLabel: string;
  searchTerms: string[];
  comparePrice?: string;
  category?: string;
  categoryPath?: string[];
  productUrl?: string;
  imageUrl?: string;
  isCampaign?: boolean;
  fetchedAt?: string;
}

export interface PurchasePlan {
  totalPriceSek: number;
  purchasedAmount: number;
  items: Array<{ product: ProductPrice; count: number }>;
}

export interface ListItemPriceMatch {
  listItemId: string;
  listItemName: string;
  sourceTaskIds?: string[];
  product: ProductPrice | null;
  confidence: PriceMatchConfidence;
  estimatedCheckoutPriceSek?: number;
  priceBasis?: "product_price" | "weighted_item_estimate" | "package_plan";
  purchasePlan?: PurchasePlan;
  preferenceScore?: number;
  preferenceReasons?: string[];
}

export interface BasketPriceEstimate {
  matches: ListItemPriceMatch[];
  approximateTotalSek: number;
  error?: string;
  debugMessage?: string;
  debugCode?: string;
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

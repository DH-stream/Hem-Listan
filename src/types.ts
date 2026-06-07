/**
 * Type declarations for Hem-Listan
 */

export interface TaskItem {
  id: string;
  text: string;
  checked: boolean;
  notes?: string;
  progress?: number; // percentage, e.g., 66 for Window Installation
  type?: "task" | "note" | "progress" | "link";
  url?: string;
}

export type MealType = "frukost" | "lunch" | "middag";

export interface RecipeIngredient {
  rawText?: string;
  text: string;
  quantity: string;
  category: string;
  note?: string;
}

export interface MealSlot {
  id: string;
  day: string; // "Måndag", "Tisdag" etc.
  type: MealType;
  name: string;
  source?: "manual" | "recipe_import";
  recipeSourceUrl?: string;
  recipeSourceDomain?: string;
  recipeIngredients?: RecipeIngredient[];
  recipeInstructions?: string[];
  recipeImageUrl?: string;
  importedAt?: string;
}

export interface ListTheme {
  primary: string;
  container: string;
  onContainer: string;
}

export interface List {
  id: string;
  name: string;
  icon: string; // home, shopping_cart, construction, favorite, book, restaurant, fitness_center, flight etc.
  themeColor: string; // hex or CSS class
  category: "renovation" | "grocery" | "general";
  tasks: TaskItem[];
  meals?: MealSlot[]; // for grocery/schema lists
  deletedAt?: string;
  deleted_at?: string;
  membershipRole?: "owner" | "member";
  memberCount?: number;
}

export interface ListMember {
  userId: string;
  role: "owner" | "member";
  displayName: string | null;
  avatarUrl: string | null;
  avatarPath: string | null;
}

export interface DeletedList extends List {
  deletedAt: string;
  restoreSource?: "local" | "cloud";
}


export interface UserProfile {
  userId: string;
  displayName: string;
  avatarPath: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Stats {
  listsCount: number;
  itemsLeftCount: number;
  completedCount: number;
}


export interface PublicListShare {
  title: string;
  icon?: string;
  themeColor?: string;
  category?: List["category"];
  snapshot: {
    name?: string;
    title?: string;
    icon?: string;
    themeColor?: string;
    category?: List["category"];
    senderName?: string;
    shareMessageVariant?: 0 | 1 | 2;
    tasks?: TaskItem[];
    meals?: MealSlot[];
  };
  createdAt: string;
}

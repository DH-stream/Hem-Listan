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

export interface MealSlot {
  id: string;
  day: string; // "Måndag", "Tisdag" etc.
  type: MealType;
  name: string;
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
}

export interface DeletedList extends List {
  deletedAt: string;
  restoreSource?: "local" | "cloud";
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
    tasks?: TaskItem[];
    meals?: MealSlot[];
  };
  createdAt: string;
}

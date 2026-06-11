import type { RecipeIngredient, TaskItem } from "../../types";

export type GroceryCategory =
  | "Kött & Fisk"
  | "Mejeri"
  | "Frukt & Grönt"
  | "Skafferi"
  | "Fryst"
  | "Övrigt";

export type QuantityPolicy = "skip" | "hide" | "exact" | "package_round";
export type QuantityDimension = "volume" | "weight" | "count" | "package";

export interface ParsedQuantity {
  amount: number;
  unit: "ml" | "g" | "st" | "förp";
  dimension: QuantityDimension;
  approximate: boolean;
  packageSize?: string;
}

export interface CanonicalGroceryItem {
  raw: string;
  name: string;
  quantity: ParsedQuantity | null;
  category: GroceryCategory;
  policy: QuantityPolicy;
}

export interface GroceryTaskUpdate {
  taskId: string;
  updates: Pick<TaskItem, "text" | "notes">;
}

export interface GroceryMergePlan {
  tasks: TaskItem[];
  updates: GroceryTaskUpdate[];
  creates: TaskItem[];
  skipped: RecipeIngredient[];
}

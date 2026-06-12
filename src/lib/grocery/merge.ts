import type { RecipeIngredient, TaskItem } from "../../types";
import { displayGroceryItem } from "./display";
import {
  normalizeGroceryName,
  normalizeRecipeIngredient,
  normalizeShoppingItemNameForStore,
} from "./normalize";
import { addQuantities, parseQuantity } from "./parseQuantity";
import type { CanonicalGroceryItem, GroceryMergePlan } from "./types";

const parseTask = (task: TaskItem): CanonicalGroceryItem => {
  const quantityText = task.text.match(/\(([^)]+)\)\s*$/)?.[1];
  const nameText = task.text.replace(/\s*\([^)]+\)\s*$/, "");
  const name = normalizeGroceryName(nameText);
  const normalized = normalizeRecipeIngredient({ text: name, quantity: quantityText || "", category: task.notes || "" });
  const hasPersistedPackageSuggestion = normalized.policy === "package_round" && Boolean(quantityText);
  return {
    ...normalized,
    // Persisted package-rounded text is a shopping suggestion, not the raw recipe need.
    quantity: hasPersistedPackageSuggestion ? null : parseQuantity(quantityText),
    policy: hasPersistedPackageSuggestion ? "hide" : normalized.policy,
  };
};

const canSafelyMerge = (left: CanonicalGroceryItem, right: CanonicalGroceryItem) => {
  if (!left.name || left.name !== right.name) return false;
  if (left.policy === "hide" || right.policy === "hide") return true;
  if (!left.quantity || !right.quantity) return true;
  return addQuantities(left.quantity, right.quantity) !== null;
};

const combine = (existing: CanonicalGroceryItem, incoming: CanonicalGroceryItem): CanonicalGroceryItem => {
  const quantity = addQuantities(existing.quantity, incoming.quantity);
  return {
    ...incoming,
    quantity: quantity ?? existing.quantity ?? incoming.quantity,
    category: incoming.category === "Övrigt" ? existing.category : incoming.category,
    policy: existing.policy === "hide" && incoming.policy === "package_round" ? "hide" : incoming.policy,
  };
};

export const buildGroceryMergePlan = (
  existingTasks: TaskItem[],
  ingredients: RecipeIngredient[],
  createId: (index: number) => string,
): GroceryMergePlan => {
  const tasks = existingTasks.map(task => ({ ...task }));
  const creates: TaskItem[] = [];
  const skipped: RecipeIngredient[] = [];
  const updateMap = new Map<string, { text: string; notes: string }>();
  const canonicalByTaskId = new Map(tasks.map(task => [task.id, parseTask(task)]));

  ingredients.forEach((ingredient, index) => {
    const incoming = normalizeRecipeIngredient({
      ...ingredient,
      text: normalizeShoppingItemNameForStore(ingredient.text),
    });
    if (!incoming.name || incoming.policy === "skip") {
      skipped.push(ingredient);
      return;
    }

    const candidate = tasks.find(task => {
      const existing = canonicalByTaskId.get(task.id) ?? parseTask(task);
      return !task.checked && canSafelyMerge(existing, incoming);
    });
    if (candidate) {
      const existing = canonicalByTaskId.get(candidate.id) ?? parseTask(candidate);
      const combined = combine(existing, incoming);
      canonicalByTaskId.set(candidate.id, combined);
      candidate.text = displayGroceryItem(combined);
      candidate.notes = combined.category;
      if (!creates.some(task => task.id === candidate.id)) {
        updateMap.set(candidate.id, { text: candidate.text, notes: candidate.notes });
      }
      return;
    }

    const task: TaskItem = {
      id: createId(index),
      text: displayGroceryItem(incoming),
      checked: false,
      notes: incoming.category,
    };
    tasks.unshift(task);
    creates.push(task);
    canonicalByTaskId.set(task.id, incoming);
  });

  return {
    tasks,
    creates,
    skipped,
    updates: [...updateMap].map(([taskId, updates]) => ({ taskId, updates })),
  };
};

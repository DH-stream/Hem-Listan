import type { List, MealSlot } from "../types";

export interface PendingMealSave {
  listId: string;
  meal: MealSlot;
}

export const mergePendingMeals = (
  fetchedLists: List[],
  pendingSaves: Iterable<PendingMealSave>,
): List[] => {
  const pendingByList = new Map<string, MealSlot[]>();

  for (const pending of pendingSaves) {
    const meals = pendingByList.get(pending.listId) ?? [];
    meals.push(pending.meal);
    pendingByList.set(pending.listId, meals);
  }

  if (pendingByList.size === 0) return fetchedLists;

  return fetchedLists.map((list) => {
    const pendingMeals = pendingByList.get(list.id);
    if (!pendingMeals?.length) return list;

    const meals = [...(list.meals ?? [])];
    for (const pendingMeal of pendingMeals) {
      const slotIndex = meals.findIndex(
        (meal) => meal.day === pendingMeal.day && meal.type === pendingMeal.type,
      );
      if (slotIndex === -1) meals.push(pendingMeal);
      else meals[slotIndex] = pendingMeal;
    }

    return { ...list, meals };
  });
};

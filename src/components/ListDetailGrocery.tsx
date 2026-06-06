import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { List, ListMember, TaskItem, MealSlot, MealType } from "../types";
import LucideIcon from "./LucideIcon";
import SharedListCount from "./SharedListCount";
import CelebrationCard from "./CelebrationCard";
import MealModal from "./MealModal";

interface ListDetailGroceryProps {
  list: List;
  members: ListMember[] | null;
  onBack: () => void;
  onToggleTask: (listId: string, taskId: string) => void;
  onAddTask: (listId: string, text: string, categoryName?: string) => void;
  onDeleteTask: (listId: string, taskId: string) => void;
  onUpdateTask: (
    listId: string,
    taskId: string,
    updates: Partial<TaskItem>,
  ) => void;
  onResetList: (listId: string) => void;
  onAddMeal: (
    listId: string,
    day: string,
    type: MealType,
    name: string,
  ) => void;
  onDeleteMeal: (listId: string, mealId: string) => void;
  onBulkAddGroceryDetails: (
    listId: string,
    mealName: string,
    ingredients: { text: string; quantity: string; category: string }[],
  ) => void;
}

export default function ListDetailGrocery({
  list,
  members,
  onBack,
  onToggleTask,
  onAddTask,
  onDeleteTask,
  onUpdateTask,
  onResetList,
  onAddMeal,
  onDeleteMeal,
  onBulkAddGroceryDetails,
}: ListDetailGroceryProps) {
  // Navigation within list: 0 = "Schema" view, 1 = "Lista" view
  const [activeTab, setActiveTab] = useState<number>(0);
  const [showCompleted, setShowCompleted] = useState(false);

  // States for Link Importer
  const [recipeUrl, setRecipeUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  // States for adding item / meals
  const [newItemText, setNewItemText] = useState("");

  const [mealModalOpen, setMealModalOpen] = useState(false);
  const [pendingMeal, setPendingMeal] = useState<{
    day: string;
    type: MealType;
  } | null>(null);
  const totalTasks = list.tasks.length;
  const completedTasks = list.tasks.filter((t) => t.checked);
  const completedCount = completedTasks.length;

  const defaultDays = [
    "Måndag",
    "Tisdag",
    "Onsdag",
    "Torsdag",
    "Fredag",
    "LÖrdag",
    "Söndag",
  ];

  const handleImportRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeUrl.trim()) return;

    setIsImporting(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      const response = await fetch("/api/import-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: recipeUrl.trim() }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.error || "Gick inte att hämta eller tolka receptet.",
        );
      }

      const data = await response.json();
      if (data && data.ingredients) {
        // Bulk import ingredients and meal slot dynamically!
        onBulkAddGroceryDetails(
          list.id,
          data.mealName || data.recipeName,
          data.ingredients,
        );

        setImportSuccess(
          `Framgångsrikt importerat: "${data.recipeName}"! Ny middag inlagd och ${data.ingredients.length} varor tillagda i inköpslistan.`,
        );
        setRecipeUrl("");
      } else {
        throw new Error("Receptet verkar sakna ingredienser.");
      }
    } catch (err: any) {
      setImportError(err.message || "Ett oväntat fel uppstod.");
    } finally {
      setIsImporting(false);
    }
  };

  // Helper categorization heuristic in Swedish
  const predictCategory = (text: string): string => {
    const textLower = text.toLowerCase();

    const fruitVeg = [
      "äpple",
      "banan",
      "avokado",
      "päron",
      "lök",
      "vitlök",
      "morot",
      "tomat",
      "sallad",
      "gurka",
      "paprika",
      "citron",
      "lime",
      "potatis",
      "ingefära",
      "frukt",
      "grönt",
      "spenat",
      "svamp",
    ];
    const dairy = [
      "mjölk",
      "grädde",
      "smör",
      "ost",
      "creme fraiche",
      "kvarg",
      "yoghurt",
      "ägg",
      "milda",
      "mejeri",
    ];
    const pantry = [
      "pasta",
      "spagetti",
      "makaroner",
      "ris",
      "vete",
      "mjöl",
      "socker",
      "solrosolja",
      "olja",
      "vinäger",
      "salt",
      "peppar",
      "krossade",
      "burk",
      "buljong",
      "bröd",
      "gryn",
      "skafferi",
      "krydda",
      "ketchup",
      "senap",
    ];
    const meats = [
      "lax",
      "torsks",
      "fisk",
      "kyckling",
      "bacon",
      "färs",
      "nötfärs",
      "fläsk",
      "kött",
      "skinka",
      "korv",
      "räkor",
    ];
    const frozen = ["fryst", "glass", "frysta", "wok"];

    if (fruitVeg.some((kw) => textLower.includes(kw))) return "Frukt & Grönt";
    if (dairy.some((kw) => textLower.includes(kw))) return "Mejeri";
    if (pantry.some((kw) => textLower.includes(kw))) return "Skafferi";
    if (meats.some((kw) => textLower.includes(kw))) return "Kött & Fisk";
    if (frozen.some((kw) => textLower.includes(kw))) return "Fryst";
    return "Övrigt";
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (newItemText.trim()) {
      const category = predictCategory(newItemText.trim());
      onAddTask(list.id, newItemText.trim(), category);
      setNewItemText("");
    }
  };

  const triggerAddMealPrompt = (day: string, type: MealType) => {
    setPendingMeal({ day, type });
    setMealModalOpen(true);
  };

  // Group list items by category for display (only active, unchecked items):
  const getCategorizedTasks = () => {
    const grouped: { [category: string]: TaskItem[] } = {
      "Frukt & Grönt": [],
      Mejeri: [],
      Skafferi: [],
      "Kött & Fisk": [],
      Fryst: [],
      Övrigt: [],
    };

    const activeTasks = list.tasks.filter((t) => !t.checked);

    activeTasks.forEach((t) => {
      // Look up inside notes (category fallback)
      const cat = t.notes || "Övrigt";
      if (grouped[cat]) {
        grouped[cat].push(t);
      } else {
        // Dynamic addition of uncategorized mapped categories
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(t);
      }
    });

    return grouped;
  };

  const categorized = getCategorizedTasks();

  const getCatIcon = (name: string) => {
    switch (name) {
      case "Frukt & Grönt":
        return "eco";
      case "Mejeri":
        return "water_drop";
      case "Skafferi":
        return "inventory";
      default:
        return "today";
    }
  };

  const handleMealModalClose = useCallback(() => {
    setMealModalOpen(false);
    setPendingMeal(null);
  }, []);

  const handleMealModalConfirm = useCallback((name: string) => {
    if (pendingMeal && name.trim()) {
      onAddMeal(list.id, pendingMeal.day, pendingMeal.type, name.trim());
    }
    setMealModalOpen(false);
    setPendingMeal(null);
  }, [pendingMeal, onAddMeal, list.id]);

  return (
    <div className="w-full max-w-[768px] mx-auto pb-[170px]">
      {/* Dynamic Header Toolbar */}
      <header className="w-full px-5 sticky top-0 bg-surface/80 backdrop-blur-xl flex justify-between items-center py-4 z-40 mb-3">
        <button
          onClick={onBack}
          className="p-1.5 hover:bg-surface-container text-primary rounded-full transition-all active:scale-95 shrink-0"
          title="Gå tillbaka"
        >
          <LucideIcon name="arrow_back" className="w-6 h-6" />
        </button>

        <div className="flex min-w-0 flex-1 flex-col items-center pr-4">
          <div className="flex max-w-full items-center gap-2">
            <h1 className="min-w-0 truncate font-display text-lg font-bold text-text-main">
              {list.name}
            </h1>
          </div>
          <SharedListCount count={members?.length ?? list.memberCount} className="mt-1.5" />
          {/* Dot Pagination indicators */}
          <div className="flex gap-1.5 mt-1.5">
            <span
              onClick={() => setActiveTab(0)}
              className={`w-2 h-2 rounded-full cursor-pointer transition-all duration-300 ${
                activeTab === 0
                  ? "bg-primary w-4"
                  : "bg-surface-container-highest"
              }`}
            />
            <span
              onClick={() => setActiveTab(1)}
              className={`w-2 h-2 rounded-full cursor-pointer transition-all duration-300 ${
                activeTab === 1
                  ? "bg-primary w-4"
                  : "bg-surface-container-highest"
              }`}
            />
          </div>
        </div>

        <button className="p-2 hover:bg-surface-container text-primary rounded-full transition-all shrink-0">
          <LucideIcon name="shopping_cart" className="w-5 h-5 opacity-80" />
        </button>
      </header>

      {/* Slide Carousel Layout Blocks */}
      <div className="px-5">
        {activeTab === 0 ? (
          /* VIEW 1: SCHEMA VIEW */
          <motion.div
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* Import Recipe card form */}
            <div className="bg-surface-container-lowest p-5 rounded-xl bento-glow-primary border border-surface-container/30">
              <div className="flex items-center gap-3 mb-2.5">
                <div className="bg-primary/10 p-2 rounded-lg text-primary">
                  <LucideIcon name="link" className="w-5 h-5 font-bold" />
                </div>
                <h2 className="font-display text-base font-bold text-text-main">
                  Importera recept
                </h2>
              </div>
              <p className="font-sans text-xs text-on-surface-variant font-medium mb-3">
                Klistra in en länk från ICA, Tasteline, Arla m.fl. så hämtar
                Gemini ingredienser samt rätter direkt.
              </p>

              {importError && (
                <div className="bg-error/10 text-error text-xs p-3 rounded-lg border border-error/20 mb-3.5">
                  {importError}
                </div>
              )}

              {importSuccess && (
                <div className="bg-secondary-container text-on-secondary-container text-xs p-3 rounded-lg border border-secondary/20 mb-3.5">
                  {importSuccess}
                </div>
              )}

              <form onSubmit={handleImportRecipe} className="flex gap-2">
                <input
                  type="url"
                  required
                  value={recipeUrl}
                  onChange={(e) => setRecipeUrl(e.target.value)}
                  className="flex-1 bg-surface-container-low border border-surface-container rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-outline/50 outline-none font-sans"
                  placeholder="https://..."
                  disabled={isImporting}
                />
                <button
                  type="submit"
                  disabled={isImporting || !recipeUrl}
                  className="bg-primary text-white rounded-lg px-5 py-2 font-display text-xs font-bold active:scale-95 transition-all outline-none disabled:opacity-50 flex items-center gap-1 cursor-pointer shrink-0"
                >
                  {isImporting ? (
                    <>
                      <LucideIcon
                        name="loader"
                        className="w-3.5 h-3.5 animate-spin"
                      />
                      Hämtar...
                    </>
                  ) : (
                    "Hämta"
                  )}
                </button>
              </form>
            </div>

            {/* Weekly slots section category */}
            <div className="space-y-4">
              <h3 className="font-sans text-[11px] font-bold text-accent-rust uppercase tracking-wider">
                DENNA VECKA
              </h3>

              {defaultDays.map((day, idx) => {
                // Fetch existing meals for this day
                const mealsForDay =
                  list.meals?.filter((m) => m.day === day) || [];
                const breakfast = mealsForDay.find((m) => m.type === "frukost");
                const lunch = mealsForDay.find((m) => m.type === "lunch");
                const dinner = mealsForDay.find((m) => m.type === "middag");

                // Give each day an accent border tone similar to screenshot 2
                const dayBorderColor =
                  idx % 2 === 0 ? "border-t-[#FFE4E1]" : "border-t-[#E0F2F1]";

                return (
                  <div
                    key={day}
                    className={`bg-surface-container-lowest border-t-4 ${dayBorderColor} rounded-xl shadow-sm overflow-hidden border border-surface-container/30`}
                  >
                    <div className="p-4">
                      <h4 className="font-display text-base font-bold text-text-main mb-3.5">
                        {day}
                      </h4>

                      <div className="space-y-2.5">
                        {/* Frukost Slot */}
                        {breakfast ? (
                          <div className="bg-surface-container p-3 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <LucideIcon
                                name="sunny"
                                className="w-4 h-4 text-[#FFB347]"
                              />
                              <div>
                                <p className="text-[9px] uppercase font-bold text-outline tracking-wider leading-none mb-0.5">
                                  Frukost
                                </p>
                                <p className="font-sans text-xs font-semibold text-text-main">
                                  {breakfast.name}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                onDeleteMeal(list.id, breakfast.id)
                              }
                              className="text-on-surface-variant/60 hover:text-error hover:bg-surface-container rounded-full p-1"
                            >
                              <LucideIcon
                                name="close"
                                className="w-3.5 h-3.5"
                              />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => triggerAddMealPrompt(day, "frukost")}
                            className="border border-dashed border-surface-container-highest bg-[#FCF9F8] rounded-xl p-3 flex items-center justify-between text-outline/50 hover:bg-primary-fixed/5 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <LucideIcon
                                name="sunny"
                                className="w-4 h-4 text-[#FFB347]/55"
                              />
                              <span className="font-sans text-xs font-medium">
                                Frukost
                              </span>
                            </div>
                            <LucideIcon name="add" className="w-4 h-4" />
                          </div>
                        )}

                        {/* Lunch Slot */}
                        {lunch ? (
                          <div className="bg-surface-container p-3 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <LucideIcon
                                name="partly_sunny"
                                className="w-4 h-4 text-[#FFD700]"
                              />
                              <div>
                                <p className="text-[9px] uppercase font-bold text-outline tracking-wider leading-none mb-0.5">
                                  Lunch
                                </p>
                                <p className="font-sans text-xs font-semibold text-text-main">
                                  {lunch.name}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => onDeleteMeal(list.id, lunch.id)}
                              className="text-on-surface-variant/60 hover:text-error hover:bg-surface-container rounded-full p-1"
                            >
                              <LucideIcon
                                name="close"
                                className="w-3.5 h-3.5"
                              />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => triggerAddMealPrompt(day, "lunch")}
                            className="border border-dashed border-surface-container-highest bg-[#FCF9F8] rounded-xl p-3 flex items-center justify-between text-outline/50 hover:bg-primary-fixed/5 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <LucideIcon
                                name="partly_sunny"
                                className="w-4 h-4 text-[#FFD700]/55"
                              />
                              <span className="font-sans text-xs font-medium">
                                Lunch
                              </span>
                            </div>
                            <LucideIcon name="add" className="w-4 h-4" />
                          </div>
                        )}

                        {/* Middag Slot */}
                        {dinner ? (
                          <div className="bg-surface-container p-3 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <LucideIcon
                                name="bedtime"
                                className="w-4 h-4 text-[#FF8C00]"
                              />
                              <div>
                                <p className="text-[9px] uppercase font-bold text-outline tracking-wider leading-none mb-0.5">
                                  Middag
                                </p>
                                <p className="font-sans text-xs font-semibold text-text-main line-clamp-1">
                                  {dinner.name}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => onDeleteMeal(list.id, dinner.id)}
                              className="text-on-surface-variant/60 hover:text-error hover:bg-surface-container rounded-full p-1"
                            >
                              <LucideIcon
                                name="close"
                                className="w-3.5 h-3.5"
                              />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => triggerAddMealPrompt(day, "middag")}
                            className="border border-dashed border-surface-container-highest bg-[#FCF9F8] rounded-xl p-3 flex items-center justify-between text-outline/50 hover:bg-primary-fixed/5 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <LucideIcon
                                name="bedtime"
                                className="w-4 h-4 text-[#FF8C00]/55"
                              />
                              <span className="font-sans text-xs font-medium">
                                Middag
                              </span>
                            </div>
                            <LucideIcon name="add" className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ) : (
          /* VIEW 2: GROCERY CHECKLIST VIEW */
          <motion.div
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* Progress status card banner details */}
            <div className="bg-surface-container-lowest p-5 rounded-xl border border-surface-container/30 bento-glow-primary">
              <div className="flex justify-between items-end mb-2.5">
                <div>
                  <p className="font-sans text-xs font-semibold text-on-surface-variant">
                    Shopping Progress
                  </p>
                  <h2 className="font-display text-xl font-bold text-primary mt-0.5">
                    {totalTasks - completedCount} varor kvar
                  </h2>
                </div>
                <p className="font-display text-base font-bold text-primary">
                  {completedCount} / {totalTasks}
                </p>
              </div>

              <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {totalTasks > 0 && completedCount === totalTasks ? (
              <CelebrationCard
                listName={list.name}
                totalTasks={totalTasks}
                onReset={() => onResetList(list.id)}
              />
            ) : (
              /* Grocery categories lists checklists */
              <div className="space-y-6">
                {Object.keys(categorized).map((categoryName) => {
                  const items = categorized[categoryName];
                  if (items.length === 0) return null;

                  return (
                    <section key={categoryName}>
                      <div className="flex items-center gap-2 mb-3 px-1">
                        <LucideIcon
                          name={getCatIcon(categoryName)}
                          className="w-4 h-4 text-on-surface-variant opacity-75"
                        />
                        <h3 className="font-sans text-xs font-bold text-outline uppercase tracking-wider">
                          {categoryName}
                        </h3>
                      </div>

                      <div className="space-y-2.5">
                        <AnimatePresence initial={false}>
                          {items.map((item) => (
                            <motion.div
                              key={item.id}
                              className={`flex items-center justify-between p-3.5 bg-surface-container-lowest rounded-xl border border-surface-container/25 shadow-sm hover:shadow transition-shadow group cursor-pointer ${
                                item.checked ? "opacity-60" : ""
                              }`}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              layoutId={`grocery-item-${item.id}`}
                            >
                              <div
                                onClick={() => onToggleTask(list.id, item.id)}
                                className="flex items-center gap-3.5 flex-1 min-w-0"
                              >
                                <div
                                  className={`w-5 h-5 rounded-full border-2 shrink-0 transition-all flex items-center justify-center ${
                                    item.checked
                                      ? "bg-primary border-primary"
                                      : "border-outline-variant group-hover:border-primary"
                                  }`}
                                >
                                  {item.checked && (
                                    <LucideIcon
                                      name="close"
                                      className="w-3.5 h-3.5 text-white"
                                    />
                                  )}
                                </div>
                                <span
                                  className={`font-sans text-sm text-text-main font-medium truncate ${
                                    item.checked
                                      ? "line-through opacity-70"
                                      : ""
                                  }`}
                                >
                                  {item.text}
                                </span>
                              </div>

                              <button
                                onClick={() => onDeleteTask(list.id, item.id)}
                                className="p-1 hover:bg-surface-container text-error rounded-full transition-colors opacity-50 hover:opacity-100"
                                title="Ta bort"
                              >
                                <LucideIcon name="close" className="w-4 h-4" />
                              </button>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </section>
                  );
                })}
              </div>
            )}

            {/* Completed items collapsible panel */}
            {completedTasks.length > 0 && (
              <div className="mt-4 border-t border-surface-container-high pt-4">
                <button
                  type="button"
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="w-full flex items-center justify-between py-2 text-outline hover:text-text-main transition-colors font-sans text-xs font-bold uppercase tracking-wider focus:outline-none cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <LucideIcon
                      name={showCompleted ? "chevron_down" : "chevron_right"}
                      className="w-4 h-4 text-outline"
                    />
                    <span>Handlade varor ({completedTasks.length})</span>
                  </div>
                  <span className="text-[10px] bg-surface-container-high px-2.5 py-0.5 rounded-full text-outline font-semibold">
                    {showCompleted ? "DÖLJ" : "VISA"}
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {showCompleted && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden space-y-2.5 mt-3"
                    >
                      {completedTasks.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3.5 bg-surface-container-lowest/70 rounded-xl border border-surface-container/20 opacity-70 group cursor-pointer hover:opacity-100 transition-opacity"
                        >
                          <div
                            onClick={() => onToggleTask(list.id, item.id)}
                            className="flex items-center gap-3.5 flex-1 min-w-0"
                          >
                            <div className="w-5 h-5 rounded-full border border-primary bg-primary flex items-center justify-center shrink-0">
                              <LucideIcon
                                name="close"
                                className="w-3.5 h-3.5 text-white"
                              />
                            </div>
                            <span className="font-sans text-sm text-text-main font-medium line-through truncate">
                              {item.text}
                            </span>
                          </div>

                          <button
                            onClick={() => onDeleteTask(list.id, item.id)}
                            className="p-1 hover:bg-surface-container text-error rounded-full transition-colors opacity-50 hover:opacity-100"
                            title="Ta bort"
                          >
                            <LucideIcon name="close" className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Inspirational Eco Tip Card */}
            <section className="pt-2">
              <div className="relative h-44 rounded-2xl overflow-hidden group cursor-pointer shadow-md bg-gradient-to-br from-primary/85 via-primary-container to-secondary-container">
                <div className="absolute right-5 top-5 w-16 h-16 rounded-full bg-white/20 flex items-center justify-center transition-transform duration-500 group-hover:scale-105">
                  <LucideIcon name="eco" className="w-8 h-8 text-white" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent flex flex-col justify-end p-5">
                  <p className="text-white font-sans text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1 leading-none">
                    Shopping Tips
                  </p>
                  <h4 className="text-white font-display text-lg font-bold">
                    Ekologiska val denna vecka
                  </h4>
                </div>
              </div>
            </section>
          </motion.div>
        )}
      </div>

      {/* QUICK ADD TEXT INPUT & STICKY BOTTOM TABS NAV */}
      <footer className="fixed bottom-0 left-0 w-full z-45">
        {/* Sticky Input (only visible on "Lista" view 1 or if adding items is helpful) */}
        {activeTab === 1 && (
          <div className="px-5 mb-4 flex justify-center">
            <form
              onSubmit={handleAddItem}
              className="w-full max-w-[768px] flex items-center gap-2 bg-white rounded-full p-1.5 shadow-xl border border-surface-container-high focus-within:ring-2 focus-within:ring-primary focus-within:bg-white"
            >
              <div className="flex-1 px-4">
                <input
                  type="text"
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  className="w-full bg-transparent border-none text-sm font-sans text-on-surface placeholder:text-outline/60 outline-none h-10 pr-2 focus:ring-0"
                  placeholder="Lägg till vara..."
                />
              </div>
              <button
                type="submit"
                disabled={!newItemText.trim()}
                className="bg-primary hover:bg-primary-container text-white w-10 h-10 rounded-full flex items-center justify-center shadow-md active:scale-90 transition-transform disabled:opacity-45"
              >
                <LucideIcon name="add" className="w-5 h-5 text-white" />
              </button>
            </form>
          </div>
        )}

        {/* Tab Selection controller nav bar */}
        <nav className="bg-white/95 backdrop-blur-md border-t border-surface-container-high px-5 py-3 flex justify-around items-center h-16 shadow-[0px_-4px_25px_rgba(0,59,5,0.02)]">
          <button
            onClick={() => setActiveTab(0)}
            className={`flex items-center gap-2 px-5 py-2 rounded-full transition-all duration-300 ${
              activeTab === 0
                ? "bg-[#FFE4E1] text-text-main font-bold"
                : "text-on-surface-variant font-medium text-xs"
            }`}
          >
            <LucideIcon name="calendar" className="w-4 h-4" />
            <span className="text-xs">Schema</span>
          </button>

          <button
            onClick={() => setActiveTab(1)}
            className={`flex items-center gap-2 px-5 py-2 rounded-full transition-all duration-300 ${
              activeTab === 1
                ? "bg-[#E0F2F1] text-text-main font-bold"
                : "text-on-surface-variant font-medium text-xs"
            }`}
          >
            <LucideIcon name="shopping_basket" className="w-4 h-4" />
            <span className="text-xs">Lista</span>
          </button>
        </nav>
      </footer>
      <MealModal
        isOpen={mealModalOpen}
        onClose={handleMealModalClose}
        onConfirm={handleMealModalConfirm}
        day={pendingMeal?.day ?? ""}
        mealType={pendingMeal?.type ?? "middag"}
      />
    </div>
  );
}

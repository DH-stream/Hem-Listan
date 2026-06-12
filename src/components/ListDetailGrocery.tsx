import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { List, ListMember, TaskItem, MealSlot, MealType, RecipeIngredient, SavedRecipe } from "../types";
import LucideIcon from "./LucideIcon";
import SharedListCount from "./SharedListCount";
import CelebrationCard from "./CelebrationCard";
import MealModal from "./MealModal";
import ListNameEditor from "./ListNameEditor";
import PresenceAvatarStack from "./PresenceAvatarStack";
import type { PresentUser } from "../lib/presence";
import RecipeDetailModal from "./RecipeDetailModal";
import RecipeImportPreviewModal, {
  RecipeImportPreview,
  RecipeImportSelection,
} from "./RecipeImportPreviewModal";
import { getRecipeUrlFeedback, touchSavedRecipeLastUsed, upsertSavedRecipeFromImport } from "../lib/supabase";
import { useBasketPriceEstimate } from "../lib/pricing/useBasketPriceEstimate";
import StoreLogo from "./StoreLogo";

interface ListDetailGroceryProps {
  list: List;
  isLoggedIn: boolean;
  members: ListMember[] | null;
  presentUsers: PresentUser[];
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
  onRenameList: (listId: string, name: string) => Promise<boolean>;
  onAddMeal: (
    listId: string,
    day: string,
    type: MealType,
    name: string,
    clientId: string,
  ) => Promise<boolean>;
  onDeleteMeal: (listId: string, mealId: string) => void;
  onMoveMeal: (
    listId: string,
    mealId: string,
    day: string,
    type: MealType,
  ) => Promise<boolean>;
  onBulkAddGroceryDetails: (
    listId: string,
    mealName: string,
    day: string,
    mealType: MealType,
    ingredients: RecipeIngredient[],
    recipe: Pick<
      MealSlot,
      | "recipeSourceUrl"
      | "recipeSourceDomain"
      | "recipeIngredients"
      | "recipeInstructions"
      | "recipeImageUrl"
    >,
    clientId: string,
  ) => Promise<void>;
}

export default function ListDetailGrocery({
  list,
  isLoggedIn,
  members,
  presentUsers,
  onBack,
  onToggleTask,
  onAddTask,
  onDeleteTask,
  onUpdateTask,
  onResetList,
  onRenameList,
  onAddMeal,
  onDeleteMeal,
  onMoveMeal,
  onBulkAddGroceryDetails,
}: ListDetailGroceryProps) {
  // Navigation within list: 0 = "Schema" view, 1 = "Lista" view
  const [activeTab, setActiveTab] = useState<number>(0);
  const [showCompleted, setShowCompleted] = useState(false);

  // States for Link Importer
  const [recipeUrl, setRecipeUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [recipeImportPreview, setRecipeImportPreview] =
    useState<RecipeImportPreview | null>(null);
  const [selectedRecipeMeal, setSelectedRecipeMeal] = useState<MealSlot | null>(null);
  const [selectedSavedRecipeId, setSelectedSavedRecipeId] = useState<string | null>(null);
  const [dislikedUrlWarning, setDislikedUrlWarning] = useState<string | null>(null);

  // States for adding item / meals
  const [newItemText, setNewItemText] = useState("");

  const [mealModalOpen, setMealModalOpen] = useState(false);
  const [pendingMeal, setPendingMeal] = useState<{
    day: string;
    type: MealType;
  } | null>(null);
  const [highlightedMealClientId, setHighlightedMealClientId] = useState<string | null>(null);
  useEffect(() => {
    if (!highlightedMealClientId) return;
    const mealCard = document.querySelector<HTMLElement>(
      `[data-meal-client-id="${highlightedMealClientId}"]`,
    );
    if (!mealCard) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    mealCard.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "center",
      inline: "nearest",
    });
    const timeoutId = window.setTimeout(() => setHighlightedMealClientId(null), 1300);
    return () => window.clearTimeout(timeoutId);
  }, [highlightedMealClientId, list.meals]);

  const totalTasks = list.tasks.length;
  const completedTasks = list.tasks.filter((t) => t.checked);
  const completedCount = completedTasks.length;
  const { matchByTaskId, approximateTotalSek } = useBasketPriceEstimate(list.tasks);

  const defaultDays = [
    "Måndag",
    "Tisdag",
    "Onsdag",
    "Torsdag",
    "Fredag",
    "Lördag",
    "Söndag",
  ];
  const currentDay = defaultDays[(new Date().getDay() + 6) % 7];

  const hasRecipeDetails = (meal: MealSlot) =>
    meal.source === "recipe_import" ||
    Boolean(meal.recipeIngredients?.length || meal.recipeInstructions?.length);

  const handleMealKeyDown = (event: React.KeyboardEvent, meal: MealSlot) => {
    if (!hasRecipeDetails(meal) || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    setSelectedRecipeMeal(meal);
  };

  const handleImportRecipe = async (event: React.FormEvent) => {
    event.preventDefault();
    const url = recipeUrl.trim();
    if (!url) return;
    const feedback = await getRecipeUrlFeedback(url);
    if (feedback?.rating === "disliked") {
      setDislikedUrlWarning(url);
      return;
    }
    await importRecipeUrl(url);
  };

  const importRecipeUrl = async (url: string) => {

    const requestId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    console.info("[HL_RECIPE_IMPORT]", {
      event: "import_start",
      requestId,
      url,
    });

    setIsImporting(true);
    setImportError(null);
    setRecipeImportPreview(null);

    try {
      const response = await fetch("/api/import-recipe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hl-request-id": requestId,
        },
        body: JSON.stringify({ url }),
      });
      const contentType = response.headers.get("content-type") ?? "";

      console.info("[HL_RECIPE_IMPORT]", {
        event: "import_response",
        requestId,
        status: response.status,
        ok: response.ok,
        contentType,
      });

      if (!response.ok) {
        const bodyText = await response.text();
        let errorBody: Record<string, unknown> | null = null;

        try {
          const parsedBody: unknown = JSON.parse(bodyText);
          errorBody =
            parsedBody !== null &&
            typeof parsedBody === "object" &&
            !Array.isArray(parsedBody)
              ? (parsedBody as Record<string, unknown>)
              : null;
        } catch {
          errorBody = null;
        }

        console.error("[HL_RECIPE_IMPORT]", {
          event: "import_error_body",
          requestId,
          ...(errorBody
            ? {
                code: errorBody.code,
                error: errorBody.error,
                attemptedMethods: errorBody.attemptedMethods,
                canRetryWithAi: errorBody.canRetryWithAi,
              }
            : { bodyPreview: bodyText.slice(0, 300) }),
        });

        throw new Error(
          typeof errorBody?.error === "string"
            ? errorBody.error
            : "Gick inte att hämta eller tolka receptet.",
        );
      }

      const data = await response.json();
      if (!Array.isArray(data?.ingredients) || data.ingredients.length === 0) {
        throw new Error("Receptet verkar sakna ingredienser.");
      }

      console.info("[HL_RECIPE_IMPORT]", {
        event: "import_success",
        requestId,
        recipeName: data.recipeName,
        ingredientCount: data.ingredients.length,
        instructionCount: Array.isArray(data.instructions)
          ? data.instructions.length
          : 0,
        extractionMethod: data.extractionMethod,
        confidence: data.confidence,
        qualityWarnings: data.qualityWarnings,
      });

      const sourceUrl = data.sourceUrl || url;
      let sourceDomain = data.sourceDomain;
      if (!sourceDomain) {
        try {
          sourceDomain = new URL(sourceUrl).hostname;
        } catch {
          sourceDomain = undefined;
        }
      }

      setRecipeImportPreview({
        recipeName: data.recipeName,
        mealName: data.mealName,
        ingredients: data.ingredients,
        instructions: Array.isArray(data.instructions)
          ? data.instructions
          : undefined,
        sourceUrl,
        sourceDomain,
        imageUrl: typeof data.imageUrl === "string" ? data.imageUrl : undefined,
        extractionMethod: data.extractionMethod,
        confidence: data.confidence,
        qualityWarnings: Array.isArray(data.qualityWarnings)
          ? data.qualityWarnings
          : [],
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Ett oväntat fel uppstod.";
      console.error("[HL_RECIPE_IMPORT]", {
        event: "import_failed",
        requestId,
        message,
        error,
      });
      setImportError(message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleAcceptRecipeImport = useCallback((selection: RecipeImportSelection) => {
    if (!recipeImportPreview) return;

    const clientId = typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setHighlightedMealClientId(clientId);
    void onBulkAddGroceryDetails(
      list.id,
      recipeImportPreview.mealName || recipeImportPreview.recipeName,
      selection.day,
      selection.mealType,
      selection.ingredients,
      {
        recipeSourceUrl: recipeImportPreview.sourceUrl,
        recipeSourceDomain: recipeImportPreview.sourceDomain,
        recipeIngredients: recipeImportPreview.ingredients,
        recipeInstructions: recipeImportPreview.instructions,
        recipeImageUrl: recipeImportPreview.imageUrl,
      },
      clientId,
    );
    setRecipeImportPreview(null);
    setSelectedSavedRecipeId(null);
    setRecipeUrl("");

    if (selectedSavedRecipeId) {
      void touchSavedRecipeLastUsed(selectedSavedRecipeId).catch((error) => {
        console.error("saved_recipe_touch_failed", {
          recipeId: selectedSavedRecipeId,
          error,
        });
      });
    } else {
      void upsertSavedRecipeFromImport({
        title: recipeImportPreview.recipeName,
        mealName: recipeImportPreview.mealName,
        sourceUrl: recipeImportPreview.sourceUrl,
        sourceDomain: recipeImportPreview.sourceDomain,
        imageUrl: recipeImportPreview.imageUrl,
        ingredients: recipeImportPreview.ingredients,
        instructions: recipeImportPreview.instructions,
        markUsed: true,
      }).catch((error) => {
        console.error("saved_recipe_upsert_failed", {
          sourceUrl: recipeImportPreview.sourceUrl,
          error,
        });
      });
    }
  }, [list.id, onBulkAddGroceryDetails, recipeImportPreview, selectedSavedRecipeId]);

  const handleRejectRecipeImport = useCallback(() => {
    setRecipeImportPreview(null);
    setSelectedSavedRecipeId(null);
  }, []);

  const handleSelectSavedRecipe = useCallback((recipe: SavedRecipe) => {
    setMealModalOpen(false);
    setSelectedSavedRecipeId(recipe.id);
    setRecipeImportPreview({
      recipeName: recipe.title,
      mealName: recipe.mealName ?? undefined,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions ?? undefined,
      sourceUrl: recipe.sourceUrl ?? undefined,
      sourceDomain: recipe.sourceDomain ?? undefined,
      imageUrl: recipe.imageUrl ?? undefined,
      qualityWarnings: [],
    });
  }, []);

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
      const mealName = name.trim();
      const { day, type } = pendingMeal;
      const clientId = typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      setHighlightedMealClientId(clientId);
      void onAddMeal(list.id, day, type, mealName, clientId);
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
          <ListNameEditor
            name={list.name}
            canRename={list.membershipRole !== "member"}
            onRename={(name) => onRenameList(list.id, name)}
            headingClassName="min-w-0 truncate font-display text-lg font-bold text-text-main"
          />
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

        <div className="flex shrink-0 items-center gap-1">
          <PresenceAvatarStack users={presentUsers} />
          <button className="p-2 hover:bg-surface-container text-primary rounded-full transition-all shrink-0">
            <LucideIcon name="shopping_cart" className="w-5 h-5 opacity-80" />
          </button>
        </div>
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
                Klistra in en länk från ICA, Arla eller Köket så hämtar vi
                receptets ingredienser.
              </p>

              {importError && (
                <div className="bg-error/10 text-error text-xs p-3 rounded-lg border border-error/20 mb-3.5">
                  {importError}
                </div>
              )}

              <form onSubmit={handleImportRecipe} className="flex gap-2">
                <input
                  type="url"
                  required
                  value={recipeUrl}
                  onChange={(e) => {
                    setRecipeUrl(e.target.value);
                    setRecipeImportPreview(null);
                  }}
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
                          <div
                            onClick={() => hasRecipeDetails(breakfast) && setSelectedRecipeMeal(breakfast)}
                            onKeyDown={(event) => handleMealKeyDown(event, breakfast)}
                            role={hasRecipeDetails(breakfast) ? "button" : undefined}
                            tabIndex={hasRecipeDetails(breakfast) ? 0 : undefined}
                            data-meal-client-id={breakfast.clientId}
                            className={`relative overflow-hidden bg-surface-container p-3 rounded-xl flex items-center justify-between ${highlightedMealClientId === breakfast.clientId ? "meal-card-highlight" : ""} ${hasRecipeDetails(breakfast) ? "cursor-pointer transition-[background-color,transform] duration-150 hover:bg-surface-container-high active:scale-[0.99]" : ""}`}
                          >
                            <div className="flex items-center gap-3">
                              <LucideIcon
                                name="sunny"
                                className="w-4 h-4 text-[#FFB347]"
                              />
                              <div>
                                <p className="text-[9px] uppercase font-bold text-outline tracking-wider leading-none mb-0.5">
                                  Frukost
                                </p>
                                <p className="flex items-center gap-1.5 font-sans text-xs font-semibold text-text-main">
                                  <span>{breakfast.name}</span>
                                  {hasRecipeDetails(breakfast) ? (
                                    <LucideIcon name="article" className="h-3.5 w-3.5 shrink-0 text-accent-rust/70" />
                                  ) : null}
                                </p>
                              </div>
                            </div>
                            <button
                              aria-label="Ta bort frukost"
                              onClick={(event) => {
                                event.stopPropagation();
                                onDeleteMeal(list.id, breakfast.id);
                              }}
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
                          <div
                            onClick={() => hasRecipeDetails(lunch) && setSelectedRecipeMeal(lunch)}
                            onKeyDown={(event) => handleMealKeyDown(event, lunch)}
                            role={hasRecipeDetails(lunch) ? "button" : undefined}
                            tabIndex={hasRecipeDetails(lunch) ? 0 : undefined}
                            data-meal-client-id={lunch.clientId}
                            className={`relative overflow-hidden bg-surface-container p-3 rounded-xl flex items-center justify-between ${highlightedMealClientId === lunch.clientId ? "meal-card-highlight" : ""} ${hasRecipeDetails(lunch) ? "cursor-pointer transition-[background-color,transform] duration-150 hover:bg-surface-container-high active:scale-[0.99]" : ""}`}
                          >
                            <div className="flex items-center gap-3">
                              <LucideIcon
                                name="partly_sunny"
                                className="w-4 h-4 text-[#FFD700]"
                              />
                              <div>
                                <p className="text-[9px] uppercase font-bold text-outline tracking-wider leading-none mb-0.5">
                                  Lunch
                                </p>
                                <p className="flex items-center gap-1.5 font-sans text-xs font-semibold text-text-main">
                                  <span>{lunch.name}</span>
                                  {hasRecipeDetails(lunch) ? (
                                    <LucideIcon name="article" className="h-3.5 w-3.5 shrink-0 text-accent-rust/70" />
                                  ) : null}
                                </p>
                              </div>
                            </div>
                            <button
                              aria-label="Ta bort lunch"
                              onClick={(event) => {
                                event.stopPropagation();
                                onDeleteMeal(list.id, lunch.id);
                              }}
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
                          <div
                            onClick={() => hasRecipeDetails(dinner) && setSelectedRecipeMeal(dinner)}
                            onKeyDown={(event) => handleMealKeyDown(event, dinner)}
                            role={hasRecipeDetails(dinner) ? "button" : undefined}
                            tabIndex={hasRecipeDetails(dinner) ? 0 : undefined}
                            data-meal-client-id={dinner.clientId}
                            className={`relative overflow-hidden bg-surface-container p-3 rounded-xl flex items-center justify-between ${highlightedMealClientId === dinner.clientId ? "meal-card-highlight" : ""} ${hasRecipeDetails(dinner) ? "cursor-pointer transition-[background-color,transform] duration-150 hover:bg-surface-container-high active:scale-[0.99]" : ""}`}
                          >
                            <div className="flex items-center gap-3">
                              <LucideIcon
                                name="bedtime"
                                className="w-4 h-4 text-[#FF8C00]"
                              />
                              <div>
                                <p className="text-[9px] uppercase font-bold text-outline tracking-wider leading-none mb-0.5">
                                  Middag
                                </p>
                                <p className="flex items-center gap-1.5 font-sans text-xs font-semibold text-text-main">
                                  <span className="line-clamp-1">{dinner.name}</span>
                                  {hasRecipeDetails(dinner) ? (
                                    <LucideIcon name="article" className="h-3.5 w-3.5 shrink-0 text-accent-rust/70" />
                                  ) : null}
                                </p>
                              </div>
                            </div>
                            <button
                              aria-label="Ta bort middag"
                              onClick={(event) => {
                                event.stopPropagation();
                                onDeleteMeal(list.id, dinner.id);
                              }}
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
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {approximateTotalSek > 0 && (
                    <div className="flex items-center gap-1.5" title="Ungefärligt pris från City Gross">
                      <span className="font-display text-base font-bold text-primary">
                        ≈ {Math.round(approximateTotalSek)} kr
                      </span>
                      <StoreLogo chainId="city_gross" className="h-5 w-auto max-w-14" />
                    </div>
                  )}
                  <p className="font-display text-sm font-bold text-primary">
                    {completedCount} / {totalTasks}
                  </p>
                </div>
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

                              {matchByTaskId[item.id]?.product && (
                                <div
                                  className={`mr-2 flex shrink-0 items-center gap-1.5 ${
                                    matchByTaskId[item.id].confidence === "high"
                                      ? "text-primary"
                                      : "text-on-surface-variant/65"
                                  }`}
                                  title={`Ungefärligt pris: ${matchByTaskId[item.id].product?.productName}`}
                                >
                                  <span className="font-sans text-xs font-semibold tabular-nums">
                                    {(
                                      matchByTaskId[item.id].estimatedCheckoutPriceSek ??
                                      matchByTaskId[item.id].product!.priceSek
                                    ).toLocaleString("sv-SE", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })} kr
                                    {matchByTaskId[item.id].confidence !== "high" ? " ?" : ""}
                                  </span>
                                  <StoreLogo chainId="city_gross" className="h-4 w-auto max-w-12" />
                                </div>
                              )}

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
      <RecipeImportPreviewModal
        open={recipeImportPreview !== null}
        preview={recipeImportPreview}
        days={defaultDays}
        initialDay={pendingMeal?.day ?? currentDay}
        initialMealType={pendingMeal?.type ?? "middag"}
        onAccept={handleAcceptRecipeImport}
        onCancel={handleRejectRecipeImport}
      />

      <RecipeDetailModal
        meal={selectedRecipeMeal}
        meals={list.meals ?? []}
        days={defaultDays}
        onMove={async (mealId, day, type) => {
          const moved = await onMoveMeal(list.id, mealId, day, type);
          if (moved) setSelectedRecipeMeal(null);
          return moved;
        }}
        onClose={() => setSelectedRecipeMeal(null)}
      />

      <AnimatePresence>
        {dislikedUrlWarning && (
          <motion.div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div role="alertdialog" aria-modal="true" aria-labelledby="disliked-url-title" initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }} transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
              <h2 id="disliked-url-title" className="text-lg font-bold text-text-main">Inte en favorit senast</h2>
              <p className="mt-2 text-sm font-medium leading-relaxed text-on-surface-variant">Sist markerades den här rätten som inte en favorit. Vill du importera den ändå?</p>
              <div className="mt-6 flex gap-2">
                <button type="button" onClick={() => setDislikedUrlWarning(null)} className="min-h-[44px] flex-1 rounded-xl bg-surface-container px-4 text-sm font-bold text-text-main active:scale-[0.97]">Avbryt</button>
                <button type="button" onClick={() => { const url = dislikedUrlWarning; setDislikedUrlWarning(null); void importRecipeUrl(url); }} className="min-h-[44px] flex-1 rounded-xl bg-primary px-4 text-sm font-bold text-white active:scale-[0.97]">Importera ändå</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      <MealModal
        isOpen={mealModalOpen}
        onClose={handleMealModalClose}
        onConfirm={handleMealModalConfirm}
        day={pendingMeal?.day ?? ""}
        mealType={pendingMeal?.type ?? "middag"}
        isLoggedIn={isLoggedIn}
        onSelectSavedRecipe={handleSelectSavedRecipe}
      />
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ImageOff, ThumbsDown, ThumbsUp } from "lucide-react";
import type { SavedRecipe } from "../types";
import {
  deleteSavedRecipe,
  fetchSavedRecipes,
  updateSavedRecipeRating,
  upsertRecipeUrlFeedback,
} from "../lib/supabase";
import LucideIcon from "./LucideIcon";

interface SavedRecipeDeleteConfirmDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onKeep: () => void;
  onRemove: () => void;
}

function SavedRecipeDeleteConfirmDialog({ isOpen, onCancel, onKeep, onRemove }: SavedRecipeDeleteConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedElement?.focus();
    };
  }, [isOpen, onCancel]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4 font-sans backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="dislike-recipe-title"
            aria-describedby="dislike-recipe-description"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="dislike-recipe-title" className="text-lg font-bold text-gray-900">Vill du ta bort sparade receptet?</h2>
            <p id="dislike-recipe-description" className="mt-2 text-sm font-medium leading-relaxed text-gray-600">Vi kommer ihåg att den inte var en favorit om du importerar länken igen.</p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button ref={cancelButtonRef} type="button" onClick={onKeep} className="min-h-[44px] rounded-xl bg-gray-100 px-4 py-3 text-sm font-bold text-gray-700 active:scale-[0.97]">Behåll sparat</button>
              <button type="button" onClick={onRemove} className="min-h-[44px] rounded-xl bg-amber-600 px-4 py-3 text-sm font-bold text-white active:scale-[0.97]">Ta bort</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default function SavedRecipesSection({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingDislike, setPendingDislike] = useState<SavedRecipe | null>(null);
  const closeDislikeDialog = useCallback(() => setPendingDislike(null), []);

  const loadRecipes = useCallback(async () => {
    if (!isLoggedIn) return;
    setLoading(true);
    const saved = await fetchSavedRecipes();
    if (saved) {
      try {
        if (
          new URLSearchParams(window.location.search).get("debug") === "1" ||
          window.localStorage.getItem("hem-listan-debug-enabled") === "true"
        ) {
          saved.forEach((recipe) => {
            console.log("[saved-recipes] loaded recipe", {
              recipeId: recipe.id,
              title: recipe.title,
              imageUrl: recipe.imageUrl,
            });
          });
        }
      } catch {
        // Debug logging must not prevent saved recipes from rendering.
      }
      setRecipes(saved);
    }
    setLoading(false);
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn) void loadRecipes();
  }, [isLoggedIn, loadRecipes]);

  const rememberRating = async (recipe: SavedRecipe, rating: "liked" | "disliked") => {
    const saved = await updateSavedRecipeRating(recipe.id, rating);
    if (!saved) return false;
    setRecipes((current) => current.map((item) => item.id === recipe.id ? { ...item, userRating: rating } : item));
    if (recipe.sourceUrl) {
      await upsertRecipeUrlFeedback({
        sourceUrl: recipe.sourceUrl,
        sourceDomain: recipe.sourceDomain,
        recipeTitle: recipe.title,
        rating,
      });
    }
    return true;
  };

  const keepDisliked = async () => {
    if (!pendingDislike) return;
    await rememberRating(pendingDislike, "disliked");
    setPendingDislike(null);
  };

  const removeDisliked = async () => {
    if (!pendingDislike) return;
    if (pendingDislike.sourceUrl) {
      const remembered = await upsertRecipeUrlFeedback({
        sourceUrl: pendingDislike.sourceUrl,
        sourceDomain: pendingDislike.sourceDomain,
        recipeTitle: pendingDislike.title,
        rating: "disliked",
      });
      if (!remembered) return;
    }
    const deleted = await deleteSavedRecipe(pendingDislike.id);
    if (deleted) setRecipes((current) => current.filter((item) => item.id !== pendingDislike.id));
    setPendingDislike(null);
  };

  return (
    <>
      <div className="rounded-xl border border-[#EDEADF] bg-[#FAF9F5] p-2 shadow-sm">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-lg bg-white px-3 py-2.5 text-left shadow-sm transition-[background-color,transform] hover:bg-gray-50 active:scale-[0.99]"
          aria-expanded={open}
        >
          <span>
            <span className="block text-xs font-bold text-gray-900">Sparade recept{recipes.length ? ` · ${recipes.length}` : ""}</span>
            <span className="mt-0.5 block text-[11px] font-medium text-[#706B5C]">Återanvänd recept i veckoplaneringen</span>
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FAF9F5] text-gray-400 ring-1 ring-[#EDEADF]">
            <LucideIcon name="chevron_down" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </span>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-2 max-h-72 space-y-2 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
                {!isLoggedIn ? (
                  <p className="rounded-lg bg-white px-3 py-4 text-center text-[11px] font-medium text-[#706B5C] shadow-sm">Logga in för att spara och återanvända recept.</p>
                ) : loading ? (
                  <p className="rounded-lg bg-white px-3 py-4 text-[11px] font-medium text-gray-400 shadow-sm">Hämtar sparade recept...</p>
                ) : recipes.length === 0 ? (
                  <p className="rounded-lg bg-white px-3 py-4 text-center text-[11px] font-medium leading-relaxed text-[#706B5C] shadow-sm">Inga sparade recept än.<br />Importera ett recept så dyker det upp här.</p>
                ) : recipes.map((recipe) => (
                  <article key={recipe.id} className="flex gap-3 rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-[#EDEADF]">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-emerald-50 to-amber-50 text-emerald-700">
                      {recipe.imageUrl ? <img src={recipe.imageUrl} alt="" className="h-full w-full object-cover" /> : <ImageOff className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1 py-0.5">
                      <p className="truncate text-xs font-bold text-gray-900">{recipe.title}</p>
                      <p className="mt-0.5 truncate text-[10px] font-medium text-[#706B5C]">{recipe.sourceDomain || "Sparat recept"}</p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void rememberRating(recipe, "liked")}
                          aria-label={`Markera ${recipe.title} som favorit`}
                          aria-pressed={recipe.userRating === "liked"}
                          className={`flex h-8 w-8 items-center justify-center rounded-full transition-[background-color,color,transform] active:scale-[0.95] ${recipe.userRating === "liked" ? "bg-emerald-100 text-emerald-700" : "bg-[#FAF9F5] text-gray-400 hover:text-emerald-700"}`}
                        ><ThumbsUp className="h-3.5 w-3.5" /></button>
                        <button
                          type="button"
                          onClick={() => setPendingDislike(recipe)}
                          aria-label={`Markera ${recipe.title} som inte favorit`}
                          aria-pressed={recipe.userRating === "disliked"}
                          className={`flex h-8 w-8 items-center justify-center rounded-full transition-[background-color,color,transform] active:scale-[0.95] ${recipe.userRating === "disliked" ? "bg-amber-100 text-amber-700" : "bg-[#FAF9F5] text-gray-400 hover:text-amber-700"}`}
                        ><ThumbsDown className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <SavedRecipeDeleteConfirmDialog
        isOpen={pendingDislike !== null}
        onCancel={closeDislikeDialog}
        onKeep={() => void keepDisliked()}
        onRemove={() => void removeDisliked()}
      />
    </>
  );
}

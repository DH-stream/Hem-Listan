import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ImageOff, ThumbsDown, ThumbsUp, X } from "lucide-react";
import type { SavedRecipe } from "../types";
import { fetchSavedRecipes } from "../lib/supabase";

export default function SavedRecipePicker({ open, isLoggedIn, onClose, onSelect }: {
  open: boolean;
  isLoggedIn: boolean;
  onClose: () => void;
  onSelect: (recipe: SavedRecipe) => void;
}) {
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !isLoggedIn) return;
    setLoading(true);
    void fetchSavedRecipes().then((saved) => {
      if (saved) setRecipes([...saved].sort((a, b) => Number(a.userRating === "disliked") - Number(b.userRating === "disliked")));
      setLoading(false);
    });
  }, [isLoggedIn, open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="saved-recipe-picker-title" className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-t-3xl bg-[#FAF9F5] shadow-2xl sm:rounded-3xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-[#EDEADF] bg-white px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Veckoplanering</p>
            <h2 id="saved-recipe-picker-title" className="mt-0.5 text-lg font-bold text-gray-900">Välj ett sparat recept</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Stäng" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FAF9F5] text-gray-500 active:scale-[0.96]"><X className="h-5 w-5" /></button>
        </header>
        <div className="max-h-[calc(85vh-82px)] overflow-y-auto p-4" style={{ WebkitOverflowScrolling: "touch" }}>
          {!isLoggedIn ? (
            <p className="rounded-2xl bg-white px-5 py-8 text-center text-sm font-medium text-[#706B5C] shadow-sm">Logga in för att spara och återanvända recept.</p>
          ) : loading ? (
            <p className="rounded-2xl bg-white px-5 py-8 text-center text-sm font-medium text-gray-400 shadow-sm">Hämtar sparade recept...</p>
          ) : recipes.length === 0 ? (
            <p className="rounded-2xl bg-white px-5 py-8 text-center text-sm font-medium leading-relaxed text-[#706B5C] shadow-sm">Inga sparade recept än.<br />Importera ett recept så dyker det upp här.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {recipes.map((recipe) => (
                <button key={recipe.id} type="button" onClick={() => onSelect(recipe)} className="overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-[#EDEADF] transition-transform active:scale-[0.98]">
                  <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-50 to-amber-50 text-emerald-700">
                    {recipe.imageUrl ? <img src={recipe.imageUrl} alt="" className="h-full w-full object-cover" /> : <ImageOff className="h-7 w-7" />}
                    {recipe.userRating && <span className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-sm ${recipe.userRating === "liked" ? "text-emerald-700" : "text-amber-700"}`}>{recipe.userRating === "liked" ? <ThumbsUp className="h-3.5 w-3.5" /> : <ThumbsDown className="h-3.5 w-3.5" />}</span>}
                  </div>
                  <span className="block p-3">
                    <span className="block line-clamp-2 text-xs font-bold leading-snug text-gray-900">{recipe.title}</span>
                    <span className="mt-1 block truncate text-[10px] font-medium text-[#706B5C]">{recipe.userRating === "disliked" ? "Inte favorit · " : ""}{recipe.sourceDomain || "Sparat recept"}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>, document.body
  );
}

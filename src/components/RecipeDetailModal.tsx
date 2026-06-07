import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import type { MealSlot } from "../types";
import LucideIcon from "./LucideIcon";

type RecipeDetailModalProps = {
  meal: MealSlot | null;
  onClose: () => void;
};

const easing = [0.23, 1, 0.32, 1] as const;
const sectionClassName =
  "rounded-2xl border border-surface-container/40 bg-surface-container-low p-4 shadow-[0_8px_24px_rgba(34,50,35,0.05)]";

export default function RecipeDetailModal({ meal, onClose }: RecipeDetailModalProps) {
  useEffect(() => {
    if (!meal) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [meal, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {meal ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-text-main/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: easing }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.article
            role="dialog"
            aria-modal="true"
            aria-labelledby="recipe-detail-title"
            className="flex max-h-[94dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] bg-surface-container-lowest shadow-[0_24px_80px_rgba(34,50,35,0.22)] sm:max-h-[88vh] sm:rounded-[28px]"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2, ease: easing }}
          >
            <header className="relative shrink-0 border-b border-surface-container/40 px-5 pb-4 pt-5 sm:px-6">
              <div className="pr-12">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-accent-rust">
                  Recept
                </p>
                <h2 id="recipe-detail-title" className="font-display text-xl font-bold leading-tight text-text-main">
                  {meal.name}
                </h2>
                {meal.recipeSourceDomain ? (
                  <p className="mt-1.5 text-xs font-medium text-on-surface-variant">
                    {meal.recipeSourceDomain}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Stäng recept"
                onClick={onClose}
                className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant transition-[background-color,transform] duration-150 hover:bg-surface-container-high active:scale-[0.97]"
              >
                <LucideIcon name="close" className="h-4.5 w-4.5" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:pb-6">
              {meal.recipeImageUrl ? (
                <img
                  src={meal.recipeImageUrl}
                  alt=""
                  className="mb-5 aspect-[16/9] w-full rounded-2xl object-cover"
                />
              ) : null}

              {meal.recipeSourceUrl ? (
                <a
                  href={meal.recipeSourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mb-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-display text-xs font-bold text-white transition-[filter,transform] duration-150 hover:brightness-105 active:scale-[0.98]"
                >
                  Öppna originalrecept
                  <LucideIcon name="external_link" className="h-4 w-4" />
                </a>
              ) : null}

              <div className="space-y-4">
                <section className={sectionClassName}>
                  <h3 className="font-display text-sm font-bold text-text-main">Ingredienser</h3>
                  {meal.recipeIngredients?.length ? (
                    <ul className="mt-3 divide-y divide-surface-container/60">
                      {meal.recipeIngredients.map((ingredient, index) => (
                        <li key={`${ingredient.rawText ?? ingredient.text}-${index}`} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold leading-snug text-text-main">
                              {ingredient.text}
                            </span>
                            {ingredient.note ? (
                              <span className="mt-1 block text-xs leading-relaxed text-on-surface-variant/75">
                                {ingredient.note}
                              </span>
                            ) : null}
                          </span>
                          {ingredient.quantity ? (
                            <span className="shrink-0 text-right text-xs font-medium text-on-surface-variant">
                              {ingredient.quantity}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-on-surface-variant">Inga ingredienser sparades.</p>
                  )}
                </section>

                {meal.recipeInstructions?.length ? (
                  <section className={sectionClassName}>
                    <h3 className="font-display text-sm font-bold text-text-main">Gör så här</h3>
                    <ol className="mt-3 space-y-3 pl-5 text-sm leading-relaxed text-on-surface-variant [list-style:decimal]">
                      {meal.recipeInstructions.map((instruction, index) => (
                        <li key={`${instruction}-${index}`} className="pl-1">
                          {instruction}
                        </li>
                      ))}
                    </ol>
                  </section>
                ) : null}
              </div>
            </div>
          </motion.article>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

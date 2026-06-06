import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import LucideIcon from "./LucideIcon";

export type RecipeImportPreview = {
  recipeName: string;
  mealName?: string;
  ingredients: { text: string; quantity: string; category: string }[];
  sourceUrl?: string;
  sourceDomain?: string;
  extractionMethod?:
    | "json_ld"
    | "dom_fallback"
    | "site_adapter"
    | "ai_fallback"
    | string;
  confidence?: "high" | "medium" | "low";
};

type RecipeImportReviewSheetProps = {
  open: boolean;
  preview: RecipeImportPreview | null;
  onAccept: () => void;
  onCancel: () => void;
};

const easing = [0.23, 1, 0.32, 1] as const;

export default function RecipeImportReviewSheet({
  open,
  preview,
  onAccept,
  onCancel,
}: RecipeImportReviewSheetProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previouslyFocusedElement = document.activeElement;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocusedElement instanceof HTMLElement) {
        previouslyFocusedElement.focus();
      }
    };
  }, [open, onCancel]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && preview && (
        <motion.div
          key="recipe-import-review-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: easing }}
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto overscroll-none bg-black/40 pt-4 backdrop-blur-[2px] sm:items-center sm:p-4"
          onClick={onCancel}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="recipe-import-review-title"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18, ease: easing }}
            className="relative flex max-h-[calc(100dvh-1rem)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-surface-container/30 bg-surface-container-lowest shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onCancel}
              aria-label="Avbryt receptimport"
              className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant transition-[color,transform] hover:text-text-main active:scale-[0.94]"
            >
              <LucideIcon name="close" className="h-5 w-5" />
            </button>

            <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-4 [-webkit-overflow-scrolling:touch] sm:p-6 sm:pb-4">
              <div className="pr-10">
                <h2
                  id="recipe-import-review-title"
                  className="font-display text-lg font-bold text-text-main"
                >
                  Ser det här bra ut?
                </h2>
                <p className="mt-1 font-sans text-sm font-semibold text-primary">
                  {preview.recipeName}
                </p>
              </div>

              <ul className="mt-4 space-y-2">
                {preview.ingredients.map((ingredient, index) => (
                  <li
                    key={`${ingredient.text}-${ingredient.quantity}-${index}`}
                    className="flex items-start justify-between gap-3 border-b border-primary/10 pb-2 text-sm last:border-b-0 last:pb-0"
                  >
                    <span className="font-medium text-text-main">
                      {ingredient.text}
                    </span>
                    {ingredient.quantity && (
                      <span className="shrink-0 text-on-surface-variant">
                        {ingredient.quantity}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex gap-2 border-t border-surface-container/40 bg-surface-container-lowest px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-6">
              <button
                type="button"
                onClick={onAccept}
                className="flex-1 rounded-lg bg-primary px-4 py-3 font-display text-xs font-bold text-white transition-transform duration-150 active:scale-[0.97]"
              >
                Ja, lägg till
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 rounded-lg border border-surface-container-highest bg-surface-container-lowest px-4 py-3 font-display text-xs font-bold text-on-surface-variant transition-transform duration-150 active:scale-[0.97]"
              >
                Avbryt
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import LucideIcon from "./LucideIcon";

export type RecipeImportPreview = {
  recipeName: string;
  mealName?: string;
  ingredients: { text: string; quantity: string; category: string }[];
  instructions?: string[];
  sourceUrl?: string;
  sourceDomain?: string;
  extractionMethod?:
    | "json_ld"
    | "dom_fallback"
    | "site_adapter"
    | "ai_fallback"
    | string;
  confidence?: "high" | "medium" | "low";
  qualityWarnings?: string[];
};

type RecipeImportPreviewModalProps = {
  open: boolean;
  preview: RecipeImportPreview | null;
  onAccept: () => void;
  onCancel: () => void;
};

type ConfirmationPhase = "review" | "confirming" | "check";

const easing = [0.23, 1, 0.32, 1] as const;
const backdropTransition = { duration: 0.16, ease: easing } as const;
const cardTransition = { duration: 0.18, ease: easing } as const;
const contentTransition = { duration: 0.16, ease: easing } as const;

export default function RecipeImportPreviewModal({
  open,
  preview,
  onAccept,
  onCancel,
}: RecipeImportPreviewModalProps) {
  const [phase, setPhase] = useState<ConfirmationPhase>("review");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const confirmTimersRef = useRef<number[]>([]);
  const hasConfirmedRef = useRef(false);

  const clearConfirmTimers = useCallback(() => {
    confirmTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    confirmTimersRef.current = [];
  }, []);

  useEffect(() => {
    if (!open) {
      clearConfirmTimers();
      setPhase("review");
      hasConfirmedRef.current = false;
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previouslyFocusedElement = document.activeElement;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      if (previouslyFocusedElement instanceof HTMLElement) {
        previouslyFocusedElement.focus();
      }
    };
  }, [clearConfirmTimers, open]);

  useEffect(() => {
    if (!open || phase !== "review") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, open, phase]);

  useEffect(() => clearConfirmTimers, [clearConfirmTimers]);

  const handleCancel = useCallback(() => {
    if (phase !== "review") return;
    onCancel();
  }, [onCancel, phase]);

  const handleConfirm = useCallback(() => {
    if (phase !== "review" || hasConfirmedRef.current) return;

    hasConfirmedRef.current = true;
    setPhase("confirming");
    confirmTimersRef.current = [
      window.setTimeout(() => setPhase("check"), 350),
      window.setTimeout(() => onAccept(), 950),
    ];
  }, [onAccept, phase]);

  if (typeof document === "undefined") return null;

  const showConfidenceWarning =
    preview?.confidence === "medium" ||
    preview?.confidence === "low" ||
    Boolean(preview?.qualityWarnings?.length);

  return createPortal(
    <AnimatePresence>
      {open && preview && (
        <motion.div
          key="recipe-import-preview-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={backdropTransition}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-none bg-black/40 p-4 backdrop-blur-[2px] font-sans"
          onClick={handleCancel}
        >
          <motion.div
            layout="size"
            layoutDependency={phase}
            role="dialog"
            aria-modal="true"
            aria-label="Förhandsgranska receptimport"
            initial={{ opacity: 0, scale: 0.98, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 4 }}
            transition={cardTransition}
            className="relative my-4 flex max-h-[calc(100dvh-2rem)] w-full max-w-md transform-gpu flex-col overflow-hidden rounded-2xl border border-surface-container/30 bg-surface-container-lowest shadow-2xl will-change-transform"
            onClick={(event) => event.stopPropagation()}
          >
            {phase === "review" && (
              <button
                ref={closeButtonRef}
                type="button"
                onClick={handleCancel}
                aria-label="Avbryt receptimport"
                className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant transition-[color,transform] hover:text-text-main active:scale-[0.94]"
              >
                <LucideIcon name="close" className="h-5 w-5" />
              </button>
            )}

            <AnimatePresence mode="popLayout" initial={false}>
              {phase === "review" ? (
                <motion.div
                  key="recipe-review"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={contentTransition}
                  className="flex min-h-0 flex-col"
                >
                  <div className="min-h-0 flex-1 overflow-y-auto p-6 pb-4 [-webkit-overflow-scrolling:touch]">
                    <div className="pr-10">
                      <h2
                        id="recipe-import-preview-title"
                        className="font-display text-lg font-bold text-text-main"
                      >
                        Ser det här bra ut?
                      </h2>
                      <p className="mt-1 font-sans text-sm font-semibold text-primary">
                        {preview.recipeName}
                      </p>
                    </div>

                    {showConfidenceWarning && (
                      <p className="mt-4 rounded-xl bg-primary-fixed/30 p-3 text-xs font-medium leading-relaxed text-on-surface-variant">
                        Jag är lite osäker på om allt kom med. Kolla gärna
                        igenom
                        {preview.qualityWarnings?.length
                          ? `: ${preview.qualityWarnings.join(" ")}`
                          : "."}
                      </p>
                    )}

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

                    {preview.instructions?.length ? (
                      <section className="mt-5 border-t border-primary/10 pt-4">
                        <h3 className="font-display text-sm font-bold text-text-main">
                          Gör så här
                        </h3>
                        <ol className="mt-2 space-y-2 pl-5 text-xs leading-relaxed text-on-surface-variant [list-style:decimal]">
                          {preview.instructions.map((instruction, index) => (
                            <li key={`${instruction}-${index}`} className="pl-1">
                              {instruction}
                            </li>
                          ))}
                        </ol>
                      </section>
                    ) : null}
                  </div>

                  <div className="flex gap-2 border-t border-surface-container/40 px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4">
                    <button
                      type="button"
                      onClick={handleConfirm}
                      className="flex-1 rounded-lg bg-primary px-4 py-3 font-display text-xs font-bold text-white transition-transform duration-150 active:scale-[0.97]"
                    >
                      Ja, lägg till
                    </button>
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="flex-1 rounded-lg border border-surface-container-highest bg-surface-container-lowest px-4 py-3 font-display text-xs font-bold text-on-surface-variant transition-transform duration-150 active:scale-[0.97]"
                    >
                      Avbryt
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="recipe-confirmation"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={contentTransition}
                  className="flex min-h-64 items-center justify-center p-8"
                  aria-live="polite"
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.28, ease: easing }}
                    className="flex h-20 w-20 items-center justify-center rounded-full bg-primary shadow-[0_0_24px_rgba(26,107,32,0.35)]"
                  >
                    {phase === "check" && (
                      <motion.svg
                        viewBox="0 0 52 52"
                        className="h-9 w-9 fill-none stroke-white stroke-[4] [stroke-linecap:round] [stroke-linejoin:round]"
                        aria-hidden="true"
                      >
                        <motion.path
                          d="M14.1 27.2l7.1 7.2 16.7-16.8"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 0.3, ease: easing }}
                        />
                      </motion.svg>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

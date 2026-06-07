import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import type { MealType } from "../types";
import LucideIcon from "./LucideIcon";

export type RecipeImportIngredient = {
  text: string;
  quantity: string;
  category: string;
};

export type RecipeImportPreview = {
  recipeName: string;
  mealName?: string;
  ingredients: RecipeImportIngredient[];
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

export type RecipeImportSelection = {
  day: string;
  mealType: MealType;
  ingredients: RecipeImportIngredient[];
};

type RecipeImportPreviewModalProps = {
  open: boolean;
  preview: RecipeImportPreview | null;
  days: string[];
  initialDay: string;
  initialMealType: MealType;
  onAccept: (selection: RecipeImportSelection) => void;
  onCancel: () => void;
};

type ConfirmationPhase = "review" | "confirming" | "check";

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: "frukost", label: "Frukost" },
  { value: "lunch", label: "Lunch" },
  { value: "middag", label: "Middag" },
];
const easing = [0.23, 1, 0.32, 1] as const;
const backdropTransition = { duration: 0.16, ease: easing } as const;
const cardTransition = { duration: 0.18, ease: easing } as const;
const contentTransition = { duration: 0.16, ease: easing } as const;
const sectionClassName =
  "rounded-2xl border border-surface-container/40 bg-surface-container-low p-4 shadow-[0_8px_24px_rgba(34,50,35,0.05)]";

function splitIngredientNote(text: string) {
  const noteIndex = text.search(/(?:^|\s)(?:obs!|tips:)/i);
  if (noteIndex <= 0) return { name: text, note: "" };
  return {
    name: text.slice(0, noteIndex).trim().replace(/[,.]$/, ""),
    note: text.slice(noteIndex).trim(),
  };
}

function shouldShowCategory(category: string) {
  const normalized = category.trim().toLowerCase();
  return Boolean(normalized && normalized !== "övrigt" && normalized.length <= 24);
}

export default function RecipeImportPreviewModal({
  open,
  preview,
  days,
  initialDay,
  initialMealType,
  onAccept,
  onCancel,
}: RecipeImportPreviewModalProps) {
  const [phase, setPhase] = useState<ConfirmationPhase>("review");
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [selectedMealType, setSelectedMealType] =
    useState<MealType>(initialMealType);
  const [selectedIngredientIndexes, setSelectedIngredientIndexes] = useState<
    Set<number>
  >(new Set());
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const confirmTimersRef = useRef<number[]>([]);
  const hasConfirmedRef = useRef(false);

  const clearConfirmTimers = useCallback(() => {
    confirmTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    confirmTimersRef.current = [];
  }, []);

  useEffect(() => {
    if (!open || !preview) return;
    setSelectedDay(initialDay);
    setSelectedMealType(initialMealType);
    setSelectedIngredientIndexes(
      new Set(preview.ingredients.map((_, index) => index)),
    );
  }, [initialDay, initialMealType, open, preview]);

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

  const toggleIngredient = useCallback((index: number) => {
    setSelectedIngredientIndexes((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (phase !== "review" || hasConfirmedRef.current || !preview) return;

    const selection: RecipeImportSelection = {
      day: selectedDay,
      mealType: selectedMealType,
      ingredients: preview.ingredients.filter((_, index) =>
        selectedIngredientIndexes.has(index),
      ),
    };

    hasConfirmedRef.current = true;
    setPhase("confirming");
    confirmTimersRef.current = [
      window.setTimeout(() => setPhase("check"), 350),
      window.setTimeout(() => onAccept(selection), 950),
    ];
  }, [
    onAccept,
    phase,
    preview,
    selectedDay,
    selectedIngredientIndexes,
    selectedMealType,
  ]);

  if (typeof document === "undefined") return null;

  const showConfidenceWarning =
    preview?.confidence === "medium" ||
    preview?.confidence === "low" ||
    Boolean(preview?.qualityWarnings?.length);
  const selectedCount = selectedIngredientIndexes.size;
  const totalCount = preview?.ingredients.length ?? 0;

  return createPortal(
    <AnimatePresence>
      {open && preview && (
        <motion.div
          key="recipe-import-preview-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={backdropTransition}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-none bg-black/40 p-3 backdrop-blur-[2px] font-sans sm:p-4"
          onClick={handleCancel}
        >
          <motion.div
            layout="size"
            layoutDependency={phase}
            role="dialog"
            aria-modal="true"
            aria-labelledby="recipe-import-preview-title"
            initial={{ opacity: 0, scale: 0.98, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 4 }}
            transition={cardTransition}
            className="relative my-3 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md transform-gpu flex-col overflow-hidden rounded-3xl border border-surface-container/40 bg-surface-container-lowest shadow-2xl will-change-transform sm:my-4 sm:max-h-[calc(100dvh-2rem)]"
            onClick={(event) => event.stopPropagation()}
          >
            {phase === "review" && (
              <button
                ref={closeButtonRef}
                type="button"
                onClick={handleCancel}
                aria-label="Avbryt receptimport"
                className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant transition-[color,transform] duration-150 hover:text-text-main active:scale-[0.96]"
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
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 pb-3 [-webkit-overflow-scrolling:touch] sm:p-6 sm:pb-4">
                    <div className="pr-10">
                      <h2
                        id="recipe-import-preview-title"
                        className="font-display text-xl font-bold text-text-main"
                      >
                        Granska och planera
                      </h2>
                      <p className="mt-1 text-xs font-medium text-on-surface-variant">
                        Välj måltid och det som ska läggas i inköpslistan.
                      </p>
                    </div>

                    <section className={sectionClassName}>
                      <p className="font-display text-[11px] font-bold uppercase tracking-wider text-accent-rust">
                        Recept
                      </p>
                      <h3 className="mt-1.5 font-display text-base font-bold leading-snug text-text-main">
                        {preview.recipeName}
                      </h3>
                      {preview.sourceDomain && (
                        <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
                          <LucideIcon name="link" className="h-3.5 w-3.5" />
                          {preview.sourceDomain.replace(/^www\./, "")}
                        </p>
                      )}
                      {showConfidenceWarning && (
                        <div className="mt-3 flex gap-2 rounded-xl border border-amber-500/20 bg-amber-50 p-3 text-xs font-medium leading-relaxed text-amber-900">
                          <LucideIcon
                            name="info"
                            className="mt-0.5 h-4 w-4 shrink-0"
                          />
                          <span>
                            Kontrollera gärna receptet en extra gång.
                            {preview.qualityWarnings?.length
                              ? ` ${preview.qualityWarnings.join(" ")}`
                              : ""}
                          </span>
                        </div>
                      )}
                    </section>

                    <section className={sectionClassName}>
                      <p className="font-display text-[11px] font-bold uppercase tracking-wider text-accent-rust">
                        Planera
                      </p>
                      <div className="mt-3">
                        <p className="mb-2 text-xs font-bold text-text-main">Dag</p>
                        <div
                          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                          role="group"
                          aria-label="Välj dag"
                        >
                          {days.map((day) => {
                            const selected = selectedDay === day;
                            return (
                              <button
                                key={day}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => setSelectedDay(day)}
                                className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] ${
                                  selected
                                    ? "border-primary bg-primary text-white shadow-sm"
                                    : "border-surface-container-highest bg-surface-container-lowest text-on-surface-variant"
                                }`}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="mt-3">
                        <p className="mb-2 text-xs font-bold text-text-main">
                          Måltid
                        </p>
                        <div
                          className="grid grid-cols-3 gap-2"
                          role="group"
                          aria-label="Välj måltid"
                        >
                          {MEAL_TYPES.map(({ value, label }) => {
                            const selected = selectedMealType === value;
                            return (
                              <button
                                key={value}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => setSelectedMealType(value)}
                                className={`rounded-xl border px-2 py-2.5 text-xs font-bold transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] ${
                                  selected
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-surface-container-highest bg-surface-container-lowest text-on-surface-variant"
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </section>

                    <section className={sectionClassName}>
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <p className="font-display text-[11px] font-bold uppercase tracking-wider text-accent-rust">
                            Ingredienser
                          </p>
                          <p className="mt-1 text-xs font-medium text-on-surface-variant">
                            Avmarkera sådant du redan har hemma.
                          </p>
                        </div>
                        <p
                          className="shrink-0 rounded-lg border border-primary/10 bg-primary/5 px-2.5 py-1 text-[11px] font-bold tabular-nums text-primary"
                          aria-live="polite"
                        >
                          {selectedCount} av {totalCount} valda
                        </p>
                      </div>
                      <ul className="mt-3 space-y-2">
                        {preview.ingredients.map((ingredient, index) => {
                          const selected = selectedIngredientIndexes.has(index);
                          const { name, note } = splitIngredientNote(
                            ingredient.text,
                          );
                          return (
                            <li
                              key={`${ingredient.text}-${ingredient.quantity}-${index}`}
                              className={`rounded-xl border transition-[background-color,border-color] duration-150 ${
                                selected
                                  ? "border-surface-container/50 bg-surface-container-lowest"
                                  : "border-surface-container/30 bg-surface-container-lowest/55"
                              }`}
                            >
                              <label className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 px-3.5 py-3">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleIngredient(index)}
                                  className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-surface-container-highest accent-primary"
                                />
                                <span className="min-w-0">
                                  <span
                                    className={`block text-sm font-semibold leading-snug ${
                                      selected
                                        ? "text-text-main"
                                        : "text-on-surface-variant line-through opacity-60"
                                    }`}
                                  >
                                    {name}
                                  </span>
                                  {(shouldShowCategory(ingredient.category) || note) && (
                                    <span className="mt-1.5 block space-y-1">
                                      {shouldShowCategory(ingredient.category) && (
                                        <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-on-surface-variant/65">
                                          {ingredient.category}
                                        </span>
                                      )}
                                      {note && (
                                        <span className="block text-[11px] leading-relaxed text-on-surface-variant/80">
                                          {note}
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </span>
                                {ingredient.quantity && (
                                  <span className="max-w-24 pl-1 text-right text-xs font-medium leading-snug text-on-surface-variant">
                                    {ingredient.quantity}
                                  </span>
                                )}
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </section>

                    {preview.instructions?.length ? (
                      <details className={sectionClassName}>
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                          <span className="font-display text-[11px] font-bold uppercase tracking-wider text-accent-rust">
                            Gör så här
                          </span>
                          <LucideIcon
                            name="expand_more"
                            className="h-4 w-4 text-on-surface-variant"
                          />
                        </summary>
                        <ol className="mt-3 space-y-2.5 pl-5 text-xs leading-relaxed text-on-surface-variant [list-style:decimal]">
                          {preview.instructions.map((instruction, index) => (
                            <li key={`${instruction}-${index}`} className="pl-1">
                              {instruction}
                            </li>
                          ))}
                        </ol>
                      </details>
                    ) : null}
                  </div>

                  <div className="border-t border-surface-container/40 bg-surface-container-lowest px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pt-4">
                    <p className="mb-2 text-center text-[11px] font-semibold text-on-surface-variant">
                      {selectedCount} av {totalCount} läggs till i inköpslistan
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleConfirm}
                        className="flex-1 rounded-xl bg-primary px-4 py-3 font-display text-xs font-bold text-white shadow-sm transition-transform duration-150 active:scale-[0.97]"
                      >
                        Lägg till måltid
                      </button>
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="rounded-xl border border-surface-container-highest bg-surface-container-lowest px-4 py-3 font-display text-xs font-bold text-on-surface-variant transition-transform duration-150 active:scale-[0.97]"
                      >
                        Avbryt
                      </button>
                    </div>
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

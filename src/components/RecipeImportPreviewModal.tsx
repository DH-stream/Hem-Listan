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
  return Boolean(
    normalized && normalized !== "övrigt" && normalized.length <= 24,
  );
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
          className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/40 font-sans backdrop-blur-[2px] sm:items-center sm:p-4"
          onClick={handleCancel}
        >
          <motion.div
            layout="size"
            layoutDependency={phase}
            role="dialog"
            aria-modal="true"
            aria-labelledby="recipe-import-preview-title"
            initial={{ opacity: 0, scale: 0.99, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.99, y: 24 }}
            transition={cardTransition}
            className="relative flex max-h-[92dvh] w-full max-w-md transform-gpu flex-col overflow-hidden rounded-t-[2rem] border border-b-0 border-surface-container/40 bg-surface-container-lowest shadow-2xl will-change-transform sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl sm:border-b"
            onClick={(event) => event.stopPropagation()}
          >
            {phase === "review" && (
              <>
                <div
                  aria-hidden="true"
                  className="absolute left-1/2 top-2.5 z-10 h-1 w-10 -translate-x-1/2 rounded-full bg-surface-container-highest sm:hidden"
                />
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={handleCancel}
                  aria-label="Avbryt receptimport"
                  className="absolute right-2.5 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low/85 text-on-surface-variant transition-[background-color,color,transform] duration-150 hover:bg-surface-container-high hover:text-text-main active:scale-[0.96] sm:top-2.5"
                >
                  <LucideIcon name="close" className="h-4.5 w-4.5" />
                </button>
              </>
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
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4 [-webkit-overflow-scrolling:touch]">
                    <header className="px-5 pb-5 pt-9 sm:px-6 sm:pt-6">
                      <div className="flex items-start gap-3.5 pr-10">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/10 bg-primary/10 text-primary shadow-sm">
                          <LucideIcon name="restaurant" className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 pt-0.5">
                          <p className="font-display text-[10px] font-bold uppercase tracking-[0.12em] text-accent-rust">
                            Receptimport
                          </p>
                          <h2
                            id="recipe-import-preview-title"
                            className="mt-1 font-display text-xl font-bold leading-tight text-text-main"
                          >
                            {preview.recipeName}
                          </h2>
                          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-on-surface-variant">
                            {preview.sourceDomain && (
                              <span className="inline-flex items-center gap-1.5">
                                <LucideIcon
                                  name="link"
                                  className="h-3.5 w-3.5"
                                />
                                {preview.sourceDomain.replace(/^www\./, "")}
                              </span>
                            )}
                            {preview.sourceDomain && (
                              <span
                                aria-hidden="true"
                                className="h-1 w-1 rounded-full bg-surface-container-highest"
                              />
                            )}
                            <span>{totalCount} ingredienser hittades</span>
                          </div>
                        </div>
                      </div>

                      {showConfidenceWarning && (
                        <div className="mt-4 flex gap-2 rounded-xl border border-amber-500/20 bg-amber-50 p-3 text-xs font-medium leading-relaxed text-amber-900">
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
                    </header>

                    <section className="border-y border-surface-container/40 bg-surface-container-low/70 px-5 py-5 sm:px-6">
                      <h3 className="font-display text-sm font-bold text-text-main">
                        När ska den ätas?
                      </h3>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        Välj dag och måltid för receptet.
                      </p>

                      <div
                        className="-mx-1 mt-4 flex snap-x gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                              className={`shrink-0 snap-start rounded-xl border px-3.5 py-2.5 text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-[0.97] ${
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

                      <div
                        className="mt-3 grid grid-cols-3 rounded-xl bg-surface-container-high p-1"
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
                              className={`rounded-lg px-2 py-2.5 text-xs font-bold transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.98] ${
                                selected
                                  ? "bg-surface-container-lowest text-primary shadow-sm"
                                  : "text-on-surface-variant"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </section>

                    <section className="px-5 py-5 sm:px-6">
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <h3 className="font-display text-sm font-bold text-text-main">
                            Ingredienser
                          </h3>
                          <p className="mt-1 text-xs text-on-surface-variant">
                            Avmarkera det du redan har hemma.
                          </p>
                        </div>
                        <p
                          className="shrink-0 text-xs font-bold tabular-nums text-primary"
                          aria-live="polite"
                        >
                          {selectedCount} av {totalCount} valda
                        </p>
                      </div>

                      <ul className="mt-4 space-y-2.5">
                        {preview.ingredients.map((ingredient, index) => {
                          const selected = selectedIngredientIndexes.has(index);
                          const { name, note } = splitIngredientNote(
                            ingredient.text,
                          );
                          const showCategory = shouldShowCategory(
                            ingredient.category,
                          );

                          return (
                            <li
                              key={`${ingredient.text}-${ingredient.quantity}-${index}`}
                            >
                              <label
                                className={`group grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 rounded-2xl border px-3.5 py-3.5 transition-[background-color,border-color,box-shadow,opacity,transform] duration-150 active:scale-[0.99] ${
                                  selected
                                    ? "border-surface-container/50 bg-surface-container-lowest shadow-[0_4px_16px_rgba(34,50,35,0.05)]"
                                    : "border-surface-container/25 bg-surface-container-low/45 opacity-70"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleIngredient(index)}
                                  className="peer sr-only"
                                />
                                <span
                                  aria-hidden="true"
                                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-[background-color,border-color,transform] duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 ${
                                    selected
                                      ? "border-primary bg-primary text-white"
                                      : "border-surface-container-highest bg-surface-container-lowest text-transparent group-hover:border-primary/50"
                                  }`}
                                >
                                  <LucideIcon
                                    name="check"
                                    className="h-3.5 w-3.5 stroke-[3]"
                                  />
                                </span>

                                <span className="min-w-0 pt-0.5">
                                  <span
                                    className={`block text-sm font-semibold leading-snug transition-colors duration-150 ${
                                      selected
                                        ? "text-text-main"
                                        : "text-on-surface-variant line-through decoration-surface-container-highest"
                                    }`}
                                  >
                                    {name}
                                  </span>
                                  {(showCategory || note) && (
                                    <span className="mt-1.5 block space-y-1">
                                      {showCategory && (
                                        <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-on-surface-variant/60">
                                          {ingredient.category}
                                        </span>
                                      )}
                                      {note && (
                                        <span className="block text-[11px] leading-relaxed text-on-surface-variant/75">
                                          {note}
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </span>

                                {ingredient.quantity && (
                                  <span
                                    className={`max-w-24 pl-1 pt-0.5 text-right text-xs font-medium leading-snug transition-colors duration-150 ${
                                      selected
                                        ? "text-on-surface-variant"
                                        : "text-on-surface-variant/60"
                                    }`}
                                  >
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
                      <section className="px-5 pb-5 sm:px-6">
                        <details className={`${sectionClassName} group`}>
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                            <span className="font-display text-sm font-bold text-text-main">
                              Gör så här
                            </span>
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-high text-on-surface-variant transition-transform duration-150 group-open:rotate-180">
                              <LucideIcon
                                name="expand_more"
                                className="h-4 w-4"
                              />
                            </span>
                          </summary>
                          <ol className="mt-3 space-y-2.5 pl-5 text-xs leading-relaxed text-on-surface-variant [list-style:decimal]">
                            {preview.instructions.map((instruction, index) => (
                              <li
                                key={`${instruction}-${index}`}
                                className="pl-1"
                              >
                                {instruction}
                              </li>
                            ))}
                          </ol>
                        </details>
                      </section>
                    ) : null}
                  </div>

                  <footer className="shrink-0 border-t border-surface-container/40 bg-surface-container-lowest/95 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-md sm:px-6 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pt-4">
                    <p className="mb-3 text-center text-xs font-medium text-on-surface-variant">
                      <span className="font-bold tabular-nums text-text-main">
                        {selectedCount} av {totalCount}
                      </span>{" "}
                      varor läggs till
                    </p>
                    <div className="flex gap-2.5">
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="w-[34%] rounded-xl bg-surface-container-low px-3 py-3.5 font-display text-xs font-bold text-on-surface-variant transition-[background-color,transform] duration-150 hover:bg-surface-container-high active:scale-[0.97]"
                      >
                        Avbryt
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirm}
                        className="flex-1 rounded-xl bg-primary px-4 py-3.5 font-display text-xs font-bold text-white shadow-sm transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.97]"
                      >
                        Lägg till måltid
                      </button>
                    </div>
                  </footer>
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

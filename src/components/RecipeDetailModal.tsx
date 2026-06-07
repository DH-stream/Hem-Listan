import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import type { MealSlot } from "../types";
import { formatIngredientName } from "../lib/ingredientDisplay";
import LucideIcon from "./LucideIcon";

type RecipeDetailModalProps = {
  meal: MealSlot | null;
  onClose: () => void;
};

type ScreenWakeLockSentinel = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
  removeEventListener: (type: "release", listener: () => void) => void;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<ScreenWakeLockSentinel>;
  };
};

const easing = [0.23, 1, 0.32, 1] as const;
const sectionClassName =
  "rounded-2xl border border-surface-container/40 bg-surface-container-low p-4 shadow-[0_8px_24px_rgba(34,50,35,0.05)]";

export default function RecipeDetailModal({ meal, onClose }: RecipeDetailModalProps) {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(() => new Set());
  const [wakeLockSupported, setWakeLockSupported] = useState(false);
  const [wantsWakeLock, setWantsWakeLock] = useState(false);
  const [isWakeLocked, setIsWakeLocked] = useState(false);
  const wakeLockRef = useRef<ScreenWakeLockSentinel | null>(null);
  const wakeLockReleaseHandlerRef = useRef<(() => void) | null>(null);
  const wantsWakeLockRef = useRef(false);
  const modalOpenRef = useRef(false);

  const releaseWakeLock = useCallback(async () => {
    const wakeLock = wakeLockRef.current;
    const releaseHandler = wakeLockReleaseHandlerRef.current;
    wakeLockRef.current = null;
    wakeLockReleaseHandlerRef.current = null;
    setIsWakeLocked(false);

    if (wakeLock && releaseHandler) {
      wakeLock.removeEventListener("release", releaseHandler);
    }
    if (!wakeLock || wakeLock.released) return;

    try {
      await wakeLock.release();
    } catch {
      // Wake lock release can fail when the browser already released it.
    }
  }, []);

  const requestWakeLock = useCallback(async () => {
    const wakeLock = (navigator as NavigatorWithWakeLock).wakeLock;
    if (!wakeLock) return;

    try {
      const sentinel = await wakeLock.request("screen");
      if (!wantsWakeLockRef.current || !modalOpenRef.current) {
        await sentinel.release();
        return;
      }

      wakeLockRef.current = sentinel;
      setIsWakeLocked(true);

      const handleRelease = () => {
        sentinel.removeEventListener("release", handleRelease);
        if (wakeLockRef.current === sentinel) wakeLockRef.current = null;
        if (wakeLockReleaseHandlerRef.current === handleRelease) {
          wakeLockReleaseHandlerRef.current = null;
        }
        setIsWakeLocked(false);
      };
      wakeLockReleaseHandlerRef.current = handleRelease;
      sentinel.addEventListener("release", handleRelease);
    } catch {
      wantsWakeLockRef.current = false;
      setWantsWakeLock(false);
      setIsWakeLocked(false);
    }
  }, []);

  useEffect(() => {
    setWakeLockSupported(
      typeof navigator !== "undefined" &&
        "wakeLock" in navigator &&
        typeof (navigator as NavigatorWithWakeLock).wakeLock?.request === "function",
    );
  }, []);

  useEffect(() => {
    modalOpenRef.current = Boolean(meal);
    wantsWakeLockRef.current = false;
    setCompletedSteps(new Set());
    setWantsWakeLock(false);
    void releaseWakeLock();
  }, [meal?.id, releaseWakeLock]);

  useEffect(() => {
    if (!meal) return undefined;

    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        wantsWakeLock &&
        !wakeLockRef.current
      ) {
        void requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [meal, requestWakeLock, wantsWakeLock]);

  useEffect(() => {
    return () => {
      modalOpenRef.current = false;
      wantsWakeLockRef.current = false;
      void releaseWakeLock();
    };
  }, [releaseWakeLock]);

  const toggleWakeLock = () => {
    if (wantsWakeLock || isWakeLocked) {
      wantsWakeLockRef.current = false;
      setWantsWakeLock(false);
      void releaseWakeLock();
      return;
    }

    wantsWakeLockRef.current = true;
    setWantsWakeLock(true);
    void requestWakeLock();
  };

  const toggleStep = (index: number) => {
    setCompletedSteps((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

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
                {wakeLockSupported ? (
                  <button
                    type="button"
                    onClick={toggleWakeLock}
                    aria-pressed={isWakeLocked}
                    className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-bold transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] ${
                      isWakeLocked
                        ? "border-primary/20 bg-primary-fixed text-primary"
                        : "border-surface-container/60 bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                    }`}
                  >
                    <LucideIcon name="sunny" className="h-3.5 w-3.5" />
                    {isWakeLocked
                      ? "Skärmen hålls vaken"
                      : "Håll skärmen vaken"}
                  </button>
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
                              {formatIngredientName(ingredient.text)}
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
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-display text-sm font-bold text-text-main">Gör så här</h3>
                      {completedSteps.size > 0 ? (
                        <p className="shrink-0 text-[11px] font-bold text-on-surface-variant/70">
                          {completedSteps.size} av {meal.recipeInstructions.length} steg klara
                        </p>
                      ) : null}
                    </div>
                    <ol className="mt-4 space-y-3">
                      {meal.recipeInstructions.map((instruction, index) => {
                        const completed = completedSteps.has(index);

                        return (
                          <li key={`${instruction}-${index}`}>
                            <button
                              type="button"
                              aria-pressed={completed}
                              onClick={() => toggleStep(index)}
                              className={`flex w-full gap-3 rounded-2xl border p-4 text-left transition-[background-color,border-color,transform] duration-150 active:scale-[0.99] ${
                                completed
                                  ? "border-surface-container/60 bg-surface-container-lowest/80"
                                  : "border-transparent bg-surface-container-lowest hover:border-surface-container/60"
                              }`}
                            >
                              <span
                                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-display text-sm font-bold tabular-nums transition-colors duration-150 ${
                                  completed
                                    ? "border-primary/25 bg-primary-fixed text-primary"
                                    : "border-surface-container-highest bg-surface-container-low text-text-main"
                                }`}
                              >
                                {completed ? (
                                  <LucideIcon name="check" className="h-4 w-4 stroke-[3]" />
                                ) : (
                                  index + 1
                                )}
                              </span>
                              <span
                                className={`min-w-0 text-base leading-relaxed transition-colors duration-150 sm:text-[1.05rem] ${
                                  completed
                                    ? "text-on-surface-variant/70"
                                    : "text-text-main"
                                }`}
                              >
                                {instruction}
                              </span>
                            </button>
                          </li>
                        );
                      })}
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

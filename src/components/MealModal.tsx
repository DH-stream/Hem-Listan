import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import type { MealType, SavedRecipe } from '../types';
import SavedRecipePicker from './SavedRecipePicker';

interface MealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
  day?: string;
  mealType?: MealType;
  isLoggedIn: boolean;
  onSelectSavedRecipe: (recipe: SavedRecipe) => void;
}

type MealModalMode = 'manual' | 'savedRecipePicker';
type MealModalPhase = 'idle' | 'open' | 'confirming' | 'check' | 'closing';

const easing = [0.23, 1, 0.32, 1] as const;
const backdropTransition = { duration: 0.16, ease: easing } as const;
const cardTransition = { duration: 0.16, ease: easing } as const;
const contentTransition = { duration: 0.14, ease: easing } as const;

const MealModal = memo(({ isOpen, onClose, onConfirm, day = "Måndag", mealType = "frukost", isLoggedIn, onSelectSavedRecipe }: MealModalProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<MealModalPhase>('idle');
  const [mode, setMode] = useState<MealModalMode>('manual');

  useEffect(() => {
    if (isOpen) {
      setMode('manual');
      setPhase('open');
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [isOpen]);

  const handleCancel = useCallback(() => {
    setPhase('closing');
    setTimeout(() => { setPhase('idle'); onClose(); }, 300);
  }, [onClose]);

  const handleSavedRecipeSelect = useCallback((recipe: SavedRecipe) => {
    setPhase('idle');
    onSelectSavedRecipe(recipe);
  }, [onSelectSavedRecipe]);

  const handleConfirm = useCallback(() => {
    const value = inputRef.current?.value ?? '';
    setPhase('confirming');
    setTimeout(() => setPhase('check'), 600);
    setTimeout(() => {
      onConfirm(value);
      setPhase('closing');
      setTimeout(() => { setPhase('idle'); onClose(); }, 300);
    }, 1200);
  }, [onConfirm, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {phase !== 'idle' && (
        <motion.div
          key="meal-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={backdropTransition}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-none bg-black/50 p-4 font-sans"
        >
          <style>{`@keyframes drawCheck { to { stroke-dashoffset: 0; } }`}</style>

          <AnimatePresence mode="popLayout" initial={false}>
            {phase === 'open' && (
              <motion.div
                key="meal-modal-card"
                layout="size"
                layoutDependency={mode}
                role="dialog"
                aria-modal="true"
                aria-labelledby={mode === 'manual' ? 'meal-modal-title' : 'saved-recipe-picker-title'}
                initial={{ opacity: 0, scale: 0.98, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 4 }}
                transition={cardTransition}
                className="relative my-4 flex max-h-[calc(100dvh-2rem)] w-full max-w-md transform-gpu flex-col overflow-hidden rounded-3xl border border-primary/10 bg-gradient-to-br from-[#FCF9F8] to-[#E8F5E9] shadow-2xl will-change-transform sm:my-8 sm:max-h-[calc(100dvh-4rem)]"
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  {mode === 'manual' ? (
                    <motion.div
                      key="manual"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={contentTransition}
                      className="p-6"
                    >
                      <h2 id="meal-modal-title" className="text-[1.2rem] font-semibold leading-[1.3] text-gray-800">
                        Vad vill du lägga till för {mealType} på {day}?
                      </h2>
                      <p className="mb-6 mt-2 text-sm text-gray-600">Skriv in en maträtt eller en länk.</p>

                      <button
                        type="button"
                        onClick={() => setMode('savedRecipePicker')}
                        className="mb-4 w-full rounded-[14px] border border-[#D9E8D7] bg-[#F3F8F1] px-3.5 py-3 text-sm font-semibold text-[#1A6B20] transition-transform active:scale-[0.97]"
                      >
                        Vill du använda ett sparat recept?
                      </button>

                      <input
                        ref={inputRef}
                        type="text"
                        defaultValue=""
                        className="mb-7 w-full rounded-2xl border-0 bg-[#FCF9F8] px-4 py-3.5 text-base text-gray-700 shadow-[inset_4px_4px_8px_#DCD9D8,inset_-4px_-4px_8px_#FFFFFF] outline-none"
                        placeholder="T.ex. Havregrynsgröt"
                        autoFocus
                      />

                      <div className="flex gap-3">
                        <button type="button" onClick={handleCancel} className="flex-1 rounded-2xl border-0 bg-gray-100 px-5 py-3.5 text-base font-medium text-gray-700 transition-transform active:scale-[0.97]">
                          Avbryt
                        </button>
                        <button type="button" onClick={handleConfirm} className="flex-1 rounded-2xl border-0 bg-[#1A6B20] px-5 py-3.5 text-base font-semibold text-white shadow-[0_4px_14px_rgba(26,107,32,0.35)] transition-transform active:scale-[0.97]">
                          OK
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="saved"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={contentTransition}
                      className="min-h-0"
                    >
                      <SavedRecipePicker
                        isLoggedIn={isLoggedIn}
                        onBack={() => setMode('manual')}
                        onClose={handleCancel}
                        onSelect={handleSavedRecipeSelect}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {(phase === 'confirming' || phase === 'check') && (
              <motion.div
                key="meal-modal-confirmation"
                initial={{ opacity: 0, scale: 0.98, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 4 }}
                transition={cardTransition}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-[#1A6B20] shadow-[0_0_24px_rgba(26,107,32,0.5)]"
              >
                {phase === 'check' && (
                  <svg
                    viewBox="0 0 52 52"
                    style={{
                      width: 36,
                      height: 36,
                      stroke: 'white',
                      strokeWidth: 4,
                      strokeLinecap: 'round',
                      strokeLinejoin: 'round',
                      fill: 'none',
                      strokeDasharray: 100,
                      strokeDashoffset: 100,
                      animation: 'drawCheck 0.35s ease-out forwards',
                    }}
                  >
                    <path d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                  </svg>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
});

export default MealModal;

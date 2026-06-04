import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import LucideIcon from "./LucideIcon";

type DeleteListConfirmModalProps = {
  isOpen: boolean;
  listName?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function DeleteListConfirmModal({
  isOpen,
  listName,
  onCancel,
  onConfirm,
}: DeleteListConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="delete-list-confirm-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-none bg-black/40 p-4 backdrop-blur-sm font-sans"
          onClick={onCancel}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-list-confirm-title"
            aria-describedby="delete-list-confirm-description"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="relative my-8 w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={onCancel}
              className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full text-gray-400 transition-transform hover:text-gray-600 active:scale-[0.94]"
              aria-label="Stäng bekräftelse"
            >
              <LucideIcon name="close" className="h-5 w-5" />
            </button>

            <div className="mb-5 flex items-start gap-3 pr-8">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 ring-1 ring-red-100">
                <LucideIcon name="archive" className="h-5 w-5" />
              </div>
              <div className="min-w-0 pt-0.5">
                <h2
                  id="delete-list-confirm-title"
                  className="text-lg font-bold leading-tight text-gray-900"
                >
                  Ta bort lista?
                </h2>
                {listName && (
                  <p className="mt-1 truncate text-xs font-bold text-gray-500">
                    {listName}
                  </p>
                )}
              </div>
            </div>

            <p
              id="delete-list-confirm-description"
              className="text-sm font-medium leading-relaxed text-gray-600"
            >
              Listan flyttas till Borttagna listor i 2 dagar. Du kan återställa
              den från Inställningar.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onCancel}
                className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 shadow-sm transition-all hover:bg-gray-50 active:scale-[0.97] sm:min-w-28"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="min-h-[44px] rounded-xl bg-red-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/20 transition-all hover:bg-red-600 active:scale-[0.97] sm:min-w-28"
              >
                Ta bort
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

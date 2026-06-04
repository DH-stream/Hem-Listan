import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import LucideIcon from "./LucideIcon";

type ListActionsModalProps = {
  isOpen: boolean;
  listName?: string;
  onCancel: () => void;
  onSend: () => void;
  onShare: () => void;
  onDelete: () => void;
};

const actions = [
  {
    key: "send",
    title: "Skicka lista",
    subtitle: "Skicka en kopia som någon kan öppna.",
    icon: "link",
    destructive: false,
  },
  {
    key: "share",
    title: "Dela lista",
    subtitle: "Bjud in någon att redigera tillsammans.",
    icon: "person",
    destructive: false,
  },
  {
    key: "delete",
    title: "Ta bort lista",
    subtitle: "Flytta till Borttagna listor i 2 dagar.",
    icon: "archive",
    destructive: true,
  },
] as const;

export default function ListActionsModal({
  isOpen,
  listName,
  onCancel,
  onSend,
  onShare,
  onDelete,
}: ListActionsModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const handleAction = (key: (typeof actions)[number]["key"]) => {
    if (key === "send") {
      onSend();
      return;
    }

    if (key === "share") {
      onShare();
      return;
    }

    onDelete();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="list-actions-backdrop"
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
            aria-labelledby="list-actions-title"
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
              className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full text-gray-400 transition-[color,transform] hover:text-gray-600 active:scale-[0.94]"
              aria-label="Stäng liståtgärder"
            >
              <LucideIcon name="close" className="h-5 w-5" />
            </button>

            <div className="mb-5 pr-8">
              <h2
                id="list-actions-title"
                className="text-lg font-bold leading-tight text-gray-900"
              >
                Liståtgärder
              </h2>
              {listName && (
                <p className="mt-1 truncate text-xs font-bold text-gray-500">
                  {listName}
                </p>
              )}
            </div>

            <div className="space-y-2">
              {actions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  onClick={() => handleAction(action.key)}
                  className="group flex min-h-[68px] w-full items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/80 p-3 text-left shadow-sm transition-[background-color,box-shadow,transform] hover:bg-white hover:shadow-md active:scale-[0.98]"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1 ${
                      action.destructive
                        ? "bg-red-50 text-red-600 ring-red-100"
                        : "bg-white text-gray-700 ring-gray-200"
                    }`}
                  >
                    <LucideIcon name={action.icon} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-sm font-bold ${
                        action.destructive ? "text-red-600" : "text-gray-900"
                      }`}
                    >
                      {action.title}
                    </span>
                    <span className="mt-0.5 block text-xs font-medium leading-relaxed text-gray-500">
                      {action.subtitle}
                    </span>
                  </span>
                  <LucideIcon
                    name="chevron-right"
                    className="h-4 w-4 shrink-0 text-gray-300 transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-gray-400"
                  />
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

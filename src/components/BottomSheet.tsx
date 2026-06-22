import { ReactNode, useCallback } from "react";
import { AnimatePresence, motion, useDragControls, useReducedMotion } from "motion/react";

interface BottomSheetProps {
  open: boolean;
  titleId: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  closeLabel?: string;
  transition?: { duration: number } | { type: "spring"; stiffness: number; damping: number };
}

export default function BottomSheet({
  open,
  titleId,
  onClose,
  children,
  className = "",
  closeLabel = "Stäng",
  transition,
}: BottomSheetProps) {
  const shouldReduceMotion = useReducedMotion();
  const dragControls = useDragControls();
  const sheetTransition =
    transition ??
    (shouldReduceMotion
      ? { duration: 0.01 }
      : { type: "spring" as const, stiffness: 360, damping: 32 });

  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: { offset: { y: number }; velocity: { y: number } }) => {
      if (info.offset.y > 90 || info.velocity.y > 650) onClose();
    },
    [onClose],
  );

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
          <motion.button
            type="button"
            aria-label={closeLabel}
            className="absolute inset-0 bg-black/35"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`relative w-full rounded-t-3xl border border-surface-container bg-surface p-5 shadow-2xl sm:max-w-md sm:rounded-3xl ${className}`}
            initial={{ y: 32, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 32, opacity: 0 }}
            transition={sheetTransition}
            drag={shouldReduceMotion ? false : "y"}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.28 }}
            onDragEnd={handleDragEnd}
          >
            <button
              type="button"
              className="mx-auto mb-4 block h-5 w-14 touch-none cursor-grab rounded-full active:cursor-grabbing sm:hidden"
              aria-label="Dra nedåt för att stänga"
              onPointerDown={(event) => dragControls.start(event)}
            >
              <span className="mx-auto block h-1 w-10 rounded-full bg-outline-variant" />
            </button>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

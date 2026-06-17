import { AnimatePresence, motion } from "motion/react";
import StoreLogo from "./StoreLogo";
import { PRICING_SOURCES, type PricingSource } from "../lib/pricing/sources";

interface PricingSourceSheetProps {
  open: boolean;
  selectedSource: PricingSource;
  onSelect: (source: PricingSource) => void;
  onClose: () => void;
}

export default function PricingSourceSheet({
  open,
  selectedSource,
  onSelect,
  onClose,
}: PricingSourceSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.button
            type="button"
            aria-label="Stäng butiksväljaren"
            className="absolute inset-0 bg-black/35"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pricing-source-title"
            className="relative w-full rounded-t-3xl border border-surface-container bg-surface p-5 shadow-2xl sm:max-w-md sm:rounded-3xl"
            initial={{ y: 32, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 32, opacity: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 32 }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-outline-variant sm:hidden" />
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 id="pricing-source-title" className="font-display text-lg font-bold text-on-surface">
                  Välj butik
                </h2>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Välj priskälla för den här enheten.
                </p>
              </div>
              <button
                type="button"
                className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container"
                aria-label="Stäng"
                onClick={onClose}
              >
                ×
              </button>
            </div>
            <div className="space-y-2">
              {PRICING_SOURCES.map((source) => {
                const active =
                  source.chain === selectedSource.chain && source.storeId === selectedSource.storeId;
                return (
                  <button
                    key={`${source.chain}:${source.storeId}`}
                    type="button"
                    className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                      active
                        ? "border-primary bg-primary/10"
                        : "border-surface-container-high bg-surface-container-lowest hover:bg-surface-container-low"
                    }`}
                    onClick={() => onSelect(source)}
                  >
                    <StoreLogo chainId={source.chain} className="h-8 w-14" />
                    <span className="flex-1 font-sans text-sm font-semibold text-on-surface">
                      {source.label}
                    </span>
                    {active && <span className="text-sm font-bold text-primary">Vald</span>}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

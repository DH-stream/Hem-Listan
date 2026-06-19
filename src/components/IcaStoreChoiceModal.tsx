import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import StoreLogo from "./StoreLogo";
import {
  resolveNearestIcaStore,
  SEEDED_ICA_STORES,
  type PricingSource,
} from "../lib/pricing/sources";

interface IcaStoreChoiceModalProps {
  open: boolean;
  selectedSource: PricingSource;
  onSelect: (source: PricingSource) => void;
  onClose: () => void;
}

type IcaStep = "choice" | "list";

export default function IcaStoreChoiceModal({
  open,
  selectedSource,
  onSelect,
  onClose,
}: IcaStoreChoiceModalProps) {
  const [step, setStep] = useState<IcaStep>("choice");
  const [storeQuery, setStoreQuery] = useState("");
  const [resolvingNearest, setResolvingNearest] = useState(false);

  const filteredStores = useMemo(() => {
    const normalizedQuery = storeQuery.trim().toLocaleLowerCase("sv-SE");
    if (!normalizedQuery) return SEEDED_ICA_STORES;
    return SEEDED_ICA_STORES.filter((store) =>
      [store.label, store.storeId, store.storeUrl]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase("sv-SE").includes(normalizedQuery)),
    );
  }, [storeQuery]);

  const handleClose = () => {
    setStep("choice");
    setStoreQuery("");
    onClose();
  };

  const handleSelect = (source: PricingSource) => {
    setStep("choice");
    setStoreQuery("");
    onSelect(source);
  };

  const handleNearest = async () => {
    if (resolvingNearest) return;
    setResolvingNearest(true);
    try {
      handleSelect(await resolveNearestIcaStore());
    } finally {
      setResolvingNearest(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="absolute inset-0 z-10 flex items-end justify-center px-4 pb-6 sm:items-center sm:p-6">
          <motion.button
            type="button"
            aria-label="Stäng ICA-väljaren"
            className="absolute inset-0 rounded-t-3xl bg-black/20 sm:rounded-3xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ica-store-choice-title"
            className="relative w-full rounded-3xl border border-surface-container-high bg-surface p-4 shadow-2xl sm:max-w-sm"
            initial={{ y: 24, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 24, scale: 0.98, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 id="ica-store-choice-title" className="font-display text-lg font-bold text-on-surface">
                  Välj ICA-butik
                </h3>
                {step === "list" && (
                  <p className="mt-1 text-sm text-on-surface-variant">Sök eller välj butik själv.</p>
                )}
              </div>
              <button
                type="button"
                className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container"
                aria-label="Tillbaka"
                onClick={handleClose}
              >
                ×
              </button>
            </div>

            {step === "choice" ? (
              <div className="space-y-2">
                <button
                  type="button"
                  className="w-full rounded-2xl border border-surface-container-high bg-surface-container-lowest p-4 text-left transition hover:bg-surface-container-low"
                  onClick={handleNearest}
                >
                  <span className="block font-sans text-base font-bold text-on-surface">Närmast mig</span>
                  <span className="mt-1 block text-sm text-on-surface-variant">Använd butik nära dig</span>
                </button>
                <button
                  type="button"
                  className="w-full rounded-2xl border border-surface-container-high bg-surface-container-lowest p-4 text-left transition hover:bg-surface-container-low"
                  onClick={() => setStep("list")}
                >
                  <span className="block font-sans text-base font-bold text-on-surface">Välj från lista</span>
                  <span className="mt-1 block text-sm text-on-surface-variant">Sök eller välj butik själv</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="search"
                  className="w-full rounded-2xl border border-surface-container-high bg-surface-container-lowest px-4 py-3 font-sans text-sm text-on-surface outline-none transition placeholder:text-on-surface-variant focus:border-primary focus:bg-surface"
                  placeholder="Sök ICA-butik"
                  value={storeQuery}
                  onChange={(event) => setStoreQuery(event.target.value)}
                />
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {filteredStores.length > 0 ? (
                    filteredStores.map((store) => {
                      const active =
                        selectedSource.chain === store.chain && selectedSource.storeId === store.storeId;
                      return (
                        <button
                          key={`${store.chain}:${store.storeId}`}
                          type="button"
                          className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                            active
                              ? "border-primary bg-primary/10"
                              : "border-surface-container-high bg-surface-container-lowest hover:bg-surface-container-low"
                          }`}
                          onClick={() => handleSelect(store)}
                        >
                          <StoreLogo chainId="ica" className="h-8 w-14" />
                          <span className="flex-1 font-sans text-sm font-semibold text-on-surface">
                            {store.label}
                          </span>
                          {active && <span className="text-sm font-bold text-primary">Vald</span>}
                        </button>
                      );
                    })
                  ) : (
                    <p className="rounded-2xl border border-surface-container-high bg-surface-container-lowest p-4 text-center text-sm text-on-surface-variant">
                      Ingen butik hittades
                    </p>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

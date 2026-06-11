import React, { useEffect, useMemo, useState } from "react";
import type { TaskItem } from "../types";
import { cityGrossPriceAdapter, CITY_GROSS_DEMO_STORE } from "../lib/pricing/cityGrossAdapter";
import { loadStorePreferences, saveStorePreferences } from "../lib/pricing/preferences";
import type { BasketPriceResult, PriceMatchConfidence } from "../lib/pricing/types";
import LucideIcon from "./LucideIcon";

interface PriceSuggestionBetaProps {
  tasks: TaskItem[];
}

const sek = new Intl.NumberFormat("sv-SE", {
  style: "currency",
  currency: "SEK",
  minimumFractionDigits: 2,
});

const confidenceLabels: Record<PriceMatchConfidence, string> = {
  high: "Hög säkerhet",
  medium: "Medel",
  low: "Låg säkerhet",
  none: "Saknas",
};

const confidenceStyles: Record<PriceMatchConfidence, string> = {
  high: "bg-primary-fixed text-on-primary-fixed-variant",
  medium: "bg-[#FFF1C7] text-[#684E00]",
  low: "bg-error-container text-on-error-container",
  none: "bg-surface-container-high text-on-surface-variant",
};

export default function PriceSuggestionBeta({ tasks }: PriceSuggestionBetaProps) {
  const [preferences, setPreferences] = useState(loadStorePreferences);
  const [result, setResult] = useState<BasketPriceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeTasks = useMemo(() => tasks.filter((task) => !task.checked), [tasks]);
  const itemSignature = activeTasks.map((task) => `${task.id}:${task.text}`).join("|");

  useEffect(() => {
    setResult(null);
    setError(null);
  }, [itemSignature]);

  const chooseManualStore = () => {
    const next = {
      priceMode: "manual_store" as const,
      selectedStoreId: CITY_GROSS_DEMO_STORE.id,
    };
    setPreferences(next);
    saveStorePreferences(next);
  };

  const calculatePrice = async () => {
    setError(null);
    try {
      const basket = await cityGrossPriceAdapter.calculateBasket(
        preferences.selectedStoreId ?? CITY_GROSS_DEMO_STORE.id,
        activeTasks.map((task) => ({ id: task.id, name: task.text })),
      );
      setResult(basket);
    } catch (calculationError) {
      setResult(null);
      setError(
        calculationError instanceof Error
          ? calculationError.message
          : "Prisförslaget kunde inte beräknas.",
      );
    }
  };

  return (
    <section className="rounded-2xl border border-surface-container-high bg-surface-container-lowest p-5 bento-glow-primary">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg font-bold text-primary">Prisförslag</h3>
            <span className="rounded-full bg-primary-fixed px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-wider text-on-primary-fixed">
              Beta
            </span>
          </div>
          <p className="mt-1 font-sans text-xs leading-relaxed text-on-surface-variant">
            Demo-priser ger bara en uppskattning och kan skilja sig från priset i butik.
          </p>
        </div>
        <LucideIcon name="receipt" className="h-5 w-5 shrink-0 text-primary/70" />
      </div>

      <div className="mt-4 grid gap-2">
        <button
          type="button"
          onClick={chooseManualStore}
          aria-pressed={preferences.priceMode === "manual_store"}
          className="flex w-full items-center justify-between rounded-xl border border-primary/25 bg-primary-fixed/25 px-3.5 py-3 text-left transition-transform duration-150 active:scale-[0.98]"
        >
          <span>
            <span className="block font-sans text-sm font-semibold text-text-main">
              Jag väljer butik själv
            </span>
            <span className="mt-0.5 block font-sans text-xs text-on-surface-variant">
              {CITY_GROSS_DEMO_STORE.name}
            </span>
          </span>
          <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-primary bg-primary">
            <LucideIcon name="check" className="h-3 w-3 text-white" />
          </span>
        </button>

        <button
          type="button"
          disabled
          className="flex w-full cursor-not-allowed items-center justify-between rounded-xl border border-surface-container-high bg-surface-container-low px-3.5 py-3 text-left opacity-65"
        >
          <span>
            <span className="block font-sans text-sm font-semibold text-on-surface-variant">
              Hitta billigaste butik
            </span>
            <span className="mt-0.5 block font-sans text-xs text-outline">
              Jämförelse mellan flera kedjor kommer senare
            </span>
          </span>
          <span className="rounded-full bg-surface-container-high px-2 py-1 font-sans text-[10px] font-bold uppercase tracking-wider text-outline">
            Kommer
          </span>
        </button>
      </div>

      <button
        type="button"
        onClick={calculatePrice}
        disabled={activeTasks.length === 0}
        className="mt-4 w-full rounded-full bg-primary px-4 py-3 font-sans text-sm font-bold text-white shadow-sm transition-transform duration-150 hover:bg-primary-container active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
      >
        Beräkna ungefärligt pris
      </button>

      {activeTasks.length === 0 && (
        <p className="mt-2 text-center font-sans text-xs text-outline">
          Lägg till en ohanterad vara för att få ett prisförslag.
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-xl bg-error-container px-3 py-2 font-sans text-xs text-on-error-container">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-5 border-t border-surface-container-high pt-5">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-3 rounded-xl bg-primary-fixed/30 p-3.5 sm:col-span-1">
              <p className="font-sans text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                Ungefärligt totalpris
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-primary">
                {sek.format(result.approximateTotalSek)}
              </p>
            </div>
            <div className="rounded-xl bg-surface-container-low p-3.5">
              <p className="font-sans text-[10px] font-bold uppercase tracking-wider text-outline">
                Matchade
              </p>
              <p className="mt-1 font-display text-xl font-bold text-text-main">
                {result.matchedItemCount}
              </p>
            </div>
            <div className="rounded-xl bg-surface-container-low p-3.5">
              <p className="font-sans text-[10px] font-bold uppercase tracking-wider text-outline">
                Osäkra/saknas
              </p>
              <p className="mt-1 font-display text-xl font-bold text-text-main">
                {result.uncertainOrMissingItemCount}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {result.matches.map((match) => (
              <div
                key={match.listItemId}
                className="rounded-xl border border-surface-container-high bg-surface-container-lowest px-3.5 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-sans text-sm font-semibold text-text-main">
                      {match.listItemName}
                    </p>
                    <p className="mt-1 font-sans text-xs leading-relaxed text-on-surface-variant">
                      <span aria-hidden="true">→ </span>
                      {match.product?.productName ?? "Ingen demo-produkt hittades"}
                    </p>
                  </div>
                  <p className="shrink-0 font-sans text-sm font-bold text-primary">
                    {match.product ? sek.format(match.product.priceSek) : "—"}
                  </p>
                </div>
                <span
                  className={`mt-2 inline-flex rounded-full px-2 py-1 font-sans text-[10px] font-bold ${confidenceStyles[match.confidence]}`}
                >
                  {confidenceLabels[match.confidence]}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-3 font-sans text-[11px] leading-relaxed text-outline">
            Summan bygger på en demo-produkt per matchad listvara. Mängd, kampanjer och dagsaktuella butikspriser ingår inte.
          </p>
        </div>
      )}
    </section>
  );
}

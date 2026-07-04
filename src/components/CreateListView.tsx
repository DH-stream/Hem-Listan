import React, { useState } from "react";
import { motion } from "motion/react";
import LucideIcon from "./LucideIcon";
import type { List, WeekdayKey } from "../types";
import { WEEKDAYS } from "../lib/weekdays";

interface CreateListViewProps {
  onCancel: () => void;
  onCreateList: (name: string, icon: string, themeColor: string, category: List["category"], mealPlanStartDay?: WeekdayKey) => void;
}

export default function CreateListView({ onCancel, onCreateList }: CreateListViewProps) {
  const [listName, setListName] = useState("");
  const [selectedListType, setSelectedListType] = useState<List["category"]>("general");
  const [selectedIcon, setSelectedIcon] = useState("home");
  const [selectedColor, setSelectedColor] = useState("#003b05"); // default primary green
  const [mealPlanStartDay, setMealPlanStartDay] = useState<WeekdayKey>("monday");

  // Standard icon library from design layout
  const icons = [
    { name: "home", label: "Hem" },
    { name: "shopping_cart", label: "Inköp" },
    { name: "construction", label: "Fixa" },
    { name: "favorite", label: "Favorit" },
    { name: "book", label: "Läsa" },
    { name: "restaurant", label: "Mat" },
    { name: "fitness_center", label: "Träna" },
    { name: "flight", label: "Resa" },
    { name: "calendar", label: "Datum" },
    { name: "architecture", label: "Bygg" }
  ];

  // Colors aligned with brand kit
  const colors = [
    { value: "#003b05", label: "Mörkgrön" },
    { value: "#346a2f", label: "Skogsgrön" },
    { value: "#ffb0c9", label: "Rosa" },
    { value: "#7C2E00", label: "Eldbrun" },
    { value: "#9ad68e", label: "Ljusgrön" },
    { value: "#2F5F73", label: "Blåprint" }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!listName.trim()) return;

    onCreateList(
      listName.trim(),
      selectedIcon,
      selectedColor,
      selectedListType,
      selectedListType === "grocery" ? mealPlanStartDay : undefined,
    );
  };

  return (
    <div className="w-full max-w-[768px] mx-auto min-h-screen flex flex-col bg-surface font-sans">
      {/* Top Header Navigation */}
      <header className="w-full px-5 py-4 top-0 sticky bg-surface z-50 flex justify-between items-center text-on-surface">
        <button
          type="button"
          onClick={onCancel}
          className="text-on-surface-variant font-sans font-bold text-xs hover:opacity-85 transition-opacity active:scale-95"
        >
          Avbryt
        </button>
        <h1 className="font-display text-base font-bold text-text-main">
          Ny lista
        </h1>
        <div className="w-10"></div> {/* Balanced Spacer for true centering */}
      </header>

      {/* Form Content body container */}
      <main className="flex-1 px-5 py-6 flex flex-col gap-6 overflow-y-auto">
        {/* Hero Visual Card showing selected icons preview */}
        <div className="relative w-full h-40 rounded-xl overflow-hidden shadow-[0px_4px_20px_rgba(0,59,5,0.04)] bg-gradient-to-br from-surface-container via-surface-muted to-primary/10">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white/90 backdrop-blur-sm px-6 py-4 rounded-full shadow-md border border-white flex items-center justify-center gap-2">
              <LucideIcon
                name={selectedIcon}
                className="w-8 h-8 transition-transform duration-300"
                style={{ color: selectedColor }}
              />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 flex-grow">
          {/* List Name Text input */}
          <div className="space-y-2">
            <label className="font-sans text-xs font-bold text-on-surface-variant px-1 scale-95 origin-left">
              Listnamn
            </label>
            <input
              type="text"
              required
              maxLength={40}
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              className="w-full bg-surface-muted border-0 rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none text-on-surface placeholder:text-outline/50 font-sans"
              placeholder="t.ex. Badrumsrenovering"
            />
          </div>

          {/* Functional list type selection */}
          <fieldset className="space-y-3">
            <legend className="font-sans text-xs font-bold text-on-surface-variant px-1 scale-95 origin-left">
              Vad vill du skapa?
            </legend>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  value: "general" as const,
                  title: "Vanlig lista",
                  subtitle: "Projekt, vardag, packning och fix",
                  icon: "home"
                },
                {
                  value: "grocery" as const,
                  title: "Matlista",
                  subtitle: "Inköp, varor och måltidsplanering",
                  icon: "shopping_cart"
                },
                {
                  value: "date_log" as const,
                  title: "Datumlista",
                  subtitle: "Logga händelser och anteckningar per dag",
                  icon: "calendar"
                },
                {
                  value: "build_sketch" as const,
                  title: "Byggskiss",
                  subtitle: "Skissa rum och väggmått",
                  icon: "architecture"
                }
              ].map((listType) => {
                const isActive = selectedListType === listType.value;
                return (
                  <button
                    key={listType.value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setSelectedListType(listType.value)}
                    className={`relative min-h-24 rounded-2xl border p-3 text-left transition-[background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.98] ${
                      isActive
                        ? "border-primary bg-primary/5 shadow-[0_0_0_1px_var(--color-primary),0_8px_24px_rgba(0,59,5,0.06)]"
                        : "border-outline/15 bg-surface-container-low hover:border-primary/25 hover:bg-surface-muted"
                    }`}
                  >
                    <span
                      className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${
                        isActive ? "bg-primary text-white" : "bg-white text-on-surface-variant shadow-sm"
                      }`}
                    >
                      <LucideIcon name={listType.icon} className="h-4 w-4" />
                    </span>
                    <span className="block pr-6 font-display text-sm font-bold text-text-main">
                      {listType.title}
                    </span>
                    <span className="mt-1 block pr-1 text-[11px] leading-snug text-on-surface-variant">
                      {listType.subtitle}
                    </span>
                    {isActive && (
                      <span className="absolute right-3.5 top-3.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white shadow-sm">
                        <LucideIcon name="check" className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>



          {selectedListType === "grocery" && (
            <div className="space-y-2">
              <label htmlFor="meal-plan-start-day" className="font-sans text-xs font-bold text-on-surface-variant px-1 scale-95 origin-left">
                Veckan börjar på
              </label>
              <select
                id="meal-plan-start-day"
                value={mealPlanStartDay}
                onChange={(event) => setMealPlanStartDay(event.target.value as WeekdayKey)}
                className="w-full bg-surface-muted border-0 rounded-xl px-4 py-3.5 text-sm focus:ring-2 focus:ring-primary focus:bg-white transition-all outline-none text-on-surface font-sans"
              >
                {WEEKDAYS.map((weekday) => (
                  <option key={weekday.key} value={weekday.key}>
                    {weekday.label}
                  </option>
                ))}
              </select>
              <p className="px-1 text-xs leading-relaxed text-on-surface-variant">
                Välj vilken dag matplaneringen ska börja. Du kan ändra detta senare.
              </p>
            </div>
          )}

          {/* Icon Choice Grid selection */}
          <div className="space-y-3">
            <label className="font-sans text-xs font-bold text-on-surface-variant px-1 scale-95 origin-left">
              Välj ikon
            </label>
            <div className="grid grid-cols-4 gap-3">
              {icons.map((item) => {
                const isActive = selectedIcon === item.name;
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => setSelectedIcon(item.name)}
                    className={`p-3.5 rounded-xl flex items-center justify-center hover:bg-surface-variant/40 transition-all active:scale-95 cursor-pointer border ${
                      isActive
                        ? "bg-primary text-white border-primary"
                        : "bg-surface-container-low border-transparent text-text-main"
                    }`}
                  >
                    <LucideIcon name={item.name} className="w-5 h-5" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Theme Color selectors */}
          <div className="space-y-3">
            <label className="font-sans text-xs font-bold text-on-surface-variant px-1 scale-95 origin-left">
              Välj temafärg
            </label>
            <div className="flex flex-wrap gap-4 px-1 py-1">
              {colors.map((color) => {
                const isActive = selectedColor === color.value;
                return (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setSelectedColor(color.value)}
                    className="w-10 h-10 rounded-full transition-all active:scale-90 relative cursor-pointer"
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                  >
                    {isActive && (
                      <span className="absolute inset-0 rounded-full ring-2 ring-offset-2 ring-primary border border-white" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </form>
      </main>

      {/* CTA Footer Form Submit button */}
      <footer className="p-5 pb-8">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!listName.trim()}
          className="w-full py-4 bg-primary text-white font-display text-sm font-bold rounded-full shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-45 disabled:pointer-events-none"
        >
          <span>Skapa lista</span>
          <LucideIcon name="plus" className="w-4 h-4" />
        </button>
      </footer>
    </div>
  );
}

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { List, ListMember, TaskItem } from "../types";
import { addDaysToDateKey, createDateLogEntry, formatDateLogHeading, formatDateLogTime, getEntriesForDate, getEntryDates, getWeekDays, toLocalDateKey } from "../lib/dateLog";
import LucideIcon from "./LucideIcon";
import ListNameEditor from "./ListNameEditor";
import PresenceAvatarStack from "./PresenceAvatarStack";
import SharedListCount from "./SharedListCount";
import type { PresentUser } from "../lib/presence";

interface ListDetailDateLogProps {
  list: List;
  members: ListMember[] | null;
  presentUsers: PresentUser[];
  onBack: () => void;
  onToggleTask: (listId: string, taskId: string) => void;
  onAddDateLogEntry: (listId: string, entry: Omit<TaskItem, "id">) => void;
  onDeleteTask: (listId: string, taskId: string) => void;
  onRenameList: (listId: string, name: string) => Promise<boolean>;
}

const WEEKDAY_LABELS = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

export default function ListDetailDateLog({
  list,
  members,
  presentUsers,
  onBack,
  onToggleTask,
  onAddDateLogEntry,
  onDeleteTask,
  onRenameList,
}: ListDetailDateLogProps) {
  const todayKey = toLocalDateKey(new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [entryText, setEntryText] = useState("");
  const [notes, setNotes] = useState("");
  const [weekDirection, setWeekDirection] = useState(1);

  const hasLogEntries = list.tasks.length > 0;
  const selectedDate = useMemo(() => new Date(`${selectedDateKey}T00:00:00`), [selectedDateKey]);
  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);
  const entryDates = useMemo(() => getEntryDates(list.tasks), [list.tasks]);
  const selectedEntries = useMemo(
    () => getEntriesForDate(list.tasks, selectedDateKey),
    [list.tasks, selectedDateKey],
  );

  const handlePreviousWeek = () => {
    setWeekDirection(-1);
    setSelectedDateKey((dateKey) => addDaysToDateKey(dateKey, -7));
  };
  const handleNextWeek = () => {
    setWeekDirection(1);
    setSelectedDateKey((dateKey) => addDaysToDateKey(dateKey, 7));
  };
  const handleToday = () => {
    setWeekDirection(selectedDateKey > todayKey ? -1 : 1);
    setSelectedDateKey(todayKey);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const text = entryText.trim();
    if (!text) return;

    onAddDateLogEntry(list.id, createDateLogEntry(text, selectedDateKey, notes.trim() || undefined));
    setEntryText("");
    setNotes("");
  };

  return (
    <div className="w-full max-w-[768px] mx-auto px-5 pb-28">
      <header className="relative sticky top-0 z-40 mb-3 h-[76px] w-full bg-surface/80 backdrop-blur-xl">
        <div className="absolute left-0 top-1/2 flex -translate-y-1/2 items-center">
          <button onClick={onBack} className="shrink-0 rounded-full p-1.5 text-primary transition-all hover:bg-surface-container active:scale-90" title="Gå tillbaka">
            <LucideIcon name="arrow_back" className="h-6 w-6" />
          </button>
        </div>
        <div className="pointer-events-none absolute left-1/2 top-1/2 flex w-[calc(100%_-_15rem)] -translate-x-1/2 -translate-y-1/2 flex-col items-center sm:w-[calc(100%_-_26.5rem)] [&>div]:pointer-events-auto [&>div]:max-w-full [&>form]:pointer-events-auto [&>form]:max-w-full">
          <ListNameEditor name={list.name} canRename={list.membershipRole !== "member"} onRename={(name) => onRenameList(list.id, name)} headingClassName="min-w-0 truncate font-display text-xl font-bold text-text-main" />
          <SharedListCount count={members?.length ?? list.memberCount} className="mt-1" />
        </div>
        <div className="absolute right-0 top-1/2 flex w-20 -translate-y-1/2 justify-end sm:w-28">
          <PresenceAvatarStack users={presentUsers} />
        </div>
      </header>

      <section className={`mb-5 rounded-2xl bg-primary-container text-on-primary shadow-[0px_4px_20px_rgba(0,59,5,0.04)] ${hasLogEntries ? "px-4 py-3" : "p-5"}`} style={{ backgroundColor: list.themeColor || "#1a5319" }}>
        {hasLogEntries ? (
          <div className="flex items-center justify-between gap-3">
            <p className="font-sans text-[10px] font-bold uppercase leading-none tracking-widest text-[#b3f3a6]">Datumlista</p>
            <div className="flex shrink-0 items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur-md">
              <LucideIcon name="calendar" className="h-3.5 w-3.5 text-white" />
              <span className="font-sans text-xs font-semibold">{list.tasks.length} loggar sparade</span>
            </div>
          </div>
        ) : (
          <>
            <p className="mb-1 font-sans text-[10px] font-bold uppercase leading-none tracking-widest text-[#b3f3a6]">Datumlista</p>
            <h2 className="mb-3 font-display text-2xl font-bold tracking-tight">Logga små händelser per dag</h2>
            <div className="flex w-fit items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 backdrop-blur-md">
              <LucideIcon name="calendar" className="h-4 w-4 text-white" />
              <span className="font-sans text-xs font-semibold">0 loggar sparade</span>
            </div>
          </>
        )}
      </section>

      <section className="mb-5 rounded-2xl bg-white/70 p-3 shadow-sm ring-1 ring-outline/10 backdrop-blur">
        <div className="mb-2 flex items-center justify-between gap-2">
          <button type="button" onClick={handlePreviousWeek} className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-all hover:bg-surface-muted active:scale-95" aria-label="Föregående vecka">
            <LucideIcon name="arrow_back" className="h-4 w-4" />
          </button>
          <button type="button" onClick={handleToday} disabled={selectedDateKey === todayKey} className="px-2 py-1 text-xs font-bold text-primary transition-opacity active:scale-95 disabled:pointer-events-none disabled:opacity-45">
            Idag
          </button>
          <button type="button" onClick={handleNextWeek} className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-all hover:bg-surface-muted active:scale-95" aria-label="Nästa vecka">
            <LucideIcon name="chevron_right" className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-hidden">
          <AnimatePresence initial={false} custom={weekDirection} mode="popLayout">
            <motion.div
              key={weekDays[0] ? toLocalDateKey(weekDays[0]) : selectedDateKey}
              initial={{ opacity: 0.88, x: weekDirection * 120 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0.88, x: weekDirection * -120 }}
              transition={{ duration: 0.42, ease: [0.23, 1, 0.32, 1] }}
              className="grid grid-cols-7 gap-1.5"
            >
              {weekDays.map((day, index) => {
                const dateKey = toLocalDateKey(day);
                const isSelected = selectedDateKey === dateKey;
                const isToday = todayKey === dateKey;
                const hasEntries = entryDates.has(dateKey);
                return (
                  <button key={dateKey} type="button" onClick={() => setSelectedDateKey(dateKey)} className={`relative min-h-[58px] rounded-2xl px-1 py-2 text-center transition-all active:scale-95 ${isSelected ? "bg-primary text-white shadow-md" : "text-on-surface-variant hover:bg-surface-muted/60"}`}>
                    <span className={`block text-[10px] font-bold uppercase ${isSelected ? "opacity-80" : "opacity-60"}`}>{WEEKDAY_LABELS[index]}</span>
                    <span className={`mt-1 block font-display text-lg font-bold leading-none ${isSelected ? "text-white" : "text-text-main/80"}`}>{day.getDate()}</span>
                    {isToday && <span className={`mt-1 block text-[9px] font-bold ${isSelected ? "text-white" : "text-primary"}`}>Idag</span>}
                    {hasEntries && <span className={`absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${isSelected ? "bg-white" : "bg-primary"}`} />}
                  </button>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      <section className="mb-5">
        <p className="px-1 text-xs font-bold uppercase tracking-widest text-on-surface-variant">Vald dag</p>
        <h3 className="px-1 font-display text-2xl font-bold capitalize text-text-main">{formatDateLogHeading(selectedDateKey)}</h3>
      </section>

      <form onSubmit={handleSubmit} className="mb-6 rounded-2xl bg-white/85 p-4 shadow-sm ring-1 ring-outline/10 backdrop-blur">
        <input value={entryText} onChange={(event) => setEntryText(event.target.value)} className="mb-3 w-full rounded-xl border-0 bg-surface-muted px-4 py-3 text-sm text-on-surface outline-none transition-all placeholder:text-outline/50 focus:bg-white focus:ring-2 focus:ring-primary" placeholder={selectedDateKey === todayKey ? "Lägg till logg för idag…" : "Lägg till logg för vald dag…"} />
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className="mb-3 w-full resize-none rounded-xl border-0 bg-surface-muted px-4 py-3 text-sm text-on-surface outline-none transition-all placeholder:text-outline/50 focus:bg-white focus:ring-2 focus:ring-primary" placeholder="Anteckning (valfritt), t.ex. Smort med Mildison" />
        <button type="submit" disabled={!entryText.trim()} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 font-display text-sm font-bold text-white shadow-md transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45">
          <span>Lägg till logg</span>
          <LucideIcon name="plus" className="h-4 w-4" />
        </button>
      </form>

      <div className="space-y-3">
        {selectedEntries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-outline/20 bg-white/50 p-6 text-center text-sm text-on-surface-variant">Inga loggar för den här dagen ännu.</div>
        ) : selectedEntries.map((entry) => (
          <article key={entry.id} className="rounded-2xl bg-white/85 p-4 shadow-sm ring-1 ring-outline/10 backdrop-blur">
            <div className="flex items-start gap-3">
              <button type="button" onClick={() => onToggleTask(list.id, entry.id)} className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all ${entry.checked ? "border-primary bg-primary text-white" : "border-outline/30 bg-white text-transparent"}`}>
                <LucideIcon name="check" className="h-3.5 w-3.5" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
                  <LucideIcon name="calendar" className="h-3.5 w-3.5" />
                  <span>{formatDateLogTime(entry) || formatDateLogHeading(selectedDateKey)}</span>
                </div>
                <p className={`font-sans text-sm font-semibold text-text-main ${entry.checked ? "line-through opacity-60" : ""}`}>{entry.text}</p>
                {entry.notes && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-on-surface-variant">{entry.notes}</p>}
              </div>
              <button type="button" onClick={() => onDeleteTask(list.id, entry.id)} className="rounded-full p-1 text-error opacity-45 transition-opacity hover:bg-surface-container hover:opacity-100" title="Ta bort">
                <LucideIcon name="close" className="h-4 w-4" />
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

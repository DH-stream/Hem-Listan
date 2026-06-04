import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { List, TaskItem } from "../types";
import LucideIcon from "./LucideIcon";
import CelebrationCard from "./CelebrationCard";

interface ListDetailRenovationProps {
  list: List;
  onBack: () => void;
  onToggleTask: (listId: string, taskId: string) => void;
  onAddTask: (
    listId: string,
    text: string,
    categoryName?: string,
    taskType?: "task" | "note" | "progress" | "link",
    url?: string,
    notes?: string,
    progress?: number
  ) => void;
  onDeleteTask: (listId: string, taskId: string) => void;
  onUpdateTask: (listId: string, taskId: string, updates: Partial<TaskItem>) => void;
  onResetList: (listId: string) => void;
  userImage?: string;
}

export default function ListDetailRenovation({
  list,
  onBack,
  onToggleTask,
  onAddTask,
  onDeleteTask,
  onUpdateTask,
  onResetList,
  userImage
}: ListDetailRenovationProps) {
  const [newTaskText, setNewTaskText] = useState("");
  const [selectedType, setSelectedType] = useState<"task" | "note" | "progress" | "link">("task");
  
  // Optional secondary fields
  const [extraNotes, setExtraNotes] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [initialProgress, setInitialProgress] = useState(0);
  const [showOptions, setShowOptions] = useState(false);

  const totalTasks = list.tasks.length;
  const completedTasks = list.tasks.filter((t) => t.checked);
  const completedCount = completedTasks.length;

  // Split tasks into sections:
  const completed = list.tasks.filter((t) => t.checked);
  
  // In-progress sections: items of type 'progress' or tasks with defined progress values (that are active, unchecked)
  const inProgress = list.tasks.filter(
    (t) =>
      !t.checked &&
      (t.type === "progress" || t.progress !== undefined || t.id === "r-t-4" || t.id === "r-t-5")
  );

  // Pure reference note items that are active/unchecked
  const notes = list.tasks.filter((t) => !t.checked && t.type === "note");

  // Useful links/bookmarks
  const links = list.tasks.filter((t) => !t.checked && t.type === "link");

  // Standard checkbox tasks that are active
  const toDo = list.tasks.filter(
    (t) =>
      !t.checked &&
      !completed.includes(t) &&
      !inProgress.includes(t) &&
      !notes.includes(t) &&
      !links.includes(t)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;

    // Format URL correctly if link is selected
    let cleanUrl = linkUrl.trim();
    if (selectedType === "link" && cleanUrl && !/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = `https://${cleanUrl}`;
    }

    onAddTask(
      list.id,
      newTaskText.trim(),
      undefined, // no direct category name mapping
      selectedType,
      selectedType === "link" ? cleanUrl : undefined,
      extraNotes.trim() || undefined,
      selectedType === "progress" ? initialProgress : undefined
    );

    // Reset input states
    setNewTaskText("");
    setExtraNotes("");
    setLinkUrl("");
    setInitialProgress(0);
    setShowOptions(false);
  };

  const handleIncrementProgress = (taskId: string, current: number) => {
    const next = Math.min(100, current + 10);
    if (next === 100) {
      // Auto complete progress item if it reaches 100%!
      onUpdateTask(list.id, taskId, { progress: 100, checked: true });
    } else {
      onUpdateTask(list.id, taskId, { progress: next });
    }
  };

  const handleDecrementProgress = (taskId: string, current: number) => {
    const next = Math.max(0, current - 10);
    onUpdateTask(list.id, taskId, { progress: next });
  };

  // Get responsive custom type label text and icon in Swedish
  const getTypeBadge = (type?: string) => {
    switch (type) {
      case "note":
        return { text: "Notering", icon: "book", color: "text-[#E0A96D] bg-[#FDF6EC] border-[#F9EAD4]" };
      case "link":
        return { text: "Resurs", icon: "link", color: "text-[#628E90] bg-[#F0F6F6] border-[#DFECEC]" };
      default:
        return { text: "Uppgift", icon: "check", color: "text-primary bg-primary/5 border-primary/10" };
    }
  };

  return (
    <div className="w-full max-w-[768px] mx-auto px-5 pb-[180px]">
      {/* Back Navigation Top Header */}
      <header className="w-full sticky top-0 bg-surface/80 backdrop-blur-xl flex justify-between items-center py-4 z-40 mb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-surface-container text-primary rounded-full transition-all active:scale-90"
            title="Gå tillbaka"
          >
            <LucideIcon name="arrow_back" className="w-6 h-6" />
          </button>
          <h1 className="font-display text-xl font-bold text-text-main line-clamp-1">
            {list.name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {completedCount > 0 && (
            <button
              onClick={() => onResetList(list.id)}
              className="px-3 py-1.5 bg-surface-container hover:bg-surface-container-high rounded-full font-sans text-xs font-bold text-outline hover:text-text-main flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Återställ alla framsteg i listan"
            >
              <LucideIcon name="refresh" className="w-3.5 h-3.5" />
              <span>Återställ</span>
            </button>
          )}
          {userImage && (
            <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant shrink-0">
              <img
                alt="User"
                src={userImage}
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>
      </header>

      {/* Hero Badge card display status */}
      <section className="mb-8">
        <div
          className="bg-primary-container rounded-xl p-5 text-on-primary shadow-[0px_4px_20px_rgba(0,59,5,0.04)] relative overflow-hidden"
          style={{ backgroundColor: list.themeColor || "#1a5319" }}
        >
          <div className="relative z-10">
            <p className="font-sans text-[10px] uppercase font-bold tracking-widest text-[#b3f3a6] mb-1 leading-none">
              Status
            </p>
            <h2 className="font-display text-2xl font-bold tracking-tight mb-3">
              {list.id === "renovation-1" ? "Guest Wing Progress" : `${list.name} - Framsteg`}
            </h2>
            <div className="flex items-center gap-2 bg-white/20 w-fit px-3 py-1.5 rounded-full backdrop-blur-md">
              <LucideIcon name="architecture" className="w-4 h-4 text-white" />
              <span className="font-sans text-xs font-semibold">
                {completedCount} av {totalTasks} punkter avklarade
              </span>
            </div>
          </div>
          {/* Subtle design circles */}
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        </div>
      </section>

      {/* Universal Celebration view triggered when ALL items are checked */}
      {totalTasks > 0 && completedCount === totalTasks ? (
        <CelebrationCard
          listName={list.name}
          totalTasks={totalTasks}
          onReset={() => onResetList(list.id)}
        />
      ) : (
        /* Categories lists grid blocks */
        <div className="space-y-8">
          
          {/* REFERENCE NOTES SECTION */}
          {notes.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="font-sans text-xs font-bold text-outline uppercase tracking-wider">
                  Anteckningar & Idéer 📌
                </h3>
                <span className="bg-[#FFF9EE] text-[#D08F35] border border-[#F6E6CC] px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  {notes.length} st
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <AnimatePresence initial={false}>
                  {notes.map((task) => (
                    <motion.div
                      key={task.id}
                      className="bg-gradient-to-tr from-[#FFFDF9] to-[#FCFBF4] p-4 rounded-xl border border-[#F5E6CC]/80 shadow-[0px_2px_12px_rgba(208,143,53,0.03)] relative group text-left"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      layoutId={`task-${task.id}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-display text-sm font-bold text-text-main line-clamp-1 pr-4">
                          {task.text}
                        </h4>
                        <div className="flex gap-1 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => onToggleTask(list.id, task.id)}
                            className="p-1 hover:bg-[#F2E4CD] text-[#A86E1B] rounded-full transition-colors"
                            title="Markera som klar"
                          >
                            <LucideIcon name="check" className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteTask(list.id, task.id)}
                            className="p-1 hover:bg-[#F2E4CD] text-error rounded-full transition-colors"
                            title="Ta bort"
                          >
                            <LucideIcon name="close" className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      
                      <p className="font-sans text-xs text-on-surface-variant font-medium whitespace-pre-line line-clamp-4 leading-relaxed italic">
                        {task.notes || "Inget antecknat än."}
                      </p>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}

          {/* USEFUL LINKS & RESOURCES SECTION */}
          {links.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="font-sans text-xs font-bold text-outline uppercase tracking-wider">
                  Spara Länkar & Webbplatser 🔗
                </h3>
                <span className="bg-[#F0F6F6] text-[#4A7879] border border-[#DCECEC] px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  {links.length} st
                </span>
              </div>
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {links.map((task) => (
                    <motion.div
                      key={task.id}
                      className="bg-white p-3.5 rounded-xl border border-surface-container/20 shadow-sm flex items-center justify-between group"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      layoutId={`task-${task.id}`}
                    >
                      <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        <button
                          onClick={() => onToggleTask(list.id, task.id)}
                          className="w-5 h-5 rounded-[6px] border-2 border-outline-variant hover:border-primary shrink-0 transition-colors flex items-center justify-center cursor-pointer"
                        />
                        <div className="truncate">
                          <span className="font-display text-sm font-bold text-[#3B6667] block truncate">
                            {task.text}
                          </span>
                          {task.url && (
                            <a
                              href={task.url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-sans text-[11px] text-primary hover:underline font-semibold block truncate mt-0.5"
                            >
                              {task.url}
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {task.url && (
                          <a
                            href={task.url}
                            target="_blank"
                            rel="noreferrer"
                            className="bg-[#E5F2F2] hover:bg-[#CCDEDE] text-[#2F5253] p-2 rounded-lg transition-colors font-display text-xs font-bold"
                            title="Öppna länk"
                          >
                            <LucideIcon name="link" className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          onClick={() => onDeleteTask(list.id, task.id)}
                          className="p-1.5 hover:bg-surface-container text-error rounded-full transition-colors opacity-40 group-hover:opacity-100"
                        >
                          <LucideIcon name="close" className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}

          {/* ACTIVE TO DO Category SECTION */}
          {toDo.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3.5 px-1">
                <h3 className="font-display text-base font-bold text-text-main">Att göra</h3>
                <span className="bg-surface-container-high text-on-surface px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider">
                  {toDo.length} kvar
                </span>
              </div>
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {toDo.map((task) => (
                    <motion.div
                      key={task.id}
                      className="bg-surface-container-lowest p-3.5 rounded-xl shadow-[0px_4px_20px_rgba(0,59,5,0.02)] border border-surface-container/20 flex items-center justify-between group"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      layoutId={`task-${task.id}`}
                    >
                      <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        <button
                          onClick={() => onToggleTask(list.id, task.id)}
                          className="w-5 h-5 rounded-[6px] border-2 border-outline-variant hover:border-primary shrink-0 transition-colors flex items-center justify-center cursor-pointer"
                        />
                        <div className="truncate text-left">
                          <span className="font-sans text-sm text-on-surface font-semibold block truncate">
                            {task.text}
                          </span>
                          {task.notes && (
                            <span className="text-[11px] text-outline font-medium block truncate mt-0.5">
                              {task.notes}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => onDeleteTask(list.id, task.id)}
                          className="p-1 hover:bg-surface-container text-error rounded-full transition-colors opacity-0 group-hover:opacity-100"
                          title="Radera"
                        >
                          <LucideIcon name="close" className="w-4 h-4" />
                        </button>
                        <LucideIcon name="grip-vertical" className="w-4 h-4 text-outline opacity-40 drag-handle" />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}

          {/* MEASURABLE PROGRESS SECTION */}
          {inProgress.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3.5 px-1">
                <h3 className="font-display text-base font-bold text-text-main font-semibold">Framsteg & Pågående 📊</h3>
                <span className="bg-secondary-container text-on-secondary-container px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider">
                  {inProgress.length} st
                </span>
              </div>
              <div className="space-y-3.5">
                <AnimatePresence initial={false}>
                  {inProgress.map((task) => {
                    // Normalize progress state
                    const progressVal = task.progress !== undefined ? task.progress : 25;
                    return (
                      <motion.div
                        key={task.id}
                        className="p-4 rounded-xl shadow-[0px_4px_12px_rgba(0,59,5,0.01)] border bg-white border-secondary-container relative overflow-hidden text-left"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        layoutId={`task-${task.id}`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3.5 flex-1 min-w-0">
                            <button
                              onClick={() => onToggleTask(list.id, task.id)}
                              className="w-5 h-5 rounded-[6px] border-2 border-secondary shrink-0 transition-colors flex items-center justify-center cursor-pointer"
                            />
                            <div className="truncate">
                              <span className="font-display text-sm font-bold text-on-surface block truncate">
                                {task.text}
                              </span>
                              {task.notes && (
                                <p className="text-[11px] text-outline font-medium truncate mt-0.5">
                                  {task.notes}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Dynamic slider controls button +/- */}
                          <div className="flex items-center gap-1 shrink-0 bg-surface-container rounded-lg p-1">
                            <button
                              onClick={() => handleDecrementProgress(task.id, progressVal)}
                              className="w-7 h-7 bg-white hover:bg-surface-container-high text-outline rounded flex items-center justify-center font-bold font-sans transition-colors cursor-pointer"
                              title="Minska framsteg"
                            >
                              -
                            </button>
                            <span className="font-mono text-[11px] font-bold text-text-main w-10 text-center">
                              {progressVal}%
                            </span>
                            <button
                              onClick={() => handleIncrementProgress(task.id, progressVal)}
                              className="w-7 h-7 bg-primary hover:bg-primary-container text-white rounded flex items-center justify-center font-bold font-sans transition-colors cursor-pointer"
                              title="Öka framsteg"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Responsive Progress bar Indicator */}
                        <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden mt-3 bg-surface-container-high/60">
                          <div
                            className="bg-secondary h-full rounded-full transition-all duration-300"
                            style={{ width: `${progressVal}%` }}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </section>
          )}

          {/* COMPLETED Category SECTION */}
          {completed.length > 0 && (
            <section className="opacity-65">
              <div className="flex items-center justify-between mb-3.5 px-1">
                <h3 className="font-display text-base font-bold text-text-main line-through">Klara</h3>
                <span className="bg-surface-container text-on-surface px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider">
                  {completed.length} st
                </span>
              </div>
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {completed.map((task) => {
                    const badge = getTypeBadge(task.type);
                    return (
                      <motion.div
                        key={task.id}
                        className="bg-surface-muted/60 p-3.5 rounded-xl border border-surface-container/20 flex items-center justify-between"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        layoutId={`task-${task.id}`}
                      >
                        <div
                          className="flex items-center gap-3.5 flex-1 min-w-0 cursor-pointer"
                          onClick={() => onToggleTask(list.id, task.id)}
                        >
                          <div className="w-5 h-5 rounded-[6px] border border-primary bg-primary flex items-center justify-center shrink-0">
                            <LucideIcon name="close" className="w-3.5 h-3.5 text-white" />
                          </div>
                          <div className="truncate text-left">
                            <span className="font-sans text-sm text-on-surface/70 font-medium line-through truncate">
                              {task.text}
                            </span>
                            {task.type && task.type !== "task" && (
                              <span className={`inline-block text-[8px] font-bold px-1.5 py-0.5 rounded border ml-2 ${badge.color}`}>
                                {badge.text}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => onDeleteTask(list.id, task.id)}
                          className="p-1 hover:bg-surface-container text-error rounded-full transition-colors opacity-50 hover:opacity-100"
                          title="Radera"
                        >
                          <LucideIcon name="close" className="w-4 h-4" />
                        </button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </section>
          )}
        </div>
      )}

      {/* QUICK ADD STICKY FOOTER WITH FLEXIBLE MULTI-TYPE SELECTOR */}
      <footer className="fixed bottom-0 left-0 w-full bg-surface/90 backdrop-blur-xl px-5 pb-8 pt-4 z-40 border-t border-surface-container-high flex flex-col items-center">
        <div className="w-full max-w-[768px] space-y-3">
          
          {/* Item Type Pill Options row - only task, note, and link - dynamically sized to screen with symmetric grid layout */}
          <div className="grid grid-cols-3 gap-2 w-full py-0.5 px-0.5">
            <button
              id="btn-add-task-type-task"
              onClick={() => {
                setSelectedType("task");
                setShowOptions(false);
              }}
              className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none w-full ${
                selectedType === "task"
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "bg-white text-outline border-outline-variant hover:text-text-main hover:bg-surface-container/20"
              }`}
            >
              <LucideIcon name="check" className="w-3.5 h-3.5" />
              <span>Uppgift</span>
            </button>

            <button
              id="btn-add-task-type-note"
              onClick={() => {
                setSelectedType("note");
                setShowOptions(true);
              }}
              className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none w-full ${
                selectedType === "note"
                  ? "bg-[#D08F35] text-white border-[#D08F35] shadow-sm"
                  : "bg-white text-outline border-outline-variant hover:text-text-main hover:bg-surface-container/20"
              }`}
            >
              <LucideIcon name="book" className="w-3.5 h-3.5" />
              <span>Notering</span>
            </button>

            <button
              id="btn-add-task-type-link"
              onClick={() => {
                setSelectedType("link");
                setShowOptions(true);
              }}
              className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none w-full ${
                selectedType === "link"
                  ? "bg-[#4A7879] text-white border-[#4A7879] shadow-sm"
                  : "bg-white text-outline border-outline-variant hover:text-text-main hover:bg-surface-container/20"
              }`}
            >
              <LucideIcon name="link" className="w-3.5 h-3.5" />
              <span>Länk</span>
            </button>
          </div>

          {/* Morphing Dual-Input Card for Notes and Links, or sleek Pill for Tasks */}
          <AnimatePresence mode="wait">
            {selectedType === "task" ? (
              /* SLEEK HORIZONTAL BAR FOR STANDARD TASKS */
              <motion.form
                key="task-form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
                onSubmit={handleSubmit}
                className="relative flex items-center gap-3 bg-surface-muted border border-outline-variant/30 rounded-full pl-5 pr-1 py-1 shadow-md focus-within:ring-2 focus-within:ring-primary focus-within:bg-white transition-all w-full"
              >
                <LucideIcon name="add" className="w-5 h-5 text-primary shrink-0" />
                <input
                  type="text"
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  className="flex-grow bg-transparent border-none focus:ring-0 font-sans text-sm text-on-surface placeholder:text-outline/65 h-10 outline-none pr-2"
                  placeholder="Lägg till en syssla eller sak..."
                />
                <button
                  type="submit"
                  disabled={!newTaskText.trim()}
                  className="bg-primary text-white rounded-full px-5 py-2.5 font-sans font-bold text-xs hover:bg-primary-container active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  Spara
                </button>
              </motion.form>
            ) : (
              /* MORPHED CONGRUENT BOTH FIELDS CARD FOR NOTES & LINKS */
              <motion.form
                key="morphed-card-form"
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ type: "spring", damping: 20, stiffness: 220 }}
                onSubmit={handleSubmit}
                className="w-full bg-white border border-outline-variant/30 rounded-2xl shadow-lg p-4 flex flex-col gap-3.5 text-left focus-within:ring-2 focus-within:ring-[#4A7879] transition-all relative"
              >
                {/* Visual morph icon accent */}
                <div className="absolute top-4 right-4 flex items-center gap-1.5 opacity-50 px-2.5 py-1 bg-surface-container rounded-full border border-surface-container-high">
                  <LucideIcon
                    name={selectedType === "note" ? "book" : "link"}
                    className="w-3.5 h-3.5 text-outline"
                  />
                  <span className="font-sans text-[9px] font-bold text-outline uppercase tracking-wider select-none">
                    {selectedType === "note" ? "Notis-Läge" : "Länk-Läge"}
                  </span>
                </div>

                {/* Input 1: Title */}
                <div className="flex flex-col gap-1 w-full pt-1">
                  <label className="font-sans text-[10px] font-bold text-outline uppercase tracking-wider block select-none">
                    Titel
                  </label>
                  <input
                    type="text"
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    className="w-full bg-transparent border-b border-surface-container-high focus:border-primary/40 focus:ring-0 pb-1.5 font-sans text-sm font-bold text-text-main placeholder:text-outline/40 outline-none"
                    placeholder={
                      selectedType === "note"
                        ? "t.ex. Glöm inte kvitto på färg"
                        : "t.ex. Byggmax Färgkarta Grön"
                    }
                    autoFocus
                  />
                </div>

                {/* Input 2: Dynamic Content linked or text notes */}
                <div className="flex flex-col gap-1 w-full">
                  <label className="font-sans text-[10px] font-bold text-outline uppercase tracking-wider block select-none">
                    {selectedType === "note" ? "Innehåll / Beskrivning" : "Webbadress (URL-länk)"}
                  </label>
                  {selectedType === "note" ? (
                    <textarea
                      value={extraNotes}
                      onChange={(e) => setExtraNotes(e.target.value)}
                      placeholder="Skriv dina tankar, mätvärden eller inköpsreferenser här..."
                      rows={3}
                      className="w-full bg-surface-container/30 px-3 py-2 border border-surface-container-high rounded-xl text-xs text-on-surface placeholder:text-outline/40 focus:ring-1 focus:ring-[#D08F35]/35 focus:bg-white outline-none resize-none font-sans"
                    />
                  ) : (
                    <div className="relative flex items-center bg-surface-container/30 border border-surface-container-high rounded-xl pr-3 focus-within:bg-white focus-within:ring-1 focus-within:ring-primary/30 transition-all">
                      <input
                        type="text"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        placeholder="t.ex. www.byggmax.se/farg"
                        className="w-full bg-transparent border-none px-3 py-2.5 text-xs text-on-surface placeholder:text-outline/40 focus:ring-0 outline-none font-sans"
                      />
                      <LucideIcon name="link" className="w-3.5 h-3.5 text-outline opacity-40 shrink-0" />
                    </div>
                  )}
                </div>

                {/* Bottom row actions bar inside unified card */}
                <div className="flex justify-between items-center border-t border-surface-container-high/60 pt-3.5 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedType("task");
                      setNewTaskText("");
                      setExtraNotes("");
                      setLinkUrl("");
                    }}
                    className="px-4 py-2 hover:bg-surface-container text-outline hover:text-text-main rounded-xl font-sans font-bold text-xs transition-colors cursor-pointer select-none"
                  >
                    Avbryt
                  </button>

                  <button
                    type="submit"
                    disabled={
                      !newTaskText.trim() ||
                      (selectedType === "link" && !linkUrl.trim())
                    }
                    className="bg-primary hover:bg-primary-container text-white rounded-xl px-5 py-2.5 font-sans font-bold text-xs disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-all active:scale-95"
                  >
                    Spara {selectedType === "note" ? "notering" : "länk"}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </footer>
    </div>
  );
}

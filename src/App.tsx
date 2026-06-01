import { useState, startTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { List, Stats, MealType, TaskItem } from "./types";
import { INITIAL_LISTS } from "./data";
import DashboardView from "./components/DashboardView";
import ListDetailRenovation from "./components/ListDetailRenovation";
import ListDetailGrocery from "./components/ListDetailGrocery";
import CreateListView from "./components/CreateListView";
import SettingsModal from "./components/SettingsModal";
import LucideIcon from "./components/LucideIcon";

export default function App() {
  // Initialize from LocalStorage or default seeded lists
  const [lists, setLists] = useState<List[]>(() => {
    try {
      const saved = localStorage.getItem("hem-listan-lists");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Could not load lists from localStorage", e);
    }
    return INITIAL_LISTS;
  });

  const [currentView, setCurrentView] = useState<"dashboard" | "create" | "detail">("dashboard");
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pulseCount, setPulseCount] = useState(0);

  const [userName, setUserName] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("hem-listan-user-name");
      if (saved) return saved;
    } catch (e) {
      console.error("Could not load username", e);
    }
    return "Hem-Listan";
  });

  const handleUpdateUserName = (newName: string) => {
    setUserName(newName);
    try {
      localStorage.setItem("hem-listan-user-name", newName);
    } catch (e) {
      console.warn("Could not save username", e);
    }
  };

  // Helper helper to state mutation with auto saving to localStorage
  const saveLists = (updatedLists: List[]) => {
    setLists(updatedLists);
    setPulseCount((prev) => prev + 1);
    try {
      localStorage.setItem("hem-listan-lists", JSON.stringify(updatedLists));
    } catch (e) {
      console.warn("localStorage quota or write error occured:", e);
    }
  };

  // 1. Stats builder
  const getStats = (): Stats => {
    const listCount = lists.length;
    let itemsLeft = 0;
    let completed = 0;

    lists.forEach((list) => {
      list.tasks.forEach((t) => {
        if (t.checked) {
          completed++;
        } else {
          itemsLeft++;
        }
      });
    });

    return {
      listsCount: listCount,
      itemsLeftCount: itemsLeft,
      completedCount: completed
    };
  };

  // 2. Event Handlers - Task & List updates
  const handleToggleTask = (listId: string, taskId: string) => {
    const updated = lists.map((list) => {
      if (list.id === listId) {
        return {
          ...list,
          tasks: list.tasks.map((task) =>
            task.id === taskId ? { ...task, checked: !task.checked } : task
          )
        };
      }
      return list;
    });
    saveLists(updated);
  };

  const handleAddTask = (
    listId: string,
    text: string,
    categoryName?: string,
    taskType?: "task" | "note" | "progress" | "link",
    url?: string,
    notes?: string,
    progress?: number
  ) => {
    const newTask = {
      id: `task-${Date.now()}-${Math.floor(Math.random() * 1050)}`,
      text,
      checked: false,
      notes: notes || categoryName,
      type: taskType || "task",
      url,
      progress
    };

    const updated = lists.map((list) => {
      if (list.id === listId) {
        return {
          ...list,
          tasks: [newTask, ...list.tasks]
        };
      }
      return list;
    });
    saveLists(updated);
  };

  const handleUpdateTask = (listId: string, taskId: string, updates: Partial<TaskItem>) => {
    const updated = lists.map((list) => {
      if (list.id === listId) {
        return {
          ...list,
          tasks: list.tasks.map((task) =>
            task.id === taskId ? { ...task, ...updates } : task
          )
        };
      }
      return list;
    });
    saveLists(updated);
  };

  const handleResetList = (listId: string) => {
    const updated = lists.map((list) => {
      if (list.id === listId) {
        return {
          ...list,
          tasks: list.tasks.map((task) => ({
            ...task,
            checked: false,
            // reset progress to 0 if it exists
            progress: task.progress !== undefined ? 0 : undefined
          }))
        };
      }
      return list;
    });
    saveLists(updated);
  };

  const handleDeleteTask = (listId: string, taskId: string) => {
    const updated = lists.map((list) => {
      if (list.id === listId) {
        return {
          ...list,
          tasks: list.tasks.filter((task) => task.id !== taskId)
        };
      }
      return list;
    });
    saveLists(updated);
  };

  // 3. Event Handlers - Meal updates
  const handleAddMeal = (listId: string, day: string, type: MealType, name: string) => {
    const updated = lists.map((list) => {
      if (list.id === listId) {
        const currentMeals = list.meals ? [...list.meals] : [];
        const existingIdx = currentMeals.findIndex((m) => m.day === day && m.type === type);

        const newMeal = {
          id: `meal-${Date.now()}`,
          day,
          type,
          name
        };

        if (existingIdx !== -1) {
          currentMeals[existingIdx] = newMeal;
        } else {
          currentMeals.push(newMeal);
        }

        return {
          ...list,
          meals: currentMeals
        };
      }
      return list;
    });
    saveLists(updated);
  };

  const handleDeleteMeal = (listId: string, mealId: string) => {
    const updated = lists.map((list) => {
      if (list.id === listId) {
        return {
          ...list,
          meals: list.meals ? list.meals.filter((m) => m.id !== mealId) : []
        };
      }
      return list;
    });
    saveLists(updated);
  };

  // Bulk add Details from imported recipe
  const handleBulkAddGroceryDetails = (
    listId: string,
    mealName: string,
    ingredients: { text: string; quantity: string; category: string }[]
  ) => {
    const updated = lists.map((list) => {
      if (list.id === listId) {
        // 1. Add meal to Wednesday (or first open spot)
        const currentMeals = list.meals ? [...list.meals] : [];
        const targetedDays = ["Tisdag", "Onsdag", "Torsdag", "Fredag", "Måndag", "Lördag", "Söndag"];
        let slottedDay = "Onsdag";

        for (const day of targetedDays) {
          const hasDinnerSelection = currentMeals.some((m) => m.day === day && m.type === "middag");
          if (!hasDinnerSelection) {
            slottedDay = day;
            break;
          }
        }

        currentMeals.push({
          id: `meal-${Date.now()}-imported`,
          day: slottedDay,
          type: "middag",
          name: mealName
        });

        // 2. Map parsed ingredients to grocery tasks
        const newGroceryItems = ingredients.map((ing, idx) => ({
          id: `task-imported-${Date.now()}-${idx}`,
          text: `${ing.text} (${ing.quantity})`,
          checked: false,
          notes: ing.category // category mapping
        }));

        return {
          ...list,
          meals: currentMeals,
          tasks: [...newGroceryItems, ...list.tasks]
        };
      }
      return list;
    });
    saveLists(updated);
  };

  // 4. Create new list from overlay form input
  const handleAddNewList = (
    name: string,
    icon: string,
    themeColor: string,
    category: "renovation" | "grocery" | "general"
  ) => {
    const newList: List = {
      id: `list-${Date.now()}`,
      name,
      icon,
      themeColor,
      category,
      tasks: [],
      // Prep seeded meals if it is a grocery category
      meals: category === "grocery" ? [] : undefined
    };

    saveLists([newList, ...lists]);
    setPulseCount((prev) => prev + 1);
    startTransition(() => {
      setCurrentView("dashboard");
    });
  };

  const handleAddListFromTemplate = (template: any) => {
    const instantiated: List = {
      id: `list-${Date.now()}-${Math.floor(Math.random() * 100)}`,
      name: template.name,
      icon: template.icon,
      themeColor: template.themeColor,
      category: template.category,
      tasks: template.tasks.map((t: any, idx: number) => ({
        ...t,
        id: `task-${Date.now()}-${idx}`
      }))
    };

    saveLists([instantiated, ...lists]);
  };

  const handleResetLists = () => {
    localStorage.removeItem("hem-listan-lists");
    saveLists(INITIAL_LISTS);
  };

  // Nav actions
  const handleSelectList = (id: string) => {
    setSelectedListId(id);
    setPulseCount((prev) => prev + 1);
    startTransition(() => {
      setCurrentView("detail");
    });
  };

  const activeList = lists.find((l) => l.id === selectedListId);

  // Dynamic Background Blob Color Logic based on current state
  const getAmbientColors = () => {
    if (currentView === "create") {
      return {
        blob1: "bg-[#FFE4E1]/40", // Soft pink
        blob2: "bg-[#E0F2F1]/50", // Soft teal
        scale: 1.15
      };
    }
    if (currentView === "detail" && activeList) {
      if (activeList.category === "grocery") {
        return {
          blob1: "bg-[#A5D6A7]/30", // Lush green
          blob2: "bg-[#80DEEA]/35", // Ocean cyan
          scale: 1.25
        };
      } else if (activeList.category === "renovation") {
        return {
          blob1: "bg-[#FFCC80]/25", // Terracotta/Peach warm clay
          blob2: "bg-[#FFE082]/25", // Dusty sand gold
          scale: 1.1
        };
      }
    }
    // Default dashboard tranquil sage and sunrise gold
    return {
      blob1: "bg-[#C8E6C9]/25", // Quiet sage morning green
      blob2: "bg-[#FFE0B2]/30", // Quiet sunrise apricot glow
      scale: 1.0
    };
  };

  const ambient = getAmbientColors();

  return (
    <div className="min-h-screen bg-transparent font-sans antialiased text-on-surface flex flex-col items-center relative">
      {/* Dynamic Ambient Background Layers */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute inset-0 bg-[#fcf9f8] transition-colors duration-1000" />
        <AnimatePresence mode="popLayout">
          {/* Blob 1 (Top Left) */}
          <motion.div
            key={`blob1-${currentView}-${activeList?.category}-${pulseCount}`}
            className={`absolute top-[-10%] left-[-10%] w-[80vw] md:w-[600px] h-[80vw] md:h-[600px] rounded-full filter blur-[70px] md:blur-[110px] mix-blend-multiply ${ambient.blob1}`}
            initial={{ scale: ambient.scale * 0.8, opacity: 0 }}
            animate={{
              scale: [ambient.scale * 0.9, ambient.scale * 1.08, ambient.scale],
              opacity: [0.35, 0.65, 0.5],
              x: ["0px", "20px", "-15px", "0px"],
              y: ["0px", "-30px", "15px", "0px"]
            }}
            transition={{
              scale: { duration: 0.7, ease: "easeOut" },
              opacity: { duration: 0.7 },
              x: { repeat: Infinity, duration: 25, ease: "easeInOut" },
              y: { repeat: Infinity, duration: 20, ease: "easeInOut" }
            }}
          />

          {/* Blob 2 (Bottom Right) */}
          <motion.div
            key={`blob2-${currentView}-${activeList?.category}-${pulseCount}`}
            className={`absolute bottom-[-10%] right-[-10%] w-[85vw] md:w-[650px] h-[85vw] md:h-[650px] rounded-full filter blur-[80px] md:blur-[120px] mix-blend-multiply ${ambient.blob2}`}
            initial={{ scale: ambient.scale * 0.8, opacity: 0 }}
            animate={{
              scale: [ambient.scale * 0.9, ambient.scale * 1.06, ambient.scale],
              opacity: [0.3, 0.55, 0.45],
              x: ["0px", "-25px", "10px", "0px"],
              y: ["0px", "20px", "-15px", "0px"]
            }}
            transition={{
              scale: { duration: 0.8, ease: "easeOut" },
              opacity: { duration: 0.8 },
              x: { repeat: Infinity, duration: 28, ease: "easeInOut" },
              y: { repeat: Infinity, duration: 24, ease: "easeInOut" }
            }}
          />
        </AnimatePresence>

        {/* Dynamic Vignette / Subtle ambient texture overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/[0.01]" />
      </div>

      {/* Dynamic Content Pages with Transition effects */}
      <main className="w-full flex-1 z-10">
        <AnimatePresence mode="wait">
          {currentView === "dashboard" && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <DashboardView
                lists={lists}
                stats={getStats()}
                userName={userName}
                onSelectList={handleSelectList}
                onTriggerCreate={() => {
                  startTransition(() => {
                    setCurrentView("create");
                  });
                }}
                onAddListFromTemplate={handleAddListFromTemplate}
                onOpenSettings={() => setShowSettings(true)}
              />
            </motion.div>
          )}

          {currentView === "create" && (
            <motion.div
              key="create"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ duration: 0.25 }}
            >
              <CreateListView
                onCancel={() => {
                  startTransition(() => {
                    setCurrentView("dashboard");
                  });
                }}
                onCreateList={handleAddNewList}
              />
            </motion.div>
          )}

          {currentView === "detail" && activeList && (
            <motion.div
              key={`detail-${activeList.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {activeList.category === "grocery" ? (
                <ListDetailGrocery
                  list={activeList}
                  onBack={() => {
                    startTransition(() => {
                      setCurrentView("dashboard");
                    });
                  }}
                  onToggleTask={handleToggleTask}
                  onAddTask={handleAddTask}
                  onDeleteTask={handleDeleteTask}
                  onUpdateTask={handleUpdateTask}
                  onResetList={handleResetList}
                  onAddMeal={handleAddMeal}
                  onDeleteMeal={handleDeleteMeal}
                  onBulkAddGroceryDetails={handleBulkAddGroceryDetails}
                />
              ) : (
                <ListDetailRenovation
                  list={activeList}
                  onBack={() => {
                    startTransition(() => {
                      setCurrentView("dashboard");
                    });
                  }}
                  onToggleTask={handleToggleTask}
                  onAddTask={handleAddTask}
                  onDeleteTask={handleDeleteTask}
                  onUpdateTask={handleUpdateTask}
                  onResetList={handleResetList}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Global Setting Modal overlay drawer */}
      <AnimatePresence>
        {showSettings && (
          <SettingsModal
            userName={userName}
            onUpdateUserName={handleUpdateUserName}
            onClose={() => setShowSettings(false)}
            onResetLists={handleResetLists}
          />
        )}
      </AnimatePresence>

      {/* Dynamic Native-Experience Search Modal overlay */}
      <AnimatePresence>
        {showSearch && (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/60 backdrop-blur-sm pt-[10vh]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg bg-white rounded-2xl p-5 shadow-2xl relative border border-surface-container overflow-hidden text-left"
            >
              <button
                onClick={() => setShowSearch(false)}
                className="absolute top-4 right-4 p-1.5 text-outline hover:bg-surface-container-high rounded-full transition-colors cursor-pointer z-10 outline-none"
                title="Stäng sök"
              >
                <LucideIcon name="close" className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <LucideIcon name="search" className="w-5 h-5 text-primary" />
                <h3 className="font-display text-sm font-bold text-text-main leading-none">
                  Sök i dina bento-listor
                </h3>
              </div>

              <div className="relative mb-4">
                <input
                  type="text"
                  autoFocus
                  placeholder="Sök efter sysslor, matvaror, länkar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-surface-container-high rounded-xl pl-10 pr-10 py-3 text-xs focus:ring-2 focus:ring-primary focus:border-primary outline-none font-sans font-medium text-text-main placeholder:text-outline/40"
                />
                <div className="w-4 h-4 text-outline/50 absolute left-3.5 top-3.5 flex items-center justify-center">
                  <LucideIcon name="search" className="w-4 h-4" />
                </div>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3.5 top-3.5 text-outline/50 hover:text-text-main p-0.5 rounded-full hover:bg-surface-container transition-colors outline-none cursor-pointer"
                  >
                    <LucideIcon name="close" className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Search outputs */}
              <div className="max-h-[50vh] overflow-y-auto no-scrollbar space-y-2 pr-1">
                {searchQuery.trim() === "" ? (
                  <div className="text-center py-6 text-outline font-sans text-xs">
                    <p className="font-medium">Skriv för att börja söka...</p>
                    <p className="text-[10px] mt-1 text-outline/65">Sökningen uppdateras live för alla dina skapade bento-listor.</p>
                  </div>
                ) : (() => {
                  const query = searchQuery.toLowerCase();
                  const results: { list: List; task: TaskItem }[] = [];
                  lists.forEach((list) => {
                    list.tasks.forEach((task) => {
                      if (
                        task.text.toLowerCase().includes(query) ||
                        (task.notes && task.notes.toLowerCase().includes(query))
                      ) {
                        results.push({ list, task });
                      }
                    });
                  });

                  if (results.length === 0) {
                    return (
                      <div className="text-center py-6 text-outline font-sans text-xs">
                        <p className="font-bold text-accent-rust">Inga resultat matchar &ldquo;{searchQuery}&rdquo;</p>
                        <p className="text-[10px] mt-1 text-outline/65">Försök kontrollera stavningen eller lägg till en ny uppgift.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      <p className="font-sans text-[10px] font-bold text-outline uppercase tracking-wider mb-2 select-none">
                        Hittade matchningar ({results.length})
                      </p>
                      {results.map(({ list, task }) => (
                        <div
                          key={task.id}
                          className="p-3 rounded-xl border border-surface-container bg-white flex items-center justify-between gap-3 hover:border-primary-container hover:bg-surface-container-lowest transition-all group"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* Checkbox wrapper */}
                            <button
                              onClick={() => handleToggleTask(list.id, task.id)}
                              className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all cursor-pointer outline-none ${
                                task.checked
                                  ? "bg-secondary border-secondary text-white"
                                  : "hover:border-primary border-outline-variant bg-white"
                              }`}
                            >
                              {task.checked && <LucideIcon name="check" className="w-3.5 h-3.5 stroke-[3]" />}
                            </button>

                            <div className="min-w-0 pr-1 flex-1">
                              <p
                                onClick={() => {
                                  handleSelectList(list.id);
                                  setShowSearch(false);
                                }}
                                className={`font-sans text-xs font-semibold leading-snug cursor-pointer hover:text-primary transition-colors truncate ${
                                  task.checked ? "line-through text-outline/60" : "text-text-main"
                                }`}
                              >
                                {task.text}
                              </p>
                              <span 
                                onClick={() => {
                                  handleSelectList(list.id);
                                  setShowSearch(false);
                                }}
                                className="inline-flex items-center gap-1 font-sans text-[9px] font-bold text-outline hover:text-text-main transition-colors mt-0.5 cursor-pointer"
                              >
                                📂 {list.name}
                              </span>
                            </div>
                          </div>
                          
                          {/* Go to list chevron */}
                          <button
                            onClick={() => {
                              handleSelectList(list.id);
                              setShowSearch(false);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-outline hover:text-text-main hover:bg-surface-container rounded-full transition-all outline-none"
                            title="Öppna bento-lista"
                          >
                            <LucideIcon name="chevron_right" className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Visual background brand watermark or label footer if in home view */}
      {currentView === "dashboard" && (
        <div className="fixed bottom-0 left-0 w-full z-10 flex justify-around items-center px-4 pb-4 pt-1 bg-surface-container-low dark:bg-surface-container-lowest border-t border-surface-container-high shadow-lg">
          <button className="flex flex-col items-center justify-center text-primary bg-secondary-container rounded-full px-5 py-2 active:scale-95 transition-all text-xs font-bold gap-1 cursor-pointer">
            <LucideIcon name="calendar" className="w-5 h-5" />
            <span>Hem</span>
          </button>
          <button
            onClick={() => {
              setSearchQuery("");
              setShowSearch(true);
            }}
            className="flex flex-col items-center justify-center text-on-surface-variant font-medium text-xs hover:bg-surface-variant/30 px-5 py-2 rounded-full active:scale-95 transition-all gap-1 cursor-pointer"
          >
            <LucideIcon name="search" className="w-5 h-5 text-outline" />
            <span>Sök</span>
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="flex flex-col items-center justify-center text-on-surface-variant font-medium text-xs hover:bg-surface-variant/30 px-5 py-2 rounded-full active:scale-95 transition-all gap-1 cursor-pointer"
          >
            <LucideIcon name="settings" className="w-5 h-5 text-outline" />
            <span>Inställningar</span>
          </button>
        </div>
      )}
    </div>
  );
}

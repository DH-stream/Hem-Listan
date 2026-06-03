import { useState, useEffect, startTransition, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { List, Stats, MealType, TaskItem } from "./types";
import { INITIAL_LISTS } from "./data";
import DashboardView from "./components/DashboardView";
import ListDetailRenovation from "./components/ListDetailRenovation";
import ListDetailGrocery from "./components/ListDetailGrocery";
import CreateListView from "./components/CreateListView";
import SettingsModal from "./components/SettingsModal";
import LucideIcon from "./components/LucideIcon";
import {
  getSupabaseClient,
  isSupabaseConfigured,
  fetchLists,
  createList,
  addTask,
  updateTask,
  deleteTask,
  upsertMeal,
  deleteMeal,
} from "./lib/supabase";

// ── localStorage helpers ─────────────────────────────────────────────
const loadLocalLists = (): List[] => {
  try {
    const saved = localStorage.getItem("hem-listan-lists");
    if (saved) return JSON.parse(saved);
  } catch {}
  return INITIAL_LISTS;
};

const saveLocalLists = (lists: List[]) => {
  try {
    localStorage.setItem("hem-listan-lists", JSON.stringify(lists));
  } catch (e) {
    console.warn("localStorage write error:", e);
  }
};

export default function App() {
  const [lists, setLists] = useState<List[]>(loadLocalLists);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentView, setCurrentView] = useState<"dashboard" | "create" | "detail">("dashboard");
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pulseCount, setPulseCount] = useState(0);
  const realtimeRef = useRef<any>(null);

  const [userName, setUserName] = useState<string>(
    () => localStorage.getItem("hem-listan-user-name") ?? "Hem-Listan"
  );
  const [userImage, setUserImage] = useState<string>(
    () => localStorage.getItem("user_profile_image") ?? ""
  );

  // ── Auth + Supabase init ─────────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const client = getSupabaseClient();
    if (!client) return;

    const initAuth = async () => {
      const { data: { user } } = await client.auth.getUser();
      if (user) {
        setIsLoggedIn(true);
        await loadFromSupabase();
        subscribeRealtime();
      }
    };

    initAuth();

    const { data: { subscription } } = client.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        setIsLoggedIn(true);
        const localLists = loadLocalLists();
        const hasCustomLists = JSON.stringify(localLists) !== JSON.stringify(INITIAL_LISTS);
        if (hasCustomLists) await migrateLocalToSupabase(localLists);
        await loadFromSupabase();
        subscribeRealtime();
      } else if (event === "SIGNED_OUT") {
        setIsLoggedIn(false);
        unsubscribeRealtime();
        setLists(loadLocalLists());
      }
    });

    return () => {
      subscription.unsubscribe();
      unsubscribeRealtime();
    };
  }, []);

  const loadFromSupabase = async () => {
    const fetched = await fetchLists();
    if (fetched.length > 0) {
      setLists(fetched);
      saveLocalLists(fetched);
    }
  };

  const migrateLocalToSupabase = async (localLists: List[]) => {
    for (const list of localLists) {
      const newId = await createList(list);
      if (!newId) continue;
      for (const task of list.tasks) {
        await addTask(newId, task);
      }
      for (const meal of list.meals ?? []) {
        await upsertMeal(newId, meal);
      }
    }
  };

  const subscribeRealtime = () => {
    const client = getSupabaseClient();
    if (!client) return;
    unsubscribeRealtime();
    realtimeRef.current = client
      .channel('hl_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hl_lists' }, () => loadFromSupabase())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hl_tasks' }, () => loadFromSupabase())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hl_meals' }, () => loadFromSupabase())
      .subscribe();
  };

  const unsubscribeRealtime = () => {
    const client = getSupabaseClient();
    if (realtimeRef.current) {
      client?.removeChannel(realtimeRef.current);
      realtimeRef.current = null;
    }
  };

  // ── Hjälpfunktion: uppdatera state + localStorage ────────────────
  const applyAndSync = (updatedLists: List[]) => {
    setLists(updatedLists);
    setPulseCount(p => p + 1);
    saveLocalLists(updatedLists);
  };

  // ── Stats ────────────────────────────────────────────────────────
  const getStats = (): Stats => {
    let itemsLeft = 0, completed = 0;
    lists.forEach(l => l.tasks.forEach(t => t.checked ? completed++ : itemsLeft++));
    return { listsCount: lists.length, itemsLeftCount: itemsLeft, completedCount: completed };
  };

  // ── Handlers ─────────────────────────────────────────────────────
  const handleUpdateUserName = (name: string) => {
    setUserName(name);
    localStorage.setItem("hem-listan-user-name", name);
  };

  const handleUpdateUserImage = (base64: string) => {
    setUserImage(base64);
    if (base64) localStorage.setItem("user_profile_image", base64);
    else localStorage.removeItem("user_profile_image");
  };

  const handleToggleTask = async (listId: string, taskId: string) => {
    const task = lists.find(l => l.id === listId)?.tasks.find(t => t.id === taskId);
    if (!task) return;
    const newChecked = !task.checked;
    const updated = lists.map(l => l.id !== listId ? l : {
      ...l, tasks: l.tasks.map(t => t.id === taskId ? { ...t, checked: newChecked } : t)
    });
    applyAndSync(updated);
    if (isLoggedIn) await updateTask(taskId, { checked: newChecked });
  };

  const handleAddTask = async (
    listId: string, text: string, categoryName?: string,
    taskType?: "task" | "note" | "progress" | "link",
    url?: string, notes?: string, progress?: number
  ) => {
    const tempId = `task-${Date.now()}-${Math.floor(Math.random() * 1050)}`;
    const newTask: TaskItem = {
      id: tempId, text, checked: false,
      notes: notes || categoryName,
      type: taskType || "task",
      url, progress
    };
    const updated = lists.map(l => l.id !== listId ? l : { ...l, tasks: [newTask, ...l.tasks] });
    applyAndSync(updated);

    if (isLoggedIn) {
      const dbId = await addTask(listId, newTask);
      if (dbId) {
        setLists(prev => prev.map(l => l.id !== listId ? l : {
          ...l, tasks: l.tasks.map(t => t.id === tempId ? { ...t, id: dbId } : t)
        }));
      }
    }
  };

  const handleUpdateTask = async (listId: string, taskId: string, updates: Partial<TaskItem>) => {
    const updated = lists.map(l => l.id !== listId ? l : {
      ...l, tasks: l.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t)
    });
    applyAndSync(updated);
    if (isLoggedIn) await updateTask(taskId, updates);
  };

  const handleDeleteTask = async (listId: string, taskId: string) => {
    const updated = lists.map(l => l.id !== listId ? l : {
      ...l, tasks: l.tasks.filter(t => t.id !== taskId)
    });
    applyAndSync(updated);
    if (isLoggedIn) await deleteTask(taskId);
  };

  const handleResetList = async (listId: string) => {
    const list = lists.find(l => l.id === listId);
    const updated = lists.map(l => l.id !== listId ? l : {
      ...l, tasks: l.tasks.map(t => ({ ...t, checked: false, progress: t.progress !== undefined ? 0 : undefined }))
    });
    applyAndSync(updated);
    if (isLoggedIn && list) {
      await Promise.all(list.tasks.map(t => updateTask(t.id, { checked: false })));
    }
  };

  const handleAddMeal = async (listId: string, day: string, type: MealType, name: string) => {
    const tempId = `meal-${Date.now()}`;
    const newMeal = { id: tempId, day, type, name };
    const updated = lists.map(l => {
      if (l.id !== listId) return l;
      const meals = [...(l.meals ?? [])];
      const idx = meals.findIndex(m => m.day === day && m.type === type);
      if (idx !== -1) meals[idx] = newMeal; else meals.push(newMeal);
      return { ...l, meals };
    });
    applyAndSync(updated);

    if (isLoggedIn) {
      const dbId = await upsertMeal(listId, newMeal);
      if (dbId) {
        setLists(prev => prev.map(l => l.id !== listId ? l : {
          ...l, meals: (l.meals ?? []).map(m => m.id === tempId ? { ...m, id: dbId } :

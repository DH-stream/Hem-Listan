import { useState, useEffect, startTransition, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { AnimatePresence, motion } from "motion/react";
import { DeletedList, List, ListMember, Stats, MealSlot, MealType, RecipeIngredient, TaskItem, UserProfile } from "./types";
import { INITIAL_LISTS } from "./data";
import DashboardView from "./components/DashboardView";
import ListDetailRenovation from "./components/ListDetailRenovation";
import ListDetailGrocery from "./components/ListDetailGrocery";
import CreateListView from "./components/CreateListView";
import DebugPanel from "./components/DebugPanel";
import PublicShareView from "./components/PublicShareView";
import CollaborativeInviteView from "./components/CollaborativeInviteView";
import SettingsModal from "./components/SettingsModal";
import LucideIcon from "./components/LucideIcon";
import { readCachedUserProfile, writeCachedUserProfile } from "./lib/profile";
import {
  getSupabaseClient,
  isSupabaseConfigured,
  setSupabaseAuthSnapshot,
  getSupabaseAuthSnapshot,
  clearSupabaseAuthSnapshot,
  fetchLists,
  fetchListMembers,
  fetchDeletedLists,
  createList,
  updateListName,
  addTask,
  updateTask,
  deleteTask,
  softDeleteList,
  restoreList,
  upsertMeal,
  moveMeal,
  deleteMeal,
  getInitialProfileDisplayName,
  loadOrCreateUserProfile,
  removeUserAvatar,
  updateUserProfile,
  uploadUserAvatar,
  acceptListInvite,
} from "./lib/supabase";
import { mergePendingMeals, type PendingMealSave } from "./lib/optimisticMeals";
import { buildGroceryMergePlan } from "./lib/grocery/merge";

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

// ── localStorage helpers ─────────────────────────────────────────────
const getListDeletedAt = (list: List): string | undefined => list.deletedAt ?? list.deleted_at;

const isWithinDeletedListRestoreWindow = (deletedAt?: string): deletedAt is string => {
  if (!deletedAt) return false;

  const deletedTime = new Date(deletedAt).getTime();
  if (Number.isNaN(deletedTime)) return false;

  return deletedTime >= Date.now() - 2 * 24 * 60 * 60 * 1000;
};

const stripDeletedFields = (list: List): List => {
  const { deletedAt, deleted_at, ...activeList } = list;
  void deletedAt;
  void deleted_at;
  return activeList;
};

const deletedListToActiveList = (deletedList: DeletedList): List => ({
  id: deletedList.id,
  name: deletedList.name,
  icon: deletedList.icon,
  themeColor: deletedList.themeColor,
  category: deletedList.category,
  tasks: deletedList.tasks ?? [],
  meals: deletedList.meals,
});

const loadLocalLists = (): List[] => {
  try {
    const saved = localStorage.getItem("hem-listan-lists");
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
};

const loadLocalActiveLists = (): List[] =>
  loadLocalLists()
    .filter(list => !getListDeletedAt(list) || isUuid(list.id))
    .map(stripDeletedFields);

const loadLocalDeletedLists = (): DeletedList[] =>
  loadLocalLists()
    .filter(list => !isUuid(list.id))
    .map(list => ({ list, deletedAt: getListDeletedAt(list) }))
    .filter((entry): entry is { list: List; deletedAt: string } => isWithinDeletedListRestoreWindow(entry.deletedAt))
    .map(({ list, deletedAt }) => ({
      ...list,
      deletedAt,
      tasks: list.tasks ?? [],
      meals: list.meals,
      restoreSource: "local" as const,
    }))
    .sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

const saveLocalLists = (lists: List[]) => {
  try {
    localStorage.setItem("hem-listan-lists", JSON.stringify(lists));
  } catch (e) {
    console.warn("localStorage write error:", e);
  }
};

const saveLocalActiveLists = (activeLists: List[]) => {
  const deletedLists = loadLocalLists().filter(list => !isUuid(list.id) && getListDeletedAt(list));
  saveLocalLists([
    ...activeLists.map(stripDeletedFields),
    ...deletedLists,
  ]);
};

const saveLocalDeletedList = (list: List, deletedAt: string) => {
  const storedLists = loadLocalLists().filter(storedList => storedList.id !== list.id);
  saveLocalLists([
    ...storedLists,
    { ...list, deletedAt },
  ]);
};

const migrationKeyForUser = (userId: string) => `hem-listan-supabase-migrated-${userId}`;

const taskFingerprint = (task: TaskItem) => JSON.stringify({
  text: task.text,
  checked: task.checked ?? false,
  notes: task.notes || undefined,
  type: task.type || 'task',
  url: task.url || undefined,
  progress: task.progress ?? undefined,
});

const mealFingerprint = (meal: { day: string; type: string; name: string }) => JSON.stringify({
  day: meal.day,
  type: meal.type,
  name: meal.name,
});

const listMetadataFingerprint = (list: List) => JSON.stringify({
  name: list.name,
  icon: list.icon || 'list',
  themeColor: list.themeColor || '#1a5319',
  category: list.category || 'general',
});

const listFingerprint = (list: List) => JSON.stringify({
  metadata: listMetadataFingerprint(list),
  tasks: list.tasks.map(taskFingerprint),
  meals: (list.meals ?? []).map(mealFingerprint),
});

const PENDING_INVITE_TOKEN_STORAGE_KEY = "hem-listan-pending-invite-token";

const getInviteTokenFromPath = () => {
  const match = window.location.pathname.match(/^\/invite\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};

const getPublicShareTokenFromPath = () => {
  const match = window.location.pathname.match(/^\/share\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};

export default function App() {
  const publicShareToken = getPublicShareTokenFromPath();

  if (publicShareToken) {
    return <PublicShareView token={publicShareToken} />;
  }

  const inviteToken = getInviteTokenFromPath()
    ?? localStorage.getItem(PENDING_INVITE_TOKEN_STORAGE_KEY);

  return <MainApp inviteToken={inviteToken} />;
}

function MainApp({ inviteToken }: { inviteToken: string | null }) {
  const [lists, setLists] = useState<List[]>(loadLocalActiveLists);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentView, setCurrentView] = useState<"dashboard" | "create" | "detail">("dashboard");
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [listMembers, setListMembers] = useState<ListMember[] | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pulseCount, setPulseCount] = useState(0);
  const [deletedLists, setDeletedLists] = useState<DeletedList[]>([]);
  const [deletedListsLoading, setDeletedListsLoading] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [inviteDismissed, setInviteDismissed] = useState(false);
  const realtimeRef = useRef<any>(null);
  const migrationInFlightRef = useRef<Promise<void> | null>(null);
  const pendingTasksByTempListIdRef = useRef<Record<string, TaskItem[]>>({});
  const pendingMealSavesRef = useRef<Map<string, PendingMealSave>>(new Map());

  const [userName, setUserName] = useState<string>(
    () => localStorage.getItem("hem-listan-user-name") ?? "Hem-Listan"
  );
  const [userImage, setUserImage] = useState<string>(
    () => localStorage.getItem("user_profile_image") ?? ""
  );

  useEffect(() => {
    setListMembers(null);
    if (currentView !== "detail" || !selectedListId || !isUuid(selectedListId) || !isLoggedIn) return;

    let cancelled = false;
    void fetchListMembers(selectedListId).then((members) => {
      if (!cancelled) setListMembers(members);
    });

    return () => {
      cancelled = true;
    };
  }, [currentView, isLoggedIn, selectedListId]);

  // ── Auth + Supabase init ─────────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const client = getSupabaseClient();
    if (!client) return;

    const handleAuthenticatedSession = async (user: User) => {
      console.log("[HL_PROFILE] auth profile init start", {
        userId: user.id,
        email: user.email,
      });
      setIsLoggedIn(true);
      setSessionUser(user);
      setUserProfile(null);
      setUserName(getInitialProfileDisplayName(user));
      setUserImage("");
      console.log("[HL_PROFILE] fallback profile applied", {
        userId: user.id,
        displayName: getInitialProfileDisplayName(user),
      });

      const cachedProfile = readCachedUserProfile(user.id);
      console.log("[HL_PROFILE] cache read result", {
        userId: user.id,
        hasCachedProfile: !!cachedProfile,
        cachedDisplayName: cachedProfile?.displayName,
        hasCachedAvatar: !!cachedProfile?.avatarUrl,
      });
      if (cachedProfile) {
        setUserProfile(cachedProfile);
        setUserName(cachedProfile.displayName);
        setUserImage(cachedProfile.avatarUrl ?? "");
      }

      void loadOrCreateUserProfile(user)
        .then((profile) => {
          console.log("[HL_PROFILE] background load resolved", {
            userId: user.id,
            hasProfile: !!profile,
            profileUserId: profile?.userId,
            displayName: profile?.displayName,
            hasAvatar: !!profile?.avatarUrl,
          });
          if (!profile) return;
          writeCachedUserProfile(profile);
          const currentUserId = getSupabaseAuthSnapshot().userId;
          if (currentUserId !== user.id) {
            console.warn("[HL_PROFILE] skip applying stale profile", {
              loadedForUserId: user.id,
              currentUserId,
            });
            return;
          }

          setUserProfile(profile);
          setUserName(profile.displayName);
          setUserImage(profile.avatarUrl ?? "");
        })
        .catch((error) => {
          console.warn("[HL_PROFILE] background load failed", error);
        });

      console.log("[HL_PROFILE] continuing list sync after starting profile load", {
        userId: user.id,
      });
      await migrateLocalToSupabaseIfNeeded(user.id);
      await loadFromSupabase();
      subscribeRealtime();
    };

    const initAuth = async () => {
      console.log("auth_init_start");
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (code) {
        console.log("auth_callback_code_found");
        console.log("auth_callback_exchange_start");

        try {
          const { data, error } = await client.auth.exchangeCodeForSession(code);
          console.log("auth_callback_exchange_result", {
            hasSession: !!data.session,
            userId: data.session?.user?.id,
            error: error?.message,
          });

          if (error) {
            console.error("auth_callback_exchange_error", {
              message: error.message,
              name: error.name,
            });
          }

          if (data.session?.user) {
            setSupabaseAuthSnapshot(data.session);
            await handleAuthenticatedSession(data.session.user);
            return;
          }
        } catch (error) {
          console.error("auth_callback_exchange_error", {
            message: error instanceof Error ? error.message : String(error),
            name: error instanceof Error ? error.name : "UnknownError",
          });
        } finally {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }

      const { data: { session } } = await client.auth.getSession();
      if (session?.user) setSupabaseAuthSnapshot(session);
      else clearSupabaseAuthSnapshot();

      const { data: { user } } = await client.auth.getUser();

      const authenticatedUser = session?.user ?? user;

      if (authenticatedUser) {
        console.log("auth_init_session_found", { userId: authenticatedUser.id });
        await handleAuthenticatedSession(authenticatedUser);
        return;
      }

      console.log("auth_init_no_session", { userId: user?.id });
      setIsLoggedIn(false);
      setSessionUser(null);
      setUserProfile(null);
    };

    initAuth();

    const { data: { subscription } } = client.auth.onAuthStateChange(async (event, session) => {
      console.log("auth_state_event", { event, hasSession: !!session, userId: session?.user?.id });

      if (session?.user) setSupabaseAuthSnapshot(session);
      else clearSupabaseAuthSnapshot();

      if ((event === "INITIAL_SESSION" || event === "SIGNED_IN") && session?.user) {
        console.log("auth_state_signed_in", { event, userId: session.user.id });
        await handleAuthenticatedSession(session.user);
      } else if (event === "TOKEN_REFRESHED" && session?.user) {
        setIsLoggedIn(true);
        setSessionUser(session.user);
      } else if (event === "SIGNED_OUT") {
        console.log("auth_state_signed_out");
        setIsLoggedIn(false);
        setSessionUser(null);
        setUserProfile(null);
        setUserName(localStorage.getItem("hem-listan-user-name") ?? "Hem-Listan");
        setUserImage(localStorage.getItem("user_profile_image") ?? "");
        unsubscribeRealtime();
        setLists(loadLocalActiveLists());
      }
    });

    return () => {
      subscription.unsubscribe();
      unsubscribeRealtime();
    };
  }, []);

  const loadFromSupabase = async () => {
    const fetched = await fetchLists();
    if (!fetched) return false;

    const pendingMealSaves = pendingMealSavesRef.current;
    for (const [clientId, pending] of pendingMealSaves) {
      const savedMealIsPresent = fetched
        .find(list => list.id === pending.listId)
        ?.meals?.some(meal => meal.id === pending.meal.id);
      if (savedMealIsPresent) pendingMealSaves.delete(clientId);
    }

    const merged = mergePendingMeals(fetched, pendingMealSaves.values());
    setLists(merged);
    saveLocalActiveLists(merged);
    return true;
  };


  const loadDeletedLists = async () => {
    setDeletedListsLoading(true);
    try {
      const localDeletedLists = loadLocalDeletedLists();
      let cloudDeletedLists: DeletedList[] = [];
      const authSnapshot = getSupabaseAuthSnapshot();
      const hasCloudSession = isLoggedIn || Boolean(sessionUser) || Boolean(authSnapshot.accessToken);

      if (hasCloudSession) {
        cloudDeletedLists = await fetchDeletedLists();
      }

      const localDeletedIds = new Set(localDeletedLists.map(list => list.id));
      const mergedDeletedLists = [
        ...localDeletedLists,
        ...cloudDeletedLists.filter(list => !localDeletedIds.has(list.id)),
      ].sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

      setDeletedLists(mergedDeletedLists);
      console.log("load_deleted_lists_done", { count: mergedDeletedLists.length });
      return true;
    } catch (error) {
      console.error("load_deleted_lists_error", { error });
      setDeletedLists(loadLocalDeletedLists());
      return false;
    } finally {
      setDeletedListsLoading(false);
    }
  };

  useEffect(() => {
    if (!showSettings) return;
    void loadDeletedLists();
  }, [showSettings]);

  const migrateLocalToSupabase = async (localLists: List[], ownerId: string) => {
    const existingLists = await fetchLists();
    if (!existingLists) return false;

    let migratedSuccessfully = true;
    const existingFingerprints = new Set(existingLists.map(listFingerprint));

    for (const list of localLists) {
      if (existingFingerprints.has(listFingerprint(list))) continue;

      const existingList = existingLists.find(existing =>
        (isUuid(list.id) && existing.id === list.id) ||
        listMetadataFingerprint(existing) === listMetadataFingerprint(list)
      );
      let targetList = existingList;

      if (!targetList) {
        const newId = await createList(list, ownerId);
        if (!newId || !isUuid(newId)) {
          migratedSuccessfully = false;
          console.error("local_migration_create_list_error", { listId: list.id, name: list.name });
          continue;
        }

        targetList = { ...list, id: newId, tasks: [], meals: [] };
        existingLists.push(targetList);
        console.log("local_migration_create_list_success", { listId: newId, name: list.name });
      }

      const existingTasks = new Set(targetList.tasks.map(taskFingerprint));
      for (const task of list.tasks) {
        if (existingTasks.has(taskFingerprint(task))) continue;

        const taskId = await addTask(targetList.id, task);
        if (taskId) {
          existingTasks.add(taskFingerprint(task));
          targetList.tasks.push({ ...task, id: taskId });
        } else {
          migratedSuccessfully = false;
          console.error("local_migration_add_task_error", { listId: targetList.id, taskId: task.id, text: task.text });
        }
      }

      const existingMeals = new Set((targetList.meals ?? []).map(mealFingerprint));
      for (const meal of list.meals ?? []) {
        if (existingMeals.has(mealFingerprint(meal))) continue;

        const mealId = await upsertMeal(targetList.id, meal);
        if (mealId) {
          existingMeals.add(mealFingerprint(meal));
          targetList.meals = [...(targetList.meals ?? []), { ...meal, id: mealId }];
        } else {
          migratedSuccessfully = false;
          console.error("local_migration_add_meal_error", { listId: targetList.id, mealId: meal.id, day: meal.day, type: meal.type });
        }
      }
    }

    return migratedSuccessfully;
  };

  const migrateLocalToSupabaseIfNeeded = async (userId: string) => {
    if (migrationInFlightRef.current) {
      await migrationInFlightRef.current;
      return;
    }

    const runMigration = async () => {
      const localLists = loadLocalActiveLists();
      const hasCustomLists = localLists.length > 0 && JSON.stringify(localLists) !== JSON.stringify(INITIAL_LISTS);
      const migrationKey = migrationKeyForUser(userId);
      if (localStorage.getItem(migrationKey) === "true") return;

      console.log("local_migration_start", { userId });

      if (!hasCustomLists) {
        console.log("local_migration_no_custom_lists", { userId });
        return;
      }

      const migratedSuccessfully = await migrateLocalToSupabase(localLists, userId);
      if (!migratedSuccessfully) return;

      localStorage.setItem(migrationKey, "true");
      console.log("local_migration_done", { userId });
    };

    migrationInFlightRef.current = runMigration();
    try {
      await migrationInFlightRef.current;
    } finally {
      migrationInFlightRef.current = null;
    }
  };

  const canCloudSave = async (operation: string): Promise<boolean> => {
    const authSnapshot = getSupabaseAuthSnapshot();
    const hasSession = isLoggedIn || Boolean(sessionUser) || Boolean(authSnapshot.accessToken);
    if (hasSession && !isLoggedIn) setIsLoggedIn(true);
    if (!hasSession) console.log("cloud_save_skipped_no_session", { operation });
    return hasSession;
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
    saveLocalActiveLists(updatedLists);
  };

  const setListsAndSync = (updater: (currentLists: List[]) => List[]) => {
    setLists(prev => {
      const updated = updater(prev);
      saveLocalActiveLists(updated);
      return updated;
    });
  };

  // ── Stats ────────────────────────────────────────────────────────
  const getStats = (): Stats => {
    let itemsLeft = 0, completed = 0;
    lists.forEach(l => l.tasks.forEach(t => t.checked ? completed++ : itemsLeft++));
    return { listsCount: lists.length, itemsLeftCount: itemsLeft, completedCount: completed };
  };

  // ── Handlers ─────────────────────────────────────────────────────
  const handleUpdateUserName = async (name: string): Promise<boolean> => {
    const activeUserId = sessionUser?.id ?? getSupabaseAuthSnapshot().userId;
    if (activeUserId) {
      const profile = await updateUserProfile(activeUserId, { displayName: name });
      if (!profile) return false;

      setUserProfile(profile);
      setUserName(profile.displayName);
      writeCachedUserProfile(profile);
      return true;
    }

    setUserName(name);
    localStorage.setItem("hem-listan-user-name", name);
    return true;
  };

  const handleUpdateUserImage = async (base64: string): Promise<boolean> => {
    const activeUserId = sessionUser?.id ?? getSupabaseAuthSnapshot().userId;
    if (activeUserId) {
      const profile = base64
        ? await uploadUserAvatar(activeUserId, base64, userProfile?.avatarPath)
        : await removeUserAvatar(activeUserId, userProfile?.avatarPath);
      if (!profile) return false;

      setUserProfile(profile);
      setUserImage(profile.avatarUrl ?? "");
      writeCachedUserProfile(profile);
      return true;
    }

    setUserImage(base64);
    if (base64) localStorage.setItem("user_profile_image", base64);
    else localStorage.removeItem("user_profile_image");
    return true;
  };

  const handleToggleTask = async (listId: string, taskId: string) => {
    const task = lists.find(l => l.id === listId)?.tasks.find(t => t.id === taskId);
    if (!task) return;
    const previousTask = { ...task };
    const newChecked = !task.checked;
    const updated = lists.map(l => l.id !== listId ? l : {
      ...l, tasks: l.tasks.map(t => t.id === taskId ? { ...t, checked: newChecked } : t)
    });
    applyAndSync(updated);

    if (await canCloudSave("toggle_task")) {
      const updatedInCloud = await updateTask(taskId, { checked: newChecked });
      if (updatedInCloud) {
        console.log("cloud_toggle_task_success", { listId, taskId, checked: newChecked });
      } else {
        setListsAndSync(prev => prev.map(l => l.id !== listId ? l : {
          ...l, tasks: l.tasks.map(t => t.id === taskId ? previousTask : t)
        }));
        console.error("cloud_toggle_task_error", { listId, taskId, checked: newChecked });
      }
    }
  };

  const resolveCloudListId = (listId: string): string | null => {
    if (isUuid(listId)) return listId;
    if (lists.some(l => l.id === listId)) return null;
    if (selectedListId && isUuid(selectedListId) && lists.some(l => l.id === selectedListId)) return selectedListId;
    return null;
  };

  const queuePendingTaskForTempList = (listId: string, task: TaskItem) => {
    pendingTasksByTempListIdRef.current[listId] = [
      ...(pendingTasksByTempListIdRef.current[listId] ?? []),
      task
    ];
  };

  const clearPendingTasksForTempList = (listId: string) => {
    delete pendingTasksByTempListIdRef.current[listId];
  };

  const flushPendingTasksForTempList = async (tempListId: string, cloudListId: string) => {
    const pendingTasks = pendingTasksByTempListIdRef.current[tempListId] ?? [];
    clearPendingTasksForTempList(tempListId);

    for (const task of pendingTasks) {
      const dbId = await addTask(cloudListId, task);
      if (dbId) {
        setListsAndSync(prev => prev.map(l => {
          if (l.id !== cloudListId) return l;
          const hasOptimisticTask = l.tasks.some(t => t.id === task.id);
          return {
            ...l,
            tasks: hasOptimisticTask
              ? l.tasks.map(t => t.id === task.id ? { ...t, id: dbId } : t)
              : [{ ...task, id: dbId }, ...l.tasks]
          };
        }));
        console.log("cloud_add_task_success", { listId: cloudListId, taskId: dbId });
      } else {
        setListsAndSync(prev => prev.map(l => l.id !== cloudListId ? l : {
          ...l, tasks: l.tasks.filter(t => t.id !== task.id)
        }));
        console.error("cloud_add_task_error", { listId: cloudListId, taskId: task.id });
      }
    }
  };

  const handleAddTask = async (
    listId: string, text: string, categoryName?: string,
    taskType?: "task" | "note" | "progress" | "link",
    url?: string, notes?: string, progress?: number
  ) => {
    const cloudListId = resolveCloudListId(listId);
    const optimisticListId = cloudListId ?? listId;
    const tempId = `task-${Date.now()}-${Math.floor(Math.random() * 1050)}`;
    const newTask: TaskItem = {
      id: tempId, text, checked: false,
      notes: notes || categoryName,
      type: taskType || "task",
      url, progress
    };
    const updated = lists.map(l => l.id !== optimisticListId ? l : { ...l, tasks: [newTask, ...l.tasks] });
    applyAndSync(updated);

    if (await canCloudSave("add_task")) {
      if (!cloudListId) {
        queuePendingTaskForTempList(listId, newTask);
        console.log("cloud_add_task_queued_for_pending_list", { listId, taskId: tempId });
        return;
      }

      const dbId = await addTask(cloudListId, newTask);
      if (dbId) {
        setListsAndSync(prev => prev.map(l => l.id !== cloudListId ? l : {
          ...l, tasks: l.tasks.map(t => t.id === tempId ? { ...t, id: dbId } : t)
        }));
        console.log("cloud_add_task_success", { listId: cloudListId, taskId: dbId });
      } else {
        setListsAndSync(prev => prev.map(l => l.id !== cloudListId ? l : {
          ...l, tasks: l.tasks.filter(t => t.id !== tempId)
        }));
        console.error("cloud_add_task_error", { listId: cloudListId, taskId: tempId });
      }
    }
  };

  const handleUpdateTask = async (listId: string, taskId: string, updates: Partial<TaskItem>) => {
    const task = lists.find(l => l.id === listId)?.tasks.find(t => t.id === taskId);
    if (!task) return;
    const previousTask = { ...task };
    const updated = lists.map(l => l.id !== listId ? l : {
      ...l, tasks: l.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t)
    });
    applyAndSync(updated);

    if (await canCloudSave("update_task")) {
      const updatedInCloud = await updateTask(taskId, updates);
      if (updatedInCloud) {
        console.log("cloud_update_task_success", { listId, taskId, updates });
      } else {
        setListsAndSync(prev => prev.map(l => l.id !== listId ? l : {
          ...l, tasks: l.tasks.map(t => t.id === taskId ? previousTask : t)
        }));
        console.error("cloud_update_task_error", { listId, taskId, updates });
      }
    }
  };

  const handleDeleteTask = async (listId: string, taskId: string) => {
    const list = lists.find(l => l.id === listId);
    const task = list?.tasks.find(t => t.id === taskId);
    if (!list || !task) return;
    const taskIndex = list.tasks.findIndex(t => t.id === taskId);
    const previousTask = { ...task };
    const updated = lists.map(l => l.id !== listId ? l : {
      ...l, tasks: l.tasks.filter(t => t.id !== taskId)
    });
    applyAndSync(updated);

    const canSave = await canCloudSave("delete_task");
    if (!canSave) {
      console.log("cloud_delete_task_skipped", { listId, taskId, reason: "no_session" });
      return;
    }

    console.log("cloud_delete_task_start", { listId, taskId });
    const deleted = await deleteTask(taskId);
    if (deleted) {
      console.log("cloud_delete_task_success", { listId, taskId });
    } else {
      setListsAndSync(prev => prev.map(l => {
        if (l.id !== listId || l.tasks.some(t => t.id === taskId)) return l;
        const tasks = [...l.tasks];
        tasks.splice(taskIndex, 0, previousTask);
        return { ...l, tasks };
      }));
      console.error("cloud_delete_task_error", { listId, taskId });
    }
  };

  const handleResetList = async (listId: string) => {
    const list = lists.find(l => l.id === listId);
    const updated = lists.map(l => l.id !== listId ? l : {
      ...l, tasks: l.tasks.map(t => ({ ...t, checked: false, progress: t.progress !== undefined ? 0 : undefined }))
    });
    applyAndSync(updated);
    if (list && await canCloudSave("reset_list")) {
      await Promise.all(list.tasks.map(t => updateTask(t.id, { checked: false })));
    }
  };

  const persistOptimisticMeal = async (
    listId: string,
    newMeal: MealSlot,
    previousMeal?: MealSlot,
  ): Promise<boolean> => {
    const clientId = newMeal.clientId;
    if (!clientId) return false;

    if (!await canCloudSave("add_meal")) {
      pendingMealSavesRef.current.delete(clientId);
      return true;
    }

    const dbId = await upsertMeal(listId, newMeal);
    if (dbId) {
      if (!pendingMealSavesRef.current.has(clientId)) {
        await deleteMeal(dbId);
        return true;
      }

      const savedMeal = { ...newMeal, id: dbId };
      pendingMealSavesRef.current.set(clientId, { listId, meal: savedMeal });
      setListsAndSync(current => current.map(list => list.id !== listId ? list : {
        ...list,
        meals: (list.meals ?? []).map(meal => meal.clientId === clientId ? savedMeal : meal),
      }));
      return true;
    }

    pendingMealSavesRef.current.delete(clientId);
    setListsAndSync(current => current.map(list => {
      if (list.id !== listId) return list;
      const optimisticMealIsCurrent = (list.meals ?? []).some(meal => meal.clientId === clientId);
      if (!optimisticMealIsCurrent) return list;

      const meals = (list.meals ?? []).filter(meal => meal.clientId !== clientId);
      if (previousMeal) meals.push(previousMeal);
      return { ...list, meals };
    }));
    console.error("cloud_add_meal_error", { listId, mealId: newMeal.id });
    return false;
  };

  const handleAddMeal = async (
    listId: string,
    day: string,
    type: MealType,
    name: string,
    clientId: string,
  ): Promise<boolean> => {
    const tempId = `meal-${clientId}`;
    const newMeal: MealSlot = { id: tempId, clientId, day, type, name };
    const previousMeal = lists
      .find(list => list.id === listId)
      ?.meals?.find(meal => meal.day === day && meal.type === type);

    pendingMealSavesRef.current.set(clientId, { listId, meal: newMeal });
    setListsAndSync(current => current.map(list => {
      if (list.id !== listId) return list;
      const meals = [...(list.meals ?? [])];
      const slotIndex = meals.findIndex(meal => meal.day === day && meal.type === type);
      if (slotIndex === -1) meals.push(newMeal);
      else meals[slotIndex] = newMeal;
      return { ...list, meals };
    }));

    return persistOptimisticMeal(listId, newMeal, previousMeal);
  };

  const handleDeleteMeal = async (listId: string, mealId: string) => {
    const meal = lists
      .find(list => list.id === listId)
      ?.meals?.find(item => item.id === mealId);
    if (meal?.clientId) pendingMealSavesRef.current.delete(meal.clientId);

    const updated = lists.map(l => l.id !== listId ? l : {
      ...l, meals: (l.meals ?? []).filter(m => m.id !== mealId)
    });
    applyAndSync(updated);
    if (isUuid(mealId) && await canCloudSave("delete_meal")) await deleteMeal(mealId);
  };

  const handleMoveMeal = async (
    listId: string,
    mealId: string,
    day: string,
    type: MealType,
  ): Promise<boolean> => {
    const list = lists.find(item => item.id === listId);
    const meal = list?.meals?.find(item => item.id === mealId);
    if (!meal) return false;
    if (meal.day === day && meal.type === type) return true;

    const movedMeal = { ...meal, day, type };
    const updated = lists.map(item => item.id !== listId ? item : {
      ...item,
      meals: [
        ...(item.meals ?? []).filter(existing =>
          existing.id !== mealId && (existing.day !== day || existing.type !== type)
        ),
        movedMeal,
      ],
    });
    applyAndSync(updated);

    if (await canCloudSave("move_meal")) {
      const movedInCloud = await moveMeal(listId, meal, day, type);
      if (!movedInCloud) {
        console.error("cloud_move_meal_error", { listId, mealId, day, type });
      }
    }

    return true;
  };

  const handleBulkAddGroceryDetails = async (
    listId: string,
    mealName: string,
    day: string,
    mealType: MealType,
    ingredients: RecipeIngredient[],
    recipe: Pick<
      MealSlot,
      | "recipeSourceUrl"
      | "recipeSourceDomain"
      | "recipeIngredients"
      | "recipeInstructions"
      | "recipeImageUrl"
    >,
    clientId: string,
  ) => {
    const importId = Date.now();
    const newMeal: MealSlot = {
      id: `meal-${clientId}`,
      clientId,
      day,
      type: mealType,
      name: mealName,
      source: "recipe_import" as const,
      ...recipe,
      importedAt: new Date().toISOString(),
    };
    const targetList = lists.find(list => list.id === listId);
    const mergePlan = buildGroceryMergePlan(
      targetList?.tasks ?? [],
      ingredients,
      index => `task-imported-${importId}-${index}`,
    );
    const previousMeal = targetList
      ?.meals?.find(meal => meal.day === day && meal.type === mealType);

    pendingMealSavesRef.current.set(clientId, { listId, meal: newMeal });
    setListsAndSync(current => current.map(list => {
      if (list.id !== listId) return list;
      const meals = [...(list.meals ?? [])];
      const slotIndex = meals.findIndex(meal => meal.day === day && meal.type === mealType);
      if (slotIndex === -1) meals.push(newMeal);
      else meals[slotIndex] = newMeal;
      return { ...list, meals, tasks: mergePlan.tasks };
    }));

    const mealSave = persistOptimisticMeal(listId, newMeal, previousMeal);
    if (await canCloudSave("bulk_add_grocery_details")) {
      for (const update of mergePlan.updates) {
        const updated = await updateTask(update.taskId, update.updates);
        if (!updated) console.error("cloud_update_task_error", { listId, taskId: update.taskId });
      }
      for (const task of mergePlan.creates) {
        const dbId = await addTask(listId, task);
        if (!dbId) {
          console.error("cloud_add_task_error", { listId, taskId: task.id });
          continue;
        }
        setListsAndSync(current => current.map(list => list.id !== listId ? list : {
          ...list,
          tasks: list.tasks.map(existing => existing.id === task.id ? { ...existing, id: dbId } : existing),
        }));
      }
    }
    await mealSave;
  };

  const handleAddNewList = async (
    name: string, icon: string, themeColor: string,
    category: "renovation" | "grocery" | "general"
  ) => {
    const tempId = `list-${Date.now()}`;
    const selectedThemeColor = themeColor || "#003b05";
    const newList: List = {
      id: tempId, name, icon, themeColor: selectedThemeColor, category,
      tasks: [],
      meals: category === "grocery" ? [] : undefined
    };
    applyAndSync([newList, ...lists]);
    startTransition(() => setCurrentView("dashboard"));

    if (await canCloudSave("create_list")) {
      console.log("cloud_create_list_start", { listId: tempId, name });
      if (!sessionUser) {
        setListsAndSync(prev => prev.filter(l => l.id !== tempId));
        clearPendingTasksForTempList(tempId);
        console.error("cloud_create_list_error", { listId: tempId, name, reason: "missing_session_user" });
        return;
      }

      const dbId = await createList(newList, sessionUser.id);
      if (dbId) {
        setListsAndSync(prev => prev.map(l => l.id === tempId ? { ...l, id: dbId } : l));
        setSelectedListId(prev => prev === tempId ? dbId : prev);
        console.log("cloud_create_list_success", { listId: dbId, name });
        await flushPendingTasksForTempList(tempId, dbId);
      } else {
        setListsAndSync(prev => prev.filter(l => l.id !== tempId));
        clearPendingTasksForTempList(tempId);
        console.error("cloud_create_list_error", { listId: tempId, name, reason: "createList_returned_null" });
      }
    }
  };

  const handleAddListFromTemplate = async (template: any) => {
    const tempId = `list-${Date.now()}-${Math.floor(Math.random() * 100)}`;
    const instantiated: List = {
      id: tempId,
      name: template.name,
      icon: template.icon,
      themeColor: template.themeColor,
      category: template.category,
      tasks: template.tasks.map((t: any, idx: number) => ({ ...t, id: `task-${Date.now()}-${idx}` }))
    };
    applyAndSync([instantiated, ...lists]);

    if (await canCloudSave("create_list_from_template")) {
      console.log("cloud_create_list_start", { listId: tempId, name: instantiated.name });
      if (!sessionUser) {
        setListsAndSync(prev => prev.filter(l => l.id !== tempId));
        clearPendingTasksForTempList(tempId);
        console.error("cloud_create_list_error", { listId: tempId, name: instantiated.name, reason: "missing_session_user" });
        return;
      }

      const dbId = await createList(instantiated, sessionUser.id);
      if (dbId) {
        setListsAndSync(prev => prev.map(l => l.id === tempId ? { ...l, id: dbId } : l));
        setSelectedListId(prev => prev === tempId ? dbId : prev);
        console.log("cloud_create_list_success", { listId: dbId, name: instantiated.name });

        for (const task of instantiated.tasks) {
          const taskDbId = await addTask(dbId, task);
          if (taskDbId) {
            setListsAndSync(prev => prev.map(l => l.id !== dbId ? l : {
              ...l, tasks: l.tasks.map(t => t.id === task.id ? { ...t, id: taskDbId } : t)
            }));
          } else {
            setListsAndSync(prev => prev.map(l => l.id !== dbId ? l : {
              ...l, tasks: l.tasks.filter(t => t.id !== task.id)
            }));
            console.error("cloud_add_task_error", { listId: dbId, taskId: task.id });
          }
        }

        await flushPendingTasksForTempList(tempId, dbId);
      } else {
        setListsAndSync(prev => prev.filter(l => l.id !== tempId));
        clearPendingTasksForTempList(tempId);
        console.error("cloud_create_list_error", { listId: tempId, name: instantiated.name, reason: "createList_returned_null" });
      }
    }
  };

  const handleDeleteList = async (listId: string) => {
    const listIndex = lists.findIndex(l => l.id === listId);
    const list = lists[listIndex];
    if (!list) return;

    const wasSelected = selectedListId === listId;
    const restoreListLocally = () => {
      setListsAndSync(prev => {
        if (prev.some(l => l.id === listId)) return prev;
        const restored = [...prev];
        restored.splice(Math.min(listIndex, restored.length), 0, list);
        return restored;
      });

      if (wasSelected) {
        setSelectedListId(listId);
        startTransition(() => setCurrentView("detail"));
      }
    };

    const updated = lists.filter(l => l.id !== listId);
    applyAndSync(updated);

    if (wasSelected) {
      setSelectedListId(null);
      startTransition(() => setCurrentView("dashboard"));
    }

    if (!isUuid(listId)) {
      clearPendingTasksForTempList(listId);
      saveLocalDeletedList(list, new Date().toISOString());
      console.log("cloud_soft_delete_list_skipped", { listId, reason: "local_only_list" });
      return;
    }

    const canSave = await canCloudSave("soft_delete_list");
    if (!canSave) {
      restoreListLocally();
      console.error("cloud_soft_delete_list_error", { listId, reason: "cloud_save_unavailable" });
      return;
    }

    const deleted = await softDeleteList(listId);
    if (deleted) {
      console.log("cloud_soft_delete_list_success", { listId });
      return;
    }

    restoreListLocally();
    console.error("cloud_soft_delete_list_error", { listId });
  };

  const handleRenameList = async (listId: string, name: string): Promise<boolean> => {
    const normalizedName = name.trim();
    const list = lists.find(candidate => candidate.id === listId);
    if (!list || !normalizedName || list.membershipRole === "member") return false;

    const previousName = list.name;
    setListsAndSync(currentLists => currentLists.map(candidate =>
      candidate.id === listId ? { ...candidate, name: normalizedName } : candidate
    ));

    if (!isUuid(listId)) return true;

    const canSave = await canCloudSave("update_list_name");
    const saved = canSave && await updateListName(listId, normalizedName);
    if (saved) return true;

    setListsAndSync(currentLists => currentLists.map(candidate =>
      candidate.id === listId && candidate.name === normalizedName
        ? { ...candidate, name: previousName }
        : candidate
    ));
    return false;
  };

  const handleResetLists = () => {
    localStorage.removeItem("hem-listan-lists");
    applyAndSync([]);
  };


  const replaceRestoredLocalList = (oldListId: string, restoredList: List) => {
    const storedLists = loadLocalLists().map(list => list.id === oldListId ? restoredList : list);
    saveLocalLists(storedLists);
    setLists(prev => {
      const activeWithoutRestored = prev.filter(list => list.id !== oldListId && list.id !== restoredList.id);
      return [restoredList, ...activeWithoutRestored];
    });
    setSelectedListId(prev => prev === oldListId ? restoredList.id : prev);
  };

  const syncRestoredLocalListToSupabase = async (restoredList: List, originalListId: string) => {
    if (!sessionUser) {
      console.error("cloud_restore_list_error", { listId: originalListId, reason: "missing_session_user" });
      return false;
    }

    console.log("cloud_restore_list_sync_start", { listId: originalListId, name: restoredList.name });
    const dbId = await createList(restoredList, sessionUser.id);
    if (!dbId || !isUuid(dbId)) {
      console.error("cloud_restore_list_error", { listId: originalListId, reason: "createList_returned_null" });
      return false;
    }

    let syncedList: List = { ...restoredList, id: dbId };
    let syncSucceeded = true;

    for (const task of restoredList.tasks) {
      const taskDbId = await addTask(dbId, task);
      if (taskDbId) {
        syncedList = {
          ...syncedList,
          tasks: syncedList.tasks.map(t => t.id === task.id ? { ...t, id: taskDbId } : t),
        };
      } else {
        syncSucceeded = false;
        console.error("cloud_restore_list_error", { listId: originalListId, taskId: task.id, reason: "addTask_returned_null" });
      }
    }

    for (const meal of restoredList.meals ?? []) {
      const mealDbId = await upsertMeal(dbId, meal);
      if (mealDbId) {
        syncedList = {
          ...syncedList,
          meals: (syncedList.meals ?? []).map(m => m.id === meal.id ? { ...m, id: mealDbId } : m),
        };
      } else {
        syncSucceeded = false;
        console.error("cloud_restore_list_error", { listId: originalListId, mealId: meal.id, reason: "upsertMeal_returned_null" });
      }
    }

    if (!syncSucceeded) {
      console.error("cloud_restore_list_error", { listId: originalListId, reason: "child_sync_failed_kept_local" });
      return false;
    }

    replaceRestoredLocalList(originalListId, syncedList);
    console.log("cloud_restore_list_sync_success", { listId: dbId, localListId: originalListId, name: restoredList.name });
    return true;
  };

  const handleRestoreDeletedList = async (listId: string) => {
    const localStoredList = loadLocalLists().find(list => list.id === listId && getListDeletedAt(list));

    if (localStoredList) {
      const restoredList = stripDeletedFields(localStoredList);
      replaceRestoredLocalList(listId, restoredList);
      setDeletedLists(prev => prev.filter(list => list.id !== listId));

      const canSave = await canCloudSave("restore_local_list_sync");
      if (canSave) {
        const synced = await syncRestoredLocalListToSupabase(restoredList, listId);
        if (!synced) {
          console.error("cloud_restore_list_error", { listId, source: "local", reason: "kept_local_only" });
        }
      }

      console.log("cloud_restore_list_success", { listId, source: "local" });
      return true;
    }

    const canSave = await canCloudSave("restore_list");
    if (!canSave) {
      console.error("cloud_restore_list_error", { listId, reason: "cloud_save_unavailable" });
      return false;
    }

    const restoredDeletedList = deletedLists.find(list => list.id === listId);
    const restored = await restoreList(listId);
    if (!restored) {
      console.error("cloud_restore_list_error", { listId });
      return false;
    }

    if (restoredDeletedList) {
      const activeList = deletedListToActiveList(restoredDeletedList);
      setListsAndSync(prev => [
        activeList,
        ...prev.filter(list => list.id !== listId),
      ]);
    }

    setDeletedLists(prev => prev.filter(list => list.id !== listId));
    console.log("cloud_restore_list_success", { listId });

    void loadFromSupabase()
      .then(refreshed => {
        if (!refreshed) {
          console.error("cloud_restore_list_refresh_error", { listId });
        }
      })
      .catch(error => {
        console.error("cloud_restore_list_refresh_error", { listId, error });
      });

    return true;
  };

  const clearPendingInvite = () => {
    localStorage.removeItem(PENDING_INVITE_TOKEN_STORAGE_KEY);
    if (window.location.pathname.startsWith("/invite/")) {
      window.history.replaceState({}, document.title, "/");
    }
  };

  const handleAcceptInvite = async () => {
    if (!inviteToken || inviteStatus === "loading") return;
    setInviteStatus("loading");
    const joinedListId = await acceptListInvite(inviteToken);
    if (!joinedListId) {
      setInviteStatus("error");
      return;
    }

    const refreshed = await loadFromSupabase();
    if (!refreshed) {
      setInviteStatus("error");
      return;
    }

    clearPendingInvite();
    setCurrentView("dashboard");
    setInviteStatus("success");
  };

  const handleSelectList = (id: string) => {
    setSelectedListId(id);
    setPulseCount(p => p + 1);
    startTransition(() => setCurrentView("detail"));
  };

  const activeList = lists.find(l => l.id === selectedListId);

  const getAmbientColors = () => {
    if (currentView === "create") return { blob1: "bg-[#FFE4E1]/40", blob2: "bg-[#E0F2F1]/50", scale: 1.15 };
    if (currentView === "detail" && activeList) {
      if (activeList.category === "grocery") return { blob1: "bg-[#A5D6A7]/30", blob2: "bg-[#80DEEA]/35", scale: 1.25 };
      if (activeList.category === "renovation") return { blob1: "bg-[#FFCC80]/25", blob2: "bg-[#FFE082]/25", scale: 1.1 };
    }
    return { blob1: "bg-[#C8E6C9]/25", blob2: "bg-[#FFE0B2]/30", scale: 1.0 };
  };

  const ambient = getAmbientColors();

  return (
    <div className="min-h-screen bg-transparent font-sans antialiased text-on-surface flex flex-col items-center relative">
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute inset-0 bg-[#fcf9f8] transition-colors duration-1000" />
        <AnimatePresence mode="popLayout">
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
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/[0.01]" />
      </div>

      {/* TEMP DEBUG: remove after Supabase cloud-save issue is solved. */}
      <DebugPanel
        isLoggedIn={isLoggedIn}
        sessionUserId={sessionUser?.id ?? null}
        currentView={currentView}
        listsCount={lists.length}
      />

      <main className="w-full flex-1 z-10">
        <AnimatePresence mode="wait">
          {currentView === "dashboard" && (
            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <DashboardView
                lists={lists}
                stats={getStats()}
                userName={userName}
                userImage={userImage}
                onSelectList={handleSelectList}
                onTriggerCreate={() => startTransition(() => setCurrentView("create"))}
                onAddListFromTemplate={handleAddListFromTemplate}
                onOpenSettings={() => setShowSettings(true)}
                onDeleteList={handleDeleteList}
              />
            </motion.div>
          )}

          {currentView === "create" && (
            <motion.div key="create" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} transition={{ duration: 0.25 }}>
              <CreateListView
                onCancel={() => startTransition(() => setCurrentView("dashboard"))}
                onCreateList={handleAddNewList}
              />
            </motion.div>
          )}

          {currentView === "detail" && activeList && (
            <motion.div key={`detail-${activeList.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {activeList.category === "grocery" ? (
                <ListDetailGrocery
                  list={activeList}
                  isLoggedIn={isLoggedIn}
                  members={listMembers}
                  onBack={() => startTransition(() => setCurrentView("dashboard"))}
                  onToggleTask={handleToggleTask}
                  onAddTask={handleAddTask}
                  onDeleteTask={handleDeleteTask}
                  onUpdateTask={handleUpdateTask}
                  onResetList={handleResetList}
                  onRenameList={handleRenameList}
                  onAddMeal={handleAddMeal}
                  onDeleteMeal={handleDeleteMeal}
                  onMoveMeal={handleMoveMeal}
                  onBulkAddGroceryDetails={handleBulkAddGroceryDetails}
                />
              ) : (
                <ListDetailRenovation
                  list={activeList}
                  members={listMembers}
                  onBack={() => startTransition(() => setCurrentView("dashboard"))}
                  onToggleTask={handleToggleTask}
                  onAddTask={handleAddTask}
                  onDeleteTask={handleDeleteTask}
                  onUpdateTask={handleUpdateTask}
                  onResetList={handleResetList}
                  onRenameList={handleRenameList}
                  userImage={userImage}
                  userName={userName}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {!inviteDismissed && inviteToken && (
        <CollaborativeInviteView
          isLoggedIn={isLoggedIn}
          status={inviteStatus}
          onLogin={() => {
            localStorage.setItem(PENDING_INVITE_TOKEN_STORAGE_KEY, inviteToken);
            setShowSettings(true);
          }}
          onAccept={() => void handleAcceptInvite()}
          onDone={() => {
            clearPendingInvite();
            setInviteDismissed(true);
          }}
        />
      )}

      <AnimatePresence>
        {showSettings && (
          <SettingsModal
            userName={userName}
            userImage={userImage}
            isLoggedIn={isLoggedIn}
            sessionUser={sessionUser}
            onUpdateUserName={handleUpdateUserName}
            onUpdateUserImage={handleUpdateUserImage}
            onClose={() => setShowSettings(false)}
            deletedLists={deletedLists}
            deletedListsLoading={deletedListsLoading}
            onLoadDeletedLists={loadDeletedLists}
            onRestoreDeletedList={handleRestoreDeletedList}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSearch && (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/60 backdrop-blur-sm pt-[10vh]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg bg-white rounded-2xl p-5 shadow-2xl relative border border-surface-container overflow-hidden text-left"
            >
              <button onClick={() => setShowSearch(false)} className="absolute top-4 right-4 p-1.5 text-outline hover:bg-surface-container-high rounded-full transition-colors cursor-pointer z-10 outline-none">
                <LucideIcon name="close" className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3 mb-4">
                <LucideIcon name="search" className="w-5 h-5 text-primary" />
                <h3 className="font-display text-sm font-bold text-text-main leading-none">Sök i dina bento-listor</h3>
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
                  <button onClick={() => setSearchQuery("")} className="absolute right-3.5 top-3.5 text-outline/50 hover:text-text-main p-0.5 rounded-full hover:bg-surface-container transition-colors outline-none cursor-pointer">
                    <LucideIcon name="close" className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="max-h-[50vh] overflow-y-auto no-scrollbar space-y-2 pr-1">
                {searchQuery.trim() === "" ? (
                  <div className="text-center py-6 text-outline font-sans text-xs">
                    <p className="font-medium">Skriv för att börja söka...</p>
                    <p className="text-[10px] mt-1 text-outline/65">Sökningen uppdateras live för alla dina skapade bento-listor.</p>
                  </div>
                ) : (() => {
                  const query = searchQuery.toLowerCase();
                  const results: { list: List; task: TaskItem }[] = [];
                  lists.forEach(list => list.tasks.forEach(task => {
                    if (task.text.toLowerCase().includes(query) || (task.notes && task.notes.toLowerCase().includes(query))) {
                      results.push({ list, task });
                    }
                  }));
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
                        <div key={task.id} className="p-3 rounded-xl border border-surface-container bg-white flex items-center justify-between gap-3 hover:border-primary-container hover:bg-surface-container-lowest transition-all group">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <button
                              onClick={() => handleToggleTask(list.id, task.id)}
                              className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all cursor-pointer outline-none ${task.checked ? "bg-secondary border-secondary text-white" : "hover:border-primary border-outline-variant bg-white"}`}
                            >
                              {task.checked && <LucideIcon name="check" className="w-3.5 h-3.5 stroke-[3]" />}
                            </button>
                            <div className="min-w-0 pr-1 flex-1">
                              <p
                                onClick={() => { handleSelectList(list.id); setShowSearch(false); }}
                                className={`font-sans text-xs font-semibold leading-snug cursor-pointer hover:text-primary transition-colors truncate ${task.checked ? "line-through text-outline/60" : "text-text-main"}`}
                              >
                                {task.text}
                              </p>
                              <span
                                onClick={() => { handleSelectList(list.id); setShowSearch(false); }}
                                className="inline-flex items-center gap-1 font-sans text-[9px] font-bold text-outline hover:text-text-main transition-colors mt-0.5 cursor-pointer"
                              >
                                📂 {list.name}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => { handleSelectList(list.id); setShowSearch(false); }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-outline hover:text-text-main hover:bg-surface-container rounded-full transition-all outline-none"
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

      {currentView === "dashboard" && (
        <div className="fixed bottom-0 left-0 w-full z-10 flex justify-around items-center px-4 pb-4 pt-1 bg-surface-container-low dark:bg-surface-container-lowest border-t border-surface-container-high shadow-lg">
          <button className="flex flex-col items-center justify-center text-primary bg-secondary-container rounded-full px-5 py-2 active:scale-95 transition-all text-xs font-bold gap-1 cursor-pointer">
            <LucideIcon name="calendar" className="w-5 h-5" />
            <span>Hem</span>
          </button>
          <button
            onClick={() => { setSearchQuery(""); setShowSearch(true); }}
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

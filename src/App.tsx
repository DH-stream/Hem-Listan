import { useState, useEffect, startTransition, useMemo, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { AnimatePresence, motion } from "motion/react";
import { DeletedList, List, ListMember, Stats, MealSlot, MealType, RecipeIngredient, TaskItem, UserProfile, WeekdayKey } from "./types";
import { INITIAL_LISTS } from "./data";
import DashboardView from "./components/DashboardView";
import ListDetailRenovation from "./components/ListDetailRenovation";
import ListDetailGrocery from "./components/ListDetailGrocery";
import CreateListView from "./components/CreateListView";
import DebugPanel, { getInitialMockPresenceEnabled } from "./components/DebugPanel";
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
  updateList,
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
import { useListPresence } from "./hooks/useListPresence";
import { DEBUG_PRESENCE_USER_ID, withMockPresence } from "./lib/presence";
import { normalizeWeekdayKey } from "./lib/weekdays";

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

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
    .filter(list => !getListDeletedAt(list))
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
  mealPlanStartDay: normalizeWeekdayKey(list.mealPlanStartDay),
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
  const [mockPresenceEnabled, setMockPresenceEnabled] = useState(getInitialMockPresenceEnabled);
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

  const presenceProfile = useMemo(() => sessionUser ? {
    userId: sessionUser.id,
    displayName: userProfile?.displayName || userName || sessionUser.email || "Hem-Listan",
    avatarUrl: userProfile?.avatarUrl || userImage || null,
    avatarPath: userProfile?.avatarPath ?? null,
  } : null, [sessionUser, userImage, userName, userProfile]);
  const presenceListId = currentView === "detail" && selectedListId && isUuid(selectedListId) && isLoggedIn
    ? selectedListId
    : null;
  const { presentUsers } = useListPresence(presenceListId, presenceProfile);
  const displayedPresentUsers = useMemo(() => withMockPresence(presentUsers, {
    enabled: mockPresenceEnabled,
    currentUserId: presenceProfile?.userId ?? null,
    listId: presenceListId,
  }), [mockPresenceEnabled, presenceListId, presenceProfile?.userId, presentUsers]);

  useEffect(() => {
    if (mockPresenceEnabled && displayedPresentUsers.some((user) => user.userId === DEBUG_PRESENCE_USER_ID)) {
      console.log("[presence] mock user injected");
    }
  }, [displayedPresentUsers, mockPresenceEnabled]);

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
      const hasUnsyncedLocalLists = localLists.some(list => !isUuid(list.id));
      if (localStorage.getItem(migrationKey) === "true" && !hasUnsyncedLocalLists) return;

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

  const syncLocalListToSupabase = async (
    localList: List,
    reason: string,
  ): Promise<List | null> => {
    if (isUuid(localList.id)) return localList;

    const ownerId = sessionUser?.id ?? getSupabaseAuthSnapshot().userId;
    if (!ownerId) {
      console.error("sync_local_list_error", { listId: localList.id, name: localList.name, reason, error: "missing_owner_id" });
      return null;
    }

    console.log("sync_local_list_start", { listId: localList.id, name: localList.name, reason });

    const existingLists = await fetchLists();
    if (existingLists) {
      const exactMatch = existingLists.find(existing =>
        listFingerprint(existing) === listFingerprint(localList)
      );
      const metadataMatch = existingLists.find(existing =>
        listMetadataFingerprint(existing) === listMetadataFingerprint(localList)
      );
      const existingList = exactMatch ?? metadataMatch;

      if (existingList?.id && isUuid(existingList.id)) {
        const linkedList: List = {
          ...existingList,
          membershipRole: existingList.membershipRole ?? "owner",
          memberCount: existingList.memberCount ?? 1,
        };

        setListsAndSync(currentLists => currentLists.map(list =>
          list.id === localList.id ? linkedList : list
        ));
        setSelectedListId(prev => prev === localList.id ? existingList.id : prev);
        clearPendingTasksForTempList(localList.id);
        console.log("sync_local_list_reused_existing", {
          localListId: localList.id,
          cloudListId: existingList.id,
          name: localList.name,
          reason,
        });
        return linkedList;
      }
    }

    const cleanupPartialList = async (newId: string, error: string) => {
      const cleanedUp = await softDeleteList(newId);
      if (cleanedUp) {
        console.log("sync_local_list_partial_cleanup_success", { listId: localList.id, cloudListId: newId, name: localList.name, reason, error });
      } else {
        console.error("sync_local_list_partial_cleanup_error", { listId: localList.id, cloudListId: newId, name: localList.name, reason, error });
      }
    };

    const newId = await createList(localList, ownerId);
    if (!newId || !isUuid(newId)) {
      console.error("sync_local_list_error", { listId: localList.id, name: localList.name, reason, error: "createList_returned_invalid_id" });
      return null;
    }

    const syncedTasks: TaskItem[] = [];
    for (const task of localList.tasks) {
      const taskId = await addTask(newId, task);
      if (!taskId) {
        const error = "addTask_returned_null";
        console.error("sync_local_list_error", { listId: localList.id, cloudListId: newId, taskId: task.id, reason, error });
        await cleanupPartialList(newId, error);
        return null;
      }
      syncedTasks.push({ ...task, id: taskId });
    }

    const syncedMeals: MealSlot[] | undefined = localList.meals ? [] : undefined;
    for (const meal of localList.meals ?? []) {
      const mealId = await upsertMeal(newId, meal);
      if (!mealId) {
        const error = "upsertMeal_returned_null";
        console.error("sync_local_list_error", { listId: localList.id, cloudListId: newId, mealId: meal.id, reason, error });
        await cleanupPartialList(newId, error);
        return null;
      }
      syncedMeals?.push({ ...meal, id: mealId });
    }

    const syncedList: List = {
      ...localList,
      id: newId,
      membershipRole: "owner",
      memberCount: 1,
      tasks: syncedTasks,
      meals: syncedMeals,
    };

    setListsAndSync(currentLists => currentLists.map(list =>
      list.id === localList.id ? syncedList : list
    ));
    setSelectedListId(prev => prev === localList.id ? newId : prev);
    clearPendingTasksForTempList(localList.id);
    console.log("sync_local_list_success", { listId: newId, localListId: localList.id, name: localList.name, reason });
    return syncedList;
  };

  const handleEnsureCloudList = async (list: List): Promise<string | null> => {
    if (isUuid(list.id)) return list.id;

    const syncedList = await syncLocalListToSupabase(list, "invite");
    if (!syncedList) {
      console.error("ensure_cloud_list_error", { listId: list.id, name: list.name });
      return null;
    }

    return syncedList.id;
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
  }
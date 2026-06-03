import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { List, TaskItem, MealSlot } from "../types";

// ── Singleton-klient ─────────────────────────────────────────────────
let _client: SupabaseClient | null = null;

const getSupabaseConfig = () => {
  const metaEnv = (import.meta as any).env || {};
  const url = (metaEnv.VITE_SUPABASE_URL as string) || localStorage.getItem("hem_listan_supabase_url") || "";
  const anonKey = (metaEnv.VITE_SUPABASE_ANON_KEY as string) || localStorage.getItem("hem_listan_supabase_anon_key") || "";
  return { url, anonKey };
};

export const isSupabaseConfigured = (): boolean => {
  const { url, anonKey } = getSupabaseConfig();
  return !!(url && anonKey);
};

export const getSupabaseClient = (): SupabaseClient | null => {
  if (_client) return _client;
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) return null;
  try {
    _client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
    return _client;
  } catch (e) {
    console.error("Failed to initialize Supabase client:", e);
    return null;
  }
};

// Återställ singleton när credentials ändras
export const resetSupabaseClient = () => { _client = null; };

export const saveLocalStorageCredentials = (url: string, key: string) => {
  if (url && key) {
    localStorage.setItem("hem_listan_supabase_url", url.trim());
    localStorage.setItem("hem_listan_supabase_anon_key", key.trim());
  } else {
    localStorage.removeItem("hem_listan_supabase_url");
    localStorage.removeItem("hem_listan_supabase_anon_key");
  }
  resetSupabaseClient();
};

export const getLocalCredentials = () => ({
  url: localStorage.getItem("hem_listan_supabase_url") || "",
  anonKey: localStorage.getItem("hem_listan_supabase_anon_key") || ""
});

// ── Databasoperationer ───────────────────────────────────────────────

// Hämta alla listor för inloggad användare (egna + delade)
export const fetchLists = async (): Promise<List[]> => {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data: { user } } = await client.auth.getUser();
  if (!user) return [];

  // Hämta listor som användaren äger eller är medlem i
  const { data: listsData, error } = await client
    .from('hl_lists')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !listsData || listsData.length === 0) return [];

  const listIds = listsData.map(l => l.id);

  // Hämta tasks + meals för alla dessa listor parallellt
  const [{ data: tasksData }, { data: mealsData }] = await Promise.all([
    client
      .from('hl_tasks')
      .select('*')
      .in('list_id', listIds)
      .order('sort_order', { ascending: true }),
    client
      .from('hl_meals')
      .select('*')
      .in('list_id', listIds)
  ]);

  return listsData.map(l => ({
    id: l.id,
    name: l.name,
    icon: l.icon || 'list',
    themeColor: l.theme_color || '#1a5319',
    category: l.category as "renovation" | "grocery" | "general",
    tasks: (tasksData || [])
      .filter(t => t.list_id === l.id)
      .map(t => ({
        id: t.id,
        text: t.text,
        checked: t.checked ?? false,
        notes: t.notes || undefined,
        type: (t.type || 'task') as "task" | "note" | "progress" | "link",
        url: t.url || undefined,
        progress: t.progress !== null ? t.progress : undefined,
      })),
    meals: (mealsData || [])
      .filter(m => m.list_id === l.id)
      .map(m => ({
        id: m.id,
        day: m.day,
        type: m.type as any,
        name: m.name,
      })),
  }));
};

// Skapa ny lista
export const createList = async (list: Omit<List, 'tasks' | 'meals'>): Promise<string | null> => {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;

  // Förbered datan. Om list.id skickas med från App.tsx men är ett tillfälligt sträng-id
  // (och inte en giltig UUID), låter vi Postgres gen_random_uuid() generera ett riktigt UUID.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(list.id);
  const insertData: any = {
    owner_id: user.id,
    name: list.name,
    icon: list.icon || 'list',
    theme_color: list.themeColor || '#1a5319',
    category: list.category || 'general',
  };

  if (isUuid) {
    insertData.id = list.id;
  }

  const { data, error } = await client
    .from('hl_lists')
    .insert(insertData)
    .select('id')
    .single();

  if (error || !data) {
    console.error("Error creating list:", error);
    return null;
  }
  return data.id;
};

// Uppdatera lista
export const updateList = async (listId: string, updates: Partial<Pick<List, 'name' | 'icon' | 'themeColor'>>) => {
  const client = getSupabaseClient();
  if (!client) return;
  await client.from('hl_lists').update({
    ...(updates.name && { name: updates.name }),
    ...(updates.icon && { icon: updates.icon }),
    ...(updates.themeColor && { theme_color: updates.themeColor }),
  }).eq('id', listId);
};

// Ta bort lista
export const deleteList = async (listId: string) => {
  const client = getSupabaseClient();
  if (!client) return;
  await client.from('hl_lists').delete().eq('id', listId);
};

// Lägg till task
export const addTask = async (listId: string, task: Omit<TaskItem, 'id'> & { id?: string }): Promise<string | null> => {
  const client = getSupabaseClient();
  if (!client) return null;

  const isUuid = task.id ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(task.id) : false;
  const insertData: any = {
    list_id: listId,
    text: task.text,
    checked: task.checked ?? false,
    notes: task.notes || null,
    type: task.type ?? 'task',
    url: task.url || null,
    progress: task.progress !== undefined ? task.progress : null,
  };

  if (isUuid && task.id) {
    insertData.id = task.id;
  }

  const { data, error } = await client
    .from('hl_tasks')
    .insert(insertData)
    .select('id')
    .single();

  if (error || !data) {
    console.error("Error adding task:", error);
    return null;
  }
  return data.id;
};

// Uppdatera task
export const updateTask = async (taskId: string, updates: Partial<TaskItem>) => {
  const client = getSupabaseClient();
  if (!client) return;
  await client.from('hl_tasks').update({
    ...(updates.text !== undefined && { text: updates.text }),
    ...(updates.checked !== undefined && { checked: updates.checked }),
    ...(updates.notes !== undefined && { notes: updates.notes }),
    ...(updates.progress !== undefined && { progress: updates.progress }),
    ...(updates.url !== undefined && { url: updates.url }),
  }).eq('id', taskId);
};

// Ta bort task
export const deleteTask = async (taskId: string) => {
  const client = getSupabaseClient();
  if (!client) return;
  await client.from('hl_tasks').delete().eq('id', taskId);
};

// Lägg till/uppdatera måltid
export const upsertMeal = async (listId: string, meal: { id?: string; day: string; type: string; name: string }): Promise<string | null> => {
  const client = getSupabaseClient();
  if (!client) return null;

  // Ta bort befintlig måltid för samma dag+typ först
  await client.from('hl_meals')
    .delete()
    .eq('list_id', listId)
    .eq('day', meal.day)
    .eq('type', meal.type);

  const isUuid = meal.id ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(meal.id) : false;
  const insertData: any = {
    list_id: listId,
    day: meal.day,
    type: meal.type,
    name: meal.name
  };

  if (isUuid && meal.id) {
    insertData.id = meal.id;
  }

  const { data, error } = await client
    .from('hl_meals')
    .insert(insertData)
    .select('id')
    .single();

  if (error || !data) {
    console.error("Error upserting meal:", error);
    return null;
  }
  return data.id;
};

// Ta bort måltid
export const deleteMeal = async (mealId: string) => {
  const client = getSupabaseClient();
  if (!client) return;
  await client.from('hl_meals').delete().eq('id', mealId);
};

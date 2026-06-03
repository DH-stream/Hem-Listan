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

// Hämta alla listor för inloggad användare
export const fetchLists = async (): Promise<List[]> => {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data: { user } } = await client.auth.getUser();
  if (!user) return [];

  const { data: listsData, error } = await client
    .from('hl_lists')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !listsData) return [];

  // Hämta tasks + meals för alla listor parallellt
  const listIds = listsData.map(l => l.id);

  const [{ data: tasksData }, { data: mealsData }] = await Promise.all([
    client.from('hl_tasks').select('*').in('list_id', listIds).order('sort_order', { ascending: true }),
    client.from('hl_meals').select('*').in('list_id', listIds)
  ]);

  return listsData.map(l => ({
    id: l.id,
    name: l.name,
    icon: l.icon,
    themeColor: l.theme_color,
    category: l.category,
    tasks: (tasksData || [])
      .filter(t => t.list_id === l.id)
      .map(t => ({
        id: t.id,
        text: t.text,
        checked: t.checked,
        notes: t.notes,
        type: t.type,
        url: t.url,
        progress: t.progress,
      })),
    meals: (mealsData || [])
      .filter(m => m.list_id === l.id)
      .map(m => ({
        id: m.id,
        day: m.day,
        type: m.type,
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

  const { data, error } = await client
    .from('hl_lists')
    .insert({
      owner_id: user.id,
      name: list.name,
      icon: list.icon,
      theme_color: list.themeColor,
      category: list.category,
    })
    .select('id')
    .single();

  if (error || !data) return null;
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
export const addTask = async (listId: string, task: Omit<TaskItem, 'id'>): Promise<string | null> => {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client
    .from('hl_tasks')
    .insert({
      list_id: listId,
      text: task.text,
      checked: task.checked ?? false,
      notes: task.notes,
      type: task.type ?? 'task',
      url: task.url,
      progress: task.progress,
    })
    .select('id')
    .single();
  if (error || !data) return null;
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

  const { data, error } = await client
    .from('hl_meals')
    .insert({ list_id: listId, day: meal.day, type: meal.type, name: meal.name })
    .select('id')
    .single();

  if (error || !data) return null;
  return data.id;
};

// Ta bort måltid
export const deleteMeal = async (mealId: string) => {
  const client = getSupabaseClient();
  if (!client) return;
  await client.from('hl_meals').delete().eq('id', mealId);
};

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { List, TaskItem, MealSlot } from "../types";

// ── Singleton-klient ─────────────────────────────────────────────────
// TEMP DEBUG: remove after Supabase cloud-save issue is solved.
type AbortablePromiseLike<T> = PromiseLike<T> & {
  abortSignal?: (signal: AbortSignal) => PromiseLike<T>;
};

const withTimeout = async <T,>(
  promise: AbortablePromiseLike<T>,
  ms: number,
  label: string
): Promise<T> => {
  const controller = new AbortController();
  const request = typeof promise.abortSignal === "function"
    ? promise.abortSignal(controller.signal)
    : promise;
  let timeoutId: number | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      controller.abort();
      reject(new Error(`${label}_timeout_after_${ms}ms`));
    }, ms);
  });

  try {
    return await Promise.race([Promise.resolve(request), timeout]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
};

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
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        storage: window.localStorage,
        storageKey: "hem-listan-auth"
      }
    });
    return _client;
  } catch (e) {
    console.error("Failed to initialize Supabase client:", e);
    return null;
  }
};

// Återställ singleton när credentials ändras
export const resetSupabaseClient = () => { _client = null; };

export const hasSupabaseSession = async (): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client) return false;

  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) {
    console.error("Error checking Supabase session:", sessionError);
  }

  if (sessionData.session?.user) return true;

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) {
    console.error("Error checking Supabase user:", userError);
    return false;
  }

  return !!userData.user;
};

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
export const fetchLists = async (): Promise<List[] | null> => {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;

  // Hämta listor som användaren äger eller är medlem i
  const { data: listsData, error } = await client
    .from('hl_lists')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !listsData) return null;
  if (listsData.length === 0) return [];

  const listIds = listsData.map(l => l.id);

  // Hämta tasks + meals för alla dessa listor parallellt
  const [tasksResult, mealsResult] = await Promise.all([
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

  if (tasksResult.error || mealsResult.error) return null;

  const tasksData = tasksResult.data || [];
  const mealsData = mealsResult.data || [];

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
export const createList = async (list: Omit<List, 'tasks' | 'meals'>, ownerId: string): Promise<string | null> => {
  const client = getSupabaseClient();
  if (!client) {
    console.error("create_list_client_unavailable", { listId: list.id, name: list.name });
    return null;
  }

  if (!ownerId) {
    console.error("create_list_no_owner_id", { listId: list.id, name: list.name });
    return null;
  }

  // Förbered datan. Om list.id skickas med från App.tsx men är ett tillfälligt sträng-id
  // (och inte en giltig UUID), genererar klienten ett riktigt UUID innan insert.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(list.id);
  const dbId = isUuid ? list.id : crypto.randomUUID();
  const insertData: any = {
    id: dbId,
    owner_id: ownerId,
    name: list.name,
    icon: list.icon || 'list',
    theme_color: list.themeColor || '#1a5319',
    category: list.category || 'general',
  };

  const safeInsertDetails = {
    id: insertData.id,
    name: insertData.name,
    icon: insertData.icon,
    theme_color: insertData.theme_color,
    category: insertData.category,
    hasOwnerId: Boolean(insertData.owner_id),
  };

  console.log("create_list_insert_payload", {
    insertData: safeInsertDetails,
    isUuid,
    listId: list.id,
    ownerId,
  });
  console.log("create_list_insert_start", { listId: list.id, name: list.name, ownerId });

  try {
    const { error } = await withTimeout(
      client
        .from('hl_lists')
        .insert(insertData),
      10000,
      "create_list_insert"
    );

    if (error) {
      console.error("create_list_insert_error", {
        error,
        insertData: safeInsertDetails,
        listId: list.id,
        name: list.name,
      });
      return null;
    }

    console.log("create_list_insert_success", {
      listId: dbId,
      name: list.name,
    });

    return dbId;
  } catch (error) {
    console.error("create_list_insert_exception", {
      error,
      listId: list.id,
      name: list.name,
    });

    return null;
  }
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

type AddTaskRpcPayload = {
  p_id: string;
  p_list_id: string;
  p_text: string;
  p_checked: boolean;
  p_notes: string | null;
  p_type: NonNullable<TaskItem['type']>;
  p_url: string | null;
  p_progress: number | null;
};

type AddTaskRpcSafeDetails = {
  id: string;
  list_id: string;
  text: string;
  checked: boolean;
  hasNotes: boolean;
  type: TaskItem['type'];
  hasUrl: boolean;
  progress: number | null;
};

type AddTaskDiagnosticContext = {
  listId: string;
  taskId?: string;
  dbId: string;
  text: string;
  rpcPayload: AddTaskRpcSafeDetails;
};

const addTaskWithRawRpc = async (
  client: SupabaseClient,
  rpcPayload: AddTaskRpcPayload,
  context: AddTaskDiagnosticContext
): Promise<string | null> => {
  const { url, anonKey } = getSupabaseConfig();
  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/rpc/hl_create_task`;
  const timeoutMs = 10000;

  console.log("add_task_raw_rpc_payload", {
    rpcPayload: context.rpcPayload,
    listId: context.listId,
    taskId: context.taskId,
    dbId: context.dbId,
  });

  if (!url || !anonKey) {
    console.error("add_task_raw_rpc_error", {
      error: "missing_supabase_config",
      hasUrl: Boolean(url),
      hasAnonKey: Boolean(anonKey),
      ...context,
    });
    return null;
  }

  const startedAt = Date.now();
  console.log("add_task_raw_rpc_start", {
    endpoint,
    timeoutMs,
    listId: context.listId,
    taskId: context.taskId,
    dbId: context.dbId,
    text: context.text,
  });

  try {
    const sessionStartedAt = Date.now();
    console.log("add_task_raw_rpc_session_start", {
      hasSession: false,
      hasAccessToken: false,
      elapsedMs: 0,
    });

    let sessionData;
    let sessionError;

    try {
      const sessionResult = await withTimeout(
        client.auth.getSession(),
        3000,
        "add_task_raw_rpc_session"
      );
      sessionData = sessionResult.data;
      sessionError = sessionResult.error;
    } catch (error) {
      const elapsedMs = Date.now() - sessionStartedAt;

      if (error instanceof Error && error.message === "add_task_raw_rpc_session_timeout_after_3000ms") {
        console.error("add_task_raw_rpc_session_timeout", {
          hasSession: false,
          hasAccessToken: false,
          elapsedMs,
        });
        return null;
      }

      console.error("add_task_raw_rpc_session_exception", {
        error,
        hasSession: false,
        hasAccessToken: false,
        elapsedMs,
      });
      return null;
    }

    const session = sessionData.session;
    const accessToken = session?.access_token;
    const sessionDiagnostics = {
      hasSession: Boolean(session),
      hasAccessToken: Boolean(accessToken),
      userId: session?.user?.id,
      elapsedMs: Date.now() - sessionStartedAt,
    };

    console.log("add_task_raw_rpc_session_success", sessionDiagnostics);

    if (sessionError || !accessToken) {
      console.error("add_task_raw_rpc_session_error", {
        error: sessionError || "missing_access_token",
        ...sessionDiagnostics,
      });
      console.error("add_task_raw_rpc_error", {
        error: sessionError || "missing_access_token",
        hasAccessToken: Boolean(accessToken),
        ...context,
      });
      return null;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      console.error("add_task_raw_rpc_timeout", {
        timeoutMs,
        elapsedMs: Date.now() - startedAt,
        endpoint,
        ...context,
      });
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(rpcPayload),
        signal: controller.signal,
      });
      const responseText = await response.text();
      let responseBody: unknown = responseText;

      if (responseText) {
        try {
          responseBody = JSON.parse(responseText);
        } catch {
          responseBody = responseText;
        }
      }

      console.log("add_task_raw_rpc_response", {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        elapsedMs: Date.now() - startedAt,
        body: responseBody,
        ...context,
      });

      if (!response.ok) {
        console.error("add_task_raw_rpc_error", {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          body: responseBody,
          ...context,
        });
        return null;
      }

      const createdId = typeof responseBody === 'string' && responseBody ? responseBody : context.dbId;
      console.log("add_task_raw_rpc_success", {
        listId: context.listId,
        taskId: context.taskId,
        dbId: createdId,
        text: context.text,
      });
      return createdId;
    } finally {
      window.clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error("add_task_raw_rpc_exception", {
      error,
      elapsedMs: Date.now() - startedAt,
      endpoint,
      ...context,
    });
    return null;
  }
};

// Lägg till task
export const addTask = async (listId: string, task: Omit<TaskItem, 'id'> & { id?: string }): Promise<string | null> => {
  const client = getSupabaseClient();
  if (!client) {
    console.error("add_task_client_unavailable", { listId, taskId: task.id, text: task.text });
    return null;
  }

  const isUuid = task.id ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(task.id) : false;
  const dbId = isUuid && task.id ? task.id : crypto.randomUUID();
  const rpcPayload: AddTaskRpcPayload = {
    p_id: dbId,
    p_list_id: listId,
    p_text: task.text,
    p_checked: task.checked ?? false,
    p_notes: task.notes || null,
    p_type: task.type ?? 'task',
    p_url: task.url || null,
    p_progress: task.progress !== undefined ? task.progress : null,
  };

  const safeRpcDetails: AddTaskRpcSafeDetails = {
    id: rpcPayload.p_id,
    list_id: rpcPayload.p_list_id,
    text: rpcPayload.p_text,
    checked: rpcPayload.p_checked,
    hasNotes: Boolean(rpcPayload.p_notes),
    type: rpcPayload.p_type,
    hasUrl: Boolean(rpcPayload.p_url),
    progress: rpcPayload.p_progress,
  };

  const rawRpcContext: AddTaskDiagnosticContext = {
    listId,
    taskId: task.id,
    dbId,
    text: task.text,
    rpcPayload: safeRpcDetails,
  };

  console.log("add_task_rpc_payload", {
    rpcPayload: safeRpcDetails,
    isUuid,
    taskId: task.id,
    listId,
  });
  console.log("add_task_rpc_start", { listId, taskId: task.id, dbId, text: task.text });

  try {
    const { data, error } = await withTimeout(
      client.rpc('hl_create_task', rpcPayload),
      10000,
      "add_task_rpc"
    );

    if (error) {
      console.error("add_task_rpc_error", {
        error,
        rpcPayload: safeRpcDetails,
        listId,
        taskId: task.id,
        dbId,
        text: task.text,
      });
      return addTaskWithRawRpc(client, rpcPayload, rawRpcContext);
    }

    const createdId = typeof data === 'string' ? data : dbId;
    console.log("add_task_rpc_success", { listId, taskId: task.id, dbId: createdId, text: task.text });
    return createdId;
  } catch (error) {
    console.error("add_task_rpc_exception", {
      error,
      listId,
      taskId: task.id,
      dbId,
      text: task.text,
    });
    return addTaskWithRawRpc(client, rpcPayload, rawRpcContext);
  }
};

// Uppdatera task
export const updateTask = async (taskId: string, updates: Partial<TaskItem>): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client) {
    console.error("update_task_client_unavailable", { taskId, updates: Object.keys(updates) });
    return false;
  }

  const updateData: any = {
    ...(updates.text !== undefined && { text: updates.text }),
    ...(updates.checked !== undefined && { checked: updates.checked }),
    ...(updates.notes !== undefined && { notes: updates.notes }),
    ...(updates.progress !== undefined && { progress: updates.progress }),
    ...(updates.url !== undefined && { url: updates.url }),
  };

  const safeUpdateDetails = {
    hasText: updates.text !== undefined,
    checked: updateData.checked,
    hasNotes: updates.notes !== undefined,
    progress: updateData.progress,
    hasUrl: updates.url !== undefined,
    keys: Object.keys(updateData),
  };

  console.log("update_task_payload", { taskId, updates: safeUpdateDetails });
  console.log("update_task_start", { taskId, updates: safeUpdateDetails });

  try {
    const { error } = await withTimeout(
      client
        .from('hl_tasks')
        .update(updateData)
        .eq('id', taskId),
      10000,
      "update_task"
    );

    if (error) {
      console.error("update_task_error", { error, taskId, updates: safeUpdateDetails });
      return false;
    }

    console.log("update_task_success", { taskId, updates: safeUpdateDetails });
    return true;
  } catch (error) {
    console.error("update_task_exception", { error, taskId, updates: safeUpdateDetails });
    return false;
  }
};

// Ta bort task
export const deleteTask = async (taskId: string): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client) {
    console.error("delete_task_client_unavailable", { taskId });
    return false;
  }

  console.log("delete_task_start", { taskId });

  try {
    const { error } = await withTimeout(
      client
        .from('hl_tasks')
        .delete()
        .eq('id', taskId),
      10000,
      "delete_task"
    );

    if (error) {
      console.error("delete_task_error", { error, taskId });
      return false;
    }

    console.log("delete_task_success", { taskId });
    return true;
  } catch (error) {
    console.error("delete_task_exception", { error, taskId });
    return false;
  }
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

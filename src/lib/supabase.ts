import { createClient, Session, SupabaseClient } from "@supabase/supabase-js";
import { DeletedList, List, TaskItem, MealSlot } from "../types";

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


export type SupabaseAuthSnapshot = {
  accessToken: string | null;
  userId: string | null;
};

let currentAccessToken: string | null = null;
let currentUserId: string | null = null;

export const setSupabaseAuthSnapshot = (session: Session | null) => {
  currentAccessToken = session?.access_token ?? null;
  currentUserId = session?.user?.id ?? null;

  console.log("auth_snapshot_updated", {
    hasAccessToken: Boolean(currentAccessToken),
    userId: currentUserId,
  });
};

export const getSupabaseAuthSnapshot = (): SupabaseAuthSnapshot => ({
  accessToken: currentAccessToken,
  userId: currentUserId,
});

export const clearSupabaseAuthSnapshot = () => {
  currentAccessToken = null;
  currentUserId = null;
  console.log("auth_snapshot_cleared");
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
export const resetSupabaseClient = () => { _client = null; clearSupabaseAuthSnapshot(); };

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
    .is('deleted_at', null)
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


type DeletedListRow = {
  id: string;
  name: string;
  icon: string | null;
  theme_color: string | null;
  category: string;
  deleted_at: string;
};

const mapDeletedListRow = (row: DeletedListRow): DeletedList => ({
  id: row.id,
  name: row.name,
  icon: row.icon || 'list',
  themeColor: row.theme_color || '#1a5319',
  category: row.category as "renovation" | "grocery" | "general",
  tasks: [],
  meals: row.category === 'grocery' ? [] : undefined,
  deletedAt: row.deleted_at,
  restoreSource: "cloud" as const,
});

export const fetchDeletedLists = async (): Promise<DeletedList[]> => {
  const timeoutMs = 10000;
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

  console.log("fetch_deleted_lists_start", { timeoutMs, twoDaysAgo });
  console.log("fetch_deleted_lists_sdk_start", { skipped: true, reason: "using_raw_rest_auth_snapshot" });

  const { url, anonKey } = getSupabaseConfig();
  const authSnapshot = getSupabaseAuthSnapshot();
  const accessToken = authSnapshot.accessToken;
  const authDiagnostics = {
    hasAccessToken: Boolean(accessToken),
    userId: authSnapshot.userId,
  };

  console.log("fetch_deleted_lists_raw_start", {
    timeoutMs,
    twoDaysAgo,
    hasUrl: Boolean(url),
    hasAnonKey: Boolean(anonKey),
    ...authDiagnostics,
  });

  if (!url || !anonKey) {
    console.error("fetch_deleted_lists_raw_error", {
      error: "missing_supabase_config",
      hasUrl: Boolean(url),
      hasAnonKey: Boolean(anonKey),
      ...authDiagnostics,
    });
    return [];
  }

  if (!accessToken) {
    console.error("fetch_deleted_lists_raw_error", {
      error: "missing_auth_snapshot_access_token",
      ...authDiagnostics,
    });
    return [];
  }

  console.log("fetch_deleted_lists_raw_auth_snapshot_found", authDiagnostics);

  const baseUrl = url.replace(/\/$/, '');
  const query = new URLSearchParams();
  query.set("select", "id,name,icon,theme_color,category,deleted_at");
  query.append("deleted_at", "not.is.null");
  query.append("deleted_at", `gte.${twoDaysAgo}`);
  query.set("order", "deleted_at.desc");

  const endpoint = `${baseUrl}/rest/v1/hl_lists?${query.toString()}`;
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    console.error("fetch_deleted_lists_raw_error", {
      error: "timeout",
      timeoutMs,
      elapsedMs: Date.now() - startedAt,
      endpoint,
      ...authDiagnostics,
    });
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
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

    console.log("fetch_deleted_lists_raw_response", {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      elapsedMs: Date.now() - startedAt,
      body: responseBody,
      ...authDiagnostics,
    });

    if (!response.ok) {
      console.error("fetch_deleted_lists_raw_error", {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        body: responseBody,
        ...authDiagnostics,
      });
      return [];
    }

    if (!Array.isArray(responseBody)) {
      console.error("fetch_deleted_lists_raw_error", {
        error: "unexpected_response_body",
        body: responseBody,
        ...authDiagnostics,
      });
      return [];
    }

    const deletedLists = (responseBody as DeletedListRow[]).map(mapDeletedListRow);
    console.log("fetch_deleted_lists_raw_success", {
      count: deletedLists.length,
      elapsedMs: Date.now() - startedAt,
      ...authDiagnostics,
    });

    return deletedLists;
  } catch (error) {
    console.error("fetch_deleted_lists_raw_exception", {
      error,
      elapsedMs: Date.now() - startedAt,
      ...authDiagnostics,
    });
    return [];
  } finally {
    window.clearTimeout(timeoutId);
  }
};

type CreateListRpcPayload = {
  p_id: string;
  p_owner_id: string;
  p_name: string;
  p_icon: string;
  p_theme_color: string;
  p_category: string;
};

type CreateListRpcSafeDetails = {
  id: string;
  name: string;
  icon: string;
  theme_color: string;
  category: string;
  hasOwnerId: boolean;
};

type CreateListDiagnosticContext = {
  dbId: string;
  listId: string;
  name: string;
  ownerId: string;
  rpcPayload: CreateListRpcSafeDetails;
};

const createListWithRawRpc = async (
  rpcPayload: CreateListRpcPayload,
  context: CreateListDiagnosticContext
): Promise<string | null> => {
  const { url, anonKey } = getSupabaseConfig();
  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/rpc/hl_create_list`;
  const timeoutMs = 10000;

  console.log("create_list_raw_rpc_payload", {
    rpcPayload: context.rpcPayload,
    listId: context.listId,
    dbId: context.dbId,
    name: context.name,
    ownerId: context.ownerId,
  });

  if (!url || !anonKey) {
    console.error("create_list_raw_rpc_error", {
      error: "missing_supabase_config",
      hasUrl: Boolean(url),
      hasAnonKey: Boolean(anonKey),
      ...context,
    });
    return null;
  }

  const startedAt = Date.now();
  console.log("create_list_raw_rpc_start", {
    endpoint,
    timeoutMs,
    listId: context.listId,
    dbId: context.dbId,
    name: context.name,
    ownerId: context.ownerId,
  });

  try {
    const authSnapshot = getSupabaseAuthSnapshot();
    const accessToken = authSnapshot.accessToken;
    const authDiagnostics = {
      hasAccessToken: Boolean(accessToken),
      userId: authSnapshot.userId,
    };

    if (!accessToken) {
      console.error("create_list_raw_rpc_auth_snapshot_missing", authDiagnostics);
      console.error("create_list_raw_rpc_error", {
        error: "missing_auth_snapshot_access_token",
        ...authDiagnostics,
        ...context,
      });
      return null;
    }

    console.log("create_list_raw_rpc_auth_snapshot_found", authDiagnostics);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      console.error("create_list_raw_rpc_timeout", {
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

      console.log("create_list_raw_rpc_response", {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        elapsedMs: Date.now() - startedAt,
        body: responseBody,
        ...context,
      });

      if (!response.ok) {
        console.error("create_list_raw_rpc_error", {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          body: responseBody,
          ...context,
        });
        return null;
      }

      const createdId = typeof responseBody === 'string' && responseBody ? responseBody : context.dbId;
      console.log("create_list_raw_rpc_success", {
        listId: context.listId,
        dbId: createdId,
        name: context.name,
        ownerId: context.ownerId,
      });
      return createdId;
    } finally {
      window.clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error("create_list_raw_rpc_exception", {
      error,
      elapsedMs: Date.now() - startedAt,
      endpoint,
      ...context,
    });
    return null;
  }
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
  const rpcPayload: CreateListRpcPayload = {
    p_id: dbId,
    p_owner_id: ownerId,
    p_name: insertData.name,
    p_icon: insertData.icon,
    p_theme_color: insertData.theme_color,
    p_category: insertData.category,
  };
  const rpcContext: CreateListDiagnosticContext = {
    dbId,
    listId: list.id,
    name: list.name,
    ownerId,
    rpcPayload: safeInsertDetails,
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
      return createListWithRawRpc(rpcPayload, rpcContext);
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

    return createListWithRawRpc(rpcPayload, rpcContext);
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

type SoftDeleteListRpcPayload = {
  p_list_id: string;
};

type SoftDeleteListRpcSafeDetails = {
  listId: string;
};

const softDeleteListWithRawRpc = async (
  rpcPayload: SoftDeleteListRpcPayload,
  safeRpcDetails: SoftDeleteListRpcSafeDetails
): Promise<boolean> => {
  const { url, anonKey } = getSupabaseConfig();
  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/rpc/hl_soft_delete_list`;
  const timeoutMs = 10000;

  console.log("soft_delete_list_rpc_payload", {
    rpcPayload: safeRpcDetails,
  });

  if (!url || !anonKey) {
    console.error("soft_delete_list_rpc_error", {
      error: "missing_supabase_config",
      hasUrl: Boolean(url),
      hasAnonKey: Boolean(anonKey),
      rpcPayload: safeRpcDetails,
    });
    return false;
  }

  const startedAt = Date.now();
  console.log("soft_delete_list_rpc_start", {
    endpoint,
    timeoutMs,
    listId: rpcPayload.p_list_id,
  });

  try {
    const authSnapshot = getSupabaseAuthSnapshot();
    const accessToken = authSnapshot.accessToken;
    const authDiagnostics = {
      hasAccessToken: Boolean(accessToken),
      userId: authSnapshot.userId,
    };

    if (!accessToken) {
      console.error("soft_delete_list_rpc_error", {
        error: "missing_auth_snapshot_access_token",
        ...authDiagnostics,
        rpcPayload: safeRpcDetails,
      });
      return false;
    }

    console.log("soft_delete_list_rpc_auth_snapshot_found", authDiagnostics);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      console.error("soft_delete_list_rpc_error", {
        error: "timeout",
        timeoutMs,
        elapsedMs: Date.now() - startedAt,
        endpoint,
        rpcPayload: safeRpcDetails,
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

      console.log("soft_delete_list_rpc_response", {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        elapsedMs: Date.now() - startedAt,
        body: responseBody,
        rpcPayload: safeRpcDetails,
      });

      if (!response.ok) {
        console.error("soft_delete_list_rpc_error", {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          body: responseBody,
          rpcPayload: safeRpcDetails,
        });
        return false;
      }

      console.log("soft_delete_list_rpc_success", {
        listId: rpcPayload.p_list_id,
      });
      return true;
    } finally {
      window.clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error("soft_delete_list_rpc_exception", {
      error,
      elapsedMs: Date.now() - startedAt,
      endpoint,
      rpcPayload: safeRpcDetails,
    });
    return false;
  }
};


export const softDeleteList = async (listId: string): Promise<boolean> => {
  const client = getSupabaseClient();
  const rpcPayload: SoftDeleteListRpcPayload = { p_list_id: listId };
  const safeRpcDetails: SoftDeleteListRpcSafeDetails = { listId };

  console.log("soft_delete_list_start", { listId });

  if (!client) {
    console.error("soft_delete_list_rpc_error", {
      error: "supabase_client_unavailable",
      rpcPayload: safeRpcDetails,
    });
    return false;
  }

  return softDeleteListWithRawRpc(rpcPayload, safeRpcDetails);
};

type RestoreListRpcPayload = {
  p_list_id: string;
};

type RestoreListRpcSafeDetails = {
  listId: string;
};

export const restoreList = async (listId: string): Promise<boolean> => {
  const client = getSupabaseClient();
  const { url, anonKey } = getSupabaseConfig();
  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/rpc/hl_restore_list`;
  const timeoutMs = 10000;
  const rpcPayload: RestoreListRpcPayload = { p_list_id: listId };
  const safeRpcDetails: RestoreListRpcSafeDetails = { listId };

  console.log("restore_list_start", { listId });
  console.log("restore_list_rpc_payload", { rpcPayload: safeRpcDetails });

  if (!client) {
    console.error("restore_list_rpc_error", {
      error: "supabase_client_unavailable",
      rpcPayload: safeRpcDetails,
    });
    return false;
  }

  if (!url || !anonKey) {
    console.error("restore_list_rpc_error", {
      error: "missing_supabase_config",
      hasUrl: Boolean(url),
      hasAnonKey: Boolean(anonKey),
      rpcPayload: safeRpcDetails,
    });
    return false;
  }

  const startedAt = Date.now();
  console.log("restore_list_rpc_start", {
    endpoint,
    timeoutMs,
    listId,
  });

  try {
    const authSnapshot = getSupabaseAuthSnapshot();
    const accessToken = authSnapshot.accessToken;
    const authDiagnostics = {
      hasAccessToken: Boolean(accessToken),
      userId: authSnapshot.userId,
    };

    if (!accessToken) {
      console.error("restore_list_rpc_error", {
        error: "missing_auth_snapshot_access_token",
        ...authDiagnostics,
        rpcPayload: safeRpcDetails,
      });
      return false;
    }

    console.log("restore_list_rpc_auth_snapshot_found", authDiagnostics);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      console.error("restore_list_rpc_error", {
        error: "timeout",
        timeoutMs,
        elapsedMs: Date.now() - startedAt,
        endpoint,
        rpcPayload: safeRpcDetails,
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

      console.log("restore_list_rpc_response", {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        elapsedMs: Date.now() - startedAt,
        body: responseBody,
        rpcPayload: safeRpcDetails,
      });

      if (!response.ok) {
        console.error("restore_list_rpc_error", {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          body: responseBody,
          rpcPayload: safeRpcDetails,
        });
        return false;
      }

      console.log("restore_list_rpc_success", { listId });
      return true;
    } finally {
      window.clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error("restore_list_rpc_exception", {
      error,
      elapsedMs: Date.now() - startedAt,
      endpoint,
      rpcPayload: safeRpcDetails,
    });
    return false;
  }
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

type UpdateTaskRpcPayload = {
  p_task_id: string;
  p_checked?: boolean;
  p_text?: string;
  p_notes?: string;
  p_progress?: number;
  p_url?: string;
};

type UpdateTaskRpcSafeDetails = {
  taskId: string;
  hasText: boolean;
  checked?: boolean;
  hasNotes: boolean;
  progress?: number;
  hasUrl: boolean;
  keys: string[];
};

type UpdateTaskDiagnosticContext = {
  taskId: string;
  rpcPayload: UpdateTaskRpcSafeDetails;
};

type DeleteTaskRpcPayload = {
  p_task_id: string;
};

type DeleteTaskRpcSafeDetails = {
  taskId: string;
};

type DeleteTaskDiagnosticContext = {
  taskId: string;
  rpcPayload: DeleteTaskRpcSafeDetails;
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
    const authSnapshot = getSupabaseAuthSnapshot();
    const accessToken = authSnapshot.accessToken;
    const authDiagnostics = {
      hasAccessToken: Boolean(accessToken),
      userId: authSnapshot.userId,
    };

    if (!accessToken) {
      console.error("add_task_raw_rpc_auth_snapshot_missing", authDiagnostics);
      console.error("add_task_raw_rpc_error", {
        error: "missing_auth_snapshot_access_token",
        ...authDiagnostics,
        ...context,
      });
      return null;
    }

    console.log("add_task_raw_rpc_auth_snapshot_found", authDiagnostics);

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

const updateTaskWithRawRpc = async (
  rpcPayload: UpdateTaskRpcPayload,
  context: UpdateTaskDiagnosticContext
): Promise<boolean> => {
  const { url, anonKey } = getSupabaseConfig();
  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/rpc/hl_update_task`;
  const timeoutMs = 10000;

  console.log("update_task_raw_rpc_payload", {
    rpcPayload: context.rpcPayload,
    taskId: context.taskId,
  });

  if (!url || !anonKey) {
    console.error("update_task_raw_rpc_error", {
      error: "missing_supabase_config",
      hasUrl: Boolean(url),
      hasAnonKey: Boolean(anonKey),
      ...context,
    });
    return false;
  }

  const startedAt = Date.now();
  console.log("update_task_raw_rpc_start", {
    endpoint,
    timeoutMs,
    taskId: context.taskId,
  });

  try {
    const authSnapshot = getSupabaseAuthSnapshot();
    const accessToken = authSnapshot.accessToken;
    const authDiagnostics = {
      hasAccessToken: Boolean(accessToken),
      userId: authSnapshot.userId,
    };

    if (!accessToken) {
      console.error("update_task_raw_rpc_auth_snapshot_missing", authDiagnostics);
      console.error("update_task_raw_rpc_error", {
        error: "missing_auth_snapshot_access_token",
        ...authDiagnostics,
        ...context,
      });
      return false;
    }

    console.log("update_task_raw_rpc_auth_snapshot_found", authDiagnostics);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      console.error("update_task_raw_rpc_timeout", {
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

      console.log("update_task_raw_rpc_response", {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        elapsedMs: Date.now() - startedAt,
        body: responseBody,
        ...context,
      });

      if (!response.ok) {
        console.error("update_task_raw_rpc_error", {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          body: responseBody,
          ...context,
        });
        return false;
      }

      console.log("update_task_raw_rpc_success", {
        taskId: context.taskId,
        rpcPayload: context.rpcPayload,
      });
      return true;
    } finally {
      window.clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error("update_task_raw_rpc_exception", {
      error,
      elapsedMs: Date.now() - startedAt,
      endpoint,
      ...context,
    });
    return false;
  }
};

const deleteTaskWithRawRpc = async (
  rpcPayload: DeleteTaskRpcPayload,
  context: DeleteTaskDiagnosticContext
): Promise<boolean> => {
  const { url, anonKey } = getSupabaseConfig();
  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/rpc/hl_delete_task`;
  const timeoutMs = 10000;

  console.log("delete_task_raw_rpc_payload", {
    rpcPayload: context.rpcPayload,
    taskId: context.taskId,
  });

  if (!url || !anonKey) {
    console.error("delete_task_raw_rpc_error", {
      error: "missing_supabase_config",
      hasUrl: Boolean(url),
      hasAnonKey: Boolean(anonKey),
      ...context,
    });
    return false;
  }

  const startedAt = Date.now();
  console.log("delete_task_raw_rpc_start", {
    endpoint,
    timeoutMs,
    taskId: context.taskId,
  });

  try {
    const authSnapshot = getSupabaseAuthSnapshot();
    const accessToken = authSnapshot.accessToken;
    const authDiagnostics = {
      hasAccessToken: Boolean(accessToken),
      userId: authSnapshot.userId,
    };

    if (!accessToken) {
      console.error("delete_task_raw_rpc_auth_snapshot_missing", authDiagnostics);
      console.error("delete_task_raw_rpc_error", {
        error: "missing_auth_snapshot_access_token",
        ...authDiagnostics,
        ...context,
      });
      return false;
    }

    console.log("delete_task_raw_rpc_auth_snapshot_found", authDiagnostics);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      console.error("delete_task_raw_rpc_timeout", {
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

      console.log("delete_task_raw_rpc_response", {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        elapsedMs: Date.now() - startedAt,
        body: responseBody,
        ...context,
      });

      if (!response.ok) {
        console.error("delete_task_raw_rpc_error", {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          body: responseBody,
          ...context,
        });
        return false;
      }

      console.log("delete_task_raw_rpc_success", {
        taskId: context.taskId,
        rpcPayload: context.rpcPayload,
      });
      return true;
    } finally {
      window.clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error("delete_task_raw_rpc_exception", {
      error,
      elapsedMs: Date.now() - startedAt,
      endpoint,
      ...context,
    });
    return false;
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

  const rpcPayload: UpdateTaskRpcPayload = {
    p_task_id: taskId,
    ...(updates.checked !== undefined && { p_checked: updates.checked }),
    ...(updates.text !== undefined && { p_text: updates.text }),
    ...(updates.notes !== undefined && { p_notes: updates.notes }),
    ...(updates.progress !== undefined && { p_progress: updates.progress }),
    ...(updates.url !== undefined && { p_url: updates.url }),
  };

  const rawRpcContext: UpdateTaskDiagnosticContext = {
    taskId,
    rpcPayload: {
      taskId,
      ...safeUpdateDetails,
    },
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
      return updateTaskWithRawRpc(rpcPayload, rawRpcContext);
    }

    console.log("update_task_success", { taskId, updates: safeUpdateDetails });
    return true;
  } catch (error) {
    console.error("update_task_exception", { error, taskId, updates: safeUpdateDetails });
    return updateTaskWithRawRpc(rpcPayload, rawRpcContext);
  }
};

// Ta bort task
export const deleteTask = async (taskId: string): Promise<boolean> => {
  const client = getSupabaseClient();
  if (!client) {
    console.error("delete_task_client_unavailable", { taskId });
    return false;
  }

  const rpcPayload: DeleteTaskRpcPayload = {
    p_task_id: taskId,
  };

  const rawRpcContext: DeleteTaskDiagnosticContext = {
    taskId,
    rpcPayload: {
      taskId,
    },
  };

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
      return deleteTaskWithRawRpc(rpcPayload, rawRpcContext);
    }

    console.log("delete_task_success", { taskId });
    return true;
  } catch (error) {
    console.error("delete_task_exception", { error, taskId });
    return deleteTaskWithRawRpc(rpcPayload, rawRpcContext);
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

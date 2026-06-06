import { createClient, Session, SupabaseClient, User } from "@supabase/supabase-js";
import { DeletedList, List, ListMember, PublicListShare, TaskItem, MealSlot, UserProfile } from "../types";

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

type UserProfileRow = {
  user_id: string;
  display_name: string | null;
  avatar_path: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileRequestResult =
  | { kind: "response"; response: Response; body: unknown }
  | { kind: "timeout" }
  | { kind: "error"; error: unknown };

const PROFILE_REQUEST_TIMEOUT_MS = 10000;
const PROFILE_COLUMNS = "user_id,display_name,avatar_path,avatar_url,created_at,updated_at";

const encodeStoragePath = (path: string): string =>
  path.split("/").map((segment) => encodeURIComponent(segment)).join("/");

const profileRequest = async (
  label: string,
  endpoint: string,
  init: RequestInit,
  details: Record<string, unknown>,
): Promise<ProfileRequestResult> => {
  const startedAt = Date.now();
  const controller = new AbortController();
  let timedOut = false;
  let timeoutId: number | undefined;

  console.log(`[HL_PROFILE] ${label} start`, {
    ...details,
    method: init.method ?? "GET",
    endpoint,
    timeoutMs: PROFILE_REQUEST_TIMEOUT_MS,
  });

  const request = (async (): Promise<ProfileRequestResult> => {
    try {
      const response = await fetch(endpoint, { ...init, signal: controller.signal });
      const body = await parseJsonResponse(response);
      if (timedOut) return { kind: "timeout" };

      console.log(`[HL_PROFILE] ${label} response`, {
        ...details,
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        elapsedMs: Date.now() - startedAt,
      });
      return { kind: "response", response, body };
    } catch (error) {
      if (timedOut) return { kind: "timeout" };

      console.error(`[HL_PROFILE] ${label} error`, {
        ...details,
        error,
        elapsedMs: Date.now() - startedAt,
      });
      return { kind: "error", error };
    }
  })();

  const timeout = new Promise<ProfileRequestResult>((resolve) => {
    timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
      console.error(`[HL_PROFILE] ${label} timeout`, {
        ...details,
        timeoutMs: PROFILE_REQUEST_TIMEOUT_MS,
        elapsedMs: Date.now() - startedAt,
      });
      resolve({ kind: "timeout" });
    }, PROFILE_REQUEST_TIMEOUT_MS);
  });

  const result = await Promise.race([request, timeout]);
  if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  return result;
};

const getProfileRequestContext = (label: string, userId: string) => {
  const { url, anonKey } = getSupabaseConfig();
  const { accessToken } = getSupabaseAuthSnapshot();

  if (!url || !anonKey || !accessToken) {
    console.warn(`[HL_PROFILE] ${label} skipped without config or auth`, {
      userId,
      hasUrl: Boolean(url),
      hasAnonKey: Boolean(anonKey),
      hasAccessToken: Boolean(accessToken),
    });
    return null;
  }

  return {
    supabaseUrl: url.replace(/\/$/, ""),
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
  };
};

const mapUserProfile = (row: UserProfileRow): UserProfile => ({
  userId: row.user_id,
  displayName: row.display_name?.trim() || "Hem-Listan",
  avatarPath: row.avatar_path,
  avatarUrl: row.avatar_url,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const getProfileRow = (body: unknown): UserProfileRow | null => {
  if (!Array.isArray(body) || body.length === 0) return null;
  return body[0] as UserProfileRow;
};

export const getInitialProfileDisplayName = (user: User): string => {
  const metadata = user.user_metadata ?? {};
  const metadataName = [metadata.full_name, metadata.name]
    .find((value): value is string => typeof value === "string" && Boolean(value.trim()));

  return metadataName?.trim() || user.email?.split("@")[0]?.trim() || "Hem-Listan";
};

const selectUserProfile = async (
  userId: string,
  label = "select profile",
): Promise<ProfileRequestResult> => {
  const context = getProfileRequestContext(label, userId);
  if (!context) return { kind: "error", error: "missing_config_or_auth" };

  const endpoint = `${context.supabaseUrl}/rest/v1/hl_profiles?user_id=eq.${encodeURIComponent(userId)}&select=${PROFILE_COLUMNS}`;
  return profileRequest(label, endpoint, {
    method: "GET",
    headers: context.headers,
  }, { userId });
};

export const loadOrCreateUserProfile = async (user: User): Promise<UserProfile | null> => {
  console.log("[HL_PROFILE] load/create start", { userId: user.id });
  const selectResult = await selectUserProfile(user.id);
  if (selectResult.kind !== "response") return null;

  const existingProfile = getProfileRow(selectResult.body);
  console.log("[HL_PROFILE] select profile result", {
    userId: user.id,
    hasExistingProfile: Boolean(existingProfile),
    status: selectResult.response.status,
  });
  if (!selectResult.response.ok) {
    console.error("[HL_PROFILE] profile load error", {
      userId: user.id,
      status: selectResult.response.status,
      body: selectResult.body,
    });
    return null;
  }
  if (existingProfile) return mapUserProfile(existingProfile);

  const context = getProfileRequestContext("insert profile", user.id);
  if (!context) return null;
  const insertResult = await profileRequest(
    "insert profile",
    `${context.supabaseUrl}/rest/v1/hl_profiles`,
    {
      method: "POST",
      headers: context.headers,
      body: JSON.stringify({
        user_id: user.id,
        display_name: getInitialProfileDisplayName(user),
      }),
    },
    { userId: user.id },
  );
  if (insertResult.kind !== "response") return null;

  const createdProfile = getProfileRow(insertResult.body);
  console.log("[HL_PROFILE] insert profile result", {
    userId: user.id,
    hasCreatedProfile: Boolean(createdProfile),
    status: insertResult.response.status,
  });
  if (insertResult.response.ok && createdProfile) return mapUserProfile(createdProfile);

  // A parallel auth event may have created the profile after the initial read.
  const racedResult = await selectUserProfile(user.id, "raced profile select");
  if (racedResult.kind !== "response") return null;
  const racedProfile = getProfileRow(racedResult.body);
  console.log("[HL_PROFILE] raced profile select result", {
    userId: user.id,
    hasProfile: Boolean(racedProfile),
    status: racedResult.response.status,
  });
  if (racedResult.response.ok && racedProfile) return mapUserProfile(racedProfile);

  console.error("[HL_PROFILE] profile create error", {
    userId: user.id,
    status: insertResult.response.status,
    body: insertResult.body,
  });
  return null;
};

export const updateUserProfile = async (
  userId: string,
  updates: { displayName?: string; avatarPath?: string | null; avatarUrl?: string | null },
): Promise<UserProfile | null> => {
  console.log("[HL_PROFILE] update profile start", { userId, updates });
  const context = getProfileRequestContext("update profile request", userId);
  if (!context) return null;

  const payload: Record<string, string | null> = {};
  if (updates.displayName !== undefined) payload.display_name = updates.displayName.trim();
  if (updates.avatarPath !== undefined) payload.avatar_path = updates.avatarPath;
  if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;

  const endpoint = `${context.supabaseUrl}/rest/v1/hl_profiles?user_id=eq.${encodeURIComponent(userId)}`;
  const result = await profileRequest("update profile request", endpoint, {
    method: "PATCH",
    headers: context.headers,
    body: JSON.stringify(payload),
  }, { userId });
  if (result.kind !== "response") return null;

  const profileRow = getProfileRow(result.body);
  console.log("[HL_PROFILE] update profile result", {
    userId,
    hasData: Boolean(profileRow),
    status: result.response.status,
  });
  if (!result.response.ok || !profileRow) {
    console.error("[HL_PROFILE] profile update error", {
      userId,
      status: result.response.status,
      body: result.body,
    });
    return null;
  }

  return mapUserProfile(profileRow);
};

const dataUrlToBlob = (dataUrl: string): Blob => {
  const [metadata, encodedData] = dataUrl.split(",", 2);
  if (!metadata || !encodedData || !metadata.includes(";base64")) {
    throw new Error("invalid_avatar_data_url");
  }

  const mimeType = metadata.match(/^data:([^;]+)/)?.[1] ?? "image/jpeg";
  const binary = window.atob(encodedData);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
};

const deleteAvatarObject = async (
  userId: string,
  avatarPath: string,
  label: string,
): Promise<ProfileRequestResult> => {
  const context = getProfileRequestContext(label, userId);
  if (!context) return { kind: "error", error: "missing_config_or_auth" };
  const encodedAvatarPath = encodeStoragePath(avatarPath);

  return profileRequest(
    label,
    `${context.supabaseUrl}/storage/v1/object/hl-avatars/${encodedAvatarPath}`,
    {
      method: "DELETE",
      headers: {
        apikey: context.headers.apikey,
        Authorization: context.headers.Authorization,
      },
    },
    { userId, avatarPath },
  );
};

export const uploadUserAvatar = async (
  userId: string,
  imageDataUrl: string,
  previousAvatarPath?: string | null,
): Promise<UserProfile | null> => {
  console.log("[HL_PROFILE] avatar upload start", { userId, previousAvatarPath });
  const context = getProfileRequestContext("storage upload", userId);
  if (!context) return null;

  const avatarPath = `${userId}/avatar-${Date.now()}.jpg`;
  const encodedAvatarPath = encodeStoragePath(avatarPath);
  let imageBlob: Blob;
  try {
    console.log("[HL_PROFILE] avatar blob prepare start", { userId });
    imageBlob = dataUrlToBlob(imageDataUrl);
    console.log("[HL_PROFILE] avatar blob prepared", {
      userId,
      size: imageBlob.size,
      type: imageBlob.type,
    });
  } catch (error) {
    console.error("[HL_PROFILE] avatar blob prepare error", { userId, error });
    return null;
  }

  const uploadResult = await profileRequest(
    "storage upload",
    `${context.supabaseUrl}/storage/v1/object/hl-avatars/${encodedAvatarPath}`,
    {
      method: "POST",
      headers: {
        apikey: context.headers.apikey,
        Authorization: context.headers.Authorization,
        "Content-Type": "image/jpeg",
        "x-upsert": "false",
      },
      body: imageBlob,
    },
    { userId, avatarPath },
  );
  if (uploadResult.kind !== "response") return null;

  console.log("[HL_PROFILE] storage upload result", {
    userId,
    avatarPath,
    status: uploadResult.response.status,
    ok: uploadResult.response.ok,
  });
  if (!uploadResult.response.ok) {
    console.error("[HL_PROFILE] avatar upload error", {
      userId,
      avatarPath,
      status: uploadResult.response.status,
      body: uploadResult.body,
    });
    return null;
  }

  const publicUrl = `${context.supabaseUrl}/storage/v1/object/public/hl-avatars/${encodedAvatarPath}`;
  console.log("[HL_PROFILE] avatar profile update after upload start", { userId, avatarPath });
  const updatedProfile = await updateUserProfile(userId, { avatarPath, avatarUrl: publicUrl });
  console.log("[HL_PROFILE] avatar profile update after upload result", {
    userId,
    avatarPath,
    hasProfile: Boolean(updatedProfile),
  });

  if (!updatedProfile) {
    await deleteAvatarObject(userId, avatarPath, "failed upload cleanup");
    return null;
  }

  if (previousAvatarPath && previousAvatarPath !== avatarPath) {
    const cleanupResult = await deleteAvatarObject(userId, previousAvatarPath, "previous avatar cleanup");
    if (cleanupResult.kind !== "response" || !cleanupResult.response.ok) {
      console.warn("[HL_PROFILE] previous avatar cleanup failed/skipped", {
        userId,
        previousAvatarPath,
        resultKind: cleanupResult.kind,
        status: cleanupResult.kind === "response" ? cleanupResult.response.status : undefined,
        body: cleanupResult.kind === "response" ? cleanupResult.body : undefined,
      });
    }
  }

  console.log("[HL_PROFILE] avatar upload complete", {
    userId,
    avatarPath,
    hasProfile: true,
  });
  return updatedProfile;
};

export const removeUserAvatar = async (
  userId: string,
  avatarPath?: string | null,
): Promise<UserProfile | null> => {
  console.log("[HL_PROFILE] avatar remove start", { userId, avatarPath });
  console.log("[HL_PROFILE] avatar profile clear start", { userId, avatarPath });
  const updatedProfile = await updateUserProfile(userId, { avatarPath: null, avatarUrl: null });
  console.log("[HL_PROFILE] avatar profile cleared", {
    userId,
    hasProfile: Boolean(updatedProfile),
  });
  if (!updatedProfile) return null;

  if (avatarPath) {
    const removeResult = await deleteAvatarObject(userId, avatarPath, "storage avatar remove");
    if (removeResult.kind !== "response" || !removeResult.response.ok) {
      console.warn("[HL_PROFILE] storage avatar remove failed/skipped", {
        userId,
        avatarPath,
        resultKind: removeResult.kind,
        status: removeResult.kind === "response" ? removeResult.response.status : undefined,
        body: removeResult.kind === "response" ? removeResult.body : undefined,
      });
    }
  }

  console.log("[HL_PROFILE] avatar remove complete", {
    userId,
    avatarPath,
    hasProfile: true,
  });
  return updatedProfile;
};

type CreateListShareRpcPayload = {
  p_source_list_id: string;
  p_title: string;
  p_icon: string | null;
  p_theme_color: string | null;
  p_category: string | null;
  p_snapshot: {
    name: string;
    title: string;
    icon: string;
    themeColor: string;
    category: List["category"];
    senderName?: string;
    shareMessageVariant: 0 | 1 | 2;
    tasks: Array<Pick<TaskItem, "text" | "checked" | "notes" | "type" | "url" | "progress">>;
    meals?: Array<Pick<MealSlot, "day" | "type" | "name">>;
  };
};

type PublicListShareRpcRow = {
  title: string;
  icon: string | null;
  theme_color: string | null;
  category: string | null;
  snapshot: PublicListShare["snapshot"];
  created_at: string;
};

const parseJsonResponse = async (response: Response): Promise<unknown> => {
  const responseText = await response.text();
  if (!responseText) return null;

  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
};

const isUuidValue = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const getShareMessageVariant = (): 0 | 1 | 2 => Math.floor(Math.random() * 3) as 0 | 1 | 2;

export const createListShare = async (list: List, senderName?: string): Promise<string | null> => {
  const { url, anonKey } = getSupabaseConfig();
  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/rpc/hl_create_list_share`;
  const timeoutMs = 10000;
  const startedAt = Date.now();
  const authSnapshot = getSupabaseAuthSnapshot();
  const accessToken = authSnapshot.accessToken;
  const authDiagnostics = {
    hasAccessToken: Boolean(accessToken),
    userId: authSnapshot.userId,
  };

  console.log("create_list_share_start", {
    listId: list.id,
    name: list.name,
    taskCount: list.tasks.length,
    mealCount: list.meals?.length ?? 0,
    ...authDiagnostics,
  });

  const normalizedSenderName = senderName?.trim() || undefined;
  const shareMessageVariant = getShareMessageVariant();

  const rpcPayload: CreateListShareRpcPayload = {
    p_source_list_id: list.id,
    p_title: list.name,
    p_icon: list.icon || null,
    p_theme_color: list.themeColor || null,
    p_category: list.category || null,
    p_snapshot: {
      name: list.name,
      title: list.name,
      icon: list.icon || 'list',
      themeColor: list.themeColor || '#1a5319',
      category: list.category || 'general',
      senderName: normalizedSenderName,
      shareMessageVariant,
      tasks: list.tasks.map(task => ({
        text: task.text,
        checked: task.checked ?? false,
        notes: task.notes || undefined,
        type: task.type || 'task',
        url: task.url || undefined,
        progress: task.progress ?? undefined,
      })),
      ...(list.category === 'grocery' && {
        meals: (list.meals ?? []).map(meal => ({
          day: meal.day,
          type: meal.type,
          name: meal.name,
        })),
      }),
    },
  };

  console.log("create_list_share_rpc_payload", {
    rpcPayload: {
      p_source_list_id: rpcPayload.p_source_list_id,
      p_title: rpcPayload.p_title,
      p_icon: rpcPayload.p_icon,
      p_theme_color: rpcPayload.p_theme_color,
      p_category: rpcPayload.p_category,
      taskCount: rpcPayload.p_snapshot.tasks.length,
      mealCount: rpcPayload.p_snapshot.meals?.length ?? 0,
      hasSenderName: Boolean(rpcPayload.p_snapshot.senderName),
      shareMessageVariant: rpcPayload.p_snapshot.shareMessageVariant,
    },
  });

  if (!url || !anonKey) {
    console.error("create_list_share_rpc_error", {
      error: "missing_supabase_config",
      hasUrl: Boolean(url),
      hasAnonKey: Boolean(anonKey),
      ...authDiagnostics,
    });
    return null;
  }

  if (!isUuidValue(list.id)) {
    console.error("create_list_share_rpc_error", {
      error: "source_list_id_must_be_uuid",
      listId: list.id,
      ...authDiagnostics,
    });
    return null;
  }

  console.log("create_list_share_rpc_start", { endpoint, timeoutMs, listId: list.id });

  try {
    if (!accessToken) {
      console.error("create_list_share_rpc_error", {
        error: "missing_auth_snapshot_access_token",
        ...authDiagnostics,
      });
      return null;
    }

    console.log("create_list_share_rpc_auth_snapshot_found", authDiagnostics);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      console.error("create_list_share_rpc_error", {
        error: "timeout",
        timeoutMs,
        elapsedMs: Date.now() - startedAt,
        endpoint,
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
      const responseBody = await parseJsonResponse(response);

      console.log("create_list_share_rpc_response", {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        elapsedMs: Date.now() - startedAt,
        body: responseBody,
      });

      if (!response.ok) {
        console.error("create_list_share_rpc_error", {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          body: responseBody,
        });
        return null;
      }

      const token = typeof responseBody === 'string' ? responseBody : null;
      if (!token) {
        console.error("create_list_share_rpc_error", {
          error: "unexpected_response_body",
          body: responseBody,
        });
        return null;
      }

      console.log("create_list_share_rpc_success", { token, elapsedMs: Date.now() - startedAt });
      return token;
    } finally {
      window.clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error("create_list_share_rpc_exception", {
      error,
      elapsedMs: Date.now() - startedAt,
      endpoint,
    });
    return null;
  }
};

export const fetchPublicListShare = async (token: string): Promise<PublicListShare | null> => {
  const { url, anonKey } = getSupabaseConfig();
  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/rpc/hl_get_public_list_share`;
  const timeoutMs = 10000;
  const startedAt = Date.now();

  console.log("fetch_public_list_share_start", {
    tokenPresent: Boolean(token),
    hasUrl: Boolean(url),
    hasAnonKey: Boolean(anonKey),
  });

  if (!url || !anonKey || !token) {
    console.error("fetch_public_list_share_error", {
      error: !token ? "missing_share_token" : "missing_supabase_config",
      hasUrl: Boolean(url),
      hasAnonKey: Boolean(anonKey),
      tokenPresent: Boolean(token),
    });
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      console.error("fetch_public_list_share_error", {
        error: "timeout",
        timeoutMs,
        elapsedMs: Date.now() - startedAt,
        endpoint,
      });
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          apikey: anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_share_token: token }),
        signal: controller.signal,
      });
      const responseBody = await parseJsonResponse(response);

      console.log("fetch_public_list_share_response", {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        elapsedMs: Date.now() - startedAt,
        body: responseBody,
      });

      if (!response.ok) {
        console.error("fetch_public_list_share_error", {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          body: responseBody,
        });
        return null;
      }

      if (!Array.isArray(responseBody) || responseBody.length === 0) {
        console.error("fetch_public_list_share_error", {
          error: "share_not_found",
          body: responseBody,
        });
        return null;
      }

      const row = responseBody[0] as PublicListShareRpcRow;
      const publicShare: PublicListShare = {
        title: row.title,
        icon: row.icon || undefined,
        themeColor: row.theme_color || undefined,
        category: row.category as List["category"] | undefined,
        snapshot: row.snapshot ?? {},
        createdAt: row.created_at,
      };

      console.log("fetch_public_list_share_success", {
        title: publicShare.title,
        taskCount: publicShare.snapshot.tasks?.length ?? 0,
        mealCount: publicShare.snapshot.meals?.length ?? 0,
        elapsedMs: Date.now() - startedAt,
      });

      return publicShare;
    } finally {
      window.clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error("fetch_public_list_share_error", {
      error,
      elapsedMs: Date.now() - startedAt,
      endpoint,
    });
    return null;
  }
};


export const createListInvite = async (listId: string): Promise<string | null> => {
  const { url, anonKey } = getSupabaseConfig();
  const { accessToken } = getSupabaseAuthSnapshot();
  if (!url || !anonKey || !accessToken || !isUuidValue(listId)) return null;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/hl_create_list_invite`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_list_id: listId }),
      signal: controller.signal,
    });
    const body = await parseJsonResponse(response);
    return response.ok && typeof body === "string" ? body : null;
  } catch (error) {
    console.error("create_list_invite_error", { listId, error });
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export const acceptListInvite = async (token: string): Promise<string | null> => {
  const { url, anonKey } = getSupabaseConfig();
  const { accessToken } = getSupabaseAuthSnapshot();
  if (!url || !anonKey || !accessToken || !token) return null;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/hl_accept_list_invite`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_token: token }),
      signal: controller.signal,
    });
    const body = await parseJsonResponse(response);
    return response.ok && typeof body === "string" ? body : null;
  } catch (error) {
    console.error("accept_list_invite_error", { error });
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

// ── Databasoperationer ───────────────────────────────────────────────

type ListMemberRow = {
  user_id: string;
  role: "owner" | "member";
  display_name: string | null;
  avatar_url: string | null;
  avatar_path: string | null;
};

// Hämta medlemmar först när en listdetalj öppnas.
// Raw REST + auth snapshot avoids SDK requests that can remain pending in Safari.
export const fetchListMembers = async (listId: string): Promise<ListMember[] | null> => {
  const { url, anonKey } = getSupabaseConfig();
  const { accessToken } = getSupabaseAuthSnapshot();
  if (!url || !anonKey || !accessToken) return null;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/hl_get_list_members`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_list_id: listId }),
      signal: controller.signal,
    });
    const body = await parseJsonResponse(response);
    if (!response.ok || !Array.isArray(body)) return null;

    return (body as ListMemberRow[]).map((row) => ({
      userId: row.user_id,
      role: row.role,
      displayName: row.display_name?.trim() || null,
      avatarUrl: row.avatar_url,
      avatarPath: row.avatar_path,
    }));
  } catch (error) {
    console.error("fetch_list_members_rest_error", { listId, error });
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

// Hämta alla listor för inloggad användare (egna + delade).
// Raw REST + auth snapshot avoids SDK requests that can remain pending in Safari.
export const fetchLists = async (): Promise<List[] | null> => {
  const { url, anonKey } = getSupabaseConfig();
  const { accessToken, userId } = getSupabaseAuthSnapshot();
  if (!url || !anonKey || !accessToken || !userId) return null;

  const baseUrl = url.replace(/\/$/, '');
  const headers = { apikey: anonKey, Authorization: `Bearer ${accessToken}` };
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 10000);

  try {
    const listsResponse = await fetch(
      `${baseUrl}/rest/v1/hl_lists?select=id,owner_id,name,icon,theme_color,category,created_at&deleted_at=is.null&order=created_at.desc`,
      { headers, signal: controller.signal },
    );
    const listsBody = await parseJsonResponse(listsResponse);
    if (!listsResponse.ok || !Array.isArray(listsBody)) return null;
    if (listsBody.length === 0) return [];

    const listIds = listsBody.map((row: any) => row.id);
    const inFilter = encodeURIComponent(`(${listIds.join(',')})`);
    const membersRequest = fetch(
      `${baseUrl}/rest/v1/hl_list_members?select=list_id&list_id=in.${inFilter}`,
      { headers, signal: controller.signal },
    ).then(async (response) => {
      if (!response.ok) return null;
      const body = await parseJsonResponse(response);
      return Array.isArray(body) ? body : null;
    }).catch((error) => {
      console.warn("fetch_list_member_counts_rest_error", { error });
      return null;
    });

    const [tasksResponse, mealsResponse, membersBody] = await Promise.all([
      fetch(`${baseUrl}/rest/v1/hl_tasks?select=*&list_id=in.${inFilter}&order=sort_order.asc`, { headers, signal: controller.signal }),
      fetch(`${baseUrl}/rest/v1/hl_meals?select=*&list_id=in.${inFilter}`, { headers, signal: controller.signal }),
      membersRequest,
    ]);
    const [tasksBody, mealsBody] = await Promise.all([
      parseJsonResponse(tasksResponse),
      parseJsonResponse(mealsResponse),
    ]);
    if (!tasksResponse.ok || !mealsResponse.ok || !Array.isArray(tasksBody) || !Array.isArray(mealsBody)) return null;

    return listsBody.map((listRow: any) => ({
      id: listRow.id,
      name: listRow.name,
      icon: listRow.icon || 'list',
      themeColor: listRow.theme_color || '#1a5319',
      category: listRow.category as List["category"],
      membershipRole: listRow.owner_id === userId ? 'owner' : 'member',
      memberCount: membersBody?.filter((memberRow: any) => memberRow.list_id === listRow.id).length,
      tasks: tasksBody
        .filter((taskRow: any) => taskRow.list_id === listRow.id)
        .map((taskRow: any) => ({
          id: taskRow.id,
          text: taskRow.text,
          checked: taskRow.checked ?? false,
          notes: taskRow.notes || undefined,
          type: (taskRow.type || 'task') as TaskItem["type"],
          url: taskRow.url || undefined,
          progress: taskRow.progress !== null ? taskRow.progress : undefined,
        })),
      meals: mealsBody
        .filter((mealRow: any) => mealRow.list_id === listRow.id)
        .map((mealRow: any) => ({
          id: mealRow.id,
          day: mealRow.day,
          type: mealRow.type as MealSlot["type"],
          name: mealRow.name,
        })),
    }));
  } catch (error) {
    console.error("fetch_lists_rest_error", { error });
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
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

// Byt namn på lista via raw REST för att undvika SDK-anrop som kan fastna i Safari.
export const updateListName = async (listId: string, name: string): Promise<boolean> => {
  const normalizedName = name.trim();
  const { url, anonKey } = getSupabaseConfig();
  const authSnapshot = getSupabaseAuthSnapshot();
  const accessToken = authSnapshot.accessToken;
  const timeoutMs = 10000;

  if (!normalizedName || !url || !anonKey || !accessToken || !isUuidValue(listId)) {
    console.error("update_list_name_rest_error", {
      error: "invalid_request_context",
      listId,
      hasName: Boolean(normalizedName),
      hasUrl: Boolean(url),
      hasAnonKey: Boolean(anonKey),
      hasAccessToken: Boolean(accessToken),
    });
    return false;
  }

  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/hl_lists?id=eq.${encodeURIComponent(listId)}&select=id`;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ name: normalizedName }),
      signal: controller.signal,
    });
    const responseBody = await parseJsonResponse(response);
    const updated = response.ok && Array.isArray(responseBody) && responseBody.length === 1;

    if (!updated) {
      console.error("update_list_name_rest_error", {
        listId,
        status: response.status,
        statusText: response.statusText,
        body: responseBody,
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error("update_list_name_rest_exception", { error, listId });
    return false;
  } finally {
    window.clearTimeout(timeoutId);
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

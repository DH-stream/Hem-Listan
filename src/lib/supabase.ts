import { createClient } from "@supabase/supabase-js";

// Retrieve configuration either from Vite environment variables or localStorage persistence
const getSupabaseConfig = () => {
  const metaEnv = (import.meta as any).env || {};
  const url = (metaEnv.VITE_SUPABASE_URL as string) || "";
  const key = (metaEnv.VITE_SUPABASE_ANON_KEY as string) || "";
  
  const localUrl = localStorage.getItem("hem_listan_supabase_url") || "";
  const localKey = localStorage.getItem("hem_listan_supabase_anon_key") || "";

  return {
    url: url || localUrl,
    anonKey: key || localKey,
    isSetEnv: !!(url && key),
    isSetLocal: !!(localUrl && localKey)
  };
};

export const isSupabaseConfigured = (): boolean => {
  const { url, anonKey } = getSupabaseConfig();
  return !!(url && anonKey);
};

export const getSupabaseClient = () => {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) return null;
  
  try {
    return createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
  } catch (e) {
    console.error("Failed to initialize Supabase client:", e);
    return null;
  }
};

// Helper to save local credentials override if setting up in preview
export const saveLocalStorageCredentials = (url: string, key: string) => {
  if (url && key) {
    localStorage.setItem("hem_listan_supabase_url", url.trim());
    localStorage.setItem("hem_listan_supabase_anon_key", key.trim());
  } else {
    localStorage.removeItem("hem_listan_supabase_url");
    localStorage.removeItem("hem_listan_supabase_anon_key");
  }
};

export const getLocalCredentials = () => {
  return {
    url: localStorage.getItem("hem_listan_supabase_url") || "",
    anonKey: localStorage.getItem("hem_listan_supabase_anon_key") || ""
  };
};

const viteMeta = import.meta as ImportMeta & {
  env?: {
    VITE_APP_VERSION?: string;
  };
};

export const APP_VERSION = viteMeta.env?.VITE_APP_VERSION || "__DEV__";

const APP_VERSION_STORAGE_KEY = "hem_listan_app_version";
const APP_VERSION_RELOAD_KEY = "hem_listan_version_reload_done";

const safeSetLocalVersion = () => {
  try {
    localStorage.setItem(APP_VERSION_STORAGE_KEY, APP_VERSION);
  } catch (error) {
    console.warn("Unable to store app version:", error);
  }
};

const safeGetLocalVersion = () => {
  try {
    return localStorage.getItem(APP_VERSION_STORAGE_KEY);
  } catch (error) {
    console.warn("Unable to read app version:", error);
    return null;
  }
};

const hasReloadedForVersion = () => {
  try {
    return sessionStorage.getItem(APP_VERSION_RELOAD_KEY) === APP_VERSION;
  } catch (error) {
    console.warn("Unable to read app version reload flag:", error);
    return false;
  }
};

const markReloadedForVersion = () => {
  try {
    sessionStorage.setItem(APP_VERSION_RELOAD_KEY, APP_VERSION);
  } catch (error) {
    console.warn("Unable to store app version reload flag:", error);
  }
};

const clearReloadFlag = () => {
  try {
    sessionStorage.removeItem(APP_VERSION_RELOAD_KEY);
  } catch (error) {
    console.warn("Unable to clear app version reload flag:", error);
  }
};

const clearRuntimeCaches = async () => {
  if (!("caches" in window)) return;

  try {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
  } catch (error) {
    console.warn("Unable to clear runtime caches:", error);
  }
};

const unregisterServiceWorkers = async () => {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch (error) {
    console.warn("Unable to unregister service workers:", error);
  }
};

export const ensureLatestAppVersion = async () => {
  const storedVersion = safeGetLocalVersion();

  if (!storedVersion) {
    safeSetLocalVersion();
    clearReloadFlag();
    return;
  }

  if (storedVersion === APP_VERSION) {
    clearReloadFlag();
    return;
  }

  await clearRuntimeCaches();
  await unregisterServiceWorkers();
  safeSetLocalVersion();

  if (hasReloadedForVersion()) return;

  markReloadedForVersion();
  window.location.reload();
};

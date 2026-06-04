const APP_VERSION_URL = "/app-version.json";
const STORED_VERSION_KEY = "hem-listan-app-version";
const RELOAD_GUARD_KEY = "hem-listan-version-reload-pending";

type AppVersionManifest = {
  version?: string;
};

const readVersionManifest = async (): Promise<string | null> => {
  const response = await fetch(`${APP_VERSION_URL}?t=${Date.now()}`, {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
    },
  });

  if (!response.ok) return null;

  const manifest = (await response.json()) as AppVersionManifest;
  return typeof manifest.version === "string" && manifest.version.trim()
    ? manifest.version.trim()
    : null;
};

const clearRuntimeCaches = async () => {
  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
  }

  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));
  }
};

export const ensureLatestAppVersion = async (): Promise<boolean> => {
  try {
    const latestVersion = await readVersionManifest();
    if (!latestVersion) return false;

    const storedVersion = localStorage.getItem(STORED_VERSION_KEY);
    const hasReloadedForVersion = sessionStorage.getItem(RELOAD_GUARD_KEY) === latestVersion;

    if (storedVersion && storedVersion !== latestVersion && !hasReloadedForVersion) {
      sessionStorage.setItem(RELOAD_GUARD_KEY, latestVersion);
      localStorage.setItem(STORED_VERSION_KEY, latestVersion);
      await clearRuntimeCaches();
      window.location.reload();
      return true;
    }

    localStorage.setItem(STORED_VERSION_KEY, latestVersion);
    if (hasReloadedForVersion) {
      sessionStorage.removeItem(RELOAD_GUARD_KEY);
    }
  } catch (error) {
    console.warn("Unable to verify latest app version:", error);
  }

  return false;
};

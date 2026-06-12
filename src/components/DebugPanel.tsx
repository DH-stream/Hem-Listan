import { useEffect, useMemo, useState } from "react";

type DebugLevel = "log" | "warn" | "error";

type DebugLogEntry = {
  id: number;
  timestamp: string;
  level: DebugLevel;
  message: string;
};

type DebugPanelProps = {
  isLoggedIn: boolean;
  sessionUserId: string | null;
  currentView: "dashboard" | "create" | "detail";
  listsCount: number;
  mockPresenceEnabled: boolean;
  onMockPresenceChange: (enabled: boolean) => void;
};

const DEBUG_STORAGE_KEY = "hem-listan-debug-enabled";
export const MOCK_PRESENCE_STORAGE_KEY = "hem-listan-debug-mock-presence";
const MAX_LOG_ENTRIES = 100;
const REDACTED = "[redacted]";

const SENSITIVE_KEY_PATTERN = /(access_token|refresh_token|id_token|token|anon|api[_-]?key|apikey|authorization|auth|bearer|jwt|secret|password|session|supabase)/i;
const LOCAL_STORAGE_KEY_PATTERN = /^(hem-listan|sb-|supabase|user_profile_image)/i;
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const AUTH_HEADER_PATTERN = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi;

const isStorageLike = (value: unknown) => {
  if (typeof Storage !== "undefined" && value instanceof Storage) return true;
  return typeof value === "object" && value !== null && value.constructor?.name === "Storage";
};

const sanitizeValue = (value: unknown, keyHint = "", seen = new WeakSet<object>()): unknown => {
  if (keyHint !== "sessionUserId" && SENSITIVE_KEY_PATTERN.test(keyHint)) return REDACTED;
  if (LOCAL_STORAGE_KEY_PATTERN.test(keyHint)) return "[localStorage value redacted]";
  if (isStorageLike(value)) return "[localStorage redacted]";

  if (typeof value === "string") {
    return value
      .replace(AUTH_HEADER_PATTERN, `$1 ${REDACTED}`)
      .replace(JWT_PATTERN, REDACTED);
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeValue(value.message),
      stack: sanitizeValue(value.stack ?? ""),
    };
  }

  if (typeof value !== "object" || value === null) return value;

  if (seen.has(value)) return "[circular]";
  seen.add(value);

  if (Array.isArray(value)) {
    if (value.length === 2 && typeof value[0] === "string" && LOCAL_STORAGE_KEY_PATTERN.test(value[0])) {
      return [value[0], "[localStorage value redacted]"];
    }

    return value.map(item => sanitizeValue(item, keyHint, seen));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      sanitizeValue(item, key, seen),
    ])
  );
};

const stringifyLogPart = (part: unknown) => {
  const sanitized = sanitizeValue(part);
  if (typeof sanitized === "string") return sanitized;
  if (typeof sanitized === "undefined") return "undefined";

  try {
    return JSON.stringify(sanitized);
  } catch {
    return String(sanitized);
  }
};

const formatLogArgs = (args: unknown[]) => args.map(stringifyLogPart).join(" ");

export const getInitialMockPresenceEnabled = () => {
  if (typeof window === "undefined") return false;

  try {
    const params = new URLSearchParams(window.location.search);
    const debugEnabled = params.get("debug") === "1"
      || localStorage.getItem(DEBUG_STORAGE_KEY) === "true";
    return debugEnabled && localStorage.getItem(MOCK_PRESENCE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

const getInitialDebugEnabled = () => {
  if (typeof window === "undefined") return false;

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") === "1") {
      localStorage.setItem(DEBUG_STORAGE_KEY, "true");
      return true;
    }

    return localStorage.getItem(DEBUG_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

// TEMP DEBUG: remove after Supabase cloud-save issue is solved.
export default function DebugPanel({
  isLoggedIn,
  sessionUserId,
  currentView,
  listsCount,
  mockPresenceEnabled,
  onMockPresenceChange,
}: DebugPanelProps) {
  const [enabled, setEnabled] = useState(getInitialDebugEnabled);
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<DebugLogEntry[]>([]);

  const safeState = useMemo(() => ({
    isLoggedIn,
    sessionUserId,
    currentView,
    listsCount,
  }), [currentView, isLoggedIn, listsCount, sessionUserId]);

  useEffect(() => {
    if (!enabled) return;

    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
    };

    const capture = (level: DebugLevel, args: unknown[]) => {
      const entry: DebugLogEntry = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        level,
        message: formatLogArgs(args),
      };

      setLogs(previous => [...previous, entry].slice(-MAX_LOG_ENTRIES));
    };

    (console.log as typeof console.log) = (...args: unknown[]) => {
      originalConsole.log(...args);
      capture("log", args);
    };

    (console.warn as typeof console.warn) = (...args: unknown[]) => {
      originalConsole.warn(...args);
      capture("warn", args);
    };

    (console.error as typeof console.error) = (...args: unknown[]) => {
      originalConsole.error(...args);
      capture("error", args);
    };

    return () => {
      console.log = originalConsole.log;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
    };
  }, [enabled]);

  if (!enabled) return null;

  const logsText = [
    `Debug state ${stringifyLogPart(safeState)}`,
    ...logs.map(log => `${log.timestamp} [${log.level}] ${log.message}`),
  ].join("\n");

  const handleCopyLogs = async () => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(logsText);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = logsText;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  };

  const handleDisableDebug = () => {
    try {
      localStorage.removeItem(DEBUG_STORAGE_KEY);
      const url = new URL(window.location.href);
      url.searchParams.delete("debug");
      window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    } catch {
      // TEMP DEBUG: remove after Supabase cloud-save issue is solved.
    }

    onMockPresenceChange(false);
    setIsOpen(false);
    setEnabled(false);
    setLogs([]);
  };

  const handleToggleMockPresence = () => {
    const nextEnabled = !mockPresenceEnabled;
    try {
      localStorage.setItem(MOCK_PRESENCE_STORAGE_KEY, String(nextEnabled));
    } catch {
      // Debug tooling must remain usable when storage is unavailable.
    }
    onMockPresenceChange(nextEnabled);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-3 z-[9999] rounded-full bg-black/80 px-3 py-2 font-mono text-[11px] font-bold text-white shadow-lg backdrop-blur-sm active:scale-95"
      >
        Debug
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-end bg-black/40 p-3 font-mono text-white backdrop-blur-[2px] sm:items-center sm:justify-center">
          <div className="max-h-[82vh] w-full overflow-hidden rounded-2xl border border-white/15 bg-black/90 shadow-2xl sm:max-w-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 p-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em]">Debug logs</p>
                <p className="mt-1 text-[10px] text-white/60">
                  TEMP DEBUG: remove after Supabase cloud-save issue is solved.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-white/15 px-2 py-1 text-[10px] text-white/80"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 border-b border-white/10 p-3 text-[10px] text-white/70">
              <div>Logged in: {String(safeState.isLoggedIn)}</div>
              <div>User ID: {safeState.sessionUserId ?? "null"}</div>
              <div>View: {safeState.currentView}</div>
              <div>Lists: {safeState.listsCount}</div>
            </div>

            <div className="max-h-[52vh] overflow-y-auto p-3 text-[10px] leading-relaxed">
              {logs.length === 0 ? (
                <p className="text-white/50">No logs captured yet.</p>
              ) : (
                logs.map(log => (
                  <div key={log.id} className="mb-2 break-words border-b border-white/5 pb-2">
                    <span className="text-white/45">{log.timestamp}</span>{" "}
                    <span className={log.level === "error" ? "text-red-300" : log.level === "warn" ? "text-yellow-300" : "text-emerald-300"}>
                      [{log.level}]
                    </span>{" "}
                    <span>{log.message}</span>
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-white/10 p-3">
              <button
                type="button"
                onClick={handleCopyLogs}
                className="rounded-full bg-white px-3 py-2 text-[10px] font-bold text-black"
              >
                Copy logs
              </button>
              <button
                type="button"
                onClick={() => setLogs([])}
                className="rounded-full border border-white/20 px-3 py-2 text-[10px] font-bold text-white"
              >
                Clear
              </button>
              <button
                type="button"
                aria-pressed={mockPresenceEnabled}
                onClick={handleToggleMockPresence}
                className="rounded-full border border-white/20 px-3 py-2 text-[10px] font-bold text-white active:scale-95"
              >
                Mocka presence: {mockPresenceEnabled ? "På" : "Av"}
              </button>
              <button
                type="button"
                onClick={handleDisableDebug}
                className="rounded-full border border-red-300/40 px-3 py-2 text-[10px] font-bold text-red-200"
              >
                Disable debug
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

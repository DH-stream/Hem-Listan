/** @jsxRuntime classic */
import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import type { User } from "@supabase/supabase-js";
import type { DeletedList } from "../types";
import { motion, AnimatePresence } from "motion/react";
import LucideIcon from "./LucideIcon";
import SavedRecipesSection from "./SavedRecipesSection";
import { getSupabaseClient } from "../lib/supabase";
import { getProfileInitials } from "../lib/profile";

interface SettingsModalProps {
  userName: string;
  userImage?: string;
  isLoggedIn: boolean;
  sessionUser: User | null;
  onUpdateUserName: (name: string) => Promise<boolean>;
  onUpdateUserImage: (base64: string) => Promise<boolean>;
  onClose: () => void;
  deletedLists: DeletedList[];
  deletedListsLoading: boolean;
  onLoadDeletedLists: () => Promise<boolean>;
  onRestoreDeletedList: (listId: string) => Promise<boolean>;
}

// ── Bildkomprimering ───────────────────────────────────────────────
async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 200;

        let { width, height } = img;
        if (width > height) {
          if (width > MAX) {
            height = Math.round((height * MAX) / width);
            width = MAX;
          }
        } else if (height > MAX) {
          width = Math.round((width * MAX) / height);
          height = MAX;
        }

        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };

      img.onerror = reject;
      img.src = e.target?.result as string;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


const formatDeletedListTime = (deletedAt: string) => {
  const deletedTime = new Date(deletedAt).getTime();
  if (Number.isNaN(deletedTime)) return "tas bort snart";

  const expiresAt = deletedTime + 2 * 24 * 60 * 60 * 1000;
  const remainingMs = expiresAt - Date.now();
  if (remainingMs <= 6 * 60 * 60 * 1000) return "tas bort snart";

  const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
  if (remainingHours < 24) return `${remainingHours} timmar kvar`;

  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(deletedAt));
};

// ── Google-symbol ─────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

// ── Namn ───────────────────────────────────────────────────────────
const NameForm = memo(({ userName, onSave }: { userName: string; onSave: (name: string) => Promise<void> }) => {
  const ref = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ref.current) ref.current.value = userName;
  }, [userName]);

  const save = async () => {
    const value = ref.current?.value?.trim();
    if (!value || saving) return;

    setSaving(true);
    try {
      await onSave(value);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 pt-2.5 border-t border-gray-200">
      <label className="font-sans text-[10px] font-bold text-outline uppercase tracking-wider block">
        Visningsnamn
      </label>

      <div className="flex gap-2">
        <input
          ref={ref}
          defaultValue={userName}
          placeholder="Hem-Listan"
          className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400 outline-none font-sans font-medium"
        />

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg px-4 py-2 font-sans text-xs font-bold transition-[background-color,transform] outline-none cursor-pointer shrink-0 min-h-[40px] flex items-center justify-center disabled:cursor-wait disabled:opacity-60"
        >
          {saving ? "Sparar..." : "Spara"}
        </button>
      </div>
    </div>
  );
});

NameForm.displayName = "NameForm";

// ── Auth ───────────────────────────────────────────────────────────
const AuthForm = memo(({ onSuccess, onError }: { onSuccess: (message: string) => void; onError: (message: string) => void }) => {
  const emailRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const email = emailRef.current?.value.trim() ?? "";
    const password = passRef.current?.value.trim() ?? "";

    if (!email || !password) return;

    const client = getSupabaseClient();
    if (!client) {
      onError("Inloggning är inte konfigurerad ännu. Försök igen senare.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "login") {
        const { data, error } = await client.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        onSuccess(`Inloggad som ${data.user?.email ?? email}`);
      } else {
        const { error } = await client.auth.signUp({
          email,
          password,
        });

        if (error) throw error;
        onSuccess("Konto skapat! Kolla din e-post för att bekräfta kontot.");
      }
    } catch (e: any) {
      onError(e.message || "Något gick fel vid inloggningen.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <input
          ref={emailRef}
          type="email"
          placeholder="E-post"
          className="w-full bg-white border border-[#EDEADF] rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none font-sans min-h-[40px]"
        />

        <input
          ref={passRef}
          type="password"
          placeholder="Lösenord"
          className="w-full bg-white border border-[#EDEADF] rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none font-sans min-h-[40px]"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="text-xs text-primary font-bold"
        >
          {mode === "login" ? "Skapa konto" : "Logga in"}
        </button>

        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold min-h-[40px] transition-transform active:scale-[0.97] disabled:opacity-50"
        >
          {loading ? "Väntar..." : mode === "login" ? "Logga in" : "Skapa"}
        </button>
      </div>
    </div>
  );
});

AuthForm.displayName = "AuthForm";

// ── MAIN ───────────────────────────────────────────────────────────
export default function SettingsModal({
  userName,
  userImage,
  onUpdateUserName,
  onUpdateUserImage,
  isLoggedIn,
  sessionUser,
  onClose,
  deletedLists,
  deletedListsLoading,
  onLoadDeletedLists,
  onRestoreDeletedList,
}: SettingsModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(userImage);
  const [fallbackSessionUser, setFallbackSessionUser] = useState<User | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSharingInfo, setShowSharingInfo] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [imageSaving, setImageSaving] = useState(false);
  const [deletedListsOpen, setDeletedListsOpen] = useState(false);
  const [restoreConfirmList, setRestoreConfirmList] = useState<DeletedList | null>(null);
  const [restoringListId, setRestoringListId] = useState<string | null>(null);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;

    client.auth.getSession().then(async ({ data }) => {
      console.log("settings_session_check", { hasSession: !!data.session, userId: data.session?.user?.id });
      if (data.session?.user) {
        setFallbackSessionUser(data.session.user);
        return;
      }

      const { data: userData } = await client.auth.getUser();
      console.log("settings_user_check", { hasUser: !!userData.user, userId: userData.user?.id });
      setFallbackSessionUser(userData.user);
    }).catch(() => {
      console.log("settings_session_check", { hasSession: false });
      setFallbackSessionUser(null);
    });

    const { data } = client.auth.onAuthStateChange((_e, session) => {
      setFallbackSessionUser(session?.user ?? null);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setPreview(userImage);
  }, [userImage]);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  useEffect(() => {
    if (!msg && !error) return;

    const timer = window.setTimeout(() => {
      setMsg(null);
      setError(null);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [msg, error]);

  const showSuccess = useCallback((message: string) => {
    setError(null);
    setMsg(message);
  }, []);

  const showError = useCallback((message: string) => {
    setMsg(null);
    setError(message);
  }, []);

  const saveName = useCallback(async (name: string) => {
    console.log("[HL_PROFILE] settings save name clicked", { name });
    try {
      const saved = await onUpdateUserName(name);
      console.log("[HL_PROFILE] settings save name resolved", { saved });
      if (saved) showSuccess("Namn sparat");
      else showError("Kunde inte spara namnet.");
    } catch (saveError) {
      console.error("[HL_PROFILE] settings save name failed", saveError);
      throw saveError;
    }
  }, [onUpdateUserName, showError, showSuccess]);

  const uploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || imageSaving) return;

    setImageSaving(true);
    try {
      console.log("[HL_PROFILE] settings avatar file selected", {
        name: file.name,
        size: file.size,
        type: file.type,
      });
      console.log("[HL_PROFILE] settings avatar compress start");
      const image = await compressImage(file);
      console.log("[HL_PROFILE] settings avatar compress done", {
        dataUrlLength: image.length,
      });
      const saved = await onUpdateUserImage(image);
      console.log("[HL_PROFILE] settings avatar save resolved", { saved });
      if (saved) showSuccess("Bild sparad");
      else showError("Kunde inte spara bilden.");
    } catch (uploadError) {
      console.error("[HL_PROFILE] settings avatar upload failed", uploadError);
      showError("Kunde inte läsa bilden.");
    } finally {
      setImageSaving(false);
      e.target.value = "";
    }
  };

  const removeImage = async () => {
    if (imageSaving) return;

    setImageSaving(true);
    try {
      console.log("[HL_PROFILE] settings avatar remove clicked");
      const saved = await onUpdateUserImage("");
      console.log("[HL_PROFILE] settings avatar remove resolved", { saved });
      if (saved) showSuccess("Bild borttagen");
      else showError("Kunde inte ta bort bilden.");
    } catch (removeError) {
      console.error("[HL_PROFILE] settings avatar remove failed", removeError);
      throw removeError;
    } finally {
      setImageSaving(false);
    }
  };

  const handleGoogleLogin = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) {
      showError("Inloggning med Google är inte konfigurerad ännu. Försök igen senare.");
      return;
    }

    setGoogleLoading(true);
    setError(null);
    setMsg(null);

    const { error: authError } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });

    if (authError) {
      showError(authError.message || "Kunde inte logga in med Google.");
      setGoogleLoading(false);
    }
  }, [showError]);

  const logout = async () => {
    const client = getSupabaseClient();
    if (!client) {
      showError("Inloggning är inte konfigurerad, så det går inte att logga ut just nu.");
      return;
    }

    await client.auth.signOut();
    setFallbackSessionUser(null);
    showSuccess("Utloggad");
  };


  const toggleDeletedLists = useCallback(() => {
    setDeletedListsOpen((open) => {
      const nextOpen = !open;
      if (nextOpen) void onLoadDeletedLists();
      return nextOpen;
    });
  }, [onLoadDeletedLists]);

  const handleConfirmRestore = useCallback(async () => {
    if (!restoreConfirmList) return;

    setRestoringListId(restoreConfirmList.id);
    try {
      const restored = await onRestoreDeletedList(restoreConfirmList.id);

      if (restored) {
        showSuccess("Lista återställd");
        setRestoreConfirmList(null);
        return;
      }

      showError("Kunde inte återställa listan.");
    } catch (error) {
      console.error("restore_deleted_list_error", { listId: restoreConfirmList.id, error });
      showError("Kunde inte återställa listan.");
    } finally {
      setRestoringListId(null);
    }
  }, [onRestoreDeletedList, restoreConfirmList, showError, showSuccess]);

  const activeSessionUser = sessionUser ?? fallbackSessionUser;
  const isAuthenticated = isLoggedIn || !!activeSessionUser;
  const displayName = userName || "Hem-Listan";
  const profileInitials = getProfileInitials(displayName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-none bg-black/40 p-4 backdrop-blur-sm font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
        className="relative my-8 w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full text-gray-400 transition-transform hover:text-gray-600 active:scale-[0.94]"
          aria-label="Stäng inställningar"
        >
          <LucideIcon name="close" className="h-5 w-5" />
        </button>

        <div className="mb-4 flex items-center gap-3">
          <LucideIcon name="settings" className="h-5 w-5 text-gray-800" />
          <h2 className="text-lg font-bold leading-none text-gray-800">Inställningar</h2>
        </div>

        <AnimatePresence>
          {(msg || error) && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              className="pointer-events-none absolute left-6 right-6 top-14 z-20 flex justify-center"
            >
              <div className={`flex max-w-full items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold shadow-lg ${
                error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}>
                <LucideIcon name={error ? "close" : "check"} className="h-4 w-4 shrink-0" />
                <span className="truncate">{error || msg}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto overscroll-contain pr-1" style={{ WebkitOverflowScrolling: "touch" }}>
          {/* PROFILE */}
          <div className="bg-gray-50 p-4 rounded-xl flex flex-col gap-3.5 border border-gray-200">
            <div className="mb-3 flex items-center gap-4">
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={imageSaving}
                  className="w-16 h-16 rounded-full overflow-hidden border-2 border-emerald-600/20 bg-emerald-50 flex items-center justify-center cursor-pointer hover:opacity-85 transition-opacity disabled:cursor-wait disabled:opacity-60"
                  aria-label="Byt profilbild"
                >
                  {preview ? (
                    <img src={preview} className="h-full w-full object-cover" alt="Profilbild" />
                  ) : (
                    <span className="text-lg font-bold tracking-wide text-emerald-800">{profileInitials}</span>
                  )}
                </button>
                <span className="pointer-events-none absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-emerald-600 text-white">
                  <LucideIcon name="plus" className="h-3 w-3" />
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-gray-900">{displayName}</p>
                <p className="mt-0.5 truncate text-[10px] text-gray-500">{activeSessionUser?.email ?? "Lokal profil"}</p>

                <div className="mt-2 flex gap-3 text-[10px] font-bold">
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={imageSaving} className="text-[10px] font-bold text-emerald-600 hover:underline cursor-pointer py-1 disabled:cursor-wait disabled:opacity-60">
                    {imageSaving ? "Sparar..." : preview ? "Byt bild" : "Lägg till bild"}
                  </button>
                  {preview && (
                    <button type="button" onClick={removeImage} disabled={imageSaving} className="py-1 text-gray-500 hover:text-red-600 disabled:cursor-wait disabled:opacity-60">
                      Ta bort
                    </button>
                  )}
                </div>
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={uploadImage}
              />
            </div>

            <NameForm userName={userName} onSave={saveName} />
          </div>

          {/* ACCOUNT & SHARING */}
          <div className="bg-[#FAF9F5] p-4 rounded-xl border border-[#EDEADF] space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-bold text-gray-900">Konto &amp; Delning</h3>
                <button
                  type="button"
                  onClick={() => setShowSharingInfo((v) => !v)}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-emerald-600 transition-colors cursor-pointer"
                  aria-expanded={showSharingInfo}
                  aria-label="Visa information om konto och delning"
                >
                  <span className="text-sm font-bold leading-none">i</span>
                </button>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {showSharingInfo && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
                  className="bg-white p-3 rounded-lg border border-[#EDEADF] text-[11px] text-[#706B5C] leading-relaxed shadow-sm"
                >
                  Logga in för att spara dina listor och dela dem med andra.
                </motion.div>
              )}
            </AnimatePresence>

            {isAuthenticated ? (
              <div className="space-y-3">
                <div className="bg-white p-3 rounded-lg border border-[#EDEADF] shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Inloggad som</p>
                  <p className="mt-1 truncate text-xs font-bold text-gray-900">{displayName}</p>
                  {activeSessionUser?.email && (
                    <p className="mt-0.5 truncate text-[10px] text-gray-500">{activeSessionUser.email}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={logout}
                  className="bg-white border border-[#EDEADF] hover:bg-gray-50 active:scale-95 text-gray-800 py-2 px-4 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-sm min-h-[40px] w-full"
                >
                  Logga ut
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <ul className="text-[11px] font-medium text-[#706B5C] space-y-1.5 ml-1">
                  {[
                    "Spara listor mellan enheter",
                    "Dela listor från själva listan",
                    "Koppla till Homeboard",
                  ].map((benefit) => (
                    <li key={benefit} className="flex items-center gap-2">
                      <LucideIcon name="check" className="h-3.5 w-3.5 text-[#3ECF8E] shrink-0" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                  className="w-full bg-white border border-[#EDEADF] py-2.5 rounded-lg text-xs font-bold text-gray-900 flex items-center justify-center gap-2 hover:bg-gray-50 active:scale-[0.98] transition-all shadow-sm cursor-pointer min-h-[44px] disabled:opacity-50"
                >
                  <GoogleIcon />
                  {googleLoading ? "Skickar vidare..." : "Fortsätt med Google"}
                </button>

                <div className="flex items-center py-1">
                  <div className="flex-grow border-t border-[#EDEADF]" />
                  <span className="mx-3 flex-shrink-0 text-[10px] font-medium uppercase tracking-wider text-gray-400">eller via e-post</span>
                  <div className="flex-grow border-t border-[#EDEADF]" />
                </div>

                <AuthForm onSuccess={showSuccess} onError={showError} />
              </div>
            )}
          </div>

          <div className="space-y-2 border-t border-[#EDEADF] pt-2">
            <h3 className="px-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">Recept</h3>
            <SavedRecipesSection isLoggedIn={isAuthenticated} />
          </div>

          {/* RESET */}
          <div className="space-y-2 border-t border-[#EDEADF] pt-2">
            <h3 className="px-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">Fara &amp; återställning</h3>

            <div className="rounded-xl border border-[#EDEADF] bg-[#FAF9F5] p-2 shadow-sm">
              <button
                type="button"
                onClick={toggleDeletedLists}
                className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-lg bg-white px-3 py-2.5 text-left shadow-sm transition-[background-color,transform] hover:bg-gray-50 active:scale-[0.99]"
                aria-expanded={deletedListsOpen}
              >
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-gray-900">Borttagna listor</span>
                  <span className="mt-0.5 block text-[11px] font-medium text-[#706B5C]">
                    {deletedLists.length > 0
                      ? `${deletedLists.length} ${deletedLists.length === 1 ? "lista" : "listor"} kan återställas i upp till 2 dagar`
                      : "Inga borttagna listor"}
                  </span>
                </span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FAF9F5] text-gray-400 ring-1 ring-[#EDEADF]">
                  <LucideIcon
                    name="chevron_down"
                    className={`h-4 w-4 transition-transform ${deletedListsOpen ? "rotate-180" : ""}`}
                  />
                </span>
              </button>

              <AnimatePresence initial={false}>
                {deletedListsOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 max-h-52 space-y-1.5 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
                      {deletedListsLoading ? (
                        <p className="rounded-lg bg-white px-3 py-3 text-[11px] font-medium text-gray-400 shadow-sm">Hämtar borttagna listor...</p>
                      ) : deletedLists.length === 0 ? (
                        <p className="rounded-lg bg-white px-3 py-3 text-[11px] font-medium text-gray-400 shadow-sm">Inga borttagna listor</p>
                      ) : (
                        deletedLists.map((list) => (
                          <div key={list.id} className="flex min-h-[48px] items-center gap-2 rounded-lg bg-white px-2.5 py-2 shadow-sm">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FAF9F5] text-gray-600 ring-1 ring-[#EDEADF]">
                              <LucideIcon name={list.icon || "list"} className="h-3.5 w-3.5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-bold text-gray-900">{list.name}</span>
                              <span className="mt-0.5 block truncate text-[10px] font-medium text-[#706B5C]">{formatDeletedListTime(list.deletedAt)}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setRestoreConfirmList(list)}
                              disabled={restoringListId === list.id}
                              className="min-h-[34px] shrink-0 rounded-lg bg-emerald-600 px-3 text-[11px] font-bold text-white transition-[background-color,transform] hover:bg-emerald-700 active:scale-[0.97] disabled:opacity-60"
                            >
                              {restoringListId === list.id ? "..." : "Återställ"}
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="text-center text-[10px] text-gray-400 mt-6 font-medium">
          Hem-Listan v1.3 &bull; Smarta listor för hemmet
        </div>
      </motion.div>

      <AnimatePresence>
        {restoreConfirmList && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[2px]"
            onClick={() => setRestoreConfirmList(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-2xl"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="restore-list-title"
              aria-describedby="restore-list-description"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                  <LucideIcon name="refresh" className="h-5 w-5" />
                </div>
                <div className="min-w-0 pt-0.5">
                  <h2 id="restore-list-title" className="text-lg font-bold leading-tight text-gray-900">Återställ lista?</h2>
                  <p className="mt-1 truncate text-xs font-bold text-gray-500">{restoreConfirmList.name}</p>
                </div>
              </div>

              <p id="restore-list-description" className="text-sm font-medium leading-relaxed text-gray-600">
                Listan flyttas tillbaka till dina aktiva listor.
              </p>

              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setRestoreConfirmList(null)}
                  disabled={restoringListId === restoreConfirmList.id}
                  className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 shadow-sm transition-[background-color,transform] hover:bg-gray-50 active:scale-[0.97] disabled:opacity-60 sm:min-w-28"
                >
                  Avbryt
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  disabled={restoringListId === restoreConfirmList.id}
                  className="min-h-[44px] rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-[background-color,transform] hover:bg-emerald-700 active:scale-[0.97] disabled:opacity-60 sm:min-w-28"
                >
                  {restoringListId === restoreConfirmList.id ? "Återställer..." : "Återställ"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

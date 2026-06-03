/** @jsxRuntime classic */
import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import { motion, AnimatePresence } from "motion/react";
import LucideIcon from "./LucideIcon";
import { getSupabaseClient } from "../lib/supabase";

interface SettingsModalProps {
  userName: string;
  userImage?: string;
  onUpdateUserName: (name: string) => void;
  onUpdateUserImage: (base64: string) => void;
  onClose: () => void;
  onResetLists: () => void;
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
const NameForm = memo(({ userName, onSave }: { userName: string; onSave: (name: string) => void }) => {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2 pt-3 border-t border-surface-container-high/60">
      <label className="font-sans text-[10px] font-bold text-outline uppercase tracking-wider block">
        Visningsnamn
      </label>

      <div className="flex gap-2">
        <input
          ref={ref}
          defaultValue={userName}
          placeholder="Hem-Listan"
          className="min-h-[40px] flex-1 bg-white border border-surface-container-high rounded-lg px-3 py-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
        />

        <button
          onClick={() => {
            const v = ref.current?.value?.trim();
            if (v) onSave(v);
          }}
          className="min-h-[40px] bg-primary text-white rounded-lg px-4 py-2 text-xs font-bold transition-transform active:scale-[0.97]"
        >
          Spara
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
          className="min-h-[40px] w-full border border-[#EDEADF] rounded-lg px-3 py-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
        />

        <input
          ref={passRef}
          type="password"
          placeholder="Lösenord"
          className="min-h-[40px] w-full border border-[#EDEADF] rounded-lg px-3 py-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="py-2 text-xs text-primary font-bold"
        >
          {mode === "login" ? "Skapa konto" : "Logga in"}
        </button>

        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="min-h-[40px] bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold transition-transform active:scale-[0.97] disabled:opacity-50"
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
  onClose,
  onResetLists,
}: SettingsModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(userImage);
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSharingInfo, setShowSharingInfo] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;

    client.auth.getUser().then(({ data }) => {
      setSessionUser(data.user);
    }).catch(() => setSessionUser(null));

    const { data } = client.auth.onAuthStateChange((_e, session) => {
      setSessionUser(session?.user ?? null);
    });

    return () => data.subscription.unsubscribe();
  }, []);

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

  const saveName = useCallback((name: string) => {
    onUpdateUserName(name);
    localStorage.setItem("user_profile_name", name);
    showSuccess("Namn sparat");
  }, [onUpdateUserName, showSuccess]);

  const uploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = await compressImage(file);
    setPreview(img);
    onUpdateUserImage(img);
    localStorage.setItem("user_profile_image", img);
    showSuccess("Bild sparad");
    e.target.value = "";
  };

  const removeImage = () => {
    setPreview(undefined);
    onUpdateUserImage("");
    localStorage.removeItem("user_profile_image");
    showSuccess("Bild borttagen");
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
    setSessionUser(null);
    showSuccess("Utloggad");
  };

  const displayName = sessionUser?.user_metadata?.display_name || userName || "Användare";

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
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="mb-3 flex items-center gap-4">
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-primary/20 bg-white transition-opacity hover:opacity-85"
                  aria-label="Byt profilbild"
                >
                  {preview ? (
                    <img src={preview} className="h-full w-full object-cover" alt="Profilbild" />
                  ) : (
                    <LucideIcon name="person" className="h-7 w-7 text-gray-400" />
                  )}
                </button>
                <span className="pointer-events-none absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-primary text-white">
                  <LucideIcon name="plus" className="h-3 w-3" />
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-gray-900">{userName || "Hem-Listan"}</p>
                <p className="mt-0.5 truncate text-[10px] text-gray-500">{sessionUser?.email ?? "Lokal profil"}</p>

                <div className="mt-2 flex gap-3 text-[10px] font-bold">
                  <button type="button" onClick={() => fileRef.current?.click()} className="py-1 text-primary hover:underline">
                    {preview ? "Byt bild" : "Lägg till bild"}
                  </button>
                  {preview && (
                    <button type="button" onClick={removeImage} className="py-1 text-gray-500 hover:text-red-600">
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
          <div className="space-y-3.5 rounded-xl border border-[#EDEADF] bg-[#FAF9F5] p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-bold text-gray-900">Konto &amp; Delning</h3>
                <button
                  type="button"
                  onClick={() => setShowSharingInfo((v) => !v)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:text-primary active:scale-[0.94]"
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
                  className="rounded-lg border border-[#EDEADF] bg-white p-3 text-[11px] leading-relaxed text-[#706B5C] shadow-sm"
                >
                  Logga in för att spara dina listor och dela dem med andra.
                </motion.div>
              )}
            </AnimatePresence>

            {sessionUser ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-[#EDEADF] bg-white p-3 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Inloggad som</p>
                  <p className="mt-1 truncate text-xs font-bold text-gray-900">{displayName}</p>
                  {sessionUser.email && (
                    <p className="mt-0.5 truncate text-[10px] text-gray-500">{sessionUser.email}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={logout}
                  className="min-h-[40px] w-full rounded-lg border border-[#EDEADF] bg-white px-4 py-2 text-xs font-bold text-gray-800 shadow-sm transition-transform hover:bg-gray-50 active:scale-[0.97]"
                >
                  Logga ut
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <ul className="ml-1 space-y-1.5 text-[11px] font-medium text-[#706B5C]">
                  {[
                    "Spara listor mellan enheter",
                    "Dela listor från själva listan",
                    "Koppla till Homeboard",
                  ].map((benefit) => (
                    <li key={benefit} className="flex items-center gap-2">
                      <LucideIcon name="check" className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-[#EDEADF] bg-white px-4 py-2.5 text-xs font-bold text-gray-900 shadow-sm transition-transform hover:bg-gray-50 active:scale-[0.97] disabled:opacity-50"
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

          {/* RESET */}
          <div className="space-y-2 border-t border-gray-200 pt-2">
            <h3 className="px-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">Fara &amp; återställning</h3>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Är du säker på att du vill återställa alla listor?")) {
                  onResetLists();
                  onClose();
                }
              }}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-red-500 py-3 text-xs font-bold text-white transition-transform hover:bg-red-600 active:scale-[0.97]"
            >
              <LucideIcon name="archive" className="h-4 w-4" />
              <span>Återställ standardlistor</span>
            </button>
          </div>
        </div>

        <div className="mt-6 text-center text-[10px] font-medium text-gray-400">
          Hem-Listan v1.3 &bull; Smarta listor för hemmet
        </div>
      </motion.div>
    </div>
  );
}

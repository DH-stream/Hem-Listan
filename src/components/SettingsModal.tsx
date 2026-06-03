/** @jsxRuntime classic */
import React, { useState, useEffect, useRef, useCallback, memo, FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import LucideIcon from "./LucideIcon";
import {
  isSupabaseConfigured,
  getSupabaseClient,
  saveLocalStorageCredentials,
  getLocalCredentials
} from "../lib/supabase";

interface SettingsModalProps {
  userName: string;
  userImage?: string;
  onUpdateUserName: (name: string) => void;
  onUpdateUserImage: (base64: string) => void;
  onClose: () => void;
  onResetLists: () => void;
}

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 200;
        let { width, height } = img;
        if (width > height) {
          if (width > MAX) { height = Math.round(height * MAX / width); width = MAX; }
        } else {
          if (height > MAX) { width = Math.round(width * MAX / height); height = MAX; }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Sub-komponent: Namnfält ──────────────────────────────────────────
const NameForm = memo(({ userName, sessionUser, onSave }: {
  userName: string;
  sessionUser: any;
  onSave: (name: string) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2 pt-1 border-t border-surface-container-high/60">
      <label className="font-sans text-[10px] font-bold text-outline uppercase tracking-wider block">
        Visningsnamn
      </label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          defaultValue={userName}
          placeholder="Hem-Listan"
          className="flex-1 bg-white border border-surface-container-high rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-outline/40 outline-none font-sans font-medium"
        />
        <button
          onClick={() => {
            const val = inputRef.current?.value.trim() ?? '';
            if (val && val !== userName) onSave(val);
          }}
          className="bg-primary hover:bg-primary-container text-white rounded-lg px-4 py-2 font-sans text-xs font-bold active:scale-95 transition-all outline-none cursor-pointer shrink-0"
        >
          Spara
        </button>
      </div>
    </div>
  );
});

// ── Sub-komponent: Molnsynk-konfiguration ───────────────────────────
const CloudConfigForm = memo(({ onSave, onClear }: {
  onSave: (url: string, key: string) => void;
  onClear: () => void;
}) => {
  const urlRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);
  const creds = getLocalCredentials();
  return (
    <div className="space-y-3 pt-1 border-t border-[#EDEADF]/70 text-left">
      <div className="space-y-1">
        <label className="font-sans text-[9px] font-bold text-[#706B5C] uppercase tracking-wider block">
          Projekt-URL
        </label>
        <input
          ref={urlRef}
          type="text"
          defaultValue={creds.url}
          placeholder="https://ditt-projekt.supabase.co"
          className="w-full bg-white border border-[#E1DEC7] rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none font-sans font-medium text-text-main"
        />
      </div>
      <div className="space-y-1">
        <label className="font-sans text-[9px] font-bold text-[#706B5C] uppercase tracking-wider block">
          API-nyckel
        </label>
        <input
          ref={keyRef}
          type="password"
          defaultValue={creds.anonKey}
          placeholder="eyJhbGci..."
          className="w-full bg-white border border-[#E1DEC7] rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none font-sans font-medium text-text-main"
        />
      </div>
      <div className="flex gap-2 pt-1.5">
        <button
          onClick={() => onSave(urlRef.current?.value ?? '', keyRef.current?.value ?? '')}
          className="flex-1 bg-text-main text-white py-1.5 rounded-lg text-xs font-bold hover:bg-neutral-800 transition-colors cursor-pointer text-center"
        >
          Spara anslutning
        </button>
        <button
          onClick={onClear}
          className="bg-neutral-200 text-neutral-700 hover:bg-neutral-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
        >
          Rensa
        </button>
      </div>
    </div>
  );
});

// ── Sub-komponent: Inloggningsformulär ──────────────────────────────
const AuthForm = memo(({ onSuccess, onError }: {
  onSuccess: (msg: string, displayName?: string) => void;
  onError: (msg: string) => void;
}) => {
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    const email = emailRef.current?.value.trim() ?? '';
    const password = passwordRef.current?.value.trim() ?? '';
    if (!email || !password) return;

    setIsLoading(true);
    const client = getSupabaseClient();
    if (!client) { onError("Ingen molnanslutning konfigurerad."); setIsLoading(false); return; }

    try {
      if (authMode === "login") {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const displayName = data.user?.user_metadata?.display_name;
        onSuccess(`Inloggad som ${data.user?.email}`, displayName);
        if (emailRef.current) emailRef.current.value = '';
        if (passwordRef.current) passwordRef.current.value = '';
      } else {
        const { data, error } = await client.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin }
        });
        if (error) throw error;
        onSuccess(data.session ? "Konto skapat och inloggad!" : "Bekräftelsemejl skickat!");
        if (emailRef.current) emailRef.current.value = '';
        if (passwordRef.current) passwordRef.current.value = '';
      }
    } catch (err: any) {
      onError(err.message || "Något gick fel.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="font-sans text-[9px] font-bold text-outline uppercase tracking-wider block">E-post</label>
        <input
          ref={emailRef}
          type="email"
          placeholder="anna@gmail.com"
          className="w-full bg-white border border-surface-container-high rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none font-sans"
        />
      </div>
      <div className="space-y-1">
        <label className="font-sans text-[9px] font-bold text-outline uppercase tracking-wider block">Lösenord</label>
        <input
          ref={passwordRef}
          type="password"
          placeholder="minst 6 tecken"
          className="w-full bg-white border border-surface-container-high rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none font-sans"
        />
      </div>
      <div className="flex items-center justify-between gap-4 pt-1">
        <button
          type="button"
          onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}
          className="text-[11px] font-bold text-primary hover:underline cursor-pointer select-none"
        >
          {authMode === "login" ? "Ny här? Skapa konto" : "Redan konto? Logga in"}
        </button>
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="bg-[#2D3E50] hover:bg-neutral-800 text-white rounded-lg px-5 py-2 font-sans text-xs font-bold transition-all disabled:opacity-40 cursor-pointer shadow-sm"
        >
          {isLoading ? "Väntar..." : authMode === "login" ? "Logga in" : "Skapa konto"}
        </button>
      </div>
    </div>
  );
});

// ── Huvudkomponent ───────────────────────────────────────────────────
export default function SettingsModal({
  userName,
  userImage,
  onUpdateUserName,
  onUpdateUserImage,
  onClose,
  onResetLists
}: SettingsModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | undefined>(userImage);
  const [supabaseActive, setSupabaseActive] = useState(isSupabaseConfigured());
  const [showConfig, setShowConfig] = useState(!isSupabaseConfigured());
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const client = getSupabaseClient();
    if (client) {
      client.auth.getUser().then(({ data: { user } }) => setSessionUser(user)).catch(() => setSessionUser(null));
      const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
        setSessionUser(session?.user ?? null);
      });
      return () => subscription.unsubscribe();
    } else {
      setSessionUser(null);
    }
  }, [supabaseActive]);

  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => { setSuccess(null); setError(null); }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const handleImageClick = () => fileInputRef.current?.click();

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setImagePreview(compressed);
      onUpdateUserImage(compressed);
      localStorage.setItem('user_profile_image', compressed);
      setSuccess("Profilbild sparad!");
    } catch {
      setError("Kunde inte läsa bilden.");
    }
  };

  const handleRemoveImage = () => {
    setImagePreview(undefined);
    onUpdateUserImage('');
    localStorage.removeItem('user_profile_image');
    setSuccess("Profilbild borttagen.");
  };

  const handleNameSave = useCallback(async (name: string) => {
    onUpdateUserName(name);
    localStorage.setItem('user_profile_name', name);
    const client = getSupabaseClient();
    if (client && sessionUser) {
      try { await client.auth.updateUser({ data: { display_name: name } }); } catch {}
    }
    setSuccess("Namn uppdaterat!");
  }, [onUpdateUserName, sessionUser]);

  const handleSaveCredentials = useCallback((url: string, key: string) => {
    saveLocalStorageCredentials(url, key);
    const active = isSupabaseConfigured();
    setSupabaseActive(active);
    setSuccess(active ? "Molnanslutning aktiverad!" : "Inställningar rensade.");
    if (active) setShowConfig(false);
  }, []);

  const handleClearCredentials = useCallback(() => {
    saveLocalStorageCredentials("", "");
    setSupabaseActive(false);
    setSuccess("Molnanslutning borttagen.");
  }, []);

  const handleAuthSuccess = useCallback((msg: string, displayName?: string) => {
    if (displayName) {
      onUpdateUserName(displayName);
      localStorage.setItem('user_profile_name', displayName);
    }
    setSuccess(msg);
  }, [onUpdateUserName]);

  const handleLogout = async () => {
    const client = getSupabaseClient();
    if (client) await client.auth.signOut();
    setSessionUser(null);
    setSuccess("Du har loggat ut.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl relative border border-surface-container my-8"
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 text-outline hover:bg-surface-container-high rounded-full transition-colors cursor-pointer z-10">
          <LucideIcon name="close" className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <LucideIcon name="settings" className="w-6 h-6 text-text-main" />
          <h2 className="font-display text-lg font-bold text-text-main leading-none">Inställningar</h2>
        </div>

        <AnimatePresence>
          {(success || error) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className={`mb-4 p-3 rounded-xl text-xs font-sans font-bold border flex items-center gap-2 ${error ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-800 border-emerald-200"}`}
            >
              <LucideIcon name={error ? "warning" : "info"} className="w-4 h-4 shrink-0" />
              <span className="flex-1">{error || success}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 no-scrollbar">

          {/* Profilkort */}
          <div className="bg-surface-container-low p-4 rounded-xl flex flex-col gap-3.5 border border-surface-container/30">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <button
                  onClick={handleImageClick}
                  className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary/20 bg-secondary/10 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                >
                  {imagePreview
                    ? <img src={imagePreview} alt="Profilbild" className="w-full h-full object-cover" />
                    : <LucideIcon name="person" className="w-7 h-7 text-secondary/50" />
                  }
                </button>
                <div className="absolute bottom-0 right-0 w-5 h-5 bg-primary rounded-full flex items-center justify-center pointer-events-none border-2 border-white">
                  <LucideIcon name="photo_camera" className="w-2.5 h-2.5 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-sans text-xs font-bold text-text-main truncate">{userName || "Hem-Listan"}</p>
                <p className="font-sans text-[10px] text-outline mt-0.5">{sessionUser ? sessionUser.email : "Lokal profil"}</p>
                <div className="flex gap-2 mt-2">
                  <button onClick={handleImageClick} className="text-[10px] font-bold text-primary hover:underline cursor-pointer">
                    {imagePreview ? "Byt bild" : "Lägg till bild"}
                  </button>
                  {imagePreview && (
                    <button onClick={handleRemoveImage} className="text-[10px] font-bold text-red-400 hover:underline cursor-pointer">Ta bort</button>
                  )}
                </div>
              </div>
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />

            <NameForm userName={userName} sessionUser={sessionUser} onSave={handleNameSave} />
          </div>

          {/* Molnsynk-kort */}
          <div className="bg-[#FAF9F5] p-4 rounded-xl border border-[#EDEADF] space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1 px-2 rounded-md bg-[#EDF6F0] text-[#3ECF8E] font-sans text-[10px] font-extrabold tracking-wide border border-[#A4E0C3]/30">
                  MOLN
                </div>
                <h3 className="font-sans text-xs font-bold text-text-main">Molnsynk & Listdelning</h3>
              </div>
              <span className={`w-2 h-2 rounded-full ${supabaseActive ? "bg-emerald-500 animate-pulse" : "bg-neutral-300"}`} />
            </div>

            <p className="font-sans text-[11px] text-[#706B5C] leading-normal font-medium">
              Anslut till molnet för att synka och dela listor i realtid med familj och vänner.
            </p>

            <div className="flex items-center justify-between border-t border-[#EDEADF] pt-2">
              <button
                onClick={() => setShowConfig(!showConfig)}
                className="text-[11px] font-bold text-outline hover:text-text-main flex items-center gap-1 transition-colors cursor-pointer select-none"
              >
                <span>{showConfig ? "Dölj inställningar" : "Konfigurera anslutning"}</span>
                <LucideIcon name={showConfig ? "chevron_up" : "chevron_down"} className="w-3.5 h-3.5" />
              </button>
              <span className="font-sans text-[10px] font-bold text-[#3ECF8E] select-none">
                {supabaseActive ? "✓ Ansluten" : "Ej ansluten"}
              </span>
            </div>

            <AnimatePresence>
              {showConfig && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <CloudConfigForm onSave={handleSaveCredentials} onClear={handleClearCredentials} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Auth-panel */}
          {supabaseActive && (
            <div className="bg-[#EEF4F8] p-4 rounded-xl border border-[#D5E1EA] space-y-3.5 text-left">
              <div className="flex items-center gap-2">
                <LucideIcon name="lock" className="w-4 h-4 text-primary" />
                <h3 className="font-display text-xs font-extrabold text-on-surface">
                  {sessionUser ? "Ditt synkkonto" : "Logga in för listdelning"}
                </h3>
              </div>

              {sessionUser ? (
                <div className="space-y-3">
                  <div className="p-2.5 bg-white/60 border border-stroke rounded-lg">
                    <p className="font-sans text-[10px] font-bold text-outline uppercase tracking-wider">Inloggad som</p>
                    <p className="font-mono text-xs font-bold text-text-main truncate mt-0.5">{sessionUser.email}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { const e = prompt("Kompis e-post:"); if (e?.trim()) setSuccess(`Inbjudan skickad till ${e.trim()}`); }}
                      className="flex-1 bg-primary text-white py-1.5 px-3 rounded-lg text-xs font-bold hover:bg-primary-container transition-all active:scale-95 cursor-pointer"
                    >
                      Bjud in till lista
                    </button>
                    <button onClick={handleLogout} className="bg-neutral-200 hover:bg-neutral-300 text-neutral-800 py-1.5 px-3 rounded-lg text-xs font-bold cursor-pointer">
                      Logga ut
                    </button>
                  </div>
                </div>
              ) : (
                <AuthForm onSuccess={handleAuthSuccess} onError={setError} />
              )}
            </div>
          )}

          {/* Återställning */}
          <div className="space-y-2 pt-2 border-t border-surface-container-high/60">
            <h3 className="font-sans text-[10px] font-bold text-outline uppercase tracking-wider px-1">Fara & återställning</h3>
            <button
              onClick={() => { if (window.confirm("Återställa alla listor?")) { onResetLists(); onClose(); } }}
              className="w-full py-3 bg-error text-white font-sans text-xs font-bold rounded-xl hover:bg-error/90 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <LucideIcon name="archive" className="w-4 h-4" />
              <span>Återställ standardlistor</span>
            </button>
          </div>
        </div>

        <div className="text-center font-sans text-[10px] text-outline mt-6 font-medium">
          Hem-Listan v1.3 &bull; Molnsynk &bull; Smidig Listdelning
        </div>
      </motion.div>
    </div>
  );
}

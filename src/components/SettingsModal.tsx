import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase"; // eller din path

// ── DESIGN TOKENS (Efterliknar src/data/tokens.js för inline/CSS-hantering) ────────────────
const TOKENS = {
  colors: {
    primary: "#059669",        // Smaragdgrön profilfärg
    primaryContainer: "#047857",
    surface: "#ffffff",
    surfaceContainerLow: "#f9fafb",
    surfaceContainerHigh: "#f3f4f6",
    textMain: "#111827",
    textSecondary: "#4b5563",
    outline: "#9ca3af",
    error: "#ef4444",
    brandApple: "#000000",
    brandGoogle: "#ffffff",
    creamBg: "#FAF9F5",
    creamBorder: "#EDEADF"
  },
  radius: {
    lg: "12px",
    xl: "16px",
    full: "9999px"
  }
};

// ── INTERNA INLINE SVGs (Optimerar bort lucide-react för snabbare PWA laddtid) ──────────────
const InlineIcon = memo(({ name, className = "w-5 h-5" }) => {
  const svgs = {
    close: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    settings: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    warning: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    info: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    person: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    photo_camera: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    check_circle: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    share: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 10.742l4.636-2.318a3 3 0 11.45 1.182L9.135 11.93a3 3 0 11-.45-1.182z" />
      </svg>
    ),
    check: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
    archive: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    apple: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C12 2 11.96 4.6 14.15 6.38C14.15 6.38 15.63 7.82 17.58 7.64C17.58 7.64 17.65 4.88 15.5 3.19C15.5 3.19 14.15 1.84 12 2ZM11.66 8.35C9.43 8.35 8.04 9.68 6.74 9.68C5.44 9.68 3 11.9 3 15.65C3 19.39 5.37 23 7.54 23C9.72 23 10.38 21.6 12 21.6C13.62 21.6 14.53 23 16.46 23C18.39 23 21 19.66 21 15.65C21 14.7 20.73 13.88 20.35 13.23C19.82 12.35 18.23 10.23 15.5 10.23C13.25 10.23 12.34 11.45 11.66 11.45C10.98 11.45 10.35 10.23 8.87 10.23C8.42 10.23 8.05 10.26 7.74 10.33C8.25 9.77 9.06 8.92 10.31 8.5C10.74 8.36 11.2 8.35 11.66 8.35Z" />
      </svg>
    ),
    google: (
      <svg className={className} viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
    )
  };
  return svgs[name] || null;
});




// --- MOCK SUPABASE FÖR INTERAKTIV FÖRHANDSGRANSKNING ---
let globalSessionUser = null;
let authListeners = [];
const getSupabaseClient = () => ({
  auth: {
    getUser: async () => ({ data: { user: globalSessionUser } }),
    onAuthStateChange: (cb) => {
      authListeners.push(cb);
      cb("INITIAL", { user: globalSessionUser });
      return { data: { subscription: { unsubscribe: () => { authListeners = authListeners.filter(l => l !== cb) } } } };
    },
    signInWithPassword: async ({ email }) => {
      return new Promise(resolve => setTimeout(() => {
        globalSessionUser = { email, user_metadata: { display_name: "Anna Andersson" } };
        authListeners.forEach(cb => cb("SIGNED_IN", { user: globalSessionUser }));
        resolve({ data: { user: globalSessionUser }, error: null });
      }, 500)); // Snabbare svarstid för skarp känsla
    },
    signUp: async ({ email }) => {
      return new Promise(resolve => setTimeout(() => {
        globalSessionUser = { email, user_metadata: { display_name: "Ny Användare" } };
        authListeners.forEach(cb => cb("SIGNED_IN", { user: globalSessionUser }));
        resolve({ data: { session: true }, error: null });
      }, 500));
    },
    signOut: async () => {
      globalSessionUser = null;
      authListeners.forEach(cb => cb("SIGNED_OUT", { user: null }));
    }
  }
});

// ── OPTIMERAD: Namnfält (med minimerade re-renders) ────────────────────────
const NameForm = memo(({ userName, onSave }) => {
  const inputRef = useRef(null);

  const handleSave = useCallback(() => {
    const val = inputRef.current?.value.trim() ?? '';
    if (val && val !== userName) {
      onSave(val);
    }
  }, [userName, onSave]);

  return (
    <div className="space-y-2 pt-2.5 border-t border-gray-200">
      <label className="font-sans text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
        Visningsnamn
      </label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          defaultValue={userName}
          placeholder="Hem-Listan"
          className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400 outline-none font-sans font-medium"
        />
        <button
          onClick={handleSave}
          className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg px-4 py-2 font-sans text-xs font-bold transition-all outline-none cursor-pointer shrink-0 min-h-[40px] flex items-center justify-center"
        >
          Spara
        </button>
      </div>
    </div>
  );
});

// ── OPTIMERAD: Inloggning/Registrering (Minimal rendering-overhead) ────────
const AuthForm = memo(({ onSuccess, onError }) => {
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const [authMode, setAuthMode] = useState("login");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = useCallback(async () => {
    const email = emailRef.current?.value.trim() ?? '';
    const password = passwordRef.current?.value.trim() ?? '';
    if (!email || !password) return;

    setIsLoading(true);
    const client = getSupabaseClient();

    try {
      if (authMode === "login") {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const displayName = data.user?.user_metadata?.display_name;
        onSuccess(`Inloggad som ${data.user?.email}`, displayName);
      } else {
        const { data, error } = await client.auth.signUp({ email, password });
        if (error) throw error;
        onSuccess("Konto skapat och inloggad!");
      }
    } catch (err) {
      onError(err.message || "Något gick fel.");
    } finally {
      setIsLoading(false);
    }
  }, [authMode, onSuccess, onError]);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <input
          ref={emailRef}
          type="email"
          placeholder="E-postadress"
          className="w-full bg-white border border-[#EDEADF] rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none font-sans min-h-[40px]"
        />
        <input
          ref={passwordRef}
          type="password"
          placeholder="Lösenord (minst 6 tecken)"
          className="w-full bg-white border border-[#EDEADF] rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 outline-none font-sans min-h-[40px]"
        />
      </div>
      <button
        onClick={handleSubmit}
        disabled={isLoading}
        className="w-full bg-[#2D3E50] hover:bg-slate-800 active:scale-[0.98] text-white rounded-lg px-5 py-2.5 font-sans text-xs font-bold transition-all disabled:opacity-40 cursor-pointer shadow-sm min-h-[44px]"
      >
        {isLoading ? "Väntar..." : authMode === "login" ? "Logga in" : "Skapa konto"}
      </button>
      <div className="text-center pt-1">
        <button
          type="button"
          onClick={() => setAuthMode(m => m === "login" ? "signup" : "login")}
          className="text-[11px] font-bold text-emerald-600 hover:underline cursor-pointer select-none py-1.5 inline-block"
        >
          {authMode === "login" ? "Ny här? Skapa konto" : "Redan konto? Logga in"}
        </button>
      </div>
    </div>
  );
});

// ── SettingsModal ───────────────────────────────────────────────────
function SettingsModal({
  userName,
  userImage,
  onUpdateUserName,
  onUpdateUserImage,
  onClose,
  onResetLists
}) {
  const [sessionUser, setSessionUser] = useState(null);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [showSharingInfo, setShowSharingInfo] = useState(false);


  // Synka sessionsdata
  useEffect(() => {
    const client = getSupabaseClient();
    client.auth.getUser().then(({ data: { user } }) => setSessionUser(user)).catch(() => setSessionUser(null));
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      setSessionUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Automatisk rensning av notifikationer
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => { setSuccess(null); setError(null); }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const handleNameSave = useCallback(async (name) => {
    onUpdateUserName(name);
    setSuccess("Namn uppdaterat!");
  }, [onUpdateUserName]);

  const handleAuthSuccess = useCallback((msg, displayName) => {
    if (displayName) onUpdateUserName(displayName);
    setSuccess(msg);
  }, [onUpdateUserName]);

  const handleLogout = useCallback(async () => {
    const client = getSupabaseClient();
    await client.auth.signOut();
    setSuccess("Du har loggat ut.");
  }, []);

  const handleGoogleLogin = useCallback(async () => {
    setError(null);
    setSuccess(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) {
      setError(error.message || "Kunde inte logga in med Google.");
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        style={{ borderRadius: TOKENS.radius.xl }}
        className="w-full max-w-md bg-white p-6 shadow-2xl relative border border-gray-100 my-8 will-change-transform"
      >
        {/* Stängknapp med utökat tryckområde för mobil (44x44px) */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 w-11 h-11 flex items-center justify-center text-gray-400 hover:text-gray-600 active:scale-90 transition-transform rounded-full cursor-pointer z-10"
        >
          <InlineIcon name="close" className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <InlineIcon name="settings" className="w-5 h-5 text-gray-800" />
          <h2 className="text-lg font-bold text-gray-800 leading-none">Inställningar</h2>
        </div>

        {/* Notifikationsbanner */}
        <AnimatePresence mode="popLayout">
          {(success || error) && (
            <motion.div
              initial={{ height: 0, opacity: 0, y: -10 }}
              animate={{ height: "auto", opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className={`mb-4 p-3 rounded-xl text-xs font-bold border flex items-center gap-2 will-change-transform ${error ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-800 border-emerald-200"
                }`}
            >
              <InlineIcon name={error ? "warning" : "info"} className="w-4 h-4 shrink-0" />
              <span className="flex-1">{error || success}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scrollbar-container med momentum-scroll för mobil */}
        <div
          className="space-y-4 max-h-[65vh] overflow-y-auto pr-1"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {/* Profilkort */}
          <div className="bg-gray-50 p-4 rounded-xl flex flex-col gap-3.5 border border-gray-200">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <button
                  className="w-16 h-16 rounded-full overflow-hidden border-2 border-emerald-600/20 bg-gray-200 flex items-center justify-center cursor-pointer hover:opacity-85 transition-opacity"
                >
                  <InlineIcon name="person" className="w-7 h-7 text-gray-400" />
                </button>
                <div className="absolute bottom-0 right-0 w-5 h-5 bg-emerald-600 rounded-full flex items-center justify-center pointer-events-none border-2 border-white">
                  <InlineIcon name="photo_camera" className="w-2.5 h-2.5 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-900 truncate">{userName || "Hem-Listan"}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{sessionUser ? sessionUser.email : "Lokal profil"}</p>
                <div className="flex gap-2 mt-2">
                  <button className="text-[10px] font-bold text-emerald-600 hover:underline cursor-pointer py-1">
                    Lägg till bild
                  </button>
                </div>
              </div>
            </div>

            <NameForm userName={userName} onSave={handleNameSave} />
          </div>

          {/* Sektion: Konto & Delning */}
          <div className="bg-[#FAF9F5] p-4 rounded-xl border border-[#EDEADF] space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-bold text-gray-900">Konto & Delning</h3>
                {/* 44x44px touch target */}
                <button
                  onClick={() => setShowSharingInfo(v => !v)}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-emerald-600 transition-colors cursor-pointer"
                  title="Information om delning"
                >
                  <InlineIcon name="info" className="w-4 h-4" />
                </button>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {showSharingInfo && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="bg-white p-3 rounded-lg border border-[#EDEADF] text-[11px] text-[#706B5C] mb-3 leading-relaxed space-y-2 shadow-sm">
                    <p>Den här funktionen låter dig dela dina inköpslistor med andra personer, som vänner eller familj. Alla som får tillgång kan se och redigera listorna tillsammans i realtid.</p>
                    <p>Den gör också att du kan använda dina listor på flera enheter, samt koppla dem till HomeBoard för en samlad översikt.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {sessionUser ? (
              // ── Loggat In ──
              <div className="space-y-3">
                <div className="bg-white p-3 rounded-lg border border-[#EDEADF] flex justify-between items-center shadow-sm">
                  <div>
                    <p className="text-xs font-bold text-gray-900 truncate max-w-[150px]">
                      {sessionUser.user_metadata?.display_name || userName || "Användare"}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{sessionUser.email}</p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-[#EDF6F0] px-2 py-1 rounded-md border border-[#A4E0C3]/30 text-[#3ECF8E]">
                    <InlineIcon name="check_circle" className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold">Delning aktiv</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => { setSuccess("Inbjudan skickad!"); }}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5 min-h-[40px]"
                  >
                    <InlineIcon name="share" className="w-4 h-4" />
                    Dela lista
                  </button>
                  <button
                    onClick={handleLogout}
                    className="bg-white border border-[#EDEADF] hover:bg-gray-50 active:scale-95 text-gray-800 py-2 px-4 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-sm min-h-[40px]"
                  >
                    Logga ut
                  </button>
                </div>
              </div>
            ) : (
              // ── Loggat Ut ──
              <div className="space-y-4">
                <ul className="text-[11px] font-medium text-[#706B5C] space-y-1.5 ml-1">
                  <li className="flex items-center gap-2">
                    <InlineIcon name="check" className="w-3.5 h-3.5 text-[#3ECF8E] shrink-0" />
                    Dela inköpslistor med vänner eller familj
                  </li>
                  <li className="flex items-center gap-2">
                    <InlineIcon name="check" className="w-3.5 h-3.5 text-[#3ECF8E] shrink-0" />
                    Använd samma listor på flera enheter
                  </li>
                  <li className="flex items-center gap-2">
                    <InlineIcon name="check" className="w-3.5 h-3.5 text-[#3ECF8E] shrink-0" />
                    Koppla listor till HomeBoard
                  </li>
                </ul>

                <div className="space-y-2">
                  <button className="w-full bg-white border border-[#EDEADF] py-2.5 rounded-lg text-xs font-bold text-gray-900 flex items-center justify-center gap-2 hover:bg-gray-50 active:scale-[0.98] transition-all shadow-sm cursor-pointer min-h-[44px]">
                    <InlineIcon name="google" className="w-4 h-4" />
                    Fortsätt med Google
                  </button>
                </div>

                <div className="relative flex items-center py-1">
                  <div className="flex-grow border-t border-[#EDEADF]"></div>
                  <span className="flex-shrink-0 mx-3 text-[10px] text-gray-400 font-medium uppercase tracking-wider">eller via E-post</span>
                  <div className="flex-grow border-t border-[#EDEADF]"></div>
                </div>

                <AuthForm onSuccess={handleAuthSuccess} onError={setError} />
              </div>
            )}
          </div>

          {/* Återställning */}
          <div className="space-y-2 pt-2 border-t border-gray-200">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-1">Fara & återställning</h3>
            <button
              onClick={() => { if (window.confirm("Är du säker på att du vill återställa alla listor?")) { onResetLists(); onClose(); } }}
              className="w-full py-3 bg-red-500 active:scale-95 text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm min-h-[44px]"
            >
              <InlineIcon name="archive" className="w-4 h-4" />
              <span>Återställ standardlistor</span>
            </button>
          </div>
        </div>

        <div className="text-center text-[10px] text-gray-400 mt-6 font-medium">
          Hem-Listan v1.3 &bull; Alltid Synkat
        </div>
      </motion.div>
    </div>
  );
}

// ── Wrapper för Preview ──────────────────────────────────────────────
export default function App() {
  const [isOpen, setIsOpen] = useState(true);
  const [userName, setUserName] = useState("Hem-Listan");

  return (
    <div className="min-h-screen bg-neutral-200 flex items-center justify-center p-4" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")' }}>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-emerald-600 active:scale-95 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-emerald-700 transition-all min-h-[48px]"
        >
          Öppna Inställningar
        </button>
      )}

      <AnimatePresence>
        {isOpen && (
          <SettingsModal
            userName={userName}
            onUpdateUserName={setUserName}
            onClose={() => setIsOpen(false)}
            onResetLists={() => alert("Listor återställda!")}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

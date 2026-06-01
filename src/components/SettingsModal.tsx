/** @jsxRuntime classic */
import React, { useState, useEffect, FormEvent } from "react";
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
  onUpdateUserName: (name: string) => void;
  onClose: () => void;
  onResetLists: () => void;
}

export default function SettingsModal({
  userName,
  onUpdateUserName,
  onClose,
  onResetLists
}: SettingsModalProps) {
  const [tempName, setTempName] = useState(userName);
  
  // Supabase states
  const [supabaseActive, setSupabaseActive] = useState(isSupabaseConfigured());
  const [localCreds, setLocalCreds] = useState(getLocalCredentials());
  const [inputUrl, setInputUrl] = useState(localCreds.url);
  const [inputKey, setInputKey] = useState(localCreds.anonKey);
  const [showConfig, setShowConfig] = useState(!isSupabaseConfigured());

  // Supabase Auth and Loader states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [sessionUser, setSessionUser] = useState<any>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync session user at mount or config changes
  useEffect(() => {
    const client = getSupabaseClient();
    if (client) {
      client.auth.getUser().then(({ data: { user } }) => {
        setSessionUser(user);
      }).catch(() => {
        setSessionUser(null);
      });

      const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
        setSessionUser(session?.user ?? null);
      });

      return () => {
        subscription.unsubscribe();
      };
    } else {
      setSessionUser(null);
    }
  }, [supabaseActive]);

  // Autoclear notifications
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const handleNameSave = (e: FormEvent) => {
    e.preventDefault();
    onUpdateUserName(tempName.trim());
    setSuccess("Profilnamnet uppdaterades!");
  };

  const handleSaveCredentials = (e: FormEvent) => {
    e.preventDefault();
    saveLocalStorageCredentials(inputUrl, inputKey);
    const active = isSupabaseConfigured();
    setSupabaseActive(active);
    setLocalCreds(getLocalCredentials());
    
    if (active) {
      setSuccess("Supabase-anslutning aktiverad!");
      setShowConfig(false);
    } else {
      setSuccess("Anpassade Supabase-inställningar rensade.");
    }
  };

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    const client = getSupabaseClient();
    if (!client) {
      setError("Det går inte att starta Supabase. Kontrollera dina anslutningsuppgifter.");
      setIsLoading(false);
      return;
    }

    try {
      if (authMode === "login") {
        const { data, error: authErr } = await client.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim()
        });
        if (authErr) throw authErr;
        setSuccess(`Hej återigen! Du är nu inloggad som ${data.user?.email}`);
        setEmail("");
        setPassword("");
      } else {
        const { data, error: authErr } = await client.auth.signUp({
          email: email.trim(),
          password: password.trim(),
          options: {
            emailRedirectTo: window.location.origin
          }
        });
        if (authErr) throw authErr;
        
        // Supabase auto-logins for some settings, or awaits validation link
        if (data.session) {
          setSuccess("Konto skapat och inloggningen klar!");
        } else {
          setSuccess("Konto registrerat! Ett bekräftelsemejl har skickats till dig.");
        }
        setEmail("");
        setPassword("");
      }
    } catch (err: any) {
      setError(err.message || "Kunde inte slutföra förfrågan. Försök igen.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    const client = getSupabaseClient();
    if (client) {
      await client.auth.signOut();
      setSessionUser(null);
      setSuccess("Du har loggat ut från ditt konto.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl relative border border-surface-container my-8"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-outline hover:bg-surface-container-high rounded-full transition-colors cursor-pointer z-10"
          title="Stäng"
        >
          <LucideIcon name="close" className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <LucideIcon name="settings" className="w-6 h-6 text-text-main" />
          <h2 className="font-display text-lg font-bold text-text-main leading-none">
            Inställningar
          </h2>
        </div>

        {/* Global state notification pill */}
        <AnimatePresence>
          {(success || error) && (
            <motion.div
              initial={{ height: 0, opacity: 0, y: -10 }}
              animate={{ height: "auto", opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -10 }}
              className={`mb-4 p-3 rounded-xl text-xs font-sans font-bold border flex items-center gap-2 ${
                error
                  ? "bg-red-50 text-red-700 border-red-200"
                  : "bg-emerald-50 text-emerald-800 border-emerald-200"
              }`}
            >
              <LucideIcon name={error ? "warning" : "info"} className="w-4 h-4 shrink-0" />
              <span className="flex-1">{error || success}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 no-scrollbar">
          
          {/* User Profile Card info */}
          <div className="bg-surface-container-low p-4 rounded-xl flex flex-col gap-3.5 border border-surface-container/30">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full overflow-hidden border shrink-0 bg-secondary/10 flex items-center justify-center">
                {sessionUser ? (
                  <span className="text-secondary font-bold text-lg">
                    {sessionUser.email?.substring(0, 2).toUpperCase()}
                  </span>
                ) : (
                  <img
                    alt="Profilfoto"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDDozSzqxVqljucfmI2KbMHCz31aB8XJTlwjsuQBKIwBi2UfihM3YJWBGGg4gBHOMrD0xTxhodCmn-RbAhvGADooRReTPM47r4jARWz9e7c6nwZH6QNuxFW4f-aBXGLg0y9e_IGdU4Syd5ektDCqyfrmiDEu0kxvP0gsp2s2UPKwjQWLq8FflZqHptEhPXHwx2jQYrGt3FqcSXsBf5ymOWNXA_YlX9FywkT33dDrZoFkP_WsfP91IanCVdherTzzqWspYhavdZgt1c"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div>
                <p className="font-sans text-[10px] text-outline font-bold uppercase tracking-wider">
                  {sessionUser ? "Molnsynkad användare" : "Lokal profil"}
                </p>
                <p className="font-sans text-xs font-bold text-text-main leading-none mt-1 truncate max-w-[240px]">
                  {sessionUser ? sessionUser.email : "kristofferssonmax@gmail.com"}
                </p>
              </div>
            </div>

            {/* Editable Profile Name input field */}
            <form onSubmit={handleNameSave} className="space-y-2 pt-1 border-t border-surface-container-high/60">
              <label className="font-sans text-[10px] font-bold text-outline uppercase tracking-wider block">
                Mitt Profilnamn (Appens rubrik)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  placeholder="Hem-Listan"
                  className="flex-1 bg-white border border-surface-container-high rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-outline/40 outline-none font-sans font-medium"
                />
                <button
                  type="submit"
                  disabled={tempName.trim() === userName}
                  className="bg-primary hover:bg-primary-container text-white rounded-lg px-4 py-2 font-sans text-xs font-bold active:scale-95 transition-all outline-none disabled:opacity-40 disabled:pointer-events-none cursor-pointer shrink-0"
                >
                  Spara
                </button>
              </div>
            </form>
          </div>

          {/* SUPABASE DEPLOYMENT & PERSISTENCE CARD */}
          <div className="bg-[#FAF9F5] p-4 rounded-xl border border-[#EDEADF] space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1 px-2 rounded-md bg-[#EDF6F0] text-[#3ECF8E] font-sans text-[10px] font-extrabold tracking-wide border border-[#A4E0C3]/30">
                  SUPABASE
                </div>
                <h3 className="font-sans text-xs font-bold text-text-main">
                  Molnsynk & Listdelning
                </h3>
              </div>
              <span className={`inline-flex items-center w-2 h-2 rounded-full ${supabaseActive ? "bg-emerald-500 animate-pulse" : "bg-neutral-300"}`} />
            </div>

            <p className="font-sans text-[11px] text-[#706B5C] leading-normal font-medium">
              Ge dina listor ett evigt liv genom att koppla dem till din egen Supabase-databas. Användare kan logga in för att dela och arbeta tillsammans i realtid!
            </p>

            {/* Toggle DB config link fields */}
            <div className="flex items-center justify-between border-t border-[#EDEADF] pt-2">
              <button
                type="button"
                onClick={() => setShowConfig(!showConfig)}
                className="text-[11px] font-bold text-outline hover:text-text-main flex items-center gap-1 transition-colors ml-0.5 cursor-pointer select-none"
              >
                <span>{showConfig ? "Dölj anslutningsfält" : "Visa anslutningsfält"}</span>
                <LucideIcon name={showConfig ? "chevron_up" : "chevron_down"} className="w-3.5 h-3.5" />
              </button>
              
              <span className="font-sans text-[10px] font-bold text-[#3ECF8E] select-none">
                {supabaseActive ? "✓ Ansluten till moln" : "Körs offline"}
              </span>
            </div>

            {/* Config overrides panel */}
            <AnimatePresence>
              {showConfig && (
                <motion.form
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  onSubmit={handleSaveCredentials}
                  className="space-y-3 pt-1 border-t border-[#EDEADF]/70 overflow-hidden text-left"
                >
                  <div className="space-y-1">
                    <label className="font-sans text-[9px] font-bold text-[#706B5C] uppercase tracking-wider block">
                      Supabase Projekt-URL (VITE_SUPABASE_URL)
                    </label>
                    <input
                      type="text"
                      value={inputUrl}
                      onChange={(e) => setInputUrl(e.target.value)}
                      placeholder="https://testdb.supabase.co"
                      className="w-full bg-white border border-[#E1DEC7] rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-accent-rust focus:border-accent-rust outline-none font-sans font-medium text-text-main"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-sans text-[9px] font-bold text-[#706B5C] uppercase tracking-wider block">
                      Anon API Nyckel (VITE_SUPABASE_ANON_KEY)
                    </label>
                    <input
                      type="password"
                      value={inputKey}
                      onChange={(e) => setInputKey(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5..."
                      className="w-full bg-white border border-[#E1DEC7] rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-accent-rust focus:border-accent-rust outline-none font-sans font-medium text-text-main"
                    />
                  </div>

                  <div className="flex gap-2 pt-1.5">
                    <button
                      type="submit"
                      className="flex-1 bg-text-main text-white py-1.5 rounded-lg text-xs font-bold hover:bg-neutral-800 transition-colors cursor-pointer text-center"
                    >
                      Spara autentiseringsnycklar
                    </button>
                    {(inputUrl || inputKey) && (
                      <button
                        type="button"
                        onClick={() => {
                          setInputUrl("");
                          setInputKey("");
                          saveLocalStorageCredentials("", "");
                          setSupabaseActive(false);
                          setSuccess("Rensade lokala instruktioner.");
                        }}
                        className="bg-neutral-200 text-neutral-700 hover:bg-neutral-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        title="Rensa fält"
                      >
                        Hämta
                      </button>
                    )}
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          {/* ACTIVE LOGIN AUTH PANEL */}
          {supabaseActive && (
            <div className="bg-[#EEF4F8] p-4 rounded-xl border border-[#D5E1EA] space-y-3.5 text-left">
              <div className="flex items-center gap-2">
                <LucideIcon name="lock" className="w-4 h-4 text-primary" />
                <h3 className="font-display text-xs font-extrabold text-on-surface">
                  {sessionUser ? "Ditt Synkkonto" : "Skapa inlogg för Listdelning"}
                </h3>
              </div>

              {sessionUser ? (
                <div className="space-y-3 pr-1">
                  <div className="p-2.5 bg-white/60 border border-stroke rounded-lg space-y-1">
                    <p className="font-sans text-[10px] font-bold text-outline uppercase tracking-wider">
                      Status och ansluten e-post
                    </p>
                    <p className="font-mono text-xs font-bold text-text-main block truncate">
                      {sessionUser.email}
                    </p>
                    <p className="font-sans text-[9px] text-outline font-medium">
                      Användar-ID: <code className="bg-neutral-100 px-1 py-0.5 rounded text-neutral-600 font-mono text-[8px]">{sessionUser.id}</code>
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const code = prompt("Ange din kompis e-post för att bjuda in till listan:");
                        if (code && code.trim()) {
                          setSuccess(`Skickat en delningsinbjudan från Supabase till: ${code.trim()}`);
                        }
                      }}
                      className="flex-1 bg-primary text-white py-1.5 px-3 rounded-lg text-xs font-bold hover:bg-primary-container transition-all active:scale-95 text-center cursor-pointer select-none"
                    >
                      Dela en lista
                    </button>
                    <button
                      onClick={handleLogout}
                      className="bg-neutral-200 hover:bg-neutral-300 text-neutral-800 py-1.5 px-3 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer text-center"
                    >
                      Logga ut
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleAuth} className="space-y-3">
                  <div className="space-y-1">
                    <label className="font-sans text-[9px] font-bold text-outline uppercase tracking-wider block select-none">
                      E-postadress
                    </label>
                    <input
                      type="email"
                      value={email}
                      required
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="t.ex. anna@gmail.com"
                      className="w-full bg-white border border-surface-container-high rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none font-sans"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-sans text-[9px] font-bold text-outline uppercase tracking-wider block select-none">
                      Lösenord
                    </label>
                    <input
                      type="password"
                      value={password}
                      required
                      minLength={6}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="****** (minst 6 tecken)"
                      className="w-full bg-white border border-surface-container-high rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none font-sans"
                    />
                  </div>

                  {/* Auth Mode Toggle & Submit */}
                  <div className="flex items-center justify-between gap-4 pt-1">
                    <button
                      type="button"
                      onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}
                      className="text-[11px] font-bold text-primary hover:underline cursor-pointer select-none"
                    >
                      {authMode === "login"
                        ? "Ny här? Skapa ett synkkonto"
                        : "Har du redan ett konto? Logga in"}
                    </button>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="bg-[#2D3E50] hover:bg-neutral-800 text-white rounded-lg px-5 py-2 font-sans text-xs font-bold transition-all disabled:opacity-40 cursor-pointer shadow-sm"
                    >
                      {isLoading ? (
                        "Vänta..."
                      ) : authMode === "login" ? (
                        "Logga in"
                      ) : (
                        "Skapa konto"
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Reset administrative actions */}
          <div className="space-y-2 pt-2 border-t border-surface-container-high/60">
            <h3 className="font-sans text-[10px] font-bold text-outline uppercase tracking-wider px-1">
              Fara & återställning
            </h3>
            <button
              onClick={() => {
                const conf = window.confirm("Vill du återställa alla listor till sina fabriksinställningar?");
                if (conf) {
                  onResetLists();
                  onClose();
                }
              }}
              className="w-full py-3 bg-error text-white font-sans text-xs font-bold rounded-xl hover:bg-error/90 active:scale-95 transition-all text-center cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              <LucideIcon name="archive" className="w-4 h-4" />
              <span>Återställ standardlistor</span>
            </button>
          </div>
        </div>

        <div className="text-center font-sans text-[10px] text-outline mt-6 font-medium">
          Hem-Listan v1.3 &bull; Förberedd för Supabase &bull; Smidig Listdelning
        </div>
      </motion.div>
    </div>
  );
}

/** @jsxRuntime classic */
import React, { useState, useEffect, useRef, useCallback, memo } from "react";
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

// ── Image compress ─────────────────────────────
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
        } else {
          if (height > MAX) {
            width = Math.round((width * MAX) / height);
            height = MAX;
          }
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

// ── Name form ─────────────────────────────
const NameForm = memo(({ userName, onSave }: any) => {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2 pt-1 border-t border-surface-container-high/60">
      <label className="text-[10px] font-bold uppercase text-outline">
        Visningsnamn
      </label>

      <div className="flex gap-2">
        <input
          ref={ref}
          defaultValue={userName}
          className="flex-1 bg-white border rounded-lg px-3 py-2 text-xs"
        />

        <button
          onClick={() => {
            const v = ref.current?.value?.trim();
            if (v) onSave(v);
          }}
          className="bg-primary text-white px-4 rounded-lg text-xs font-bold"
        >
          Spara
        </button>
      </div>
    </div>
  );
});

// ── Auth ─────────────────────────────
const AuthForm = memo(({ onSuccess, onError }: any) => {
  const email = useRef<HTMLInputElement>(null);
  const pass = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const client = getSupabaseClient();
    if (!client) return onError("Ingen molnkonfiguration");

    const e = email.current?.value || "";
    const p = pass.current?.value || "";

    if (!e || !p) return;

    setLoading(true);

    try {
      if (mode === "login") {
        const { data, error } = await client.auth.signInWithPassword({
          email: e,
          password: p,
        });

        if (error) throw error;
        onSuccess("Inloggad", data.user?.user_metadata?.display_name);
      } else {
        const { error } = await client.auth.signUp({
          email: e,
          password: p,
        });

        if (error) throw error;
        onSuccess("Konto skapat");
      }
    } catch (err: any) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <input ref={email} placeholder="E-post" className="w-full border p-2 rounded" />
      <input ref={pass} placeholder="Lösenord" type="password" className="w-full border p-2 rounded" />

      <div className="flex justify-between items-center">
        <button
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="text-xs text-primary font-bold"
        >
          {mode === "login" ? "Skapa konto" : "Logga in"}
        </button>

        <button
          onClick={submit}
          disabled={loading}
          className="bg-black text-white px-4 py-2 rounded text-xs"
        >
          {loading ? "..." : mode === "login" ? "Logga in" : "Skapa"}
        </button>
      </div>
    </div>
  );
});

// ── MAIN ─────────────────────────────
export default function SettingsModal({
  userName,
  userImage,
  onUpdateUserName,
  onUpdateUserImage,
  onClose,
  onResetLists,
}: SettingsModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const [image, setImage] = useState(userImage || "");
  const [supabaseActive, setSupabaseActive] = useState(isSupabaseConfigured());
  const [session, setSession] = useState<any>(null);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;

    client.auth.getUser().then(({ data }) => setSession(data.user));

    const { data } = client.auth.onAuthStateChange((_e, s) => {
      setSession(s?.user || null);
    });

    return () => data.subscription.unsubscribe();
  }, [supabaseActive]);

  const saveName = useCallback((name: string) => {
    onUpdateUserName(name);
    localStorage.setItem("user_profile_name", name);
    setMsg("Namn uppdaterat");
  }, []);

  const uploadImage = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const compressed = await compressImage(file);
    setImage(compressed);
    onUpdateUserImage(compressed);
  };

  const removeImage = () => {
    setImage("");
    onUpdateUserImage("");
  };

  const saveCreds = (url: string, key: string) => {
    saveLocalStorageCredentials(url, key);
    setSupabaseActive(isSupabaseConfigured());
    setMsg("Moln uppdaterat");
  };

  const clearCreds = () => {
    saveLocalStorageCredentials("", "");
    setSupabaseActive(false);
  };

  const logout = async () => {
    const client = getSupabaseClient();
    await client?.auth.signOut();
    setSession(null);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4">
      <motion.div className="bg-white w-full max-w-md rounded-2xl p-6">

        <button onClick={onClose} className="absolute top-4 right-4">
          <LucideIcon name="close" />
        </button>

        <h2 className="text-lg font-bold mb-4">Inställningar</h2>

        {/* Profile */}
        <div className="mb-4">
          <input type="file" ref={fileRef} hidden onChange={uploadImage} />

          <button onClick={() => fileRef.current?.click()}>
            {image ? "Byt bild" : "Lägg till bild"}
          </button>

          {image && <button onClick={removeImage}>Ta bort</button>}

          <NameForm userName={userName} onSave={saveName} />
        </div>

        {/* Auth */}
        {supabaseActive && (
          <div className="mb-4">
            {session ? (
              <>
                <p>{session.email}</p>
                <button onClick={logout}>Logga ut</button>
              </>
            ) : (
              <AuthForm onSuccess={setMsg} onError={setErr} />
            )}
          </div>
        )}

        {/* Reset */}
        <button
          onClick={() => {
            if (confirm("Återställ?")) onResetLists();
          }}
          className="bg-red-500 text-white w-full p-2 rounded"
        >
          Återställ listor
        </button>

        {msg && <p className="text-green-600 text-xs">{msg}</p>}
        {err && <p className="text-red-600 text-xs">{err}</p>}
      </motion.div>
    </div>
  );
}

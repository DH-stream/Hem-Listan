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

// ── Namn ───────────────────────────────────────────────────────────
const NameForm = memo(({ userName, onSave }: any) => {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2 pt-1 border-t border-surface-container-high/60">
      <label className="font-sans text-[10px] font-bold text-outline uppercase tracking-wider block">
        Visningsnamn
      </label>

      <div className="flex gap-2">
        <input
          ref={ref}
          defaultValue={userName}
          className="flex-1 bg-white border border-surface-container-high rounded-lg px-3 py-2 text-xs outline-none"
        />

        <button
          onClick={() => {
            const v = ref.current?.value?.trim();
            if (v) onSave(v);
          }}
          className="bg-primary text-white rounded-lg px-4 py-2 text-xs font-bold"
        >
          Spara
        </button>
      </div>
    </div>
  );
});

// ── Auth ───────────────────────────────────────────────────────────
const AuthForm = memo(({ onSuccess, onError }: any) => {
  const emailRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const email = emailRef.current?.value ?? "";
    const password = passRef.current?.value ?? "";

    if (!email || !password) return;

    setLoading(true);

    const client = getSupabaseClient();
    if (!client) {
      onError("Ingen anslutning till molnet.");
      setLoading(false);
      return;
    }

    try {
      if (mode === "login") {
        const { data, error } = await client.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        onSuccess(`Inloggad: ${data.user?.email}`);
      } else {
        const { error } = await client.auth.signUp({
          email,
          password,
        });

        if (error) throw error;
        onSuccess("Konto skapat!");
      }
    } catch (e: any) {
      onError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={emailRef}
        placeholder="E-post"
        className="w-full border rounded-lg px-3 py-2 text-xs"
      />

      <input
        ref={passRef}
        type="password"
        placeholder="Lösenord"
        className="w-full border rounded-lg px-3 py-2 text-xs"
      />

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
          className="bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold"
        >
          {loading ? "..." : mode === "login" ? "Logga in" : "Skapa"}
        </button>
      </div>
    </div>
  );
});

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

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;

    client.auth.getUser().then(({ data }) => {
      setSessionUser(data.user);
    });

    const { data } = client.auth.onAuthStateChange((_e, session) => {
      setSessionUser(session?.user ?? null);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const saveName = (name: string) => {
    onUpdateUserName(name);
    localStorage.setItem("user_profile_name", name);
    setMsg("Namn sparat");
  };

  const uploadImage = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = await compressImage(file);
    setPreview(img);
    onUpdateUserImage(img);
    localStorage.setItem("user_profile_image", img);
    setMsg("Bild sparad");
  };

  const removeImage = () => {
    setPreview(undefined);
    onUpdateUserImage("");
    localStorage.removeItem("user_profile_image");
  };

  const logout = async () => {
    const client = getSupabaseClient();
    await client?.auth.signOut();
    setSessionUser(null);
    setMsg("Utloggad");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        className="w-full max-w-md bg-white rounded-2xl p-6 relative"
      >
        <button onClick={onClose} className="absolute top-3 right-3">
          <LucideIcon name="close" />
        </button>

        <h2 className="font-bold text-lg mb-4">Inställningar</h2>

        {(msg || error) && (
          <div className="text-xs mb-3 text-green-600">{msg || error}</div>
        )}

        {/* PROFILE */}
        <div className="flex gap-3 items-center mb-4">
          <button
            onClick={() => fileRef.current?.click()}
            className="w-14 h-14 rounded-full overflow-hidden bg-gray-100"
          >
            {preview ? (
              <img src={preview} className="w-full h-full object-cover" />
            ) : (
              <LucideIcon name="person" />
            )}
          </button>

          <div className="flex-1">
            <p className="text-xs font-bold">{userName}</p>
            <p className="text-[10px] opacity-60">
              {sessionUser?.email ?? "Lokal profil"}
            </p>

            <div className="flex gap-2 text-[10px] mt-1">
              <button onClick={() => fileRef.current?.click()}>
                Byt bild
              </button>
              {preview && <button onClick={removeImage}>Ta bort</button>}
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

        {/* NAME */}
        <NameForm userName={userName} onSave={saveName} />

        {/* AUTH */}
        <div className="mt-4 border-t pt-4">
          {sessionUser ? (
            <div className="space-y-2">
              <p className="text-xs">Inloggad som {sessionUser.email}</p>

              <button
                onClick={logout}
                className="text-xs bg-gray-200 px-3 py-1 rounded"
              >
                Logga ut
              </button>
            </div>
          ) : (
            <AuthForm onSuccess={setMsg} onError={setError} />
          )}
        </div>

        {/* RESET */}
        <div className="mt-5 border-t pt-4">
          <button
            onClick={() => {
              if (confirm("Återställ alla listor?")) {
                onResetLists();
                onClose();
              }
            }}
            className="text-xs bg-red-500 text-white px-3 py-2 rounded w-full"
          >
            Återställ listor
          </button>
        </div>
      </motion.div>
    </div>
  );
}

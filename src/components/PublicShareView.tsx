import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PublicListShare, TaskItem } from "../types";
import { fetchPublicListShare } from "../lib/supabase";
import LucideIcon from "./LucideIcon";

type PublicShareViewProps = {
  token: string;
};

const getShareTitle = (share: PublicListShare) =>
  share.title || share.snapshot.title || share.snapshot.name || "Delad lista";

const getShareIcon = (share: PublicListShare) =>
  share.icon || share.snapshot.icon || "list";

const getShareThemeColor = (share: PublicListShare) =>
  share.themeColor || share.snapshot.themeColor || "#1a5319";

const SHARE_PROGRESS_STORAGE_PREFIX = "hem-listan-share-progress:";
const SHARE_MESSAGE_FALLBACK_SENDER = "någon";

const getTaskProgress = (task: TaskItem) => {
  if (task.type === "progress") return task.progress ?? 0;
  return task.checked ? 100 : 0;
};

const getShareMessage = (share: PublicListShare) => {
  const senderName = share.snapshot.senderName?.trim() || SHARE_MESSAGE_FALLBACK_SENDER;

  switch (share.snapshot.shareMessageVariant) {
    case 1:
      return `${senderName} skickade över en liten lista till dig. Bocka av i din egen takt 🌿`;
    case 2:
      return `Tjo! ${senderName} har fixat en lista åt dig. Bara att kika och pricka av ✅`;
    case 0:
    default:
      return `Hej! Du har fått den här listan av ${senderName}. Ta en kik vet jag ✨`;
  }
};

const getProgressStorageKey = (token: string) => `${SHARE_PROGRESS_STORAGE_PREFIX}${token}`;

const readStoredProgress = (token: string): Record<string, boolean> => {
  try {
    const storedValue = window.localStorage.getItem(getProgressStorageKey(token));
    if (!storedValue) return {};

    const parsedValue = JSON.parse(storedValue);
    if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue)) return {};

    return Object.fromEntries(
      Object.entries(parsedValue).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"),
    );
  } catch {
    return {};
  }
};

const writeStoredProgress = (token: string, progress: Record<string, boolean>) => {
  window.localStorage.setItem(getProgressStorageKey(token), JSON.stringify(progress));
};

export default function PublicShareView({ token }: PublicShareViewProps) {
  const [share, setShare] = useState<PublicListShare | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [localCheckedState, setLocalCheckedState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let isMounted = true;

    const loadShare = async () => {
      setIsLoading(true);
      setHasError(false);

      const result = await fetchPublicListShare(token);
      if (!isMounted) return;

      if (!result) {
        setShare(null);
        setHasError(true);
      } else {
        setShare(result);
        setLocalCheckedState(readStoredProgress(token));
      }
      setIsLoading(false);
    };

    void loadShare();

    return () => {
      isMounted = false;
    };
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fcf9f8] px-4 py-10 font-sans text-on-surface">
        <div className="mx-auto flex min-h-[70vh] w-full max-w-lg items-center justify-center">
          <div className="rounded-2xl border border-surface-container bg-white/80 px-5 py-4 text-sm font-bold text-outline shadow-sm">
            Laddar delad lista...
          </div>
        </div>
      </div>
    );
  }

  if (hasError || !share) {
    return (
      <div className="min-h-screen bg-[#fcf9f8] px-4 py-10 font-sans text-on-surface">
        <div className="mx-auto flex min-h-[70vh] w-full max-w-lg items-center justify-center">
          <div className="rounded-3xl border border-surface-container bg-white p-6 text-center shadow-xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-low text-outline">
              <LucideIcon name="link_off" className="h-6 w-6" />
            </div>
            <h1 className="font-display text-xl font-bold text-text-main">
              Listan kunde inte hittas
            </h1>
            <p className="mt-2 text-sm font-medium leading-relaxed text-outline">
              Listan kunde inte hittas eller länken har gått ut.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const title = getShareTitle(share);
  const icon = getShareIcon(share);
  const themeColor = getShareThemeColor(share);
  const shareMessage = getShareMessage(share);
  const tasks = (share.snapshot.tasks ?? []).map((task, index) => ({
    ...task,
    checked: localCheckedState[index] ?? task.checked,
  }));
  const meals = share.snapshot.meals ?? [];
  const checkedTasks = tasks.filter(task => task.checked).length;
  const progressPercent = tasks.length > 0 ? Math.round((checkedTasks / tasks.length) * 100) : 0;
  const handleToggleTask = (index: number) => {
    const nextCheckedState = {
      ...localCheckedState,
      [index]: !tasks[index].checked,
    };

    setLocalCheckedState(nextCheckedState);
    writeStoredProgress(token, nextCheckedState);
  };

  return (
    <div className="min-h-screen bg-[#fcf9f8] px-4 py-8 font-sans text-on-surface">
      <main className="mx-auto w-full max-w-2xl">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="overflow-hidden rounded-3xl border border-surface-container bg-white shadow-xl"
        >
          <div className="p-5 sm:p-6">
            <div className="mb-5 flex items-start gap-4">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
                style={{ backgroundColor: themeColor }}
              >
                <LucideIcon name={icon} className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.22em] text-outline">
                  Delad lista
                </p>
                <h1 className="font-display text-2xl font-bold leading-tight text-text-main">
                  {title}
                </h1>
                <p className="mt-2 text-sm font-bold leading-relaxed text-text-main">
                  {shareMessage}
                </p>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-outline">
                  Det du bockar av sparas bara på din enhet och ändrar inte originalet.
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-surface-container-low p-4">
              <div className="mb-2 flex items-center justify-between text-xs font-bold text-outline">
                <span>{checkedTasks}/{tasks.length} klara</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%`, backgroundColor: themeColor }}
                />
              </div>
            </div>
          </div>

          {meals.length > 0 && (
            <div className="border-t border-surface-container bg-surface-container-lowest p-5 sm:p-6">
              <h2 className="mb-3 font-display text-sm font-bold text-text-main">
                Matschema
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {meals.map((meal, index) => (
                  <div key={`${meal.day}-${meal.type}-${index}`} className="rounded-xl border border-surface-container bg-white p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-outline">
                      {meal.day} · {meal.type}
                    </p>
                    <p className="mt-1 text-sm font-bold text-text-main">{meal.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-surface-container p-5 sm:p-6">
            <h2 className="mb-3 font-display text-sm font-bold text-text-main">
              Uppgifter
            </h2>

            {tasks.length === 0 ? (
              <p className="rounded-xl bg-surface-container-low p-4 text-sm font-semibold text-outline">
                Den delade listan innehåller inga uppgifter.
              </p>
            ) : (
              <div className="space-y-2">
                {tasks.map((task, index) => (
                  <article key={`${task.text}-${index}`} className="rounded-xl border border-surface-container bg-white p-3 shadow-sm">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => handleToggleTask(index)}
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                          task.checked ? "border-secondary bg-secondary text-white" : "border-outline-variant bg-white text-transparent"
                        }`}
                        aria-label={task.checked ? "Markera som inte klar" : "Markera som klar"}
                        aria-pressed={task.checked}
                      >
                        <LucideIcon name="check" className="h-3.5 w-3.5 stroke-[3]" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-bold leading-snug ${task.checked ? "text-outline line-through" : "text-text-main"}`}>
                          {task.text}
                        </p>
                        {task.notes && (
                          <p className="mt-1 text-xs font-medium leading-relaxed text-outline">
                            {task.notes}
                          </p>
                        )}
                        {task.url && (
                          <a
                            href={task.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-secondary"
                          >
                            Öppna länk
                            <LucideIcon name="external_link" className="h-3 w-3" />
                          </a>
                        )}
                        {task.type === "progress" && (
                          <div className="mt-3">
                            <div className="mb-1 text-[10px] font-bold text-outline">{getTaskProgress(task)}%</div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-low">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${getTaskProgress(task)}%`, backgroundColor: themeColor }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </motion.section>
      </main>
    </div>
  );
}

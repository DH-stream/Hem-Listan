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

const getTaskProgress = (task: TaskItem) => {
  if (task.type === "progress") return task.progress ?? 0;
  return task.checked ? 100 : 0;
};

export default function PublicShareView({ token }: PublicShareViewProps) {
  const [share, setShare] = useState<PublicListShare | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

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
  const tasks = share.snapshot.tasks ?? [];
  const meals = share.snapshot.meals ?? [];
  const checkedTasks = tasks.filter(task => task.checked).length;
  const progressPercent = tasks.length > 0 ? Math.round((checkedTasks / tasks.length) * 100) : 0;

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
                  Delad läskopia
                </p>
                <h1 className="font-display text-2xl font-bold leading-tight text-text-main">
                  {title}
                </h1>
                <p className="mt-2 text-xs font-semibold text-outline">
                  Detta är en fryst kopia. Du kan läsa listan, men inte redigera den.
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
                      <div
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                          task.checked ? "border-secondary bg-secondary text-white" : "border-outline-variant bg-white text-transparent"
                        }`}
                        aria-hidden="true"
                      >
                        <LucideIcon name="check" className="h-3.5 w-3.5 stroke-[3]" />
                      </div>
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

import React, { useEffect, useRef, useState, SyntheticEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { List, Stats } from "../types";
import LucideIcon from "./LucideIcon";
import { QUICK_TEMPLATES } from "../data";
import ListActionsFlowModal from "./ListActionsFlowModal";
import { createListShare } from "../lib/supabase";
import {
  getAppearanceBackgroundStyle,
  getCustomAppearanceImageUrl,
  ListAppearance,
  ListAppearanceBackgroundRef,
  readListAppearanceMap,
  writeListAppearance,
} from "../lib/listVisuals";

// Skapade ett interface för mallarna så slipper vi "any"-fel
interface QuickTemplate {
  name: string;
  icon?: string;
  themeColor?: string;
  tasks?: Array<{ text: string; checked: boolean }>;
  [key: string]: unknown; // Tillåter extra fält om det behövs
}

interface DashboardViewProps {
  lists: List[];
  stats: Stats;
  userName: string;
  userImage?: string;
  onSelectList: (id: string) => void;
  onTriggerCreate: () => void;
  onAddListFromTemplate: (template: QuickTemplate) => void; // Ändrad från any
  onOpenSettings: () => void;
  onDeleteList: (listId: string) => void;
}

export default function DashboardView({
  lists,
  stats,
  userName,
  userImage,
  onSelectList,
  onTriggerCreate,
  onAddListFromTemplate,
  onOpenSettings,
  onDeleteList,
}: DashboardViewProps) {
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [pendingActionsList, setPendingActionsList] = useState<List | null>(
    null,
  );
  const [pressingListId, setPressingListId] = useState<string | null>(null);
  const [listAppearance, setListAppearance] = useState(() => readListAppearanceMap());
  const [customImageUrls, setCustomImageUrls] = useState<Record<string, string>>(
    {},
  );
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const cancelLongPress = () => {
    clearLongPressTimer();
    setPressingListId(null);
    pressStartRef.current = null;
  };

  const handleListPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
    list: List,
  ) => {
    if (event.button !== 0) return;

    clearLongPressTimer();
    longPressTriggeredRef.current = false;
    pressStartRef.current = { x: event.clientX, y: event.clientY };
    setPressingListId(list.id);

    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setPressingListId(null);
      setPendingActionsList(list);
      navigator.vibrate?.(50);
    }, 500);
  };

  const handleListPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = pressStartRef.current;
    if (!start) return;

    const movedX = Math.abs(event.clientX - start.x);
    const movedY = Math.abs(event.clientY - start.y);

    if (movedX > 10 || movedY > 10) {
      cancelLongPress();
    }
  };

  const handleListPointerEnd = () => {
    clearLongPressTimer();
    setPressingListId(null);
    pressStartRef.current = null;
  };

  const handleListClick = (
    event: React.MouseEvent<HTMLDivElement>,
    listId: string,
  ) => {
    if (longPressTriggeredRef.current) {
      event.preventDefault();
      event.stopPropagation();
      longPressTriggeredRef.current = false;
      return;
    }

    onSelectList(listId);
  };

  useEffect(() => {
    return () => {
      clearLongPressTimer();
    };
  }, []);

  const logListActionPlaceholder = (
    eventName: "send_list_unwired" | "share_list_unwired",
    list: List,
  ) => {
    console.log(eventName, {
      listId: list.id,
      name: list.name,
    });
  };

  const handleSendList = async (): Promise<string | null> => {
    if (!pendingActionsList) return null;

    const senderName = userName.trim() === "Hem-Listan" ? undefined : userName;
    const token = await createListShare(pendingActionsList, senderName);
    if (!token) return null;

    return `${window.location.origin}/share/${token}`;
  };

  const handleShareList = () => {
    if (pendingActionsList) {
      logListActionPlaceholder("share_list_unwired", pendingActionsList);
    }
  };

  const handleConfirmDeleteList = () => {
    if (pendingActionsList) {
      onDeleteList(pendingActionsList.id);
      setPendingActionsList(null);
    }
  };

  const handleUpdateListAppearance = (appearance: ListAppearance) => {
    if (!pendingActionsList) return;

    setListAppearance(writeListAppearance(pendingActionsList.id, appearance));
  };


  useEffect(() => {
    let isActive = true;

    const customRefs = Object.values(listAppearance)
      .map((appearance) => appearance.background)
      .filter((ref): ref is ListAppearanceBackgroundRef => ref?.type === "custom");

    setCustomImageUrls((currentUrls) => {
      const activeIds = new Set(customRefs.map((ref) => ref.id));
      const nextUrls = Object.entries(currentUrls).reduce<Record<string, string>>(
        (acc, [id, url]) => {
          if (activeIds.has(id)) {
            acc[id] = url;
          } else {
            URL.revokeObjectURL(url);
          }
          return acc;
        },
        {},
      );

      const missingRefs = customRefs.filter((ref) => !nextUrls[ref.id]);
      if (missingRefs.length > 0) {
        Promise.all(
          missingRefs.map(async (ref) => {
            const url = await getCustomAppearanceImageUrl(ref.id);
            return { id: ref.id, url };
          }),
        )
          .then((results) => {
            if (!isActive) {
              results.forEach((result) => {
                if (result.url) URL.revokeObjectURL(result.url);
              });
              return;
            }

            const loadedUrls = results.reduce<Record<string, string>>(
              (acc, result) => {
                if (result.url) acc[result.id] = result.url;
                return acc;
              },
              {},
            );

            if (Object.keys(loadedUrls).length > 0) {
              setCustomImageUrls((latestUrls) => ({
                ...latestUrls,
                ...loadedUrls,
              }));
            }
          })
          .catch((error) => {
            console.error("load_list_appearance_image_error", { error });
          });
      }

      return nextUrls;
    });

    return () => {
      isActive = false;
    };
  }, [listAppearance]);


  const getTodayDateString = () => {
    return new Date().toDateString(); // e.g. "Mon Jun 01 2026"
  };

  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      const dismissedDate = localStorage.getItem(
        "dismissed_dashboard_summary_date",
      );
      return dismissedDate === getTodayDateString();
    } catch (_) {
      return false;
    }
  });

  const handleDismiss = () => {
    try {
      localStorage.setItem(
        "dismissed_dashboard_summary_date",
        getTodayDateString(),
      );
    } catch (_) {}
    setIsDismissed(true);
  };

  // Pre-configured dynamic Swedish personal greetings and fun facts
  const getGreetingAndFact = () => {
    const today = new Date();
    const dayOfMonth = today.getDate(); // 1 to 31
    const dayOfWeek = today.getDay(); // 0 to 6

    const listsCount = lists.length;
    const completedCount = stats.completedCount;
    const totalItems = lists.reduce((acc, list) => acc + list.tasks.length, 0);

    const facts = [
      {
        emoji: "😊",
        title: ":) Hej!",
        text: `Du har just nu ${listsCount} ${listsCount === 1 ? "planeringslista" : "planeringslistor"} igång. Skoj!`,
      },
      {
        emoji: "✨",
        title: ":) God dag!",
        text: `Framsteg föder framsteg! Du har totalt bockat av ${completedCount} uppgifter i dina listor sedan start!`,
      },
      {
        emoji: "💡",
        title: ":) Kul fakta!",
        text: `Visste du att du har totalt ${totalItems} saker inlagda i dina bento-listor? Bra struktur underlättar vardagen.`,
      },
      {
        emoji: "🌿",
        title: ":) Ekologiskt tips!",
        text: `Idag är en perfekt dag att hålla koll på miljön. Glöm inte lägga till ekologiska varor på dina inköpslistor!`,
      },
      {
        emoji: "🏡",
        title: ":) Hemmet i fokus!",
        text: `Planering gör skillnad. Se till att lägga till Webbadresser eller Frimärken för att hålla dina projekt levande.`,
      },
      {
        emoji: "🎉",
        title: ":) Heja dig!",
        text: `Halva jobbet är planering. ${completedCount > 0 ? `Dina ${completedCount} avklarade punkter visar att du är på helt rätt spår!` : "Dina listor väntar på dig - bocka av ditt första föremål idag!"}`,
      },
      {
        emoji: "☕",
        title: ":) Pausa och andas!",
        text: `Minska stressen i vardagen. Skriv ner dina tankar direkt i en "notering" i stället för att hålla dem i huvudet.`,
      },
    ];

    // Simple deterministic index rotation by combining calendar properties
    const index = (dayOfMonth + dayOfWeek) % facts.length;
    return facts[index];
  };

  const activeFact = getGreetingAndFact();


  const pendingTotalTasks = pendingActionsList?.tasks.length || 0;
  const pendingCheckedTasks =
    pendingActionsList?.tasks.filter((task) => task.checked).length || 0;
  const pendingProgressPercent =
    pendingTotalTasks > 0
      ? Math.round((pendingCheckedTasks / pendingTotalTasks) * 100)
      : 0;

  // Pastel backgrounds for list index circular icons
  const getIconBg = (iconName: string) => {
    switch (iconName) {
      case "shopping_cart":
        return "bg-tertiary-fixed text-tertiary";
      case "construction":
        return "bg-secondary-container text-secondary";
      default:
        return "bg-[#E0F2F1] text-primary-container";
    }
  };

  return (
    <div className="w-full max-w-[768px] mx-auto px-5 pb-32">
      {/* Top Bar AppBar */}
      <header className="w-full top-0 sticky z-40 bg-surface/80 backdrop-blur-xl flex justify-between items-center py-4 mb-2">
        <div className="flex items-center gap-3">
          {/* Visar endast profilbildscirkeln om userImage faktiskt är satt */}
          {userImage && (
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary/10 bg-white shrink-0">
              <img
                alt="Profile"
                className="w-full h-full object-cover"
                src={userImage}
                onError={(e: SyntheticEvent<HTMLImageElement, Event>) => {
                  // Säkerställer korrekt TS-typ om profilbilden mot förmodan dör
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
          )}
          <div>
            <p className="font-label-sm text-xs text-outline uppercase tracking-widest leading-none mb-1.5">
              Välkommen tillbaka
            </p>

            {userName && userName !== "Hem-Listan" ? (
              <h1 className="font-display text-2xl font-bold text-text-main line-clamp-1">
                {userName}
              </h1>
             ) : (
              <div style={{ margin: '-2.15rem 0', overflow: 'hidden' }}>
                <motion.img
                   src="/logo.png"
                   alt="Hem-Listan"
                   loading="eager"
                   fetchPriority="high"
                   decoding="sync"
                   style={{ height: '6.75rem', width: 'auto', objectFit: 'contain', objectPosition: 'left center' }}
                   className="block select-none"
                   onLoad={() => setLogoLoaded(true)}
                   initial={{ opacity: 0, y: 4, scale: 0.96 }}
                   animate={logoLoaded ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 4, scale: 0.96 }}
                   transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
                />
              </div>
             )}
          </div>
        </div>
        <button
          onClick={onOpenSettings}
          className="p-2 text-primary hover:opacity-80 hover:bg-surface-container-low rounded-full transition-all active:scale-95 duration-250"
          title="Inställningar"
        >
          <LucideIcon name="settings" className="w-6 h-6" />
        </button>
      </header>

      {/* Dynamic Swedish Fun Fact Section */}
      <AnimatePresence>
        {!isDismissed && (
          <motion.section
            initial={{ height: 0, opacity: 0, scale: 0.95 }}
            animate={{ height: "auto", opacity: 1, scale: 1 }}
            exit={{ height: 0, opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="mb-6 overflow-hidden"
            id="dashboard-summary"
          >
            <div className="bg-gradient-to-r from-[#FDFCF7] to-[#F7F9FA] px-5 py-3.5 rounded-xl border border-surface-container/30 flex items-start gap-3.5 shadow-[0px_4px_16px_rgba(0,0,0,0.01)] text-left relative">
              <div className="w-8 h-8 rounded-full bg-accent-rust/5 flex items-center justify-center shrink-0 border border-accent-rust/10 mt-0.5">
                <span className="text-sm">{activeFact.emoji}</span>
              </div>
              <div className="flex-1 min-w-0 pr-4">
                <p className="font-sans text-xs font-bold text-accent-rust leading-none mb-1.5 select-none">
                  {activeFact.title}
                </p>
                <p className="font-sans text-xs text-on-surface-variant font-medium leading-relaxed">
                  {activeFact.text}
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="absolute top-3 right-3 text-outline/50 hover:text-text-main p-1 rounded-full hover:bg-surface-container/30 transition-all active:scale-90"
                title="Dölj"
              >
                <LucideIcon name="close" className="w-3 h-3" />
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Active Lists Title */}
      <section className="mb-4">
        <h2 className="font-display text-lg font-bold text-text-main pr-1 mb-3">
          Mina aktiva listor
        </h2>

        {/* Bento/List Cards Grid Container */}
        <div className="space-y-4">
          {lists.map((list) => {
            const totalTasks = list.tasks.length;
            const checkedTasks = list.tasks.filter((t) => t.checked).length;
            const progressPercent =
              totalTasks > 0
                ? Math.round((checkedTasks / totalTasks) * 100)
                : 0;
            const appearance = listAppearance[list.id] || {};
            const background = getAppearanceBackgroundStyle(
              appearance.background,
              customImageUrls,
              list.id,
            );

            return (
              <motion.div
                key={list.id}
                onPointerDown={(event) => handleListPointerDown(event, list)}
                onPointerMove={handleListPointerMove}
                onPointerUp={handleListPointerEnd}
                onPointerCancel={handleListPointerEnd}
                onPointerLeave={handleListPointerEnd}
                onContextMenu={(event) => event.preventDefault()}
                onClick={(event) => handleListClick(event, list.id)}
                animate={
                  pressingListId === list.id
                    ? { scale: 0.985, y: 1 }
                    : { scale: 1, y: 0 }
                }
                transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
                className={`relative overflow-hidden bg-surface-container-lowest p-4 rounded-xl border bento-glow-primary flex items-center justify-between cursor-pointer group hover:shadow-[0px_8px_30px_rgba(0,59,5,0.06)] hover:border-primary-fixed transition-colors duration-300 active:scale-[0.99] ${
                  pressingListId === list.id
                    ? "border-primary-fixed shadow-[0px_10px_34px_rgba(0,59,5,0.10)]"
                    : "border-surface-container/40"
                }`}
                layoutId={`list-card-${list.id}`}
              >
                {background && (
                  <>
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center"
                      style={background}
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.86)_0%,rgba(255,255,255,0.68)_48%,rgba(255,255,255,0.38)_100%)]"
                    />
                  </>
                )}
                <div className="relative z-10 flex items-center gap-4 flex-1">
                  <div
                    className={`relative w-12 h-12 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${getIconBg(list.icon)}`}
                  >
                    {background && (
                      <>
                        <div
                          aria-hidden="true"
                          className="absolute inset-0 bg-cover bg-center"
                          style={background}
                        />
                        <div
                          aria-hidden="true"
                          className="absolute inset-0 bg-white/42"
                        />
                      </>
                    )}
                    <LucideIcon name={list.icon} className="relative z-10 w-6 h-6 drop-shadow-[0_1px_2px_rgba(255,255,255,0.75)]" />
                  </div>
                  <div className="flex-grow min-w-0 pr-2">
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <h3 className="font-display text-base font-bold text-text-main group-hover:text-secondary transition-colors truncate">
                        {list.name}
                      </h3>
                    </div>

                    <div className="flex items-center justify-between font-sans text-xs text-outline mb-1 font-medium">
                      <span>
                        {checkedTasks}/{totalTasks} klara
                      </span>
                      <span>{progressPercent}%</span>
                    </div>

                    <div className="w-full h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${progressPercent}%`,
                          backgroundColor: list.themeColor || "#1a5319",
                        }}
                      />
                    </div>
                  </div>
                </div>
                <LucideIcon
                  name="chevron-right"
                  className="relative z-10 w-5 h-5 text-outline opacity-40 ml-2 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
                />
              </motion.div>
            );
          })}

          {/* "+ Ny lista" dashed outline slot bottom cards */}
          <button
            onClick={onTriggerCreate}
            className="w-full py-5 border-2 border-dashed border-primary-fixed-dim rounded-xl hover:bg-primary-fixed/10 transition-colors flex items-center justify-center gap-2 group cursor-pointer focus:outline-none"
          >
            <LucideIcon
              name="add_circle"
              className="w-5 h-5 text-secondary group-hover:scale-110 transition-transform"
            />
            <span className="font-display text-base font-bold text-secondary">
              Skapa ny lista
            </span>
          </button>
        </div>
      </section>

      <ListActionsFlowModal
        isOpen={!!pendingActionsList}
        listName={pendingActionsList?.name}
        listId={pendingActionsList?.id}
        listIcon={pendingActionsList?.icon}
        listThemeColor={pendingActionsList?.themeColor}
        progressLabel={`${pendingCheckedTasks}/${pendingTotalTasks} klara`}
        progressPercent={pendingProgressPercent}
        onClose={() => setPendingActionsList(null)}
        onSendCopy={handleSendList}
        onShareList={handleShareList}
        selectedAppearance={
          pendingActionsList ? listAppearance[pendingActionsList.id] || {} : {}
        }
        customImageUrls={customImageUrls}
        onUpdateAppearance={handleUpdateListAppearance}
        onConfirmDelete={handleConfirmDeleteList}
      />

      {/* Quick Templates horizontal carousell scroll */}
      <section className="mt-8">
        <h3 className="font-sans text-xs font-semibold text-outline uppercase tracking-wider mb-3 px-1">
          Snabba mallar
        </h3>
        <div className="flex gap-3 overflow-x-auto pb-2 scrolling-hide scroll-smooth select-none">
          {QUICK_TEMPLATES.map((tmpl) => (
            <motion.button
              key={tmpl.name}
              onClick={() => onAddListFromTemplate(tmpl as QuickTemplate)} // Typas om här för att matcha interfacet perfekt
              className="flex items-center gap-2 bg-surface-container-low px-4 py-3 rounded-full font-sans text-xs font-bold text-text-main hover:bg-secondary-container hover:text-on-secondary-container transition-all cursor-pointer whitespace-nowrap shrink-0 active:scale-95 duration-200 shadow-sm"
              whileHover={{ y: -1 }}
            >
              <LucideIcon name="add" className="w-4 h-4" />
              <span>{tmpl.name}</span>
            </motion.button>
          ))}
        </div>
      </section>

      {/* FLOATING ACTION ACTION FAB */}
      <motion.button
        onClick={onTriggerCreate}
        className="fixed bottom-24 right-5 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center z-40 hover:scale-105 active:scale-95 transition-all duration-350 cursor-pointer"
        whileTap={{ scale: 0.9 }}
        title="Skapa ny lista"
      >
        <LucideIcon name="add" className="w-8 h-8 text-white" />
      </motion.button>
    </div>
  );
}

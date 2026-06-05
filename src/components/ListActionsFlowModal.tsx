import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import LucideIcon from "./LucideIcon";
import {
  LIST_BANNER_OPTIONS,
  LIST_ICON_OPTIONS,
  ListVisuals,
} from "../lib/listVisuals";

type ListActionsFlowModalProps = {
  isOpen: boolean;
  listName?: string;
  onClose: () => void;
  onSendCopy: () => Promise<string | null>;
  onShareList: () => void;
  selectedVisuals: ListVisuals;
  fallbackIcon?: string;
  onUpdateVisuals: (visuals: ListVisuals) => void;
  onConfirmDelete: () => void;
};

const actions = [
  {
    key: "sendCopy",
    title: "Skicka lista",
    subtitle: "Skicka en kopia som någon kan öppna.",
    icon: "link",
    destructive: false,
  },
  {
    key: "shareList",
    title: "Dela lista",
    subtitle: "Bjud in någon att redigera tillsammans.",
    icon: "person",
    destructive: false,
  },
  {
    key: "customizeVisuals",
    title: "Anpassa utseende",
    subtitle: "Välj ikon och lokal kortbakgrund.",
    icon: "sparkles",
    destructive: false,
  },
  {
    key: "deleteList",
    title: "Ta bort lista",
    subtitle: "Flytta till Borttagna listor i 2 dagar.",
    icon: "archive",
    destructive: true,
  },
] as const;

const easing = [0.23, 1, 0.32, 1] as const;
const backdropTransition = { duration: 0.16, ease: easing } as const;
const cardTransition = { duration: 0.16, ease: easing } as const;
const contentTransition = { duration: 0.14, ease: easing } as const;

type FlowMode = "actions" | "deleteConfirm" | "shareLink" | "visualPicker";
type ShareStatus = "idle" | "loading" | "success" | "error";

export default function ListActionsFlowModal({
  isOpen,
  listName,
  onClose,
  onSendCopy,
  onShareList,
  selectedVisuals,
  fallbackIcon,
  onUpdateVisuals,
  onConfirmDelete,
}: ListActionsFlowModalProps) {
  const [mode, setMode] = useState<FlowMode>("actions");
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const [shareLink, setShareLink] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    if (!isOpen) return;

    setMode("actions");
    setShareStatus("idle");
    setShareLink("");
    setCopyStatus("idle");

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const handleClose = () => {
    setMode("actions");
    onClose();
  };

  const handleAction = async (key: (typeof actions)[number]["key"]) => {
    if (key === "sendCopy") {
      setMode("shareLink");
      setShareStatus("loading");
      setCopyStatus("idle");
      const link = await onSendCopy();
      if (link) {
        setShareLink(link);
        setShareStatus("success");
      } else {
        setShareStatus("error");
      }
      return;
    }

    if (key === "shareList") {
      onShareList();
      handleClose();
      return;
    }

    if (key === "customizeVisuals") {
      setMode("visualPicker");
      return;
    }

    setMode("deleteConfirm");
  };

  const handleConfirmDelete = () => {
    onConfirmDelete();
    handleClose();
  };


  const updateIcon = (icon?: string) => {
    onUpdateVisuals({ ...selectedVisuals, icon });
  };

  const updateBanner = (banner?: string) => {
    onUpdateVisuals({ ...selectedVisuals, banner });
  };

  const handleCopyLink = async () => {
    if (!shareLink) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareLink);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = shareLink;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopyStatus("copied");
    } catch (error) {
      console.error("copy_list_share_link_error", { error });
      setCopyStatus("error");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="list-actions-flow-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={backdropTransition}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-none bg-black/40 p-4 backdrop-blur-[2px] font-sans"
          onClick={handleClose}
        >
          <motion.div
            layout="size"
            layoutDependency={`${mode}-${shareStatus}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="list-actions-flow-title"
            aria-describedby={
              mode === "deleteConfirm" || mode === "shareLink"
                ? "list-actions-flow-description"
                : undefined
            }
            initial={{ opacity: 0, scale: 0.98, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 4 }}
            transition={cardTransition}
            className="relative my-8 w-full max-w-md transform-gpu overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl will-change-transform"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleClose}
              className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full text-gray-400 transition-[color,transform] hover:text-gray-600 active:scale-[0.94]"
              aria-label="Stäng liståtgärder"
            >
              <LucideIcon name="close" className="h-5 w-5" />
            </button>

            <AnimatePresence mode="popLayout" initial={false}>
              {mode === "actions" ? (
                <motion.div
                  key="actions"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={contentTransition}
                >
                  <div className="mb-5 pr-8">
                    <h2
                      id="list-actions-flow-title"
                      className="text-lg font-bold leading-tight text-gray-900"
                    >
                      Vad vill du göra?
                    </h2>
                    {listName && (
                      <p className="mt-1 truncate text-xs font-bold text-gray-500">
                        {listName}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    {actions.map((action) => (
                      <button
                        key={action.key}
                        type="button"
                        onClick={() => handleAction(action.key)}
                        className="group flex min-h-[68px] w-full items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/80 p-3 text-left shadow-sm transition-[background-color,box-shadow,transform] hover:bg-white active:scale-[0.98]"
                      >
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1 ${
                            action.destructive
                              ? "bg-red-50 text-red-600 ring-red-100"
                              : "bg-white text-gray-700 ring-gray-200"
                          }`}
                        >
                          <LucideIcon name={action.icon} className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block text-sm font-bold ${
                              action.destructive
                                ? "text-red-600"
                                : "text-gray-900"
                            }`}
                          >
                            {action.title}
                          </span>
                          <span className="mt-0.5 block text-xs font-medium leading-relaxed text-gray-500">
                            {action.subtitle}
                          </span>
                        </span>
                        <LucideIcon
                          name="chevron-right"
                          className="h-4 w-4 shrink-0 text-gray-300 transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-gray-400"
                        />
                      </button>
                    ))}
                  </div>
                </motion.div>
              ) : mode === "shareLink" ? (
                <motion.div
                  key="shareLink"
                  className="select-none"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={contentTransition}
                >
                  <div className="mb-5 flex items-start gap-3 pr-8">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700 ring-1 ring-green-100">
                      <LucideIcon name="link" className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <h2
                        id="list-actions-flow-title"
                        className="text-lg font-bold leading-tight text-gray-900"
                      >
                        Skicka lista
                      </h2>
                      {listName && (
                        <p className="mt-1 truncate text-xs font-bold text-gray-500">
                          {listName}
                        </p>
                      )}
                    </div>
                  </div>

                  {shareStatus === "loading" && (
                    <div
                      id="list-actions-flow-description"
                      className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 text-sm font-bold text-gray-700"
                    >
                      Skapar en låst kopia av listan...
                    </div>
                  )}

                  {shareStatus === "error" && (
                    <div
                      id="list-actions-flow-description"
                      className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700"
                    >
                      Det gick inte att skapa länken just nu. Kontrollera att du är inloggad och försök igen.
                    </div>
                  )}

                  {shareStatus === "success" && (
                    <div id="list-actions-flow-description" className="space-y-4">
                      <p className="text-sm font-medium leading-relaxed text-gray-600">
                        En fryst, läsbar kopia är skapad. Mottagaren kan öppna länken utan konto och kan inte ändra originallistan.
                      </p>
                      <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3 text-xs font-bold text-gray-700 break-all">
                        {shareLink}
                      </div>
                      {copyStatus === "copied" && (
                        <p className="text-xs font-bold text-green-700">Länken är kopierad.</p>
                      )}
                      {copyStatus === "error" && (
                        <p className="text-xs font-bold text-red-700">Kunde inte kopiera automatiskt. Markera länken och kopiera manuellt.</p>
                      )}
                    </div>
                  )}

                  <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={shareStatus === "loading" ? undefined : handleClose}
                      disabled={shareStatus === "loading"}
                      className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 shadow-sm transition-[background-color,transform] hover:bg-gray-50 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-28"
                    >
                      Stäng
                    </button>
                    {shareStatus === "error" && (
                      <button
                        type="button"
                        onClick={() => void handleAction("sendCopy")}
                        className="min-h-[44px] rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-[background-color,transform] hover:bg-secondary active:scale-[0.97] sm:min-w-28"
                      >
                        Försök igen
                      </button>
                    )}
                    {shareStatus === "success" && (
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="min-h-[44px] rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-[background-color,transform] hover:bg-secondary active:scale-[0.97] sm:min-w-28"
                      >
                        Kopiera länk
                      </button>
                    )}
                  </div>
                </motion.div>
              ) : mode === "visualPicker" ? (
                <motion.div
                  key="visualPicker"
                  className="select-none"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={contentTransition}
                >
                  <div className="mb-5 flex items-start gap-3 pr-8">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700 ring-1 ring-green-100">
                      <LucideIcon name="sparkles" className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <h2
                        id="list-actions-flow-title"
                        className="text-lg font-bold leading-tight text-gray-900"
                      >
                        Anpassa utseende
                      </h2>
                      {listName && (
                        <p className="mt-1 truncate text-xs font-bold text-gray-500">
                          {listName}
                        </p>
                      )}
                    </div>
                  </div>

                  <div id="list-actions-flow-description" className="space-y-5">
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                        Ikon
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        {LIST_ICON_OPTIONS.map((option) => {
                          const isSelected =
                            (selectedVisuals.icon || fallbackIcon) === option.key;

                          return (
                            <button
                              key={option.key}
                              type="button"
                              onClick={() => updateIcon(option.key)}
                              className={`flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl border text-xs font-bold transition-[background-color,border-color,transform] active:scale-[0.97] ${
                                isSelected
                                  ? "border-primary bg-green-50 text-primary"
                                  : "border-gray-100 bg-gray-50/80 text-gray-600 hover:bg-white"
                              }`}
                              aria-pressed={isSelected}
                            >
                              <LucideIcon name={option.key} className="h-4 w-4" />
                              <span>{option.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                        Banner
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => updateBanner(undefined)}
                          className={`min-h-[54px] rounded-xl border px-3 text-left text-xs font-bold transition-[background-color,border-color,transform] active:scale-[0.97] ${
                            !selectedVisuals.banner
                              ? "border-primary bg-green-50 text-primary"
                              : "border-gray-100 bg-gray-50/80 text-gray-600 hover:bg-white"
                          }`}
                          aria-pressed={!selectedVisuals.banner}
                        >
                          Ingen banner
                        </button>
                        {LIST_BANNER_OPTIONS.map((option) => {
                          const isSelected = selectedVisuals.banner === option.key;

                          return (
                            <button
                              key={option.key}
                              type="button"
                              onClick={() => updateBanner(option.key)}
                              className={`relative min-h-[54px] overflow-hidden rounded-xl border px-3 text-left text-xs font-bold transition-[background-color,border-color,transform] active:scale-[0.97] ${
                                isSelected
                                  ? "border-primary text-primary"
                                  : "border-gray-100 text-gray-700 hover:border-gray-200"
                              }`}
                              aria-pressed={isSelected}
                            >
                              <span
                                aria-hidden="true"
                                className={`absolute inset-0 opacity-70 ${option.className}`}
                              />
                              <span className="relative z-10">{option.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setMode("actions")}
                      className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 shadow-sm transition-[background-color,transform] hover:bg-gray-50 active:scale-[0.97] sm:min-w-28"
                    >
                      Tillbaka
                    </button>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="min-h-[44px] rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-[background-color,transform] hover:bg-secondary active:scale-[0.97] sm:min-w-28"
                    >
                      Klar
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="deleteConfirm"
                  className="select-none"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={contentTransition}
                >
                  <div className="mb-5 flex items-start gap-3 pr-8">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 ring-1 ring-red-100">
                      <LucideIcon name="archive" className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <h2
                        id="list-actions-flow-title"
                        className="text-lg font-bold leading-tight text-gray-900"
                      >
                        Ta bort lista?
                      </h2>
                      {listName && (
                        <p className="mt-1 truncate text-xs font-bold text-gray-500">
                          {listName}
                        </p>
                      )}
                    </div>
                  </div>

                  <p
                    id="list-actions-flow-description"
                    className="text-sm font-medium leading-relaxed text-gray-600"
                  >
                    Listan flyttas till Borttagna listor i 2 dagar. Du kan
                    återställa den från Inställningar.
                  </p>

                  <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setMode("actions")}
                      className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 shadow-sm transition-[background-color,transform] hover:bg-gray-50 active:scale-[0.97] sm:min-w-28"
                    >
                      Avbryt
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDelete}
                      className="min-h-[44px] rounded-xl bg-red-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/20 transition-[background-color,transform] hover:bg-red-600 active:scale-[0.97] sm:min-w-28"
                    >
                      Ta bort
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

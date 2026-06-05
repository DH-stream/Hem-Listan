import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import LucideIcon from "./LucideIcon";
import {
  APPEARANCE_PRESETS,
  deleteCustomAppearanceImage,
  getAppearanceBackgroundStyle,
  getAppearanceBadgeStyle,
  ListAppearance,
  ListAppearanceBackgroundRef,
  saveCustomAppearanceImage,
} from "../lib/listVisuals";

type ListActionsFlowModalProps = {
  isOpen: boolean;
  listName?: string;
  listId?: string;
  listIcon?: string;
  listThemeColor?: string;
  progressLabel?: string;
  progressPercent?: number;
  onClose: () => void;
  onSendCopy: () => Promise<string | null>;
  onShareList: () => void;
  selectedAppearance: ListAppearance;
  customImageUrls: Record<string, string>;
  onUpdateAppearance: (appearance: ListAppearance) => void;
  onConfirmDelete: () => void;
};

const ICON_OPTIONS = [
  { key: "shopping_cart", label: "Handla" },
  { key: "construction", label: "Fix" },
  { key: "home", label: "Hem" },
  { key: "today", label: "Plan" },
  { key: "book", label: "Läsa" },
  { key: "restaurant", label: "Mat" },
  { key: "favorite", label: "Omtanke" },
  { key: "flight", label: "Resa" },
] as const;

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
    key: "customizeAppearance",
    title: "Anpassa utseende",
    subtitle: "Byt bakgrund på ikon och listkort.",
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

type FlowMode = "actions" | "deleteConfirm" | "shareLink" | "appearancePicker";
type ShareStatus = "idle" | "loading" | "success" | "error";
type UploadStatus = "idle" | "loading" | "error";
type UploadTarget = "background" | "iconImage";

type CropDraft = {
  target: UploadTarget;
  ref: ListAppearanceBackgroundRef;
  previewUrl: string;
  isNew: boolean;
};

export default function ListActionsFlowModal({
  isOpen,
  listName,
  listId = "appearance-preview",
  listIcon = "list",
  listThemeColor = "#1a5319",
  progressLabel = "0/0 klara",
  progressPercent = 0,
  onClose,
  onSendCopy,
  onShareList,
  selectedAppearance,
  customImageUrls,
  onUpdateAppearance,
  onConfirmDelete,
}: ListActionsFlowModalProps) {
  const [mode, setMode] = useState<FlowMode>("actions");
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const [shareLink, setShareLink] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadTarget, setUploadTarget] = useState<UploadTarget>("background");
  const [cropDraft, setCropDraft] = useState<CropDraft | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cropDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    positionX: number;
    positionY: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setMode("actions");
    setShareStatus("idle");
    setShareLink("");
    setCopyStatus("idle");
    setUploadStatus("idle");

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const handleClose = () => {
    setMode("actions");
    setCropDraft(null);
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

    if (key === "customizeAppearance") {
      setUploadStatus("idle");
      setMode("appearancePicker");
      return;
    }

    setMode("deleteConfirm");
  };

  const handleConfirmDelete = () => {
    onConfirmDelete();
    handleClose();
  };

  const updateBackground = (background: ListAppearanceBackgroundRef | null) => {
    const previousBackground = selectedAppearance.background;
    onUpdateAppearance({ ...selectedAppearance, background });

    if (
      previousBackground?.type === "custom" &&
      previousBackground.id !== background?.id
    ) {
      void deleteCustomAppearanceImage(previousBackground.id).catch((error) => {
        console.error("delete_list_appearance_image_error", { error });
      });
    }
  };

  const updateIcon = (icon?: string | null) => {
    onUpdateAppearance({ ...selectedAppearance, icon: icon || null });
  };

  const updateIconImage = (iconImageOverride: ListAppearanceBackgroundRef | null) => {
    const previousIconImage = selectedAppearance.iconImageOverride;
    onUpdateAppearance({ ...selectedAppearance, iconImageOverride });

    if (
      previousIconImage?.type === "custom" &&
      previousIconImage.id !== iconImageOverride?.id
    ) {
      void deleteCustomAppearanceImage(previousIconImage.id).catch((error) => {
        console.error("delete_list_icon_image_error", { error });
      });
    }
  };

  const openCropEditor = (
    target: UploadTarget,
    ref: ListAppearanceBackgroundRef,
    previewUrl?: string,
    isNew = false,
  ) => {
    const existingUrl = target === "iconImage"
      ? customImageUrls[selectedAppearance.iconImageOverride?.id || ""]
      : customImageUrls[selectedAppearance.background?.id || ""];
    const url = previewUrl || existingUrl;
    if (!url) return;

    setCropDraft({
      target,
      ref: {
        ...ref,
        positionX: ref.positionX ?? 50,
        positionY: ref.positionY ?? 50,
        zoom: ref.zoom ?? 1,
      },
      previewUrl: url,
      isNew,
    });
  };

  const closeCropEditor = async (shouldDeleteNewImage = false) => {
    if (cropDraft?.isNew) {
      URL.revokeObjectURL(cropDraft.previewUrl);
      if (shouldDeleteNewImage) {
        await deleteCustomAppearanceImage(cropDraft.ref.id).catch((error) => {
          console.error("delete_unsaved_crop_image_error", { error });
        });
      }
    }
    cropDragRef.current = null;
    setCropDraft(null);
  };

  const saveCropEditor = () => {
    if (!cropDraft) return;

    if (cropDraft.target === "iconImage") {
      updateIconImage(cropDraft.ref);
    } else {
      updateBackground(cropDraft.ref);
    }

    void closeCropEditor(false);
  };

  const handleCropPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!cropDraft) return;
    const rect = event.currentTarget.getBoundingClientRect();
    cropDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      positionX: cropDraft.ref.positionX ?? 50,
      positionY: cropDraft.ref.positionY ?? 50,
      width: rect.width,
      height: rect.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleCropPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = cropDragRef.current;
    if (!cropDraft || !drag || drag.pointerId !== event.pointerId) return;

    const deltaX = ((event.clientX - drag.startX) / drag.width) * 100;
    const deltaY = ((event.clientY - drag.startY) / drag.height) * 100;

    setCropDraft({
      ...cropDraft,
      ref: {
        ...cropDraft.ref,
        positionX: Math.min(100, Math.max(0, drag.positionX - deltaX)),
        positionY: Math.min(100, Math.max(0, drag.positionY - deltaY)),
      },
    });
  };

  const handleCropPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (cropDragRef.current?.pointerId === event.pointerId) {
      cropDragRef.current = null;
    }
  };

  const handleUploadClick = (target: UploadTarget) => {
    setUploadTarget(target);
    fileInputRef.current?.click();
  };

  const handleUploadChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadStatus("loading");
    try {
      const ref = await saveCustomAppearanceImage(file);
      const previewUrl = URL.createObjectURL(file);
      openCropEditor(uploadTarget, ref, previewUrl, true);
      setUploadStatus("idle");
    } catch (error) {
      console.error("save_list_appearance_image_error", { error });
      setUploadStatus("error");
    }
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

  const selectedIcon = selectedAppearance.icon || listIcon;
  const selectedIconImage = selectedAppearance.iconImageOverride || null;
  const selectedBackground = selectedAppearance.background || null;
  const backgroundStyle = getAppearanceBackgroundStyle(
    selectedBackground,
    customImageUrls,
    listId,
  );
  const badgeBackgroundStyle = getAppearanceBadgeStyle(
    selectedBackground,
    customImageUrls,
    `${listId}:badge`,
  );
  const iconImageStyle = getAppearanceBackgroundStyle(
    selectedIconImage,
    customImageUrls,
    `${listId}:icon`,
  );
  const cropPreviewStyle = cropDraft
    ? {
        backgroundImage: `url(${cropDraft.previewUrl})`,
        backgroundPosition: `${cropDraft.ref.positionX ?? 50}% ${cropDraft.ref.positionY ?? 50}%`,
        backgroundSize:
          (cropDraft.ref.zoom ?? 1) > 1
            ? `${Math.round((cropDraft.ref.zoom ?? 1) * 100)}%`
            : "cover",
      }
    : undefined;

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
            layoutDependency={`${mode}-${shareStatus}-${selectedBackground?.id || "none"}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="list-actions-flow-title"
            aria-describedby={
              mode === "deleteConfirm" ||
              mode === "shareLink" ||
              mode === "appearancePicker"
                ? "list-actions-flow-description"
                : undefined
            }
            initial={{ opacity: 0, scale: 0.98, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 4 }}
            transition={cardTransition}
            className="relative my-4 flex max-h-[calc(100dvh-2rem)] w-full max-w-md transform-gpu flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white p-0 shadow-2xl will-change-transform sm:my-8 sm:max-h-[calc(100dvh-4rem)]"
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

            <div className="min-h-0 flex-1 overflow-y-auto p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch]">
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
              ) : mode === "appearancePicker" ? (
                <motion.div
                  key="appearancePicker"
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

                  <div id="list-actions-flow-description" className="space-y-4">
                    <p className="text-sm font-medium leading-relaxed text-gray-600">
                      Välj ikon och en bakgrund som visas både i ikonens cirkel och bakom listkortet.
                    </p>

                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                        Ikon
                      </p>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        <button
                          type="button"
                          onClick={() => updateIcon(null)}
                          className={`flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl border text-xs font-bold transition-[background-color,border-color,transform] active:scale-[0.97] ${
                            !selectedAppearance.icon
                              ? "border-primary bg-green-50 text-primary"
                              : "border-gray-100 bg-gray-50/80 text-gray-600 hover:bg-white"
                          }`}
                          aria-pressed={!selectedAppearance.icon}
                        >
                          <LucideIcon name={listIcon} className="h-4 w-4" />
                          <span>Standardikon</span>
                        </button>
                        {ICON_OPTIONS.map((option) => {
                          const isSelected = selectedAppearance.icon === option.key;

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

                    <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                            Egen ikonbild
                          </p>
                          <p className="mt-1 text-xs font-medium text-gray-500">
                            Visas bara i den runda ikonbrickan.
                          </p>
                        </div>
                        {iconImageStyle && (
                          <div
                            aria-hidden="true"
                            className="h-11 w-11 shrink-0 rounded-full bg-cover bg-center ring-1 ring-white"
                            style={iconImageStyle}
                          />
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => handleUploadClick("iconImage")}
                          disabled={uploadStatus === "loading"}
                          className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 shadow-sm transition-[background-color,transform] hover:bg-gray-50 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {uploadStatus === "loading" && uploadTarget === "iconImage"
                            ? "Sparar..."
                            : "Ladda upp ikonbild"}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateIconImage(null)}
                          className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 shadow-sm transition-[background-color,transform] hover:bg-gray-50 active:scale-[0.97]"
                        >
                          Ta bort ikonbild
                        </button>
                      </div>
                      {selectedIconImage?.type === "custom" && (
                        <button
                          type="button"
                          onClick={() => openCropEditor("iconImage", selectedIconImage)}
                          className="min-h-[44px] w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 shadow-sm transition-[background-color,transform] hover:bg-gray-50 active:scale-[0.97]"
                        >
                          Redigera beskärning
                        </button>
                      )}
                    </div>

                    <div
                      className="relative flex items-center justify-between overflow-hidden rounded-xl border border-surface-container/40 bg-surface-container-lowest p-4 shadow-sm"
                    >
                      {backgroundStyle && (
                        <>
                          <div
                            aria-hidden="true"
                            className="absolute inset-0 bg-cover bg-center"
                            style={backgroundStyle}
                          />
                          <div
                            aria-hidden="true"
                            className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.76)_0%,rgba(255,255,255,0.52)_48%,rgba(255,255,255,0.24)_100%)]"
                          />
                        </>
                      )}
                      <div className="relative z-10 flex flex-1 items-center gap-4">
                        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E0F2F1] text-primary-container">
                          {badgeBackgroundStyle && (
                            <>
                              <div
                                aria-hidden="true"
                                className="absolute inset-0 bg-cover bg-center"
                                style={badgeBackgroundStyle}
                              />
                              <div aria-hidden="true" className="absolute inset-0 bg-white/42" />
                            </>
                          )}
                          {iconImageStyle && (
                            <>
                              <div
                                aria-hidden="true"
                                className="absolute inset-0 bg-cover bg-center"
                                style={iconImageStyle}
                              />
                              <div aria-hidden="true" className="absolute inset-0 bg-black/10" />
                            </>
                          )}
                          <LucideIcon
                            name={selectedIcon}
                            className="relative z-10 h-6 w-6 drop-shadow-[0_1px_2px_rgba(255,255,255,0.75)]"
                          />
                        </div>
                        <div className="min-w-0 flex-1 pr-2">
                          <h3 className="truncate font-display text-base font-bold text-text-main">
                            {listName || "Min lista"}
                          </h3>
                          <div className="mb-1 mt-1.5 flex items-center justify-between font-sans text-xs font-medium text-outline">
                            <span>{progressLabel}</span>
                            <span>{progressPercent}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-low">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${progressPercent}%`,
                                backgroundColor: listThemeColor,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                      <LucideIcon
                        name="chevron-right"
                        className="relative z-10 ml-2 h-5 w-5 text-outline opacity-40"
                      />
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                        Färdiga bakgrunder
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {APPEARANCE_PRESETS.map((preset) => {
                          const isSelected =
                            selectedBackground?.type === "preset" &&
                            selectedBackground.id === preset.id;

                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() =>
                                updateBackground({ type: "preset", id: preset.id })
                              }
                              className={`relative h-40 overflow-hidden rounded-xl border p-3 text-left transition-[border-color,transform] active:scale-[0.97] ${
                                isSelected
                                  ? "border-primary text-primary"
                                  : "border-gray-100 text-gray-700 hover:border-gray-200"
                              }`}
                              aria-pressed={isSelected}
                            >
                              <span
                                aria-hidden="true"
                                className="absolute inset-0"
                                style={getAppearanceBackgroundStyle(
                                  { type: "preset", id: preset.id },
                                  {},
                                  `${listId}:${preset.id}`,
                                )}
                              />
                              <span className="absolute inset-0 bg-white/10" />
                              <span className="absolute inset-x-2 bottom-2 rounded-lg bg-white/72 px-2.5 py-2 shadow-sm backdrop-blur-[1px]">
                                <span className="block text-xs font-bold text-gray-800">
                                  {preset.label}
                                </span>
                                <span className="mt-0.5 block text-[11px] font-semibold leading-snug text-gray-600">
                                  {preset.description}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleUploadChange}
                      />
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => handleUploadClick("background")}
                          disabled={uploadStatus === "loading"}
                          className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 shadow-sm transition-[background-color,transform] hover:bg-gray-50 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {uploadStatus === "loading" && uploadTarget === "background" ? "Sparar..." : "Ladda upp egen bild"}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateBackground(null)}
                          className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 shadow-sm transition-[background-color,transform] hover:bg-gray-50 active:scale-[0.97]"
                        >
                          Ta bort bakgrund
                        </button>
                      </div>

                      {selectedBackground?.type === "custom" && (
                        <button
                          type="button"
                          onClick={() => openCropEditor("background", selectedBackground)}
                          className="min-h-[44px] w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 shadow-sm transition-[background-color,transform] hover:bg-gray-50 active:scale-[0.97]"
                        >
                          Redigera beskärning
                        </button>
                      )}

                      {uploadStatus === "error" && (
                        <p className="text-xs font-bold text-red-700">
                          Bilden kunde inte sparas lokalt. Försök med en mindre bild.
                        </p>
                      )}
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
            </div>
          </motion.div>
        </motion.div>
      )}
      {cropDraft && (
        <motion.div
          key="appearance-crop-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={backdropTransition}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 font-sans"
          onClick={() => void closeCropEditor(true)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="appearance-crop-title"
            initial={{ opacity: 0, scale: 0.98, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            transition={cardTransition}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 pr-8">
              <h2 id="appearance-crop-title" className="text-lg font-bold text-gray-900">
                {cropDraft.target === "iconImage" ? "Beskär ikonbild" : "Beskär bakgrund"}
              </h2>
              <p className="mt-1 text-xs font-medium leading-relaxed text-gray-500">
                Dra bilden bakom ramen och justera zoom innan du sparar.
              </p>
            </div>

            <div className="flex justify-center">
              <div
                className={`relative touch-none overflow-hidden bg-gray-900 shadow-inner ${
                  cropDraft.target === "iconImage"
                    ? "h-64 w-64 rounded-full"
                    : "aspect-[16/9] w-full rounded-xl"
                }`}
                onPointerDown={handleCropPointerDown}
                onPointerMove={handleCropPointerMove}
                onPointerUp={handleCropPointerUp}
                onPointerCancel={handleCropPointerUp}
              >
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-cover bg-center"
                  style={cropPreviewStyle}
                />
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-0 ${
                    cropDraft.target === "iconImage"
                      ? "rounded-full ring-2 ring-white/90 ring-inset"
                      : "rounded-xl ring-2 ring-white/90 ring-inset"
                  }`}
                />
              </div>
            </div>

            <label className="mt-5 block text-xs font-bold text-gray-600">
              Zoom
              <input
                type="range"
                min="1"
                max="2"
                step="0.05"
                value={cropDraft.ref.zoom ?? 1}
                onChange={(event) =>
                  setCropDraft({
                    ...cropDraft,
                    ref: { ...cropDraft.ref, zoom: Number(event.target.value) },
                  })
                }
                className="mt-2 w-full accent-primary"
              />
            </label>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => void closeCropEditor(true)}
                className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 shadow-sm transition-[background-color,transform] hover:bg-gray-50 active:scale-[0.97] sm:min-w-28"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={saveCropEditor}
                className="min-h-[44px] rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-[background-color,transform] hover:bg-secondary active:scale-[0.97] sm:min-w-28"
              >
                Spara
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

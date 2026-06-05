import type { CSSProperties } from "react";

export type ListAppearanceBackgroundRef = {
  type: "preset" | "custom";
  id: string;
  positionX?: number;
  positionY?: number;
  zoom?: number;
};

export type ListAppearance = {
  background?: ListAppearanceBackgroundRef | null;
};

export type ListAppearanceMap = Record<string, ListAppearance>;

export type AppearancePreset = {
  id: string;
  label: string;
  description: string;
  backgroundColor: string;
  backgroundImage: string;
};

const LIST_APPEARANCE_STORAGE_KEY = "hem_listan_list_appearance";
const IMAGE_DB_NAME = "hem_listan_appearance_images";
const IMAGE_DB_VERSION = 1;
const IMAGE_STORE_NAME = "images";

const heartMotif = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M42 64c-20-18-48 9-15 43 13 13 29 22 29 22s16-9 29-22c33-34 5-61-15-43-8 8-14 16-14 16S50 72 42 64Z" fill="rgba(236,91,132,.20)" stroke="rgba(150,54,86,.24)" stroke-width="5"/><path d="M108 34c-10-9-24 5-8 22 7 7 16 12 16 12s9-5 16-12c16-17 2-31-8-22-5 4-8 9-8 9s-3-5-8-9Z" fill="rgba(255,184,190,.34)" stroke="rgba(150,54,86,.20)" stroke-width="3"/><path d="M28 34c13-12 29-12 43 0" stroke="rgba(255,176,111,.24)" stroke-width="8"/><circle cx="124" cy="116" r="14" fill="rgba(255,202,164,.28)" stroke="rgba(150,54,86,.14)" stroke-width="3"/><circle cx="30" cy="125" r="6" fill="rgba(236,91,132,.26)"/></g></svg>`,
);
const leafMotif = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 170 170"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M36 118c48-2 78-33 91-89 0 0-57 4-81 35-17 22-10 54-10 54Z" fill="rgba(89,164,78,.22)" stroke="rgba(35,105,55,.26)" stroke-width="5"/><path d="M38 118c22-30 48-52 81-70" stroke="rgba(35,105,55,.30)" stroke-width="5"/><path d="M96 122c29-1 48-19 55-52 0 0-34 3-48 21-10 13-7 31-7 31Z" fill="rgba(164,203,112,.26)" stroke="rgba(35,105,55,.18)" stroke-width="4"/><path d="M22 54c21 1 36 12 45 32" stroke="rgba(235,174,72,.22)" stroke-width="7"/><circle cx="40" cy="138" r="8" fill="rgba(77,155,80,.22)"/><circle cx="132" cy="38" r="7" fill="rgba(255,209,102,.24)"/></g></svg>`,
);
const freshMotif = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><g fill="none" stroke-linecap="round"><circle cx="42" cy="46" r="22" fill="rgba(155,221,224,.22)" stroke="rgba(31,138,153,.24)" stroke-width="4"/><circle cx="110" cy="92" r="30" fill="rgba(196,238,224,.20)" stroke="rgba(70,159,130,.20)" stroke-width="5"/><circle cx="128" cy="42" r="10" fill="rgba(118,205,218,.22)"/><path d="M26 110c28-20 65-23 103-8" stroke="rgba(31,138,153,.18)" stroke-width="9"/><path d="M34 128c18-10 40-12 66-5" stroke="rgba(70,159,130,.16)" stroke-width="6"/><path d="M64 30c9-11 23-16 40-13" stroke="rgba(255,255,255,.55)" stroke-width="8"/></g></svg>`,
);
const playfulMotif = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 170 170"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="38" cy="42" r="17" fill="rgba(255,190,77,.34)" stroke="rgba(142,96,43,.16)" stroke-width="3"/><circle cx="122" cy="44" r="14" fill="rgba(101,183,222,.30)" stroke="rgba(49,117,148,.14)" stroke-width="3"/><circle cx="84" cy="112" r="22" fill="rgba(232,112,142,.22)" stroke="rgba(145,74,98,.16)" stroke-width="4"/><path d="M32 126c30 17 70 17 108-4" stroke="rgba(120,82,45,.22)" stroke-width="7"/><path d="M56 74c15-11 36-13 57-3" stroke="rgba(101,183,222,.20)" stroke-width="6"/><circle cx="140" cy="122" r="7" fill="rgba(255,190,77,.30)"/><circle cx="28" cy="100" r="6" fill="rgba(116,190,132,.28)"/></g></svg>`,
);

export const APPEARANCE_PRESETS: AppearancePreset[] = [
  {
    id: "care-heart",
    label: "Kärlek / Omtanke",
    description: "Varm rosa och kräm med mjuka hjärtformer.",
    backgroundColor: "#fff3ef",
    backgroundImage: `url("data:image/svg+xml,${heartMotif}"), radial-gradient(circle at 16% 18%, rgba(244, 112, 154, 0.55), transparent 30%), radial-gradient(circle at 88% 20%, rgba(255, 190, 156, 0.70), transparent 28%), radial-gradient(circle at 62% 86%, rgba(252, 231, 243, 0.88), transparent 34%), linear-gradient(135deg, rgba(255, 247, 240, 0.98), rgba(252, 218, 232, 0.92))`,
  },
  {
    id: "nature-green",
    label: "Natur / Grönt",
    description: "Botanisk grön bakgrund med bladkänsla.",
    backgroundColor: "#eef7e8",
    backgroundImage: `url("data:image/svg+xml,${leafMotif}"), radial-gradient(circle at 18% 22%, rgba(76, 175, 80, 0.55), transparent 30%), radial-gradient(circle at 84% 68%, rgba(180, 216, 125, 0.72), transparent 34%), radial-gradient(circle at 56% 12%, rgba(255, 214, 102, 0.35), transparent 22%), linear-gradient(135deg, rgba(229, 245, 223, 0.98), rgba(251, 247, 212, 0.78))`,
  },
  {
    id: "clean-fresh",
    label: "Rent / Fräscht",
    description: "Luftig blågrön, fräsch och spa-lik.",
    backgroundColor: "#eefbfb",
    backgroundImage: `url("data:image/svg+xml,${freshMotif}"), radial-gradient(circle at 18% 24%, rgba(96, 207, 222, 0.50), transparent 30%), radial-gradient(circle at 86% 18%, rgba(176, 235, 226, 0.70), transparent 28%), radial-gradient(circle at 66% 84%, rgba(196, 238, 224, 0.62), transparent 32%), linear-gradient(135deg, rgba(246, 253, 255, 0.99), rgba(218, 246, 236, 0.82))`,
  },
  {
    id: "playful-family",
    label: "Lekfullt / Familj",
    description: "Mjuka prickar och varma familjevänliga former.",
    backgroundColor: "#fff8e6",
    backgroundImage: `url("data:image/svg+xml,${playfulMotif}"), radial-gradient(circle at 16% 22%, rgba(255, 202, 74, 0.62), transparent 25%), radial-gradient(circle at 84% 26%, rgba(108, 197, 235, 0.48), transparent 25%), radial-gradient(circle at 58% 82%, rgba(244, 143, 177, 0.42), transparent 28%), linear-gradient(135deg, rgba(255, 251, 222, 0.98), rgba(255, 232, 214, 0.88))`,
  },
];

const normalizeBackgroundRef = (
  value: unknown,
): ListAppearanceBackgroundRef | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const ref = value as Record<string, unknown>;
  if ((ref.type !== "preset" && ref.type !== "custom") || typeof ref.id !== "string") {
    return null;
  }

  return {
    type: ref.type,
    id: ref.id,
    positionX: typeof ref.positionX === "number" ? ref.positionX : 50,
    positionY: typeof ref.positionY === "number" ? ref.positionY : 50,
    zoom: typeof ref.zoom === "number" ? ref.zoom : 1,
  };
};

const normalizeListAppearance = (value: unknown): ListAppearance => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const appearance = value as Record<string, unknown>;

  const background =
    normalizeBackgroundRef(appearance.background) ||
    normalizeBackgroundRef(appearance.bannerImage) ||
    normalizeBackgroundRef(appearance.iconImage);

  return background ? { background } : {};
};

export const getAppearancePreset = (
  ref?: ListAppearanceBackgroundRef | null,
) => {
  if (!ref || ref.type !== "preset") return undefined;
  return APPEARANCE_PRESETS.find((preset) => preset.id === ref.id);
};


const hashSeed = (seed: string) =>
  Array.from(seed).reduce((hash, char) => {
    return (hash * 31 + char.charCodeAt(0)) >>> 0;
  }, 2166136261);

const seededValue = (hash: number, shift: number, min: number, max: number) => {
  const value = ((hash >>> shift) & 255) / 255;
  return Math.round(min + value * (max - min));
};

export const getAppearanceBackgroundStyle = (
  ref: ListAppearanceBackgroundRef | null | undefined,
  customImageUrls: Record<string, string>,
  seed: string,
): CSSProperties | undefined => {
  if (!ref) return undefined;

  if (ref.type === "preset") {
    const preset = getAppearancePreset(ref);
    if (!preset) return undefined;

    const hash = hashSeed(`${seed}:${ref.id}`);
    const motifX = seededValue(hash, 0, -18, 22);
    const motifY = seededValue(hash, 8, -12, 24);
    const motifSize = seededValue(hash, 16, 106, 146);
    const glowX = seededValue(hash, 4, 8, 30);
    const glowY = seededValue(hash, 12, 12, 36);
    const accentX = seededValue(hash, 20, 70, 96);
    const accentY = seededValue(hash, 2, 8, 32);

    return {
      backgroundColor: preset.backgroundColor,
      backgroundImage: preset.backgroundImage,
      backgroundPosition: `${motifX}px ${motifY}px, ${glowX}% ${glowY}%, ${accentX}% ${accentY}%, 58% 84%, center`,
      backgroundRepeat: "repeat, no-repeat, no-repeat, no-repeat, no-repeat",
      backgroundSize: `${motifSize}px ${motifSize}px, cover, cover, cover, cover`,
    };
  }

  const url = customImageUrls[ref.id];
  return url
    ? {
        backgroundImage: `url(${url})`,
        backgroundPosition: `${ref.positionX ?? 50}% ${ref.positionY ?? 50}%`,
        backgroundSize:
          (ref.zoom ?? 1) > 1
            ? `${Math.round((ref.zoom ?? 1) * 100)}%`
            : "cover",
      }
    : undefined;
};
export const readListAppearanceMap = (): ListAppearanceMap => {
  try {
    const raw = localStorage.getItem(LIST_APPEARANCE_STORAGE_KEY);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.entries(parsed).reduce<ListAppearanceMap>(
      (acc, [listId, appearance]) => {
        const normalizedAppearance = normalizeListAppearance(appearance);
        if (normalizedAppearance.background) {
          acc[listId] = normalizedAppearance;
        }
        return acc;
      },
      {},
    );
  } catch (_) {
    return {};
  }
};

export const writeListAppearance = (
  listId: string,
  appearance: ListAppearance,
): ListAppearanceMap => {
  const currentAppearance = readListAppearanceMap();
  const background = appearance.background || null;

  if (!background) {
    delete currentAppearance[listId];
  } else {
    currentAppearance[listId] = { background };
  }

  try {
    localStorage.setItem(
      LIST_APPEARANCE_STORAGE_KEY,
      JSON.stringify(currentAppearance),
    );
  } catch (_) {}

  return currentAppearance;
};

const openImageDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(IMAGE_DB_NAME, IMAGE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE_NAME)) {
        db.createObjectStore(IMAGE_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export const saveCustomAppearanceImage = async (
  file: File,
): Promise<ListAppearanceBackgroundRef> => {
  const db = await openImageDb();
  const imageId = `${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(IMAGE_STORE_NAME, "readwrite");
    transaction.objectStore(IMAGE_STORE_NAME).put(file, imageId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  db.close();
  return { type: "custom", id: imageId, positionX: 50, positionY: 50, zoom: 1 };
};

export const getCustomAppearanceImageUrl = async (id: string) => {
  const db = await openImageDb();

  const image = await new Promise<Blob | undefined>((resolve, reject) => {
    const transaction = db.transaction(IMAGE_STORE_NAME, "readonly");
    const request = transaction.objectStore(IMAGE_STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(request.error);
  });

  db.close();
  return image ? URL.createObjectURL(image) : null;
};

export const deleteCustomAppearanceImage = async (id: string) => {
  const db = await openImageDb();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(IMAGE_STORE_NAME, "readwrite");
    transaction.objectStore(IMAGE_STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  db.close();
};

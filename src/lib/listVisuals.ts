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
  icon?: string | null;
  iconImageOverride?: ListAppearanceBackgroundRef | null;
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
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 320"><rect width="240" height="320" fill="none"/><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M43 83c-26-24-61 13-23 54 16 17 38 30 38 30s22-13 38-30c38-41 3-78-23-54-10 9-15 19-15 19s-5-10-15-19Z" fill="rgba(244,150,172,.28)" stroke="rgba(207,113,139,.46)" stroke-width="8"/><path d="M154 49c-17-16-40 9-15 36 10 10 25 19 25 19s15-9 25-19c25-27 2-52-15-36-6 6-10 13-10 13s-4-7-10-13Z" fill="rgba(255,181,194,.34)" stroke="rgba(207,113,139,.38)" stroke-width="6"/><path d="M168 164c-22-20-51 10-18 45 13 14 32 25 32 25s19-11 32-25c33-35 4-65-18-45-8 8-14 17-14 17s-6-9-14-17Z" fill="rgba(255,246,224,.52)" stroke="rgba(255,246,224,.75)" stroke-width="7"/><path d="M54 237c-15-14-35 8-13 31 9 9 22 17 22 17s13-8 22-17c22-23 2-45-13-31-6 6-9 12-9 12s-3-6-9-12Z" fill="rgba(255,246,224,.36)" stroke="rgba(255,246,224,.68)" stroke-width="6"/><path d="M32 22c20-30 49-43 83-39" stroke="rgba(255,246,224,.34)" stroke-width="10"/><path d="M187 258c14-19 31-28 53-27" stroke="rgba(207,113,139,.20)" stroke-width="9"/></g></svg>`,
);
const leafMotif = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 320"><rect width="240" height="320" fill="none"/><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M36 110c41-4 67-30 78-79 0 0-46 4-68 30-17 20-10 49-10 49Z" fill="rgba(61,111,76,.22)" stroke="rgba(42,78,56,.48)" stroke-width="4"/><path d="M39 110c18-27 40-46 68-61" stroke="rgba(42,78,56,.55)" stroke-width="4"/><path d="M154 86c30-4 48-25 53-60 0 0-34 5-49 25-11 14-4 35-4 35Z" fill="rgba(99,145,105,.22)" stroke="rgba(42,78,56,.44)" stroke-width="4"/><path d="M160 89c10-22 23-38 40-51" stroke="rgba(42,78,56,.42)" stroke-width="3"/><path d="M138 206c38-5 63-31 73-77 0 0-44 6-64 31-16 19-9 46-9 46Z" fill="rgba(76,124,83,.20)" stroke="rgba(42,78,56,.45)" stroke-width="4"/><path d="M141 206c18-28 39-47 63-61" stroke="rgba(42,78,56,.45)" stroke-width="4"/><path d="M48 242c28-4 46-23 54-56 0 0-32 4-47 22-11 14-7 34-7 34Z" fill="rgba(142,176,137,.22)" stroke="rgba(42,78,56,.34)" stroke-width="3"/><path d="M182 270c13-22 27-40 44-53" stroke="rgba(42,78,56,.32)" stroke-width="5"/><path d="M24 184c20-17 42-24 67-20" stroke="rgba(237,197,164,.55)" stroke-width="10"/><path d="M172 126c15 3 27 10 36 22" stroke="rgba(217,235,205,.45)" stroke-width="11"/><circle cx="31" cy="42" r="16" fill="rgba(55,92,66,.18)" stroke="rgba(42,78,56,.28)" stroke-width="2"/><circle cx="61" cy="33" r="11" fill="rgba(55,92,66,.16)"/><ellipse cx="207" cy="182" rx="16" ry="8" fill="rgba(240,199,170,.55)" transform="rotate(-7 207 182)"/></g></svg>`,
);
const energyMotif = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 320"><rect width="240" height="320" fill="#202124"/><defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#26282b"/><stop offset="1" stop-color="#17181b"/></linearGradient></defs><rect width="240" height="320" fill="url(#g)"/><path d="M106 77 80 131h32l-16 58 62-83h-34l17-49Z" fill="#ffc928" stroke="#ff3b16" stroke-width="6" stroke-linejoin="round"/><path d="M113 73 96 118h28l-12 47 37-56h-29l14-36Z" fill="#ff6a19" opacity=".86"/><g transform="translate(0 198)"><path d="M0 122c8-33 15-47 29-67-4 26 5 35 16 52 0-43 26-69 45-97-9 42 21 52 20 94 19-30 29-56 34-91 29 37 44 69 37 111 14-25 24-40 39-62-2 34 11 46 20 60v0H0Z" fill="#3a1715"/><path d="M0 122c6-22 16-42 35-61-3 25 4 36 14 52 7-45 28-61 45-92-5 40 20 48 18 88 18-27 29-50 32-82 27 34 34 62 28 95 15-23 30-42 44-54-4 27 9 40 24 54H0Z" fill="#b51d0d"/><path d="M11 122c9-28 19-41 36-58-1 21 8 36 22 49 3-32 20-53 38-72-2 34 19 46 19 78 14-22 22-39 27-66 20 25 28 49 23 69 11-17 21-26 33-37-2 21 7 28 20 37H11Z" fill="#ff5a14"/><path d="M28 122c8-19 19-30 30-40 2 18 10 30 24 37 2-25 11-39 25-54 4 27 20 38 18 57 14-19 21-29 27-49 13 18 18 35 15 49 9-12 18-20 29-27 1 13 8 20 18 27H28Z" fill="#ffc21a"/></g></svg>`,
);
const playfulMotif = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 320"><rect width="240" height="320" fill="none"/><g fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="68" cy="62" r="32" fill="rgba(239,188,73,.76)" stroke="rgba(209,151,53,.20)" stroke-width="4"/><circle cx="168" cy="73" r="34" fill="rgba(146,196,202,.72)"/><rect x="119" y="122" width="74" height="48" rx="24" fill="rgba(241,112,91,.78)" transform="rotate(-3 156 146)"/><path d="M46 170c15-20 36-20 51 0-15 19-36 19-51 0Z" fill="rgba(242,143,114,.72)"/><path d="M64 222 88 263H40Z" fill="rgba(232,137,104,.70)"/><circle cx="164" cy="242" r="31" fill="rgba(61,130,137,.78)"/><path d="M184 36c18-12 30-17 45-18" stroke="rgba(98,151,159,.76)" stroke-width="12"/><path d="M35 109c19-5 32-3 48 8" stroke="rgba(98,151,159,.64)" stroke-width="10"/><path d="M160 204c20-11 34-11 51 0" stroke="rgba(239,188,73,.72)" stroke-width="10"/><path d="M191 110 204 96l13 14-13 14Z" fill="rgba(241,112,91,.72)"/><path d="M91 112 105 99l14 13-14 14Z" fill="rgba(61,130,137,.72)"/><circle cx="35" cy="284" r="7" fill="rgba(239,188,73,.72)"/><circle cx="210" cy="282" r="8" fill="rgba(241,112,91,.68)"/><circle cx="41" cy="38" r="5" fill="rgba(98,151,159,.62)"/><path d="M17 243c18 2 28 8 36 21" stroke="rgba(241,112,91,.62)" stroke-width="8"/></g></svg>`,
);

export const APPEARANCE_PRESETS: AppearancePreset[] = [
  {
    id: "care-heart",
    label: "Kärlek / Omtanke",
    description: "Varm rosa och kräm med mjuka hjärtformer.",
    backgroundColor: "#fff3ef",
    backgroundImage: `url("data:image/svg+xml,${heartMotif}"), linear-gradient(135deg, rgba(255, 247, 240, 0.98), rgba(252, 218, 232, 0.92))`,
  },
  {
    id: "nature-green",
    label: "Natur / Grönt",
    description: "Botanisk grön bakgrund med bladkänsla.",
    backgroundColor: "#eef7e8",
    backgroundImage: `url("data:image/svg+xml,${leafMotif}"), linear-gradient(135deg, rgba(229, 245, 223, 0.98), rgba(251, 247, 212, 0.78))`,
  },
  {
    id: "tough-energy",
    label: "Tufft / Energi",
    description: "Mörk energi med flammor och blixt.",
    backgroundColor: "#202124",
    backgroundImage: `url("data:image/svg+xml,${energyMotif}"), linear-gradient(135deg, rgba(38, 40, 43, 0.98), rgba(20, 21, 24, 0.96))`,
  },
  {
    id: "playful-family",
    label: "Lekfullt / Familj",
    description: "Mjuka prickar och varma familjevänliga former.",
    backgroundColor: "#fff8e6",
    backgroundImage: `url("data:image/svg+xml,${playfulMotif}"), linear-gradient(135deg, rgba(255, 251, 222, 0.98), rgba(255, 232, 214, 0.88))`,
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
  const icon = typeof appearance.icon === "string" ? appearance.icon : null;
  const iconImage = normalizeBackgroundRef(appearance.iconImageOverride);

  return background || icon || iconImage ? { background, icon, iconImageOverride: iconImage } : {};
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
    const motifSize = seededValue(hash, 16, 130, 176);
    return {
      backgroundColor: preset.backgroundColor,
      backgroundImage: preset.backgroundImage,
      backgroundPosition: `${motifX / 2}px ${motifY / 2}px, center`,
      backgroundRepeat: "no-repeat, no-repeat",
      backgroundSize: `${motifSize + 110}px auto, cover`,
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
export const getAppearanceBadgeStyle = (
  ref: ListAppearanceBackgroundRef | null | undefined,
  customImageUrls: Record<string, string>,
  seed: string,
): CSSProperties | undefined => {
  if (!ref) return undefined;

  if (ref.type === "preset") {
    const preset = getAppearancePreset(ref);
    if (!preset) return undefined;

    const hash = hashSeed(`${seed}:${ref.id}:badge`);
    const accentX = seededValue(hash, 6, 18, 82);
    const accentY = seededValue(hash, 14, 18, 82);

    return {
      backgroundColor: preset.backgroundColor,
      backgroundImage: `radial-gradient(circle at ${accentX}% ${accentY}%, rgba(255,255,255,0.34), transparent 34%), linear-gradient(135deg, rgba(255,255,255,0.08), rgba(0,0,0,0.05))`,
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      backgroundSize: "cover",
    };
  }

  return getAppearanceBackgroundStyle(ref, customImageUrls, seed);
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
        if (
          normalizedAppearance.background ||
          normalizedAppearance.icon ||
          normalizedAppearance.iconImageOverride
        ) {
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
  const icon = appearance.icon || null;
  const iconImage = appearance.iconImageOverride || null;

  if (!background && !icon && !iconImage) {
    delete currentAppearance[listId];
  } else {
    currentAppearance[listId] = { background, icon, iconImageOverride: iconImage };
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

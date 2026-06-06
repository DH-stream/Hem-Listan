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
  position?: string;
};

const LIST_APPEARANCE_STORAGE_KEY = "hem_listan_list_appearance";
const IMAGE_DB_NAME = "hem_listan_appearance_images";
const IMAGE_DB_VERSION = 1;
const IMAGE_STORE_NAME = "images";

const heartMotif = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#fff5ed"/><stop offset="1" stop-color="#f8c9d8"/></linearGradient></defs><rect width="640" height="360" fill="url(#bg)"/><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M86 55C45 18-10 76 49 140c25 27 60 47 60 47s35-20 60-47c59-64 4-122-37-85-16 15-23 31-23 31s-7-16-23-31Z" fill="rgba(246,156,177,.30)" stroke="rgba(201,102,132,.45)" stroke-width="8"/><path d="M313 41c-24-22-56 13-20 52 15 15 36 28 36 28s21-13 36-28c36-39 4-74-20-52-9 8-16 20-16 20s-7-12-16-20Z" fill="rgba(255,205,214,.42)" stroke="rgba(199,102,132,.38)" stroke-width="6"/><path d="M504 80c-35-32-82 17-29 74 21 22 51 39 51 39s30-17 51-39c53-57 6-106-29-74-13 12-22 26-22 26s-9-14-22-26Z" fill="rgba(255,247,226,.48)" stroke="rgba(255,247,226,.72)" stroke-width="8"/><path d="M204 216c-19-17-44 9-16 39 11 12 28 21 28 21s17-9 28-21c28-30 3-56-16-39-7 7-12 15-12 15s-5-8-12-15Z" fill="rgba(255,247,226,.42)" stroke="rgba(255,247,226,.72)" stroke-width="6"/><path d="M390 206c-29-26-68 14-24 62 18 19 43 33 43 33s25-14 43-33c44-48 5-88-24-62-11 11-19 23-19 23s-8-12-19-23Z" fill="rgba(246,156,177,.22)" stroke="rgba(199,102,132,.30)" stroke-width="7"/><path d="M571 240c-19-17-45 9-16 40 11 12 28 21 28 21s17-9 28-21c29-31 3-57-16-40-7 7-12 15-12 15s-5-8-12-15Z" fill="rgba(255,247,226,.34)" stroke="rgba(255,247,226,.66)" stroke-width="6"/><path d="M-10 290c28-43 71-61 125-52" stroke="rgba(255,247,226,.38)" stroke-width="12"/><path d="M500 13c40-26 82-28 126-7" stroke="rgba(255,247,226,.34)" stroke-width="11"/></g></svg>`,
);

const leafMotif = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#dbe8cd"/><stop offset="1" stop-color="#8fb28e"/></linearGradient></defs><rect width="640" height="360" fill="url(#bg)"/><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M42 96c56-10 92-45 108-107 0 0-63 7-94 42-25 28-14 65-14 65Z" fill="rgba(46,83,58,.20)" stroke="rgba(32,63,45,.55)" stroke-width="5"/><path d="M48 96c25-37 56-64 94-83" stroke="rgba(32,63,45,.54)" stroke-width="4"/><path d="M246 87c45-8 74-36 88-87 0 0-53 8-78 38-19 23-10 49-10 49Z" fill="rgba(52,90,62,.16)" stroke="rgba(32,63,45,.45)" stroke-width="4"/><path d="M251 89c20-31 44-53 75-68" stroke="rgba(32,63,45,.44)" stroke-width="4"/><path d="M478 90c55-10 91-44 107-104 0 0-62 8-92 42-24 27-15 62-15 62Z" fill="rgba(45,80,56,.22)" stroke="rgba(32,63,45,.52)" stroke-width="5"/><path d="M484 92c24-37 56-62 93-81" stroke="rgba(32,63,45,.50)" stroke-width="4"/><path d="M142 220c42-8 68-34 80-79 0 0-48 7-70 33-18 21-10 46-10 46Z" fill="rgba(61,105,69,.20)" stroke="rgba(32,63,45,.43)" stroke-width="4"/><path d="M148 220c18-29 40-49 68-63" stroke="rgba(32,63,45,.44)" stroke-width="4"/><path d="M385 238c53-10 86-42 101-101 0 0-60 7-89 40-22 27-12 61-12 61Z" fill="rgba(42,76,53,.18)" stroke="rgba(32,63,45,.46)" stroke-width="5"/><path d="M392 238c24-35 54-59 88-78" stroke="rgba(32,63,45,.45)" stroke-width="4"/><path d="M548 260c29-45 64-76 106-96" stroke="rgba(32,63,45,.34)" stroke-width="6"/><path d="M12 264c34-26 72-34 114-24" stroke="rgba(238,198,166,.62)" stroke-width="11"/><path d="M420 145c26 5 49 19 67 42" stroke="rgba(221,238,208,.46)" stroke-width="11"/><circle cx="88" cy="28" r="17" fill="rgba(41,75,52,.20)" stroke="rgba(32,63,45,.32)" stroke-width="2"/><circle cx="124" cy="23" r="11" fill="rgba(41,75,52,.18)"/><circle cx="577" cy="128" r="10" fill="rgba(222,237,205,.46)"/><ellipse cx="575" cy="42" rx="19" ry="8" fill="rgba(240,199,170,.58)" transform="rotate(-8 575 42)"/><ellipse cx="200" cy="126" rx="15" ry="7" fill="rgba(240,199,170,.54)" transform="rotate(21 200 126)"/><circle cx="306" cy="318" r="15" fill="rgba(68,105,72,.13)"/></g></svg>`,
);

const energyMotif = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#26282b"/><stop offset="1" stop-color="#111216"/></linearGradient></defs><rect width="640" height="360" fill="url(#bg)"/><path d="M348 46 312 121h45l-21 82 86-116h-47l25-70Z" fill="#ffc928" stroke="#ff3b16" stroke-width="8" stroke-linejoin="round"/><path d="M358 42 335 104h39l-17 66 53-78h-40l20-50Z" fill="#ff6a19" opacity=".86"/><g transform="translate(0 188)"><path d="M0 172c24-74 52-99 86-139-10 53 14 77 41 119 3-83 59-119 101-171-20 82 49 92 45 164 45-52 70-92 83-160 67 78 88 126 73 187 34-54 62-86 101-118-7 65 26 88 57 118H0Z" fill="#371513"/><path d="M0 172c20-58 50-88 99-125-8 48 18 76 49 110 14-73 59-101 98-153-9 76 50 86 46 152 43-49 71-85 80-146 59 70 73 114 60 162 40-50 74-81 113-103-12 53 25 76 72 103H0Z" fill="#ad1d0d"/><path d="M20 172c25-55 60-84 105-113 1 41 30 73 66 98 8-58 50-91 91-129-3 66 53 82 52 144 37-39 58-68 73-120 42 54 56 91 46 120 31-36 63-58 96-75-7 41 28 57 72 75H20Z" fill="#ff5415"/><path d="M65 172c25-37 57-62 94-80 8 31 34 57 69 73 6-43 34-70 69-97 14 50 51 68 47 104 35-33 51-52 66-90 31 39 44 67 38 90 27-25 52-41 82-52 1 25 26 39 58 52H65Z" fill="#ffc21a"/></g></svg>`,
);

const playfulMotif = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#fff3d8"/><stop offset="1" stop-color="#ffe0cc"/></linearGradient></defs><rect width="640" height="360" fill="url(#bg)"/><g fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="94" cy="71" r="38" fill="rgba(239,188,73,.78)"/><circle cx="261" cy="78" r="42" fill="rgba(146,196,202,.76)"/><circle cx="514" cy="72" r="36" fill="rgba(239,188,73,.72)"/><rect x="339" y="116" width="105" height="55" rx="28" fill="rgba(241,112,91,.80)" transform="rotate(-3 391 144)"/><path d="M96 165c24-30 61-30 84 0-23 31-60 31-84 0Z" fill="rgba(242,143,114,.73)"/><path d="M195 208 228 266H162Z" fill="rgba(232,137,104,.72)"/><circle cx="466" cy="242" r="43" fill="rgba(61,130,137,.80)"/><path d="M502 28c30-22 58-30 90-25" stroke="rgba(98,151,159,.78)" stroke-width="13"/><path d="M36 112c37-10 66-3 93 23" stroke="rgba(98,151,159,.66)" stroke-width="11"/><path d="M322 242c36-22 67-24 96-4" stroke="rgba(239,188,73,.75)" stroke-width="12"/><path d="M558 136 579 113l22 22-22 23Z" fill="rgba(241,112,91,.75)"/><path d="M250 146 269 126l20 20-20 20Z" fill="rgba(61,130,137,.72)"/><path d="M441 49 463 30l23 20-23 21Z" fill="rgba(241,112,91,.58)"/><circle cx="54" cy="300" r="8" fill="rgba(239,188,73,.76)"/><circle cx="604" cy="286" r="9" fill="rgba(241,112,91,.72)"/><circle cx="129" cy="304" r="6" fill="rgba(98,151,159,.64)"/><circle cx="303" cy="302" r="7" fill="rgba(241,112,91,.65)"/><path d="M28 250c31 3 50 15 65 40" stroke="rgba(241,112,91,.63)" stroke-width="9"/><path d="M581 213c23 1 42 10 57 28" stroke="rgba(98,151,159,.63)" stroke-width="10"/><path d="M17 27h24M64 27h24M41 4v24M41 51v24" stroke="rgba(239,188,73,.58)" stroke-width="7"/><path d="M156 31c20 0 29 11 29 24 0 24-29 31-29 31s-29-7-29-31c0-13 9-24 29-24Z" fill="rgba(241,112,91,.46)"/></g></svg>`,
);

export const APPEARANCE_PRESETS: AppearancePreset[] = [
  {
    id: "care-heart",
    label: "Kärlek / Omtanke",
    description: "Varm rosa och kräm med mjuka hjärtformer.",
    backgroundColor: "#fff3ef",
    backgroundImage: `url("data:image/svg+xml,${heartMotif}")`,
    position: "center",
  },
  {
    id: "nature-green",
    label: "Natur / Grönt",
    description: "Botanisk grön bakgrund med bladkänsla.",
    backgroundColor: "#9fb995",
    backgroundImage: `url("data:image/svg+xml,${leafMotif}")`,
    position: "center",
  },
  {
    id: "tough-energy",
    label: "Tufft / Energi",
    description: "Mörk energi med flammor och blixt.",
    backgroundColor: "#202124",
    backgroundImage: `url("data:image/svg+xml,${energyMotif}")`,
    position: "center bottom",
  },
  {
    id: "playful-family",
    label: "Lekfullt / Familj",
    description: "Mjuka prickar och varma familjevänliga former.",
    backgroundColor: "#fff8e6",
    backgroundImage: `url("data:image/svg+xml,${playfulMotif}")`,
    position: "center",
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

export const getAppearanceBackgroundStyle = (
  ref: ListAppearanceBackgroundRef | null | undefined,
  customImageUrls: Record<string, string>,
  _seed: string,
): CSSProperties | undefined => {
  if (!ref) return undefined;

  if (ref.type === "preset") {
    const preset = getAppearancePreset(ref);
    if (!preset) return undefined;

    return {
      backgroundColor: preset.backgroundColor,
      backgroundImage: preset.backgroundImage,
      backgroundPosition: preset.position || "center",
      backgroundRepeat: "no-repeat",
      backgroundSize: "cover",
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

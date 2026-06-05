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
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><path d="M40 57s-19-11.7-19-26.2C21 22.5 31.2 19 40 28.2 48.8 19 59 22.5 59 30.8 59 45.3 40 57 40 57Z" fill="none" stroke="rgba(154,47,86,.22)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
);
const leafMotif = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><path d="M20 66c31 0 48-18 54-44 0 0-36 2-50 22-8 11-4 22-4 22Zm0 0c12-16 26-27 43-34" fill="none" stroke="rgba(36,99,42,.22)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
);
const freshMotif = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 92 92"><circle cx="28" cy="32" r="12" fill="none" stroke="rgba(23,132,145,.18)" stroke-width="3"/><circle cx="58" cy="58" r="18" fill="none" stroke="rgba(64,160,119,.14)" stroke-width="4"/><path d="M25 62c12-9 25-10 40-3" fill="none" stroke="rgba(23,132,145,.12)" stroke-width="4" stroke-linecap="round"/></svg>`,
);
const playfulMotif = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><circle cx="22" cy="30" r="8" fill="rgba(255,181,74,.24)"/><circle cx="70" cy="28" r="7" fill="rgba(101,183,222,.22)"/><circle cx="48" cy="64" r="10" fill="rgba(232,112,142,.18)"/><path d="M20 68c15 8 34 8 54-2" fill="none" stroke="rgba(120,82,45,.15)" stroke-width="4" stroke-linecap="round"/></svg>`,
);

export const APPEARANCE_PRESETS: AppearancePreset[] = [
  {
    id: "care-heart",
    label: "Kärlek / Omtanke",
    description: "Varm rosa och kräm med mjuka hjärtformer.",
    backgroundColor: "#fff3ef",
    backgroundImage: `url("data:image/svg+xml,${heartMotif}"), radial-gradient(circle at 18% 24%, rgba(244, 143, 177, 0.42), transparent 28%), radial-gradient(circle at 80% 18%, rgba(255, 213, 191, 0.62), transparent 30%), linear-gradient(135deg, rgba(255, 247, 240, 0.98), rgba(252, 231, 243, 0.86))`,
  },
  {
    id: "nature-green",
    label: "Natur / Grönt",
    description: "Botanisk grön bakgrund med bladkänsla.",
    backgroundColor: "#eef7e8",
    backgroundImage: `url("data:image/svg+xml,${leafMotif}"), radial-gradient(circle at 22% 22%, rgba(102, 187, 106, 0.42), transparent 30%), radial-gradient(circle at 76% 68%, rgba(196, 223, 170, 0.58), transparent 34%), linear-gradient(135deg, rgba(232, 245, 233, 0.98), rgba(255, 253, 231, 0.72))`,
  },
  {
    id: "clean-fresh",
    label: "Rent / Fräscht",
    description: "Luftig blågrön, fräsch och spa-lik.",
    backgroundColor: "#eefbfb",
    backgroundImage: `url("data:image/svg+xml,${freshMotif}"), radial-gradient(circle at 20% 26%, rgba(128, 222, 234, 0.42), transparent 30%), radial-gradient(circle at 84% 18%, rgba(178, 235, 242, 0.5), transparent 28%), linear-gradient(135deg, rgba(245, 253, 255, 0.98), rgba(232, 245, 233, 0.72))`,
  },
  {
    id: "playful-family",
    label: "Lekfullt / Familj",
    description: "Mjuka prickar och varma familjevänliga former.",
    backgroundColor: "#fff8e6",
    backgroundImage: `url("data:image/svg+xml,${playfulMotif}"), radial-gradient(circle at 18% 22%, rgba(255, 213, 79, 0.46), transparent 24%), radial-gradient(circle at 82% 30%, rgba(129, 212, 250, 0.34), transparent 25%), radial-gradient(circle at 54% 78%, rgba(244, 143, 177, 0.28), transparent 26%), linear-gradient(135deg, rgba(255, 253, 231, 0.98), rgba(255, 243, 224, 0.82))`,
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

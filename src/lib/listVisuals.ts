export type ListAppearanceImageRef = {
  type: "preset" | "custom";
  id: string;
};

export type ListAppearance = {
  iconImage?: ListAppearanceImageRef | null;
  bannerImage?: ListAppearanceImageRef | null;
};

export type ListAppearanceMap = Record<string, ListAppearance>;

export type AppearanceTarget = "iconImage" | "bannerImage";

export type AppearancePreset = {
  id: string;
  category: string;
  label: string;
  className: string;
};

const LIST_APPEARANCE_STORAGE_KEY = "hem_listan_list_appearance";
const IMAGE_DB_NAME = "hem_listan_appearance_images";
const IMAGE_DB_VERSION = 1;
const IMAGE_STORE_NAME = "images";

export const APPEARANCE_PRESETS: AppearancePreset[] = [
  {
    id: "home-daily",
    category: "Hem & vardag",
    label: "Varmt hem",
    className:
      "bg-[radial-gradient(circle_at_18%_24%,rgba(255,236,179,0.78),transparent_30%),linear-gradient(135deg,rgba(255,248,225,0.95),rgba(232,245,233,0.72))]",
  },
  {
    id: "food-market",
    category: "Mat & inköp",
    label: "Skafferi",
    className:
      "bg-[radial-gradient(circle_at_78%_22%,rgba(255,183,77,0.46),transparent_28%),linear-gradient(135deg,rgba(241,248,233,0.95),rgba(255,243,224,0.76))]",
  },
  {
    id: "renovation-tools",
    category: "Renovering / verktyg",
    label: "Mjukt bygge",
    className:
      "bg-[linear-gradient(135deg,rgba(239,235,233,0.96),rgba(255,248,225,0.72)),repeating-linear-gradient(90deg,rgba(124,46,0,0.10)_0_1px,transparent_1px_18px)]",
  },
  {
    id: "cleaning-fresh",
    category: "Städning",
    label: "Nystädat",
    className:
      "bg-[radial-gradient(circle_at_20%_26%,rgba(178,235,242,0.58),transparent_30%),linear-gradient(135deg,rgba(245,253,255,0.96),rgba(232,245,233,0.68))]",
  },
  {
    id: "family-soft",
    category: "Familj",
    label: "Familjetid",
    className:
      "bg-[radial-gradient(circle_at_76%_20%,rgba(244,143,177,0.38),transparent_27%),linear-gradient(135deg,rgba(255,245,247,0.96),rgba(255,248,225,0.72))]",
  },
  {
    id: "kids-play",
    category: "Barn",
    label: "Lekfullt",
    className:
      "bg-[radial-gradient(circle_at_18%_22%,rgba(255,213,79,0.45),transparent_24%),radial-gradient(circle_at_78%_28%,rgba(129,212,250,0.34),transparent_24%),linear-gradient(135deg,rgba(255,253,231,0.96),rgba(243,229,245,0.62))]",
  },
  {
    id: "care-heart",
    category: "Kärlek / omtanke",
    label: "Omtanke",
    className:
      "bg-[radial-gradient(circle_at_72%_24%,rgba(236,64,122,0.26),transparent_26%),linear-gradient(135deg,rgba(252,231,243,0.9),rgba(255,248,225,0.72))]",
  },
  {
    id: "travel-calm",
    category: "Resa",
    label: "Lugn resa",
    className:
      "bg-[radial-gradient(circle_at_24%_26%,rgba(144,202,249,0.44),transparent_30%),linear-gradient(135deg,rgba(227,242,253,0.92),rgba(255,248,225,0.68))]",
  },
  {
    id: "health-green",
    category: "Träning / hälsa",
    label: "Frisk luft",
    className:
      "bg-[radial-gradient(circle_at_78%_22%,rgba(129,199,132,0.46),transparent_28%),linear-gradient(135deg,rgba(232,245,233,0.95),rgba(241,248,233,0.7))]",
  },
  {
    id: "work-focus",
    category: "Jobb / projekt",
    label: "Fokus",
    className:
      "bg-[linear-gradient(135deg,rgba(237,231,246,0.94),rgba(227,242,253,0.66)),repeating-linear-gradient(0deg,rgba(63,81,181,0.08)_0_1px,transparent_1px_20px)]",
  },
  {
    id: "nature-meadow",
    category: "Natur",
    label: "Äng",
    className:
      "bg-[radial-gradient(circle_at_20%_22%,rgba(102,187,106,0.44),transparent_30%),linear-gradient(135deg,rgba(232,245,233,0.96),rgba(255,253,231,0.66))]",
  },
  {
    id: "neutral-premium",
    category: "Neutral premium",
    label: "Linne",
    className:
      "bg-[linear-gradient(135deg,rgba(250,247,241,0.98),rgba(238,232,222,0.72)),repeating-linear-gradient(45deg,rgba(95,86,74,0.06)_0_1px,transparent_1px_12px)]",
  },
];

const isImageRef = (value: unknown): value is ListAppearanceImageRef => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const ref = value as Record<string, unknown>;
  return (
    (ref.type === "preset" || ref.type === "custom") &&
    typeof ref.id === "string" &&
    ref.id.length > 0
  );
};

const isListAppearance = (value: unknown): value is ListAppearance => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const appearance = value as Record<string, unknown>;
  return (
    (appearance.iconImage === undefined ||
      appearance.iconImage === null ||
      isImageRef(appearance.iconImage)) &&
    (appearance.bannerImage === undefined ||
      appearance.bannerImage === null ||
      isImageRef(appearance.bannerImage))
  );
};

export const getAppearancePreset = (ref?: ListAppearanceImageRef | null) => {
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
        if (isListAppearance(appearance)) {
          acc[listId] = appearance;
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
  const nextAppearance = {
    iconImage: appearance.iconImage || null,
    bannerImage: appearance.bannerImage || null,
  };

  if (!nextAppearance.iconImage && !nextAppearance.bannerImage) {
    delete currentAppearance[listId];
  } else {
    currentAppearance[listId] = nextAppearance;
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
): Promise<ListAppearanceImageRef> => {
  const db = await openImageDb();
  const imageId = `${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(IMAGE_STORE_NAME, "readwrite");
    transaction.objectStore(IMAGE_STORE_NAME).put(file, imageId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  db.close();
  return { type: "custom", id: imageId };
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

export type ListVisuals = {
  icon?: string;
  banner?: string;
};

export type ListVisualsMap = Record<string, ListVisuals>;

export type ListIconOption = {
  key: string;
  label: string;
};

export type ListBannerOption = {
  key: string;
  label: string;
  className: string;
};

const LIST_VISUALS_STORAGE_KEY = "hem_listan_list_visuals";

export const LIST_ICON_OPTIONS: ListIconOption[] = [
  { key: "shopping_cart", label: "Handla" },
  { key: "construction", label: "Fix" },
  { key: "home", label: "Hem" },
  { key: "today", label: "Plan" },
  { key: "book", label: "Läsa" },
  { key: "restaurant", label: "Mat" },
  { key: "favorite", label: "Favorit" },
  { key: "flight", label: "Resa" },
];

export const LIST_BANNER_OPTIONS: ListBannerOption[] = [
  {
    key: "meadow",
    label: "Äng",
    className:
      "bg-[radial-gradient(circle_at_18%_20%,rgba(52,106,47,0.34),transparent_30%),linear-gradient(135deg,rgba(232,245,233,0.95),rgba(255,255,255,0))]",
  },
  {
    key: "sunrise",
    label: "Morgon",
    className:
      "bg-[radial-gradient(circle_at_22%_28%,rgba(249,168,37,0.34),transparent_28%),linear-gradient(135deg,rgba(255,243,224,0.95),rgba(255,255,255,0))]",
  },
  {
    key: "blueprint",
    label: "Ritning",
    className:
      "bg-[linear-gradient(135deg,rgba(227,242,253,0.95),rgba(255,255,255,0)),repeating-linear-gradient(90deg,rgba(30,136,229,0.16)_0_1px,transparent_1px_18px),repeating-linear-gradient(0deg,rgba(30,136,229,0.12)_0_1px,transparent_1px_18px)]",
  },
  {
    key: "berry",
    label: "Bär",
    className:
      "bg-[radial-gradient(circle_at_80%_20%,rgba(121,46,76,0.28),transparent_26%),linear-gradient(135deg,rgba(252,231,243,0.9),rgba(255,255,255,0))]",
  },
];

const isListVisuals = (value: unknown): value is ListVisuals => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const visuals = value as Record<string, unknown>;
  return (
    (visuals.icon === undefined || typeof visuals.icon === "string") &&
    (visuals.banner === undefined || typeof visuals.banner === "string")
  );
};

export const readListVisualsMap = (): ListVisualsMap => {
  try {
    const raw = localStorage.getItem(LIST_VISUALS_STORAGE_KEY);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.entries(parsed).reduce<ListVisualsMap>((acc, [listId, visuals]) => {
      if (isListVisuals(visuals)) {
        acc[listId] = visuals;
      }
      return acc;
    }, {});
  } catch (_) {
    return {};
  }
};

export const writeListVisuals = (
  listId: string,
  visuals: ListVisuals,
): ListVisualsMap => {
  const currentVisuals = readListVisualsMap();
  const nextVisuals = {
    icon: visuals.icon || undefined,
    banner: visuals.banner || undefined,
  };

  if (!nextVisuals.icon && !nextVisuals.banner) {
    delete currentVisuals[listId];
  } else {
    currentVisuals[listId] = nextVisuals;
  }

  try {
    localStorage.setItem(
      LIST_VISUALS_STORAGE_KEY,
      JSON.stringify(currentVisuals),
    );
  } catch (_) {}

  return currentVisuals;
};

export const getBannerOption = (banner?: string) => {
  if (!banner) return undefined;
  return LIST_BANNER_OPTIONS.find((option) => option.key === banner);
};

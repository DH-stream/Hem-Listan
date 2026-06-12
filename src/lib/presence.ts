export interface ListPresenceMeta {
  userId?: unknown;
  displayName?: unknown;
  email?: unknown;
  avatarUrl?: unknown;
  avatarPath?: unknown;
  listId?: unknown;
  lastSeenAt?: unknown;
}

export interface PresentUser {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  avatarPath: string | null;
  listId: string;
  lastSeenAt: string;
}

const optionalString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const presenceTimestamp = (value: unknown): number => {
  if (typeof value !== "string") return 0;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

export const getPresenceInitials = (displayName?: string | null, email?: string | null): string => {
  const source = displayName?.trim() || email?.trim().split("@")[0] || "";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "HL";

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("sv-SE");
};

export const mapPresenceState = (
  state: Record<string, ListPresenceMeta[]>,
  currentUserId?: string | null,
): PresentUser[] => {
  const usersById = new Map<string, PresentUser>();

  for (const metas of Object.values(state)) {
    for (const meta of metas) {
      const userId = optionalString(meta.userId);
      const listId = optionalString(meta.listId);
      if (!userId || !listId) continue;

      const displayName = optionalString(meta.displayName)
        || optionalString(meta.email)
        || "Hem-Listan";
      const lastSeenAt = optionalString(meta.lastSeenAt) || new Date(0).toISOString();
      const user: PresentUser = {
        userId,
        displayName,
        avatarUrl: optionalString(meta.avatarUrl),
        avatarPath: optionalString(meta.avatarPath),
        listId,
        lastSeenAt,
      };
      const existing = usersById.get(userId);

      if (!existing || presenceTimestamp(user.lastSeenAt) >= presenceTimestamp(existing.lastSeenAt)) {
        usersById.set(userId, user);
      }
    }
  }

  return [...usersById.values()].sort((left, right) => {
    const leftIsCurrent = left.userId === currentUserId;
    const rightIsCurrent = right.userId === currentUserId;
    if (leftIsCurrent !== rightIsCurrent) return leftIsCurrent ? 1 : -1;
    return right.lastSeenAt.localeCompare(left.lastSeenAt);
  });
};

export interface MockPresenceOptions {
  enabled: boolean;
  currentUserId: string | null;
  listId: string | null;
}

export const DEBUG_PRESENCE_USER_ID = "debug-presence-felicia";

export const withMockPresence = (
  users: PresentUser[],
  { enabled, currentUserId, listId }: MockPresenceOptions,
): PresentUser[] => {
  if (!enabled || !currentUserId || !listId) return users;
  if (users.some((user) => user.userId === DEBUG_PRESENCE_USER_ID)) return users;

  return [...users, {
    userId: DEBUG_PRESENCE_USER_ID,
    displayName: "Felicia",
    avatarUrl: null,
    avatarPath: null,
    listId,
    lastSeenAt: new Date().toISOString(),
  }];
};

export const shouldShowPresence = (users: PresentUser[]): boolean => users.length > 1;

export const getVisiblePresence = (users: PresentUser[], maxVisible = 3) => ({
  visibleUsers: users.slice(0, maxVisible),
  overflowCount: Math.max(0, users.length - maxVisible),
});

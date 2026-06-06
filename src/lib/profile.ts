import type { UserProfile } from "../types";

const profileCacheKey = (userId: string) => `hem-listan-profile:${userId}`;

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

export const readCachedUserProfile = (userId: string): UserProfile | null => {
  console.log("[HL_PROFILE] cache read start", { userId });
  try {
    const cachedValue = localStorage.getItem(profileCacheKey(userId));
    if (!cachedValue) {
      console.log("[HL_PROFILE] cache read empty", { userId });
      return null;
    }

    const profile = JSON.parse(cachedValue) as Partial<UserProfile>;
    if (
      profile.userId !== userId
      || typeof profile.displayName !== "string"
      || !profile.displayName.trim()
      || !isNullableString(profile.avatarPath)
      || !isNullableString(profile.avatarUrl)
      || typeof profile.createdAt !== "string"
      || typeof profile.updatedAt !== "string"
    ) {
      console.warn("[HL_PROFILE] cache read invalid shape", { userId, profile });
      return null;
    }

    console.log("[HL_PROFILE] cache read valid", {
      userId,
      displayName: profile.displayName,
      hasAvatar: !!profile.avatarUrl,
    });
    return profile as UserProfile;
  } catch (error) {
    console.warn("[HL_PROFILE] cache read error", { userId, error });
    return null;
  }
};

export const writeCachedUserProfile = (profile: UserProfile): void => {
  console.log("[HL_PROFILE] cache write start", {
    userId: profile.userId,
    displayName: profile.displayName,
    hasAvatar: !!profile.avatarUrl,
  });
  try {
    localStorage.setItem(profileCacheKey(profile.userId), JSON.stringify(profile));
    console.log("[HL_PROFILE] cache write success", { userId: profile.userId });
  } catch (error) {
    console.warn("[HL_PROFILE] cache write error", { userId: profile.userId, error });
  }
};

export const getProfileInitials = (displayName?: string | null): string => {
  const parts = displayName?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return "HL";

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("sv-SE");
};

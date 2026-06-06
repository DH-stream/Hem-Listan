import type { UserProfile } from "../types";

const profileCacheKey = (userId: string) => `hem-listan-profile:${userId}`;

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

export const readCachedUserProfile = (userId: string): UserProfile | null => {
  try {
    const cachedValue = localStorage.getItem(profileCacheKey(userId));
    if (!cachedValue) return null;

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
      return null;
    }

    return profile as UserProfile;
  } catch (error) {
    console.warn("profile_cache_read_error", error);
    return null;
  }
};

export const writeCachedUserProfile = (profile: UserProfile): void => {
  try {
    localStorage.setItem(profileCacheKey(profile.userId), JSON.stringify(profile));
  } catch (error) {
    console.warn("profile_cache_write_error", error);
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

import test from "node:test";
import assert from "node:assert/strict";
import { getPresenceInitials, getVisiblePresence, mapPresenceState, type PresentUser } from "./src/lib/presence";

test("mapPresenceState deduplicates users and keeps the latest meta", () => {
  const users = mapPresenceState({
    firstTab: [
      { userId: "user-1", displayName: "Max Old", listId: "list-1", lastSeenAt: "2026-06-12T10:00:00.000Z" },
    ],
    secondTab: [
      { userId: "user-1", displayName: "Max New", avatarUrl: "https://example.com/max.jpg", listId: "list-1", lastSeenAt: "2026-06-12T10:01:00.000Z" },
      { userId: "user-2", displayName: "Felicia", listId: "list-1", lastSeenAt: "2026-06-12T10:02:00.000Z" },
    ],
  }, "user-1");

  assert.equal(users.length, 2);
  assert.equal(users[0].userId, "user-2");
  assert.equal(users[1].displayName, "Max New");
  assert.equal(users[1].avatarUrl, "https://example.com/max.jpg");
});

test("getPresenceInitials falls back from display name to email", () => {
  assert.equal(getPresenceInitials("Felicia Andersson"), "FA");
  assert.equal(getPresenceInitials(null, "max@example.com"), "M");
  assert.equal(getPresenceInitials(), "HL");
});

test("getVisiblePresence limits avatars and reports overflow", () => {
  const users = Array.from({ length: 5 }, (_, index): PresentUser => ({
    userId: `user-${index}`,
    displayName: `User ${index}`,
    avatarUrl: null,
    avatarPath: null,
    listId: "list-1",
    lastSeenAt: new Date(index).toISOString(),
  }));

  const result = getVisiblePresence(users);
  assert.equal(result.visibleUsers.length, 3);
  assert.equal(result.overflowCount, 2);
});

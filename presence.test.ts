import test from "node:test";
import assert from "node:assert/strict";
import { DEBUG_PRESENCE_USER_ID, getPresenceInitials, getVisiblePresence, mapPresenceState, shouldShowPresence, withMockPresence, type PresentUser } from "./src/lib/presence";

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

test("shouldShowPresence only reveals presence for multiple unique users", () => {
  const user = (userId: string): PresentUser => ({
    userId,
    displayName: `User ${userId}`,
    avatarUrl: null,
    avatarPath: null,
    listId: "list-1",
    lastSeenAt: "2026-06-12T10:00:00.000Z",
  });

  assert.equal(shouldShowPresence([]), false);
  assert.equal(shouldShowPresence([user("1")]), false);
  assert.equal(shouldShowPresence([user("1"), user("2")]), true);
});

test("withMockPresence returns the same users when disabled", () => {
  const users = [presenceUser("user-1")];
  assert.equal(withMockPresence(users, {
    enabled: false,
    currentUserId: "user-1",
    listId: "list-1",
  }), users);
});

test("withMockPresence returns the same users without a current user or list", () => {
  const users = [presenceUser("user-1")];
  assert.equal(withMockPresence(users, {
    enabled: true,
    currentUserId: null,
    listId: "list-1",
  }), users);
  assert.equal(withMockPresence(users, {
    enabled: true,
    currentUserId: "user-1",
    listId: null,
  }), users);
});

test("withMockPresence adds Felicia and makes presence visible", () => {
  const users = [presenceUser("user-1")];
  const displayedUsers = withMockPresence(users, {
    enabled: true,
    currentUserId: "user-1",
    listId: "list-1",
  });

  assert.equal(displayedUsers.length, 2);
  assert.equal(displayedUsers[1].userId, DEBUG_PRESENCE_USER_ID);
  assert.equal(displayedUsers[1].displayName, "Felicia");
  assert.equal(displayedUsers[1].listId, "list-1");
  assert.equal(shouldShowPresence(displayedUsers), true);
});

test("withMockPresence does not duplicate the debug user", () => {
  const users = [presenceUser("user-1"), presenceUser(DEBUG_PRESENCE_USER_ID)];
  const displayedUsers = withMockPresence(users, {
    enabled: true,
    currentUserId: "user-1",
    listId: "list-1",
  });

  assert.equal(displayedUsers, users);
  assert.equal(displayedUsers.filter((user) => user.userId === DEBUG_PRESENCE_USER_ID).length, 1);
});

function presenceUser(userId: string): PresentUser {
  return {
    userId,
    displayName: `User ${userId}`,
    avatarUrl: null,
    avatarPath: null,
    listId: "list-1",
    lastSeenAt: "2026-06-12T10:00:00.000Z",
  };
}

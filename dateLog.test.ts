import test from "node:test";
import assert from "node:assert/strict";
import { createDateLogEntry, getEntriesForDate, getEntryDates, getWeekDays, toLocalDateKey } from "./src/lib/dateLog";
import type { List, TaskItem } from "./src/types";

test("date_log is a valid list category", () => {
  const list: List = {
    id: "list-1",
    name: "Mildison",
    icon: "calendar",
    themeColor: "#003b05",
    category: "date_log",
    tasks: [],
  };

  assert.equal(list.category, "date_log");
});

test("week selector uses Monday through Sunday", () => {
  const days = getWeekDays(new Date("2026-06-26T12:00:00"));
  assert.deepEqual(days.map(toLocalDateKey), [
    "2026-06-22",
    "2026-06-23",
    "2026-06-24",
    "2026-06-25",
    "2026-06-26",
    "2026-06-27",
    "2026-06-28",
  ]);
});

test("adding a log entry stores the selected date metadata", () => {
  const entry = createDateLogEntry("Smort med Mildison", "2026-06-26", "På kinden");

  assert.equal(entry.text, "Smort med Mildison");
  assert.equal(entry.logDate, "2026-06-26");
  assert.equal(entry.scheduledDate, "2026-06-26");
  assert.equal(entry.notes, "På kinden");
  assert.equal(typeof entry.loggedAt, "string");
});

test("entries only show for the selected date and expose marker dates", () => {
  const tasks: TaskItem[] = [
    { id: "1", text: "Smort med Mildison", checked: false, logDate: "2026-06-26", loggedAt: "2026-06-26T08:00:00.000Z" },
    { id: "2", text: "Bad", checked: false, logDate: "2026-06-27", loggedAt: "2026-06-27T08:00:00.000Z" },
  ];

  assert.deepEqual(getEntriesForDate(tasks, "2026-06-26").map((task) => task.text), ["Smort med Mildison"]);
  assert.deepEqual([...getEntryDates(tasks)].sort(), ["2026-06-26", "2026-06-27"]);
});

test("date metadata survives local JSON serialization", () => {
  const list: List = {
    id: "list-1",
    name: "Datumlista",
    icon: "calendar",
    themeColor: "#003b05",
    category: "date_log",
    tasks: [{ id: "task-1", ...createDateLogEntry("Smort med Mildison", "2026-06-26") }],
  };

  const restored = JSON.parse(JSON.stringify(list)) as List;
  assert.equal(restored.tasks[0].logDate, "2026-06-26");
  assert.equal(restored.tasks[0].scheduledDate, "2026-06-26");
  assert.equal(restored.category, "date_log");
});

test("existing grocery and renovation categories remain valid", () => {
  const grocery: List = { id: "g", name: "Mat", icon: "shopping_cart", themeColor: "#003b05", category: "grocery", tasks: [], meals: [] };
  const renovation: List = { id: "r", name: "Fix", icon: "construction", themeColor: "#003b05", category: "renovation", tasks: [] };

  assert.equal(grocery.category, "grocery");
  assert.equal(renovation.category, "renovation");
});

import test from "node:test";
import assert from "node:assert/strict";
import { addDaysToDateKey, addMonthsToDateKey, createDateLogEntry, formatMonthHeading, getEntriesForDate, getEntryDates, getMonthGrid, getWeekDays, toLocalDateKey } from "./src/lib/dateLog";
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

test("week navigation moves selected dates by whole weeks across month boundaries", () => {
  assert.equal(addDaysToDateKey("2026-03-02", -7), "2026-02-23");
  assert.equal(addDaysToDateKey("2026-01-29", 7), "2026-02-05");
});

test("selected week changes correctly across month boundaries", () => {
  const previousWeek = getWeekDays(new Date(`${addDaysToDateKey("2026-03-02", -7)}T12:00:00`));
  const nextWeek = getWeekDays(new Date(`${addDaysToDateKey("2026-01-29", 7)}T12:00:00`));

  assert.deepEqual(previousWeek.map(toLocalDateKey), [
    "2026-02-23",
    "2026-02-24",
    "2026-02-25",
    "2026-02-26",
    "2026-02-27",
    "2026-02-28",
    "2026-03-01",
  ]);
  assert.deepEqual(nextWeek.map(toLocalDateKey), [
    "2026-02-02",
    "2026-02-03",
    "2026-02-04",
    "2026-02-05",
    "2026-02-06",
    "2026-02-07",
    "2026-02-08",
  ]);
});


test("month grid starts on Monday with leading blanks", () => {
  const grid = getMonthGrid(new Date("2026-02-14T12:00:00"));

  assert.equal(grid.length, 42);
  assert.equal(grid[0], null);
  assert.equal(grid[6]?.dateKey, "2026-02-01");
  assert.equal(grid[7]?.dateKey, "2026-02-02");
});

test("month navigation moves across year boundaries", () => {
  assert.equal(addMonthsToDateKey("2026-12-15", 1), "2027-01-15");
  assert.equal(addMonthsToDateKey("2027-01-15", -1), "2026-12-15");
  assert.equal(addMonthsToDateKey("2026-01-31", 1), "2026-02-28");
});

test("month heading uses Swedish month and year", () => {
  assert.equal(formatMonthHeading("2026-12-15"), "december 2026");
});

test("adding a log entry stores the selected date metadata", () => {
  const entry = createDateLogEntry("Smort med Mildison", "2026-06-26", "På kinden");

  assert.equal(entry.text, "Smort med Mildison");
  assert.equal(entry.logDate, "2026-06-26");
  assert.equal(entry.scheduledDate, "2026-06-26");
  assert.equal(entry.notes, "På kinden");
  assert.equal(typeof entry.loggedAt, "string");
});

test("selected date filtering still works and marker dates are available in month view", () => {
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

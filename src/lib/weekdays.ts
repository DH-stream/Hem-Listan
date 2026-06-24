import type { WeekdayKey } from "../types";

export const WEEKDAYS: { key: WeekdayKey; label: string; shortLabel: string }[] = [
  { key: "monday", label: "Måndag", shortLabel: "Mån" },
  { key: "tuesday", label: "Tisdag", shortLabel: "Tis" },
  { key: "wednesday", label: "Onsdag", shortLabel: "Ons" },
  { key: "thursday", label: "Torsdag", shortLabel: "Tor" },
  { key: "friday", label: "Fredag", shortLabel: "Fre" },
  { key: "saturday", label: "Lördag", shortLabel: "Lör" },
  { key: "sunday", label: "Söndag", shortLabel: "Sön" },
];

export const DEFAULT_WEEKDAY_KEY: WeekdayKey = "monday";

export const isWeekdayKey = (value: unknown): value is WeekdayKey =>
  typeof value === "string" && WEEKDAYS.some((weekday) => weekday.key === value);

export const normalizeWeekdayKey = (value: unknown): WeekdayKey =>
  isWeekdayKey(value) ? value : DEFAULT_WEEKDAY_KEY;

export const getOrderedWeekdays = (startDay?: WeekdayKey | string | null) => {
  const normalizedStartDay = normalizeWeekdayKey(startDay);
  const startIndex = WEEKDAYS.findIndex((weekday) => weekday.key === normalizedStartDay);
  return [...WEEKDAYS.slice(startIndex), ...WEEKDAYS.slice(0, startIndex)];
};

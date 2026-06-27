import type { TaskItem } from "../types";

const DATE_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  hour: "2-digit",
  minute: "2-digit",
});

const MONTH_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  month: "long",
  year: "numeric",
});

export const toLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const addDaysToDateKey = (dateKey: string, days: number): string => {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toLocalDateKey(date);
};

export const addMonthsToDateKey = (dateKey: string, months: number): string => {
  const date = new Date(`${dateKey}T00:00:00`);
  const day = date.getDate();
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return toLocalDateKey(target);
};

export const getWeekStart = (date: Date): Date => {
  const start = new Date(date);
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + mondayOffset);
  start.setHours(0, 0, 0, 0);
  return start;
};

export const getWeekDays = (selectedDate: Date): Date[] => {
  const start = getWeekStart(selectedDate);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
};

export type DateLogMonthCell = {
  dateKey: string;
  day: number;
  isCurrentMonth: boolean;
};

export const getMonthGrid = (selectedDate: Date): Array<DateLogMonthCell | null> => {
  const firstDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
  const leadingBlanks = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const visibleDays = leadingBlanks + daysInMonth;
  const trailingBlanks = 42 - visibleDays;

  return [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), index + 1);
      return { dateKey: toLocalDateKey(date), day: index + 1, isCurrentMonth: true };
    }),
    ...Array.from({ length: trailingBlanks }, () => null),
  ];
};

export const getMonthDays = getMonthGrid;

export const getTaskLogDate = (task: TaskItem): string | undefined => task.logDate ?? task.scheduledDate;

export const createDateLogEntry = (text: string, logDate: string, notes?: string): Omit<TaskItem, "id"> => ({
  text,
  checked: false,
  notes,
  type: "task",
  logDate,
  scheduledDate: logDate,
  loggedAt: new Date().toISOString(),
});

export const getEntriesForDate = (tasks: TaskItem[], dateKey: string): TaskItem[] =>
  tasks.filter((task) => getTaskLogDate(task) === dateKey);

export const getEntryDates = (tasks: TaskItem[]): Set<string> =>
  new Set(tasks.map(getTaskLogDate).filter((date): date is string => Boolean(date)));

export const formatDateLogHeading = (dateKey: string): string => {
  const date = new Date(`${dateKey}T00:00:00`);
  return DATE_FORMATTER.format(date);
};

export const formatMonthHeading = (dateKey: string): string => {
  const date = new Date(`${dateKey}T00:00:00`);
  return MONTH_FORMATTER.format(date);
};

export const formatDateLogTime = (entry: TaskItem): string => {
  const value = entry.loggedAt ?? entry.createdAt;
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return TIME_FORMATTER.format(date);
};

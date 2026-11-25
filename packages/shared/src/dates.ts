import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  format,
  isValid,
  parse,
} from "date-fns";

export const frequencies = ["daily", "weekly", "monthly", "yearly"] as const;
export type Frequency = (typeof frequencies)[number];

export function indiaToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function nextOccurrence(
  date: string,
  frequency: Frequency,
  anchorDate = date,
) {
  const current = parse(date, "yyyy-MM-dd", new Date());
  const anchor = parse(anchorDate, "yyyy-MM-dd", new Date());
  if (!isValid(current) || !isValid(anchor))
    throw new Error("Invalid recurring date.");
  const increment = {
    daily: addDays,
    weekly: addWeeks,
    monthly: addMonths,
    yearly: addYears,
  }[frequency];
  const next = increment(current, 1);
  if (frequency === "monthly" || frequency === "yearly") {
    const daysInMonth = new Date(
      next.getFullYear(),
      next.getMonth() + 1,
      0,
    ).getDate();
    next.setDate(Math.min(anchor.getDate(), daysInMonth));
  }
  return format(next, "yyyy-MM-dd");
}

export function monthBounds(month: string) {
  const start = `${month}-01`;
  return { start, end: nextOccurrence(start, "monthly") };
}

export function monthsEndingIn(month: string, count: number) {
  const end = parse(`${month}-01`, "yyyy-MM-dd", new Date());
  return Array.from({ length: count }, (_, index) =>
    format(addMonths(end, index - count + 1), "yyyy-MM"),
  );
}

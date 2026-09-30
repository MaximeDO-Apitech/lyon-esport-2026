import { EVENT_TIME_ZONE } from "./types";

const parisFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: EVENT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function partsAt(timestamp: number) {
  const entries = parisFormatter
    .formatToParts(new Date(timestamp))
    .filter((part) => part.type !== "literal")
    .map((part) => [part.type, Number(part.value)]);
  return Object.fromEntries(entries) as Record<"year" | "month" | "day" | "hour" | "minute" | "second", number>;
}

export function parisWallTimeToUtcMs(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return Number.NaN;
  const desired = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
  };
  const desiredAsUtc = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute, desired.second);
  let guess = desiredAsUtc;
  for (let index = 0; index < 3; index += 1) {
    const seen = partsAt(guess);
    const seenAsUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, seen.second);
    guess += desiredAsUtc - seenAsUtc;
  }
  const final = partsAt(guess);
  const matches = Object.entries(desired).every(([key, valuePart]) => final[key as keyof typeof final] === valuePart);
  return matches ? guess : Number.NaN;
}

export function utcMsToParisLocalInput(timestamp: number | null) {
  if (!timestamp || !Number.isFinite(timestamp)) return "";
  const value = partsAt(timestamp);
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${value.year}-${pad(value.month)}-${pad(value.day)}T${pad(value.hour)}:${pad(value.minute)}`;
}

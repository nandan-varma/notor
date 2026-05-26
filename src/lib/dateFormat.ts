import { format, formatDistanceToNow, isThisWeek, isThisYear, isToday, isYesterday } from "date-fns";

export function formatNoteDate(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  if (isThisWeek(d)) return format(d, "EEE");
  if (isThisYear(d)) return format(d, "MMM d");
  return format(d, "MMM d, yyyy");
}

export function formatRelative(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

export type NoteDateGroup = "Today" | "Yesterday" | "This week" | "Earlier";

export function groupForDate(iso: string): NoteDateGroup {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  if (isThisWeek(d)) return "This week";
  return "Earlier";
}

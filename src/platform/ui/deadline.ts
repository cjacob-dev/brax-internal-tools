import type { Tone } from "./StatusBadge";

const HOUR = 3_600_000;

function span(ms: number): string {
  const hours = Math.floor(ms / HOUR);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${Math.floor((ms % HOUR) / 60_000)}m`;
  return `${Math.max(1, Math.floor(ms / 60_000))}m`;
}

/** SLA countdown label and tone: danger when overdue, warning inside 24h, neutral otherwise. */
export function describeDeadline(due: Date | string, now: Date = new Date()): { label: string; tone: Tone; overdue: boolean } {
  const ms = new Date(due).getTime() - now.getTime();
  if (ms <= 0) return { label: `Overdue ${span(-ms)}`, tone: "danger", overdue: true };
  return { label: `${span(ms)} left`, tone: ms <= 24 * HOUR ? "warning" : "neutral", overdue: false };
}

import { describeDeadline } from "./deadline";
import { StatusBadge } from "./StatusBadge";

/** Countdown badge for an ISO due date (red when overdue). Computed at render time. */
export function DeadlineBadge({ due }: { due: Date | string }) {
  const { label, tone } = describeDeadline(due);
  return (
    <span suppressHydrationWarning title={`Due ${new Date(due).toISOString().replace("T", " ").slice(0, 16)} UTC`}>
      <StatusBadge status={label} label={label} tone={tone} />
    </span>
  );
}

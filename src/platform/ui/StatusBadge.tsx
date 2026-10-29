export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-zinc-100 text-zinc-700",
  info: "bg-sky-50 text-sky-800",
  success: "bg-emerald-50 text-emerald-800",
  warning: "bg-amber-50 text-amber-800",
  danger: "bg-red-50 text-red-800",
};

/** Default tones for common statuses and audit actions; pass `tone` to override. */
const DEFAULT_TONES: Record<string, Tone> = {
  APPROVED: "success",
  PENDING: "warning",
  PENDING_APPROVAL: "warning",
  IN_REVIEW: "info",
  ESCALATED: "warning",
  REJECTED: "danger",
  LOW: "success",
  MEDIUM: "warning",
  HIGH: "danger",
  ACCESS_DENIED: "danger",
  PII_REVEALED: "warning",
  AUDIT_EXPORTED: "info",
  SIGNED_IN: "info",
  SIGNED_OUT: "neutral",
};

export function StatusBadge({ status, tone, label }: { status: string; tone?: Tone; label?: string }) {
  const resolved = tone ?? DEFAULT_TONES[status] ?? "neutral";
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${TONES[resolved]}`}>
      {label ?? status.replace(/_/g, " ")}
    </span>
  );
}

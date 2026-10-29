"use client";

import { useState } from "react";
import type { ActionResult } from "@/platform/actions";
import { ConfirmWithReasonDialog } from "./ConfirmWithReasonDialog";

/**
 * Shows a masked PII value (from maskPII on the server). Pass `reveal` only when the actor
 * has kyc:reveal_pii; it should be a server action that calls revealPII().
 */
export function MaskedValue({ masked, label, reveal }: { masked: string; label: string; reveal?: (reason: string) => Promise<ActionResult<string | null>> }) {
  const [revealed, setRevealed] = useState<string | null>(null);
  if (revealed !== null) return <span className="font-mono text-xs">{revealed}</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono text-xs" aria-label={`${label} (masked)`}>
        {masked}
      </span>
      {reveal ? (
        <ConfirmWithReasonDialog
          triggerLabel="Reveal"
          title={`Reveal ${label}`}
          description="This reveal is logged with your name and reason."
          confirmLabel="Reveal"
          onConfirm={reveal}
          onSuccess={(value) => setRevealed(value ?? "")}
        />
      ) : null}
    </span>
  );
}

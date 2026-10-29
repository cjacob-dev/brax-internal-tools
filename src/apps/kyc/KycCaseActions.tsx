"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, ConfirmWithReasonDialog } from "@/platform/ui";
import { claimCase, decideCase, escalateCase, submitRecommendation } from "./actions";
import { MIN_REASON_LENGTH } from "./domain";

export type KycActionState = {
  caseId: string;
  status: string;
  riskTier: string;
  hasEscalationNote: boolean;
  claimedByMe: boolean;
  recommendedByMe: boolean;
  canRecommend: boolean;
  canDecide: boolean;
};

/** Buttons are a convenience only; every rule is re-checked by the server actions. */
export function KycCaseActions({ state }: { state: KycActionState }) {
  const router = useRouter();
  const [claimError, setClaimError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const refresh = () => router.refresh();
  const { caseId, status } = state;
  const decidable = status === "PENDING_APPROVAL" || status === "ESCALATED";
  const needsNote = state.riskTier === "HIGH" && !state.hasEscalationNote;

  const buttons: React.ReactNode[] = [];
  if (state.canRecommend && status === "NEW") {
    buttons.push(
      <Button
        key="claim"
        variant="primary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await claimCase(caseId);
            setClaimError(result.ok ? null : result.error);
            if (result.ok) refresh();
          })
        }
      >
        {pending ? "Claiming..." : "Claim case"}
      </Button>,
    );
  }
  if (state.canRecommend && status === "IN_REVIEW" && state.claimedByMe) {
    buttons.push(
      <ConfirmWithReasonDialog key="rec-approve" triggerLabel="Recommend approve" title="Recommend approval" description="Sends the case to a compliance reviewer for a final decision." confirmLabel="Submit recommendation" minReasonLength={MIN_REASON_LENGTH} onConfirm={(r) => submitRecommendation(caseId, "APPROVE", r)} onSuccess={refresh} />,
      <ConfirmWithReasonDialog key="rec-reject" triggerLabel="Recommend reject" tone="danger" title="Recommend rejection" description="Sends the case to a compliance reviewer for a final decision." confirmLabel="Submit recommendation" minReasonLength={MIN_REASON_LENGTH} onConfirm={(r) => submitRecommendation(caseId, "REJECT", r)} onSuccess={refresh} />,
    );
  }
  if (state.canDecide && status === "PENDING_APPROVAL") {
    buttons.push(
      <ConfirmWithReasonDialog key="escalate" triggerLabel="Escalate" title="Escalate case" description="The note is stored on the case and is required before deciding a HIGH risk case." confirmLabel="Escalate" minReasonLength={MIN_REASON_LENGTH} onConfirm={(r) => escalateCase(caseId, r)} onSuccess={refresh} />,
    );
  }
  if (state.canDecide && decidable) {
    buttons.push(
      <ConfirmWithReasonDialog key="approve" triggerLabel="Approve" title="Approve case" confirmLabel="Approve" minReasonLength={MIN_REASON_LENGTH} onConfirm={(r) => decideCase(caseId, "APPROVED", r)} onSuccess={refresh} />,
      <ConfirmWithReasonDialog key="reject" triggerLabel="Reject" tone="danger" title="Reject case" confirmLabel="Reject" minReasonLength={MIN_REASON_LENGTH} onConfirm={(r) => decideCase(caseId, "REJECTED", r)} onSuccess={refresh} />,
    );
  }

  const hints: string[] = [];
  if (state.canDecide && decidable && state.recommendedByMe) hints.push("You recommended this case. Under the four-eyes rule another compliance reviewer must decide it.");
  if (state.canDecide && decidable && needsNote) hints.push("HIGH risk: an escalation note is required before approving or rejecting.");
  if (status === "IN_REVIEW" && !state.claimedByMe && state.canRecommend) hints.push("Claimed by another analyst.");

  if (buttons.length === 0 && hints.length === 0) return <p className="text-sm text-zinc-500">No actions available for your role at this stage.</p>;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">{buttons}</div>
      {hints.map((h) => (
        <p key={h} className="text-sm text-zinc-500">
          {h}
        </p>
      ))}
      {claimError ? (
        <p role="alert" className="text-sm text-red-700">
          {claimError}
        </p>
      ) : null}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getApp } from "@/apps/registry";
import { hasPermission } from "@/platform/auth/actor";
import { requirePagePermission } from "@/platform/auth/require-page-permission";
import { Card, DeadlineBadge, MaskedValue, PageHeader, StatusBadge, type Tone } from "@/platform/ui";
import { revealTaxId } from "./actions";
import { isClosed, KYC_ACTIONS } from "./domain";
import { KycCaseActions } from "./KycCaseActions";
import { getKycCase } from "./queries";

const app = getApp("kyc");

const ACTION_TONES: Record<string, Tone> = {
  [KYC_ACTIONS.opened]: "neutral",
  [KYC_ACTIONS.claimed]: "info",
  [KYC_ACTIONS.recommended]: "info",
  [KYC_ACTIONS.escalated]: "warning",
  [KYC_ACTIONS.approved]: "success",
  [KYC_ACTIONS.rejected]: "danger",
  [KYC_ACTIONS.decisionBlocked]: "danger",
  PII_REVEALED: "warning",
};

const fmt = (d: Date) => d.toISOString().replace("T", " ").slice(0, 16) + " UTC";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-zinc-900">{children ?? <span className="text-zinc-400">-</span>}</dd>
    </div>
  );
}

export async function KycCasePage({ id }: { id: string }) {
  await requirePagePermission(app.requiredPermission);
  const { actor, kycCase: c, timeline } = await getKycCase(id);
  if (!c) notFound();
  const canReveal = hasPermission(actor, "kyc:reveal_pii");

  return (
    <>
      <Link href={app.route} className="mb-3 inline-block text-sm text-zinc-500 hover:text-zinc-900">
        &larr; Back to queue
      </Link>
      <PageHeader
        title={c.customerName}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{c.id}</span>
            <StatusBadge status={c.status} />
            <StatusBadge status={c.riskTier} label={`${c.riskTier} risk`} />
            {isClosed(c.status) ? null : <DeadlineBadge due={c.slaDueAt} />}
          </span>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-zinc-900">Customer</h2>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Type">{c.customerType}</Field>
              <Field label="Country">{c.country}</Field>
              <Field label="Risk score">{c.riskScore} / 100</Field>
              <Field label="Tax ID">
                <MaskedValue masked={c.taxIdMasked} label="tax ID" reveal={canReveal ? revealTaxId.bind(null, c.id) : undefined} />
              </Field>
              <Field label="Opened">{fmt(c.createdAt)}</Field>
              <Field label="SLA due">{fmt(c.slaDueAt)}</Field>
            </dl>
          </Card>
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-zinc-900">Documents</h2>
            <ul className="divide-y divide-zinc-100">
              {c.documents.map((d) => (
                <li key={d.fileName} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    {d.type.replace(/_/g, " ")} <span className="font-mono text-xs text-zinc-500">{d.fileName}</span>
                  </span>
                  <StatusBadge status={d.status} tone={d.status === "VERIFIED" ? "success" : d.status === "MISSING" ? "danger" : "warning"} />
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-zinc-900">Review</h2>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Claimed by">{c.claimedByName}</Field>
              <Field label="Recommended by">{c.recommendedByName}</Field>
              <Field label="Recommendation">{c.recommendation ? <StatusBadge status={c.recommendation} tone={c.recommendation === "APPROVE" ? "success" : "danger"} /> : null}</Field>
              <Field label="Recommendation reason">{c.recommendationReason}</Field>
              <Field label="Escalation note">{c.escalationNote}</Field>
              <Field label="Decided by">{c.decidedByName}</Field>
              <Field label="Decision reason">{c.decisionReason}</Field>
            </dl>
            <div className="mt-4 border-t border-zinc-100 pt-4">
              <KycCaseActions
                state={{
                  caseId: c.id,
                  status: c.status,
                  riskTier: c.riskTier,
                  hasEscalationNote: Boolean(c.escalationNote?.trim()),
                  claimedByMe: c.claimedBy === actor.id,
                  recommendedByMe: c.recommendedBy === actor.id,
                  canRecommend: hasPermission(actor, "kyc:recommend"),
                  canDecide: hasPermission(actor, "kyc:decide"),
                }}
              />
            </div>
          </Card>
        </div>
        <Card className="h-fit">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Timeline</h2>
          <p className="mb-3 text-xs text-zinc-500">Built from the audit log.</p>
          <ol className="space-y-4 border-l border-zinc-200 pl-4">
            {timeline.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-zinc-400" aria-hidden />
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={e.action} label={e.action.replace(/^KYC_/, "").replace(/_/g, " ")} tone={ACTION_TONES[e.action]} />
                  {e.fromStatus && e.toStatus && e.fromStatus !== e.toStatus ? (
                    <span className="text-xs text-zinc-500">
                      {e.fromStatus.replace(/_/g, " ")} &rarr; {e.toStatus.replace(/_/g, " ")}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {fmt(e.createdAt)} &middot; {e.actorName}
                  {e.actorRole ? <span className="font-mono"> ({e.actorRole})</span> : null}
                </p>
                {e.reason ? <p className="mt-1 text-sm text-zinc-700">{e.reason}</p> : null}
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  );
}

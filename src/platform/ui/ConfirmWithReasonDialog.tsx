"use client";

import { useId, useRef, useState, useTransition } from "react";
import type { ActionResult } from "@/platform/actions";
import { Button } from "./Button";

/**
 * Confirmation dialog that requires a written reason (recorded in the audit log).
 * `onConfirm` is a server action; the server must still check permissions and validate the reason.
 */
export function ConfirmWithReasonDialog<T>({
  triggerLabel,
  title,
  description,
  confirmLabel = "Confirm",
  tone = "primary",
  minReasonLength = 5,
  disabled,
  onConfirm,
  onSuccess,
}: {
  triggerLabel: string;
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: "primary" | "danger";
  minReasonLength?: number;
  disabled?: boolean;
  onConfirm: (reason: string) => Promise<ActionResult<T>>;
  onSuccess?: (data: T) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const reasonId = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const tooShort = reason.trim().length < minReasonLength;

  function close() {
    dialogRef.current?.close();
    setReason("");
    setError(null);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await onConfirm(reason.trim());
      if (result.ok) {
        close();
        onSuccess?.(result.data);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <Button variant={tone} disabled={disabled} onClick={() => dialogRef.current?.showModal()}>
        {triggerLabel}
      </Button>
      <dialog ref={dialogRef} className="m-auto w-[min(480px,92vw)] rounded-lg border border-zinc-200 p-5 shadow-xl" onClose={() => setError(null)}>
        <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
        {description ? <p className="mt-1 text-sm text-zinc-500">{description}</p> : null}
        <label htmlFor={reasonId} className="mt-4 block text-sm font-medium text-zinc-800">
          Reason (required, recorded in the audit log)
        </label>
        <textarea
          id={reasonId}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={1000}
          className="mt-1 h-24 w-full rounded-md border border-zinc-300 p-2 text-sm"
        />
        {tooShort ? <p className="mt-1 text-xs text-zinc-500">At least {minReasonLength} characters.</p> : null}
        {error ? (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button variant={tone} onClick={submit} disabled={pending || tooShort}>
            {pending ? "Working..." : confirmLabel}
          </Button>
        </div>
      </dialog>
    </>
  );
}

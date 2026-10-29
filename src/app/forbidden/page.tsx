import Link from "next/link";
import { Card, PageHeader } from "@/platform/ui";

export default function ForbiddenPage() {
  return (
    <>
      <PageHeader title="Access denied" />
      <Card>
        <p className="text-sm text-zinc-600">You do not have permission to view that page. The attempt was recorded in the audit log.</p>
        <Link href="/" className="mt-3 inline-block text-sm font-medium text-zinc-900 underline">
          Back to home
        </Link>
      </Card>
    </>
  );
}

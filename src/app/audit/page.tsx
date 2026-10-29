import { AuditPage } from "@/apps/audit/AuditPage";
import { cleanFilters } from "@/apps/audit/queries";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <AuditPage filters={cleanFilters(await searchParams)} />;
}

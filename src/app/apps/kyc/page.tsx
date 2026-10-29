import { KycQueuePage } from "@/apps/kyc/KycQueuePage";
import { cleanKycFilters } from "@/apps/kyc/queries";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <KycQueuePage filters={cleanKycFilters(await searchParams)} />;
}

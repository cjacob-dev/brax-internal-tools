import { KycCasePage } from "@/apps/kyc/KycCasePage";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <KycCasePage id={id} />;
}

import { getApp } from "@/apps/registry";
import { requirePagePermission } from "@/platform/auth/require-page-permission";
import { DataTable, PageHeader, type Column } from "@/platform/ui";
import { KYC_STATUSES, RISK_TIERS } from "./domain";
import { listKycCases, type KycFilters } from "./queries";

const app = getApp("kyc");

const columns: Column[] = [
  { key: "customerName", header: "Customer", kind: "link", hrefKey: "href", sortable: true },
  { key: "customerType", header: "Type", sortable: true },
  { key: "country", header: "Country", kind: "mono", sortable: true },
  { key: "riskScore", header: "Risk", sortable: true, filterable: false },
  { key: "riskTier", header: "Tier", kind: "status", sortable: true },
  { key: "status", header: "Status", kind: "status", sortable: true },
  { key: "claimedBy", header: "Claimed by", sortable: true },
  { key: "slaDueAt", header: "SLA", kind: "deadline", sortable: true, filterable: false },
  { key: "createdAt", header: "Opened (UTC)", kind: "datetime", sortable: true, filterable: false },
];

const inputClass = "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm";

export async function KycQueuePage({ filters }: { filters: KycFilters }) {
  await requirePagePermission(app.requiredPermission);
  const { cases } = await listKycCases(filters);
  const rows = cases.map((c) => ({
    id: c.id,
    href: `${app.route}/${c.id}`,
    customerName: c.customerName,
    customerType: c.customerType,
    country: c.country,
    riskScore: c.riskScore,
    riskTier: c.riskTier,
    status: c.status,
    claimedBy: c.claimedByName,
    slaDueAt: c.slaOpen ? c.slaDueAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
  }));
  return (
    <>
      <PageHeader title={app.name} description="Open cases sorted by SLA (most overdue first). Closed cases have no SLA. Tax IDs are masked." />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Status
          <select name="status" defaultValue={filters.status ?? ""} className={inputClass}>
            <option value="">All</option>
            {KYC_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Risk tier
          <select name="tier" defaultValue={filters.tier ?? ""} className={inputClass}>
            <option value="">All</option>
            {RISK_TIERS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50">
          Apply filters
        </button>
      </form>
      <DataTable columns={columns} rows={rows} emptyMessage="No cases match these filters." initialSort={{ key: "slaDueAt", dir: "asc" }} />
    </>
  );
}

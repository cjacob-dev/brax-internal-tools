import { getApp } from "@/apps/registry";
import { hasPermission } from "@/platform/auth/actor";
import { requirePagePermission } from "@/platform/auth/require-page-permission";
import { DataTable, PageHeader, type Column } from "@/platform/ui";
import { AUDIT_MAX_ROWS, listAuditEvents, type AuditFilters } from "./queries";

const app = getApp("audit");

const columns: Column[] = [
  { key: "createdAt", header: "Time (UTC)", kind: "datetime", sortable: true },
  { key: "actor", header: "Actor", sortable: true },
  { key: "actorRole", header: "Role", kind: "mono", sortable: true },
  { key: "app", header: "App", kind: "mono", sortable: true },
  { key: "action", header: "Action", kind: "status", sortable: true },
  { key: "entity", header: "Entity", kind: "mono", sortable: true },
  { key: "before", header: "Before", kind: "json", filterable: false },
  { key: "after", header: "After", kind: "json", filterable: false },
  { key: "reason", header: "Reason" },
];

const inputClass = "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm";

export async function AuditPage({ filters }: { filters: AuditFilters }) {
  const actor = await requirePagePermission(app.requiredPermission);
  const { events, apps, entityTypes } = await listAuditEvents(filters);
  const exportQuery = new URLSearchParams(Object.entries(filters).filter((e): e is [string, string] => Boolean(e[1]))).toString();
  const rows = events.map((e) => ({
    id: e.id,
    createdAt: e.createdAt.toISOString(),
    actor: e.actorName ?? "anonymous",
    actorRole: e.actorRole,
    app: e.app,
    action: e.action,
    entity: e.entityId ? `${e.entityType}:${e.entityId}` : e.entityType,
    before: e.before,
    after: e.after,
    reason: e.reason,
  }));
  return (
    <>
      <PageHeader
        title={app.name}
        description={`Append-only. Latest ${AUDIT_MAX_ROWS} matching events. PII in payloads is masked when written.`}
        actions={
          hasPermission(actor, "audit:export") ? (
            <a href={`/audit/export${exportQuery ? `?${exportQuery}` : ""}`} className="rounded-md border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700">
              Export CSV
            </a>
          ) : null
        }
      />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          App
          <select name="app" defaultValue={filters.app ?? ""} className={inputClass}>
            <option value="">All</option>
            {apps.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Entity type
          <select name="entityType" defaultValue={filters.entityType ?? ""} className={inputClass}>
            <option value="">All</option>
            {entityTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Entity id
          <input name="entityId" defaultValue={filters.entityId ?? ""} className={inputClass} />
        </label>
        <button type="submit" className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50">
          Apply filters
        </button>
      </form>
      <DataTable columns={columns} rows={rows} emptyMessage="No audit events match these filters." initialSort={{ key: "createdAt", dir: "desc" }} />
    </>
  );
}

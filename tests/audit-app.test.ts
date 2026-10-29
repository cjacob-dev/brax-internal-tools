import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { csvCell } from "@/apps/audit/csv";
import { listAuditEvents } from "@/apps/audit/queries";
import { GET as exportCsv } from "@/app/audit/export/route";
import { recordAudit } from "@/platform/audit/record-audit";
import { requirePagePermission } from "@/platform/auth/require-page-permission";
import { auditEventsFor, session, signInAsUser } from "./helpers";

const exportUrl = (qs = "") => new Request(`http://localhost/audit/export${qs}`);

beforeEach(() => {
  session.userId = null;
});

describe("/audit (admin only)", () => {
  it.each(["ops_analyst", "compliance_reviewer"])("denies %s and records the attempt", async (role) => {
    const user = await signInAsUser(role);
    await expect(listAuditEvents({})).rejects.toMatchObject({ code: "NOT_GRANTED" });
    expect(await auditEventsFor({ actorId: user.id, action: "ACCESS_DENIED" })).toHaveLength(1);
  });

  it("page guard sends anonymous users home and wrong roles to /forbidden", async () => {
    await expect(requirePagePermission("audit:read")).rejects.toThrow("NEXT_REDIRECT:/");
    await signInAsUser("ops_analyst");
    await expect(requirePagePermission("audit:read")).rejects.toThrow("NEXT_REDIRECT:/forbidden");
  });

  it("lets admin filter by app and entity", async () => {
    const admin = await signInAsUser("admin");
    const entityId = randomUUID();
    await recordAudit({ actor: admin, app: "filter-test", action: "TEST_MARKER", entity: { type: "Widget", id: entityId }, before: null, after: null, reason: "r" });
    await recordAudit({ actor: admin, app: "other-app", action: "TEST_MARKER", entity: { type: "Widget", id: entityId }, before: null, after: null, reason: "r" });
    const byApp = await listAuditEvents({ app: "filter-test" });
    expect(byApp.events.map((e) => e.app)).toEqual(["filter-test"]);
    expect(byApp.apps).toEqual(expect.arrayContaining(["filter-test", "other-app"]));
    const byEntity = await listAuditEvents({ entityType: "Widget", entityId });
    expect(byEntity.events).toHaveLength(2);
    expect(byEntity.events[0].actorName).toBe("Test User");
  });
});

describe("CSV export", () => {
  it("returns 401 for anonymous callers and writes no AUDIT_EXPORTED", async () => {
    const before = (await auditEventsFor({ action: "AUDIT_EXPORTED" })).length;
    expect((await exportCsv(exportUrl())).status).toBe(401);
    expect(await auditEventsFor({ action: "AUDIT_EXPORTED" })).toHaveLength(before);
  });

  it.each(["ops_analyst", "compliance_reviewer"])("returns 403 for %s and writes no AUDIT_EXPORTED", async (role) => {
    const user = await signInAsUser(role);
    expect((await exportCsv(exportUrl())).status).toBe(403);
    expect(await auditEventsFor({ actorId: user.id, action: "AUDIT_EXPORTED" })).toHaveLength(0);
  });

  it("exports filtered CSV for admin and audits the export itself", async () => {
    const admin = await signInAsUser("admin");
    const entityId = randomUUID();
    await recordAudit({ actor: admin, app: "export-test", action: "TEST_MARKER", entity: { type: "Widget", id: entityId }, before: null, after: { ok: true }, reason: "=HYPERLINK(\"x\")" });
    const res = await exportCsv(exportUrl(`?app=export-test&entityId=${entityId}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const lines = (await res.text()).trim().split("\r\n");
    expect(lines[0]).toBe("id,createdAt,actorId,actorRole,app,action,entityType,entityId,before,after,reason");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain(`export-test,TEST_MARKER,Widget,${entityId}`);
    expect(lines[1]).toContain(`"'=HYPERLINK(""x"")"`);

    const [event] = await auditEventsFor({ actorId: admin.id, action: "AUDIT_EXPORTED" });
    expect(event).toMatchObject({ app: "audit", actorRole: "admin", entityType: "AuditEvent" });
    expect(JSON.parse(event.after!)).toEqual({ filters: { app: "export-test", entityId }, rowCount: 1 });
  });

  it("neutralizes spreadsheet formulas and quotes special characters", () => {
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell("-5")).toBe("'-5");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell(null)).toBe("");
  });
});

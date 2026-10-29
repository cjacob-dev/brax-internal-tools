import { describe, expect, it } from "vitest";
import { applyTableState, type Row } from "@/platform/ui/table-state";

const rows: Row[] = [
  { id: "1", name: "Charlie", amount: 30, status: "PENDING" },
  { id: "2", name: "alpha", amount: 10, status: "APPROVED" },
  { id: "3", name: "Bravo", amount: null, status: "PENDING" },
  { id: "4", name: "Delta", amount: 20, status: "REJECTED" },
];
const state = { query: "", sortKey: null, sortDir: "asc" as const, page: 1, pageSize: 10 };

describe("DataTable state", () => {
  it("filters case-insensitively across filterable keys only", () => {
    expect(applyTableState(rows, ["name", "status"], { ...state, query: "PEND" }).rows.map((r) => r.id)).toEqual(["1", "3"]);
    expect(applyTableState(rows, ["name"], { ...state, query: "pend" }).total).toBe(0);
  });

  it("sorts both directions with nulls last", () => {
    expect(applyTableState(rows, [], { ...state, sortKey: "amount", sortDir: "asc" }).rows.map((r) => r.id)).toEqual(["2", "4", "1", "3"]);
    expect(applyTableState(rows, [], { ...state, sortKey: "amount", sortDir: "desc" }).rows.map((r) => r.id)).toEqual(["1", "4", "2", "3"]);
    expect(applyTableState(rows, [], { ...state, sortKey: "name" }).rows.map((r) => r.name)).toEqual(["alpha", "Bravo", "Charlie", "Delta"]);
  });

  it("paginates and clamps the page", () => {
    const page2 = applyTableState(rows, [], { ...state, pageSize: 3, page: 2 });
    expect(page2).toMatchObject({ page: 2, pageCount: 2, total: 4 });
    expect(page2.rows.map((r) => r.id)).toEqual(["4"]);
    expect(applyTableState(rows, [], { ...state, pageSize: 3, page: 99 }).page).toBe(2);
    expect(applyTableState([], [], state)).toMatchObject({ page: 1, pageCount: 1, total: 0 });
  });
});

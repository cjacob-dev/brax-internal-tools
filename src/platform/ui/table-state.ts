export type Cell = string | number | null;
export type Row = { id: string } & Record<string, Cell>;
export type SortDir = "asc" | "desc";
export type TableState = { query: string; sortKey: string | null; sortDir: SortDir; page: number; pageSize: number };

function compare(a: Cell, b: Cell): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

/** Pure filter -> sort -> paginate, so DataTable behavior is unit-testable. */
export function applyTableState<T extends Row>(rows: readonly T[], filterKeys: readonly string[], state: TableState) {
  const q = state.query.trim().toLowerCase();
  const filtered = q ? rows.filter((row) => filterKeys.some((k) => String(row[k] ?? "").toLowerCase().includes(q))) : [...rows];
  if (state.sortKey) {
    const key = state.sortKey;
    const dir = state.sortDir === "asc" ? 1 : -1;
    filtered.sort((a, b) => {
      const c = compare(a[key], b[key]);
      return a[key] === null || b[key] === null ? c : c * dir;
    });
  }
  const pageCount = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  const page = Math.min(Math.max(1, state.page), pageCount);
  const start = (page - 1) * state.pageSize;
  return { rows: filtered.slice(start, start + state.pageSize), total: filtered.length, page, pageCount };
}

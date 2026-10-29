"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DeadlineBadge } from "./DeadlineBadge";
import { StatusBadge } from "./StatusBadge";
import { applyTableState, type Cell, type Row, type SortDir } from "./table-state";

export type ColumnKind = "text" | "mono" | "status" | "datetime" | "json" | "link" | "deadline";

export type Column = {
  key: string;
  header: string;
  kind?: ColumnKind;
  sortable?: boolean;
  /** Included in the free-text filter. Defaults to true. */
  filterable?: boolean;
  /** For kind "link": the row key holding the URL. */
  hrefKey?: string;
};

function renderCell(value: Cell, column: Column, row: Row) {
  if (value === null || value === "") return <span className="text-zinc-400">-</span>;
  switch (column.kind ?? "text") {
    case "link": {
      const href = column.hrefKey ? row[column.hrefKey] : null;
      return typeof href === "string" ? (
        <Link href={href} className="font-medium text-zinc-900 underline-offset-2 hover:underline">
          {value}
        </Link>
      ) : (
        value
      );
    }
    case "deadline":
      return <DeadlineBadge due={String(value)} />;
    case "status":
      return <StatusBadge status={String(value)} />;
    case "mono":
      return <span className="font-mono text-xs">{value}</span>;
    case "datetime":
      return <span className="whitespace-nowrap font-mono text-xs">{String(value).replace("T", " ").slice(0, 19)}</span>;
    case "json":
      return <pre className="max-w-xs whitespace-pre-wrap break-words font-mono text-xs">{JSON.stringify(JSON.parse(String(value)), null, 2)}</pre>;
    default:
      return value;
  }
}

/**
 * Client-side sort, filter, and paginate over rows the server already authorized and loaded.
 * Cells are plain values (serializable from server components); `kind` picks the renderer.
 */
export function DataTable({
  columns,
  rows,
  pageSize = 25,
  emptyMessage = "No records found.",
  initialSort,
}: {
  columns: Column[];
  rows: Row[];
  pageSize?: number;
  emptyMessage?: string;
  initialSort?: { key: string; dir: SortDir };
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(initialSort?.key ?? null);
  const [sortDir, setSortDir] = useState<SortDir>(initialSort?.dir ?? "asc");
  const [page, setPage] = useState(1);
  const filterKeys = useMemo(() => columns.filter((c) => c.filterable !== false).map((c) => c.key), [columns]);
  const view = applyTableState(rows, filterKeys, { query, sortKey, sortDir, page, pageSize });

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div className="space-y-3">
      <input
        type="search"
        placeholder="Filter rows..."
        aria-label="Filter rows"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(1);
        }}
        className="w-64 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm"
      />
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className="border-b border-zinc-200 px-3 py-2 font-medium" aria-sort={sortKey === c.key ? (sortDir === "asc" ? "ascending" : "descending") : undefined}>
                  {c.sortable ? (
                    <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 uppercase hover:text-zinc-900">
                      {c.header}
                      <span aria-hidden>{sortKey === c.key ? (sortDir === "asc" ? "▲" : "▼") : "↕"}</span>
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-zinc-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              view.rows.map((row) => (
                <tr key={row.id} className="border-b border-zinc-100 align-top last:border-0">
                  {columns.map((c) => (
                    <td key={c.key} className="px-3 py-2">
                      {renderCell(row[c.key] ?? null, c, row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-zinc-500">
        <span>
          {view.total} row{view.total === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-2">
          <button type="button" className="rounded border border-zinc-300 px-2 py-1 disabled:opacity-40" disabled={view.page <= 1} onClick={() => setPage(view.page - 1)}>
            Previous
          </button>
          <span>
            Page {view.page} of {view.pageCount}
          </span>
          <button type="button" className="rounded border border-zinc-300 px-2 py-1 disabled:opacity-40" disabled={view.page >= view.pageCount} onClick={() => setPage(view.page + 1)}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

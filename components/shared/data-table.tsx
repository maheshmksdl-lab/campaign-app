"use client";

import { useState, type ReactNode } from "react";
import { ArrowDownIcon, ArrowUpIcon } from "@phosphor-icons/react/dist/ssr";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination, td, th } from "@/components/shared/campaign-ui";
import { RowMenu, type MenuAction } from "@/components/shared/row-menu";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  /** Makes the header sortable. */
  sort?: (a: T, b: T) => number;
  align?: "right";
  className?: string;
  /** Hide on narrow screens. */
  hideBelow?: "md" | "lg";
}

const PAGE_SIZES = [10, 25, 50] as const;

/**
 * The compact table every module list uses (same cells as the Campaigns
 * list): sortable headers, optional row selection, a "⋯" menu per row and
 * pagination. Rows scroll sideways on narrow screens.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  rowLabel,
  onRowClick,
  actions,
  selected,
  onSelectedChange,
  defaultSort,
  noun,
  empty,
  minWidth = 860,
  caption,
}: {
  /** undefined while loading. */
  rows: T[] | undefined;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** Accessible name of a row, for checkboxes and menus. */
  rowLabel: (row: T) => string;
  onRowClick?: (row: T) => void;
  actions?: (row: T) => MenuAction[];
  selected?: Set<string>;
  onSelectedChange?: (s: Set<string>) => void;
  defaultSort?: { key: string; dir: "asc" | "desc" };
  noun: string;
  empty: ReactNode;
  minWidth?: number;
  caption: string;
}) {
  const [sort, setSort] = useState(defaultSort);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<number>(10);
  const sortCol = columns.find((c) => c.key === sort?.key);
  const sorted = rows && sortCol?.sort ? [...rows].sort((a, b) => sortCol.sort!(a, b) * (sort!.dir === "asc" ? 1 : -1)) : rows;
  const pageCount = Math.max(1, Math.ceil((sorted?.length ?? 0) / size));
  const current = Math.min(page, pageCount);
  const visible = sorted?.slice((current - 1) * size, current * size);
  const selectable = !!selected && !!onSelectedChange;
  const allOn = !!visible?.length && visible.every((r) => selected?.has(rowKey(r)));
  const someOn = !!visible?.some((r) => selected?.has(rowKey(r)));
  const hide = (c: Column<T>) => (c.hideBelow === "md" ? "hidden md:table-cell" : c.hideBelow === "lg" ? "hidden lg:table-cell" : "");

  if (rows && rows.length === 0) return <>{empty}</>;

  return (
    <>
      <div className="relative overflow-x-auto scrollbar-thin">
        <table className="w-full border-collapse" style={{ minWidth }}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-y border-line-soft bg-campaign-muted">
              {selectable && (
                <th scope="col" className={cn(th, "w-11 pr-0")}>
                  <Checkbox
                    aria-label="Select all on this page"
                    checked={allOn ? true : someOn ? "indeterminate" : false}
                    disabled={!visible?.length}
                    onCheckedChange={(v) => {
                      const next = new Set(selected);
                      visible?.forEach((r) => (v === true ? next.add(rowKey(r)) : next.delete(rowKey(r))));
                      onSelectedChange!(next);
                    }}
                  />
                </th>
              )}
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th key={c.key} scope="col" aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : c.sort ? "none" : undefined} className={cn(th, c.align === "right" && "text-right", hide(c), c.className)}>
                    {c.sort ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPage(1);
                          setSort(active ? { key: c.key, dir: sort!.dir === "asc" ? "desc" : "asc" } : { key: c.key, dir: "asc" });
                        }}
                        className={cn("group inline-flex items-center gap-1 rounded transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-action", c.align === "right" && "flex-row-reverse", active && "text-ink")}
                      >
                        {c.label}
                        {active && sort!.dir === "asc" ? <ArrowUpIcon size={12} aria-hidden /> : <ArrowDownIcon size={12} aria-hidden className={active ? "" : "opacity-0 group-hover:opacity-40"} />}
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                );
              })}
              {actions && (
                <th scope="col" className={cn(th, "w-12 text-right")}>
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {!visible
              ? Array.from({ length: 5 }, (_, i) => (
                  <tr key={i} className="border-b border-line-soft">
                    <td colSpan={columns.length + 2} className="px-5 py-3.5">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))
              : visible.map((r) => {
                  const id = rowKey(r);
                  const on = !!selected?.has(id);
                  return (
                    <tr key={id} data-selected={on} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cn("border-b border-line-soft transition-colors last:border-0 hover:bg-campaign-surface data-[selected=true]:bg-campaign-surface", onRowClick && "cursor-pointer")}>
                      {selectable && (
                        <td className={cn(td, "w-11 pr-0")} onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            aria-label={`Select ${rowLabel(r)}`}
                            checked={on}
                            onCheckedChange={(v) => {
                              const next = new Set(selected);
                              if (v === true) next.add(id);
                              else next.delete(id);
                              onSelectedChange!(next);
                            }}
                          />
                        </td>
                      )}
                      {columns.map((c) => (
                        <td key={c.key} className={cn(td, c.align === "right" && "text-right tabular-nums", hide(c), c.className)}>
                          {c.render(r)}
                        </td>
                      ))}
                      {actions && (
                        <td className={cn(td, "text-right")} onClick={(e) => e.stopPropagation()}>
                          <RowMenu label={`Actions for ${rowLabel(r)}`} actions={actions(r)} />
                        </td>
                      )}
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
      {sorted && sorted.length > 0 && (
        <div className="border-t border-line-soft px-4 py-3 sm:px-5">
          <Pagination
            page={current}
            pageCount={pageCount}
            total={sorted.length}
            pageSize={size}
            pageSizes={PAGE_SIZES}
            noun={noun}
            onPage={setPage}
            onPageSize={(s) => {
              setSize(s);
              setPage(1);
            }}
          />
        </div>
      )}
    </>
  );
}

/** Sorting helpers for column definitions. */
export const byText = <T,>(get: (r: T) => string | undefined) => (a: T, b: T) => (get(a) ?? "").localeCompare(get(b) ?? "", undefined, { sensitivity: "base" });
export const byNumber = <T,>(get: (r: T) => number | undefined) => (a: T, b: T) => (get(a) ?? -1) - (get(b) ?? -1);

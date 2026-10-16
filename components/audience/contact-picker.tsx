"use client";

import { useState } from "react";
import { CheckIcon, MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr";
import { Skeleton } from "@/components/ui/skeleton";
import { fieldClass } from "@/components/shared/campaign-ui";
import { useContacts } from "@/hooks/use-audience";
import { contactName } from "@/lib/audience";
import { formatNumber, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Search the contacts and tick the ones to add (to a list). Contacts already
 * in `listId` show as added. Results are paged by the API, so the 12k demo
 * contacts never load at once.
 */
export function ContactPicker({ selected, onChange, listId, className }: { selected: Set<string>; onChange: (update: (prev: Set<string>) => Set<string>) => void; listId?: string; className?: string }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data, isFetching } = useContacts({ tab: "all", search: q, page, pageSize: 8, sort: { key: "addedAt", dir: "desc" } });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="relative">
        <MagnifyingGlassIcon size={15} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted" />
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Search contacts by name, email or company"
          aria-label="Search contacts"
          className={cn(fieldClass, "pl-8.5")}
        />
      </div>
      <div className={cn("overflow-hidden rounded-lg border border-line transition-opacity", isFetching && "opacity-70")} role="listbox" aria-multiselectable="true" aria-label="Contacts">
        {!data
          ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="m-2 h-8" />)
          : data.rows.map((c) => {
              const inList = !!listId && c.listIds.includes(listId);
              const on = selected.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={on || inList}
                  disabled={inList}
                  onClick={() =>
                    onChange((prev) => {
                      const next = new Set(prev);
                      if (next.has(c.id)) next.delete(c.id);
                      else next.add(c.id);
                      return next;
                    })
                  }
                  className={cn("flex w-full items-center gap-3 border-b border-line-soft px-3 py-2 text-left transition-colors last:border-0 hover:bg-campaign-surface disabled:cursor-default disabled:hover:bg-transparent", on && "bg-campaign-surface")}
                >
                  <span className={cn("inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border", on || inList ? "border-brand bg-brand text-white" : "border-[#CFCAD9] bg-white", inList && "opacity-50")} aria-hidden>
                    {(on || inList) && <CheckIcon size={11} weight="bold" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">{contactName(c)}</span>
                    <span className="block truncate text-[12px] text-ink-muted">{c.email}</span>
                  </span>
                  {inList && <span className="shrink-0 text-[11.5px] text-ink-muted">In list</span>}
                </button>
              );
            })}
        {data && data.rows.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-ink-muted">No contacts match “{q}”.</p>}
      </div>
      <div className="flex items-center justify-between gap-2 text-[12px] text-ink-muted">
        <span>
          {pluralize(selected.size, "contact")} selected{data ? ` · ${formatNumber(data.total)} found` : ""}
        </span>
        <span className="flex items-center gap-1">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded px-2 py-1 font-medium text-brand hover:bg-brand-surface disabled:text-ink-faint disabled:hover:bg-transparent">
            Previous
          </button>
          <span className="tabular-nums">
            {page}/{pages}
          </span>
          <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded px-2 py-1 font-medium text-brand hover:bg-brand-surface disabled:text-ink-faint disabled:hover:bg-transparent">
            Next
          </button>
        </span>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArchiveIcon, ArrowDownIcon, ArrowsDownUpIcon, ArrowUpIcon, PaperPlaneTiltIcon, PlusIcon, TrashIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  FilterSelect,
  fieldClass,
  OutlineButton,
  PageHeading,
  PageShell,
  Pagination,
  PrimaryButton,
  SearchInput,
  StatusBadge,
  td,
  th,
  TypeIcon,
  TypeLabel,
  UnderlineTabs,
} from "@/components/shared/campaign-ui";
import { RowMenu } from "@/components/shared/row-menu";
import { EmptyState, ErrorState } from "@/components/shared/state-panels";
import { useCampaigns } from "@/hooks/use-campaigns";
import { campaignDate, hasPlannedTime, isSms, STATUS_META, TYPE_META, TYPE_ORDER } from "@/lib/campaign-meta";
import { formatDate, formatNumber, formatPercent, formatTime, pluralize } from "@/lib/format";
import { campaignHref, CAMPAIGNS_ROUTE, setCampaignsListHref } from "@/lib/routes";
import { CAMPAIGN_SORTS, campaignQueryString, DEFAULT_CAMPAIGN_QUERY, PAGE_SIZES, parseCampaignQuery, type CampaignQuery, type CampaignSort, type StatusTab } from "@/lib/schemas/campaign";
import type { Campaign, CampaignStatus } from "@/lib/types/campaigns";
import { cn } from "@/lib/utils";
import { useCampaignActions } from "./campaign-actions";
import { CreateCampaignDialog, useCreateDialog } from "./campaign-dialogs";

/** List state lives in the URL, so filters survive refresh, Back, and links from the dashboard and sidebar. */
function useCampaignQuery() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const query = useMemo(() => parseCampaignQuery(new URLSearchParams(params.toString())), [params]);
  const update = useCallback(
    (patch: Partial<CampaignQuery>) => {
      // Any change other than paging returns to page 1.
      const next = { ...query, ...patch, page: patch.page ?? 1 };
      router.replace(`${pathname}${campaignQueryString(next)}`, { scroll: false });
    },
    [query, router, pathname],
  );
  return [query, update] as const;
}

const hasFilters = (q: CampaignQuery) => !!(q.q || q.type || q.from || q.to || q.status);

// ── Filtering & sorting ──────────────────────────────────────────────

/** Search, channel and date filters (the status tab is applied separately so tab counts can use the rest). */
function matchesFilters(c: Campaign, q: CampaignQuery): boolean {
  const term = q.q.trim().toLowerCase();
  if (term && ![c.name, c.subject ?? "", c.message ?? "", c.audience].some((v) => v.toLowerCase().includes(term))) return false;
  if (q.type && c.type !== q.type) return false;
  const d = campaignDate(c).slice(0, 10);
  if (q.from && d < q.from) return false;
  if (q.to && d > q.to) return false;
  return true;
}

const matchesTab = (c: Campaign, tab: StatusTab) => (tab ? c.status === tab : c.status !== "archived");

/** Campaigns without results (drafts, scheduled) sort after those with rates. */
const rate = (v: number | undefined) => (v === undefined ? -1 : v);

const SORTERS: Record<CampaignSort, (a: Campaign, b: Campaign) => number> = {
  newest: (a, b) => campaignDate(b).localeCompare(campaignDate(a)),
  oldest: (a, b) => campaignDate(a).localeCompare(campaignDate(b)),
  "name-asc": (a, b) => a.name.localeCompare(b.name),
  "name-desc": (a, b) => b.name.localeCompare(a.name),
  "open-rate": (a, b) => rate(b.openRate) - rate(a.openRate),
  "click-rate": (a, b) => rate(b.clickRate) - rate(a.clickRate),
  recipients: (a, b) => b.recipients - a.recipients,
};

const SORT_LABEL: Record<CampaignSort, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  "name-asc": "Name (A–Z)",
  "name-desc": "Name (Z–A)",
  "open-rate": "Highest open rate",
  "click-rate": "Highest click rate",
  recipients: "Most recipients",
};

const TABS: { value: StatusTab; label: string }[] = [
  { value: "", label: "All Campaigns" },
  { value: "draft", label: "Drafts" },
  { value: "scheduled", label: "Scheduled" },
  { value: "sending", label: "Sending" },
  { value: "sent", label: "Sent" },
  { value: "paused", label: "Paused" },
  { value: "archived", label: "Archived" },
];

/** "Sent May 15, 2025" / "Scheduled …" / "Created …" */
function dateCell(c: Campaign) {
  if (c.sentAt) return { label: c.type === "automation" || c.type === "journey" ? "Started" : "Sent", at: c.sentAt, time: true };
  if (c.scheduledAt) return { label: hasPlannedTime(c) ? "Scheduled" : "Planned", at: c.scheduledAt, time: hasPlannedTime(c) };
  return { label: "Created", at: c.createdAt, time: false };
}

const rateText = (v: number | undefined) => (v === undefined ? "—" : formatPercent(v));

// ── Toolbar ──────────────────────────────────────────────────────────

const TYPE_OPTIONS = TYPE_ORDER.map((t) => ({ value: t, label: TYPE_META[t].label }));
const STATUS_OPTIONS = (["draft", "scheduled", "sending", "sent", "paused", "archived"] as CampaignStatus[]).map((s) => ({ value: s, label: STATUS_META[s].label }));
const SORT_OPTIONS = CAMPAIGN_SORTS.map((s) => ({ value: s, label: SORT_LABEL[s] }));

function Toolbar({ query, update }: { query: CampaignQuery; update: (p: Partial<CampaignQuery>) => void }) {
  const clear = () => update({ ...DEFAULT_CAMPAIGN_QUERY, sort: query.sort, size: query.size });
  return (
    <div className="grid grid-cols-2 gap-2 px-4 pt-4 pb-3 sm:px-5 md:grid-cols-3 xl:flex xl:flex-wrap xl:items-center">
      <FilterSelect label="Campaign type" allLabel="All types" value={query.type} onChange={(type) => update({ type: type as CampaignQuery["type"] })} options={TYPE_OPTIONS} className="xl:w-[150px]" />
      <FilterSelect label="Status" allLabel="All statuses" value={query.status} onChange={(status) => update({ status: status as StatusTab })} options={STATUS_OPTIONS} className="xl:w-[200px]" />
      <fieldset className="col-span-2 flex min-w-0 items-center gap-1.5 md:col-span-1 xl:col-auto">
        <legend className="sr-only">Date range</legend>
        <input type="date" value={query.from} max={query.to || undefined} onChange={(e) => update({ from: e.target.value })} aria-label="From date" className={cn(fieldClass, "min-w-0 flex-1 text-ink-body xl:w-[140px] xl:flex-none", query.from && "border-brand-soft bg-brand-surface")} />
        <span className="text-[12px] text-ink-muted" aria-hidden>
          to
        </span>
        <input type="date" value={query.to} min={query.from || undefined} onChange={(e) => update({ to: e.target.value })} aria-label="To date" className={cn(fieldClass, "min-w-0 flex-1 text-ink-body xl:w-[140px] xl:flex-none", query.to && "border-brand-soft bg-brand-surface")} />
      </fieldset>
      <div className="col-span-2 flex items-center gap-2 md:col-span-3 xl:col-auto xl:ml-auto">
        <label className="flex min-w-0 flex-1 items-center gap-2 text-[13px] whitespace-nowrap text-ink-muted xl:flex-none">
          Sort by
          <FilterSelect label="Sort campaigns" value={query.sort} onChange={(sort) => update({ sort: (sort || "newest") as CampaignSort })} options={SORT_OPTIONS} highlight={false} className="min-w-0 xl:w-[180px]" />
        </label>
        {hasFilters(query) && (
          <OutlineButton icon={XIcon} onClick={clear}>
            Clear filters
          </OutlineButton>
        )}
      </div>
    </div>
  );
}

// ── Table ────────────────────────────────────────────────────────────

/** Column header that toggles one of the list sorts. */
function SortHeader({ label, asc, desc, query, update, numeric, className }: { label: string; asc?: CampaignSort; desc: CampaignSort; query: CampaignQuery; update: (p: Partial<CampaignQuery>) => void; numeric?: boolean; className?: string }) {
  const active = query.sort === desc || query.sort === asc;
  const dir = query.sort === asc ? "asc" : "desc";
  const SortIcon = !active ? ArrowsDownUpIcon : dir === "asc" ? ArrowUpIcon : ArrowDownIcon;
  const next = () => {
    if (!asc) return update({ sort: desc });
    // Text columns start ascending; dates and numbers start descending.
    if (!active) update({ sort: numeric ? desc : asc });
    else update({ sort: query.sort === asc ? desc : asc });
  };
  return (
    <th scope="col" aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"} className={cn(th, numeric && "text-right", className)}>
      <button type="button" onClick={next} className={cn("inline-flex items-center gap-1 rounded transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-action", numeric && "flex-row-reverse", active && "text-ink")}>
        {label}
        <SortIcon size={12} aria-hidden className={active ? "text-brand" : "text-ink-faint"} />
      </button>
    </th>
  );
}

type Selection = { selected: Set<string>; toggle: (id: string) => void; setMany: (ids: string[], on: boolean) => void };
type Actions = ReturnType<typeof useCampaignActions>;

function CampaignTable({ rows, query, update, selection, actions, onOpen }: { rows: Campaign[]; query: CampaignQuery; update: (p: Partial<CampaignQuery>) => void; selection: Selection; actions: Actions; onOpen: (id: string) => void }) {
  const pageIds = rows.map((r) => r.id);
  const selectedOnPage = pageIds.filter((id) => selection.selected.has(id)).length;
  const allOnPage = selectedOnPage === pageIds.length && pageIds.length > 0;
  const stickyA = "sticky left-0 z-[1] bg-white group-hover/row:bg-campaign-surface group-data-[selected=true]/row:bg-campaign-surface";
  const stickyB = "sticky left-11 z-[1] bg-white group-hover/row:bg-campaign-surface group-data-[selected=true]/row:bg-campaign-surface shadow-[1px_0_0_var(--border-soft)]";

  return (
    <div className="relative hidden overflow-x-auto scrollbar-thin md:block">
      <table className="w-full min-w-[1260px] border-collapse">
        <caption className="sr-only">Campaigns</caption>
        <thead>
          <tr className="border-y border-line-soft bg-campaign-muted">
            <th scope="col" className={cn(th, "sticky left-0 z-[1] w-11 bg-campaign-muted pr-0")}>
              <Checkbox aria-label="Select all campaigns on this page" checked={allOnPage ? true : selectedOnPage > 0 ? "indeterminate" : false} onCheckedChange={(v) => selection.setMany(pageIds, v === true)} />
            </th>
            <SortHeader label="Campaign" asc="name-asc" desc="name-desc" query={query} update={update} className="sticky left-11 z-[1] min-w-[250px] bg-campaign-muted pl-3 shadow-[1px_0_0_var(--border-soft)]" />
            <th scope="col" className={th}>
              Type
            </th>
            <th scope="col" className={cn(th, "min-w-[220px]")}>
              Subject / message
            </th>
            <th scope="col" className={th}>
              Audience
            </th>
            <th scope="col" className={th}>
              Status
            </th>
            <SortHeader label="Scheduled / sent" asc="oldest" desc="newest" query={query} update={update} numeric className="text-left [&>button]:flex-row" />
            <SortHeader label="Recipients" desc="recipients" query={query} update={update} numeric />
            <SortHeader label="Open rate" desc="open-rate" query={query} update={update} numeric />
            <SortHeader label="Click rate" desc="click-rate" query={query} update={update} numeric />
            <th scope="col" className={cn(th, "w-12")}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const selected = selection.selected.has(c.id);
            const d = dateCell(c);
            return (
              <tr key={c.id} data-selected={selected} onClick={() => onOpen(c.id)} className="group/row cursor-pointer border-b border-line-soft transition-colors last:border-0 hover:bg-campaign-surface data-[selected=true]:bg-campaign-surface">
                <td className={cn(td, stickyA, "w-11 pr-0")} onClick={(e) => e.stopPropagation()}>
                  <Checkbox aria-label={`Select ${c.name}`} checked={selected} onCheckedChange={() => selection.toggle(c.id)} />
                </td>
                <td className={cn(td, stickyB, "pl-3")}>
                  <span className="flex min-w-0 items-center gap-3">
                    <TypeIcon type={c.type} size={34} className={cn(c.status === "archived" && "opacity-60")} />
                    <span className="min-w-0">
                      <Link href={campaignHref(c.id)} onClick={(e) => e.stopPropagation()} className="block max-w-[230px] truncate rounded font-semibold text-ink hover:text-brand focus-visible:outline-2 focus-visible:outline-brand-action">
                        {c.name}
                      </Link>
                      <span className="block text-[12px] leading-4 text-ink-muted">Created {formatDate(c.createdAt)}</span>
                    </span>
                  </span>
                </td>
                <td className={td}>
                  <TypeLabel type={c.type} />
                </td>
                <td className={cn(td, "max-w-[280px]")}>
                  <span className="block truncate text-ink-body" title={isSms(c) ? c.message : c.subject}>
                    {(isSms(c) ? c.message : c.subject) || <span className="text-ink-faint">{isSms(c) ? "No message yet" : "No subject yet"}</span>}
                  </span>
                </td>
                <td className={cn(td, "whitespace-nowrap")}>{c.audience}</td>
                <td className={td}>
                  <StatusBadge status={c.status} />
                </td>
                <td className={cn(td, "whitespace-nowrap")}>
                  <span className="block text-ink">{formatDate(d.at)}</span>
                  <span className="block text-[12px] leading-4 text-ink-muted">
                    {d.label}
                    {d.time && ` · ${formatTime(d.at)}`}
                  </span>
                </td>
                <td className={cn(td, "text-right tabular-nums")}>{formatNumber(c.recipients)}</td>
                <td className={cn(td, "text-right tabular-nums", c.openRate !== undefined ? "font-medium text-ink" : "text-ink-faint")} title={isSms(c) ? "SMS has no open tracking" : undefined}>
                  {rateText(c.openRate)}
                </td>
                <td className={cn(td, "text-right tabular-nums", c.clickRate !== undefined ? "font-medium text-ink" : "text-ink-faint")}>{rateText(c.clickRate)}</td>
                <td className={cn(td, "text-right")} onClick={(e) => e.stopPropagation()}>
                  <RowMenu label={`Actions for ${c.name}`} actions={actions.actionsFor(c)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Phones: one compact card per campaign instead of the wide table. */
function CampaignCards({ rows, selection, actions }: { rows: Campaign[]; selection: Selection; actions: Actions }) {
  return (
    <ul className="divide-y divide-line-soft border-t border-line-soft md:hidden">
      {rows.map((c) => {
        const d = dateCell(c);
        return (
          <li key={c.id} className={cn("relative flex gap-3 px-4 py-3.5", selection.selected.has(c.id) && "bg-campaign-surface")}>
            <Checkbox aria-label={`Select ${c.name}`} checked={selection.selected.has(c.id)} onCheckedChange={() => selection.toggle(c.id)} className="relative z-10 mt-2.5" />
            <TypeIcon type={c.type} size={38} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <Link href={campaignHref(c.id)} className="min-w-0 flex-1 rounded after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-brand-action">
                  <span className="block truncate text-[14px] leading-5 font-semibold text-ink">{c.name}</span>
                  <span className="block truncate text-[12px] leading-4 text-ink-muted">
                    {TYPE_META[c.type].label} · {c.audience}
                  </span>
                </Link>
                <div className="relative z-10 -mt-1 -mr-1">
                  <RowMenu label={`Actions for ${c.name}`} actions={actions.actionsFor(c)} />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-ink-body">
                <StatusBadge status={c.status} />
                <span className="text-ink-muted">
                  {d.label} {formatDate(d.at)}
                </span>
                {c.clickRate !== undefined && (
                  <span className="ml-auto tabular-nums">
                    {c.openRate !== undefined && <span className="font-medium text-ink">{formatPercent(c.openRate)}</span>}
                    {c.openRate !== undefined && " open · "}
                    <span className="font-medium text-ink">{formatPercent(c.clickRate)}</span> click
                  </span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-1 border-t border-line-soft px-5 py-3" aria-busy="true" aria-label="Loading campaigns">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 py-2">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="size-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="hidden h-3.5 w-40 md:block" />
          <Skeleton className="hidden h-3.5 w-28 md:block" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────

function Heading({ actions }: { actions?: ReactNode }) {
  return <PageHeading crumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Campaigns" }]} title="Campaigns" description="Manage and track all your marketing campaigns." actions={actions} />;
}

export function CampaignsViewFallback() {
  return (
    <PageShell>
      <Heading
        actions={
          <PrimaryButton icon={PlusIcon} disabled>
            Create Campaign
          </PrimaryButton>
        }
      />
      <Card className="mt-5">
        <TableSkeleton />
      </Card>
    </PageShell>
  );
}

export function CampaignsView() {
  const [query, update] = useCampaignQuery();
  const { data, isError, refetch } = useCampaigns();
  const router = useRouter();
  const create = useCreateDialog();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const removeFromSelection = (ids: string[]) =>
    setSelected((s) => {
      const n = new Set(s);
      ids.forEach((id) => n.delete(id));
      return n;
    });
  const actions = useCampaignActions();

  // "Back to Campaigns" from a campaign returns to this exact list state.
  useEffect(() => setCampaignsListHref(`${CAMPAIGNS_ROUTE}${campaignQueryString(query)}`), [query]);

  const onSearch = useCallback((q: string) => update({ q }), [update]);

  const filtered = useMemo(() => (data ?? []).filter((c) => matchesFilters(c, query)), [data, query]);
  const counts = useMemo(() => {
    const out: Record<string, number> = { "": 0 };
    for (const c of filtered) {
      out[c.status] = (out[c.status] ?? 0) + 1;
      if (c.status !== "archived") out[""]++;
    }
    return out;
  }, [filtered]);
  const rows = useMemo(() => filtered.filter((c) => matchesTab(c, query.status)).sort((a, b) => SORTERS[query.sort](a, b) || a.name.localeCompare(b.name)), [filtered, query.status, query.sort]);

  const pageCount = Math.max(1, Math.ceil(rows.length / query.size));
  const page = Math.min(query.page, pageCount);
  const visible = rows.slice((page - 1) * query.size, page * query.size);

  const selection: Selection = useMemo(
    () => ({
      selected,
      toggle: (id) =>
        setSelected((s) => {
          const n = new Set(s);
          if (n.has(id)) n.delete(id);
          else n.add(id);
          return n;
        }),
      setMany: (ids, on) =>
        setSelected((s) => {
          const n = new Set(s);
          ids.forEach((id) => (on ? n.add(id) : n.delete(id)));
          return n;
        }),
    }),
    [selected],
  );

  // Only act on selected campaigns that still exist.
  const selectedRows = (data ?? []).filter((c) => selected.has(c.id));
  const selectedIds = selectedRows.map((c) => c.id);
  const bulkLabel = selectedRows.length === 1 ? selectedRows[0].name : pluralize(selectedRows.length, "campaign");
  const sendingSelected = selectedRows.filter((c) => c.status === "sending").length;
  const allArchived = selectedRows.length > 0 && selectedRows.every((c) => c.status === "archived");

  const clearFilters = () => update({ ...DEFAULT_CAMPAIGN_QUERY, sort: query.sort, size: query.size });

  return (
    <PageShell>
      <Heading
        actions={
          <>
            <SearchInput value={query.q} onChange={onSearch} placeholder="Search campaigns…" label="Search campaigns" className="w-full sm:w-[260px]" />
            <PrimaryButton icon={PlusIcon} onClick={() => create.open("email")} className="bg-gradient-brand hover:opacity-95">
              Create Campaign
            </PrimaryButton>
          </>
        }
      />

      <UnderlineTabs
        label="Campaign status"
        idPrefix="campaigns"
        className="mt-5"
        value={query.status}
        onChange={(status) => update({ status })}
        tabs={TABS.map((t) => ({ ...t, count: data ? (counts[t.value] ?? 0) : undefined }))}
      />

      <Card className="mt-4" label="Campaign list">
        <div id="campaigns-panel" role="tabpanel" aria-labelledby={`campaigns-tab-${query.status}`}>
          <Toolbar query={query} update={update} />

          {selectedRows.length > 0 && (
            <div className="mx-4 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-brand-soft bg-brand-surface px-3 py-2 sm:mx-5" role="region" aria-label="Bulk actions">
              <span className="mr-1 text-[13px] font-medium text-ink">{pluralize(selectedRows.length, "campaign")} selected</span>
              {rows.length > selectedRows.length && rows.some((r) => !selected.has(r.id)) && (
                <button type="button" onClick={() => selection.setMany(rows.map((r) => r.id), true)} className="rounded text-[13px] font-medium text-brand hover:text-brand-press focus-visible:outline-2 focus-visible:outline-brand-action">
                  Select all {rows.length} matching
                </button>
              )}
              <div className="ml-auto flex flex-wrap gap-2">
                {allArchived ? (
                  <OutlineButton icon={ArchiveIcon} className="h-8" disabled={actions.busy} onClick={() => actions.restore(selectedIds, bulkLabel)}>
                    Restore
                  </OutlineButton>
                ) : (
                  <OutlineButton icon={ArchiveIcon} className="h-8" disabled={actions.busy} onClick={() => actions.archive(selectedIds, bulkLabel, () => removeFromSelection(selectedIds))}>
                    Archive
                  </OutlineButton>
                )}
                <OutlineButton icon={TrashIcon} className="h-8 text-[#B42318] hover:text-[#B42318]" onClick={() => actions.askDelete(selectedIds, bulkLabel, sendingSelected)}>
                  Delete
                </OutlineButton>
                <OutlineButton icon={XIcon} className="h-8" onClick={() => setSelected(new Set())}>
                  Clear
                </OutlineButton>
              </div>
            </div>
          )}

          {isError ? (
            <ErrorState hint="The campaign list couldn't be loaded." action={<OutlineButton onClick={() => refetch()}>Try again</OutlineButton>} />
          ) : !data ? (
            <TableSkeleton />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={PaperPlaneTiltIcon}
              title={hasFilters(query) ? "No campaigns match your filters" : "No campaigns yet"}
              hint={hasFilters(query) ? "Try a different search, tab or date range, or clear the filters." : "Create your first campaign to start reaching your audience."}
              action={
                hasFilters(query) ? (
                  <OutlineButton icon={XIcon} onClick={clearFilters}>
                    Clear filters
                  </OutlineButton>
                ) : (
                  <PrimaryButton icon={PlusIcon} onClick={() => create.open("email")}>
                    Create Campaign
                  </PrimaryButton>
                )
              }
            />
          ) : (
            <>
              <CampaignTable rows={visible} query={query} update={update} selection={selection} actions={actions} onOpen={(id) => router.push(campaignHref(id))} />
              <CampaignCards rows={visible} selection={selection} actions={actions} />
              <div className="border-t border-line-soft px-4 py-3 sm:px-5">
                <Pagination
                  page={page}
                  pageCount={pageCount}
                  total={rows.length}
                  pageSize={query.size}
                  pageSizes={PAGE_SIZES}
                  noun={rows.length === 1 ? "campaign" : "campaigns"}
                  onPage={(p) => update({ page: p })}
                  onPageSize={(size) => update({ size: size as CampaignQuery["size"] })}
                />
              </div>
            </>
          )}
        </div>
      </Card>

      <CreateCampaignDialog
        {...create.props}
        onCreated={(c) => {
          // Show the new draft: drafts appear under All and Drafts.
          if (query.status && query.status !== "draft") update({ status: "draft" });
          router.prefetch(campaignHref(c.id));
        }}
      />
      {actions.element(removeFromSelection)}
    </PageShell>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CaretDownIcon,
  ClipboardTextIcon,
  DotsThreeIcon,
  DownloadSimpleIcon,
  FadersHorizontalIcon,
  FileCsvIcon,
  FunnelSimpleIcon,
  ProhibitIcon,
  SignInIcon,
  TrashIcon,
  UserMinusIcon,
  UserPlusIcon,
  UsersThreeIcon,
  XIcon,
  ArrowCounterClockwiseIcon,
  ArrowSquareOutIcon,
  PencilSimpleIcon,
  ListBulletsIcon,
  BellSlashIcon,
} from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge, ConfirmDialog, fieldClass, OutlineButton, Pagination, primaryButtonClass } from "@/components/shared/campaign-ui";
import { SetupExplore } from "@/components/shared/email-ui";
import { GuideDialog } from "@/components/shared/guide-dialog";
import { EmptyState, ErrorState } from "@/components/shared/state-panels";
import { useContacts, useContactTags, useDeleteContacts, useLists, useSetExcluded, useSetSubscription } from "@/hooks/use-audience";
import { useStoredState } from "@/hooks/use-stored-state";
import { exportContacts } from "@/lib/api/contacts";
import { CONTACT_TABS, SOURCE_LABEL, SUPPRESSION_LABEL, unreachableReason } from "@/lib/audience";
import { downloadText, toCsv } from "@/lib/csv";
import { formatDateTime, formatNumber, pluralize } from "@/lib/format";
import { notInPhase } from "@/lib/phase";
import type { Contact, ContactQuery, ContactSortKey, ContactSource, ContactTab, EmailStatus, SubscriptionStatus } from "@/lib/types/audience";
import { cn } from "@/lib/utils";
import { ContactFormPanel } from "@/components/audience/contact-form";
import { RowMenu } from "@/components/shared/row-menu";
import { downloadSample, ImportContactsDialog } from "./import-dialog";

export const contactHref = (id: string) => `/contacts/${encodeURIComponent(id)}`;

// ── Views (tabs) ─────────────────────────────────────────────────────

type ExtraView = "unsubscribed" | "recent";
type View = ContactTab | ExtraView;

const EXTRA_VIEWS: { key: ExtraView; label: string; query: Partial<ContactQuery> & { tab: ContactTab } }[] = [
  { key: "unsubscribed", label: "Unsubscribed Contacts", query: { tab: "all", subscription: "unsubscribed" } },
  { key: "recent", label: "Recently Added", query: { tab: "all", addedWithinDays: 30 } },
];

const isView = (v: string | null): v is View => !!v && (CONTACT_TABS.some((t) => t.key === v) || EXTRA_VIEWS.some((t) => t.key === v));

// ── Filters ──────────────────────────────────────────────────────────

interface Filters {
  subscription?: SubscriptionStatus;
  emailStatus?: EmailStatus;
  source?: ContactSource;
  addedWithinDays?: number;
  tag?: string;
  listId?: string;
}

const ADDED_OPTIONS = [
  { value: "7", label: "In the last 7 days" },
  { value: "30", label: "In the last 30 days" },
  { value: "90", label: "In the last 90 days" },
  { value: "365", label: "In the last year" },
];

// ── Columns ──────────────────────────────────────────────────────────

interface Column {
  key: string;
  label: string;
  sort?: ContactSortKey;
  /** Shown until the person changes the column settings. */
  visible: boolean;
  className?: string;
  render: (c: Contact) => ReactNode;
}

const dash = <span className="text-ink-faint">-</span>;

function StatusChip({ c }: { c: Contact }) {
  const why = unreachableReason(c);
  if (!why) return <Badge fg="var(--success)" bg="var(--success-bg)">Reachable</Badge>;
  const label = why === "suppressed" && c.suppression ? SUPPRESSION_LABEL[c.suppression.reason] : why === "unsubscribed" ? "Unsubscribed" : why === "invalid" ? "Invalid email" : "Excluded";
  return <Badge fg={why === "excluded" ? "var(--neutral-fg)" : why === "unsubscribed" ? "var(--warning)" : "#B42318"} bg={why === "excluded" ? "var(--neutral-bg)" : why === "unsubscribed" ? "var(--warning-bg)" : "var(--danger-bg)"}>{label}</Badge>;
}

const COLUMNS: Column[] = [
  { key: "mobile", label: "Mobile", sort: "mobile", visible: true, render: (c) => c.mobile || dash },
  { key: "firstName", label: "First Name", sort: "firstName", visible: true, render: (c) => c.firstName || dash },
  { key: "lastName", label: "Last Name", sort: "lastName", visible: true, render: (c) => c.lastName || dash },
  { key: "score", label: "Contact Score", sort: "score", visible: true, className: "tabular-nums", render: (c) => (c.score ? c.score : dash) },
  { key: "phone", label: "Phone", sort: "phone", visible: true, render: (c) => c.phone || dash },
  { key: "addedAt", label: "Added Time", sort: "addedAt", visible: true, className: "whitespace-nowrap", render: (c) => formatDateTime(c.addedAt) },
  { key: "company", label: "Company", visible: false, render: (c) => c.company || dash },
  { key: "country", label: "Country", visible: false, render: (c) => c.country || dash },
  { key: "tags", label: "Tags", visible: false, render: (c) => (c.tags.length ? <span className="flex flex-wrap gap-1">{c.tags.slice(0, 3).map((t) => <Badge key={t} fg="var(--campaign-primary)" bg="var(--campaign-tint)">{t}</Badge>)}{c.tags.length > 3 && <span className="text-[12px] text-ink-muted">+{c.tags.length - 3}</span>}</span> : dash) },
  { key: "source", label: "Source", visible: false, render: (c) => SOURCE_LABEL[c.source] },
  { key: "status", label: "Status", visible: false, render: (c) => <StatusChip c={c} /> },
];

const DEFAULT_COLUMNS = COLUMNS.filter((c) => c.visible).map((c) => c.key);
const PAGE_SIZES = [25, 50, 100] as const;

const th = "px-3 py-2.5 text-left text-[12.5px] font-normal whitespace-nowrap text-ink-body";
const td = "px-3 py-3.5 text-[13px] leading-5 text-ink-body";

// ── Page ─────────────────────────────────────────────────────────────

export function ContactsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const search = params.get("q") ?? "";
  const view: View = isView(params.get("tab")) ? (params.get("tab") as View) : "reachable";

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [sort, setSort] = useState<{ key: ContactSortKey; dir: "asc" | "desc" }>({ key: "addedAt", dir: "desc" });
  const [filters, setFilters] = useState<Filters>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [columns, setColumns] = useStoredState<string[]>("evoq-campaigns:contact-columns", DEFAULT_COLUMNS);
  const [importing, setImporting] = useState<"file" | "paste" | null>(null);
  const [guide, setGuide] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState<Contact | "new" | null>(null);
  const [deletingOne, setDeletingOne] = useState<Contact | null>(null);
  const [exporting, setExporting] = useState(false);

  // Reset paging and selection whenever what's shown changes (render-time reset, no extra effect pass).
  const shape = JSON.stringify([view, search, filters, sort, pageSize]);
  const [lastShape, setLastShape] = useState(shape);
  if (shape !== lastShape) {
    setLastShape(shape);
    setPage(1);
    setSelected(new Set());
  }

  const extra = EXTRA_VIEWS.find((v) => v.key === view);
  const query: ContactQuery = { tab: extra ? extra.query.tab : (view as ContactTab), search, sort, page, pageSize, ...filters, ...(extra?.query ?? {}) };
  const { data, isError, refetch, isFetching } = useContacts(query);
  const rows = data?.rows ?? [];

  const setExcluded = useSetExcluded();
  const setSubscription = useSetSubscription();
  const del = useDeleteContacts();
  const busy = setExcluded.isPending || setSubscription.isPending || del.isPending;

  const setParam = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const s = p.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };

  // Dashboard "Import Contacts" links here with ?import=1 to open the importer.
  const wantsImport = params.get("import") === "1";
  const importMode = importing ?? (wantsImport ? "file" : null);

  const visible = COLUMNS.filter((c) => columns.includes(c.key));
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someOnPage = rows.some((r) => selected.has(r.id));
  const ids = [...selected];
  const filterCount = Object.values(filters).filter((v) => v !== undefined && v !== "").length;

  const toggleSort = (key: ContactSortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "addedAt" || key === "score" ? "desc" : "asc" }));

  const bulk = (label: string, run: () => Promise<{ done: number; skipped: number }>) =>
    run()
      .then((r) => {
        toast.success(`${pluralize(r.done, "contact")} ${label}`, { description: r.skipped ? `${pluralize(r.skipped, "contact")} already ${label}` : "Saved in this browser only" });
        setSelected(new Set());
      })
      .catch((e: Error) => toast.error("Couldn't update contacts", { description: e.message }));

  const download = async (sel: { ids: string[] } | { query: ContactQuery }, name: string) => {
    setExporting(true);
    try {
      const list = await exportContacts(sel);
      downloadText(
        `${name}.csv`,
        toCsv([
          ["Email", "First Name", "Last Name", "Mobile", "Phone", "Company", "Tags", "Contact Score", "Subscription", "Email Status", "Suppressed", "Excluded", "Source", "Added"],
          ...list.map((c) => [c.email, c.firstName, c.lastName, c.mobile, c.phone, c.company, c.tags.join(", "), c.score, c.subscription, c.emailStatus, c.suppression ? SUPPRESSION_LABEL[c.suppression.reason] : "", c.excluded ? "Yes" : "", SOURCE_LABEL[c.source], c.addedAt.replace("T", " ")]),
        ]),
      );
      toast.success(`Exported ${pluralize(list.length, "contact")}`, { description: `${name}.csv` });
    } finally {
      setExporting(false);
    }
  };

  const tabs = [...CONTACT_TABS.map((t) => ({ key: t.key as View, label: t.label })), ...(extra ? [{ key: extra.key as View, label: extra.label }] : [])];
  const viewLabel = tabs.find((t) => t.key === view)?.label ?? "Contacts";

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="sr-only">Contacts</h1>
      <div className="border-b border-line bg-white">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2 px-4 pt-3 sm:px-5">
          {/* Tabs */}
          <div role="tablist" aria-label="Contact views" className="flex min-w-0 flex-1 items-end gap-6 overflow-x-auto scrollbar-none">
            {tabs.map((t) => {
              const active = t.key === view;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls="contacts-panel"
                  onClick={() => setParam({ tab: t.key === "reachable" ? null : t.key })}
                  className={cn("relative shrink-0 pt-1 pb-3 text-[13px] leading-5 whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-action", active ? "font-medium text-campaign-action" : "text-ink-body hover:text-ink")}
                >
                  {t.label}
                  {active && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-campaign-action" aria-hidden />}
                </button>
              );
            })}
            <DropdownMenu>
              <DropdownMenuTrigger aria-label="More contact views" className="mb-2 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-ink-body hover:bg-brand-depth-10 focus-visible:outline-2 focus-visible:outline-brand-action data-[state=open]:bg-brand-depth-10">
                <DotsThreeIcon size={18} weight="bold" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {EXTRA_VIEWS.map((v) => (
                  <DropdownMenuItem key={v.key} onSelect={() => setParam({ tab: v.key })}>
                    {v.key === "unsubscribed" ? <BellSlashIcon aria-hidden /> : <UserPlusIcon aria-hidden />} {v.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Toolbar */}
          <div className="mb-2 flex items-center gap-2">
            <FilterPopover filters={filters} onApply={setFilters} count={filterCount} />
            <button type="button" onClick={() => setEditing("new")} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-campaign-soft bg-white px-3 text-[13px] font-medium text-campaign-action transition-colors hover:border-campaign-action hover:bg-campaign-surface focus-visible:outline-2 focus-visible:outline-brand-action">
              <UserPlusIcon size={15} aria-hidden /> Add Contact
            </button>
            <div className="flex">
              <button type="button" onClick={() => setImporting("file")} className={cn(primaryButtonClass, "h-8 rounded-r-none bg-campaign-action px-3 text-[13px] hover:bg-campaign-hover")}>
                <SignInIcon size={15} aria-hidden /> Import Contacts
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger aria-label="More import options" className={cn(primaryButtonClass, "h-8 rounded-l-none border-l border-white/30 bg-campaign-action px-2 hover:bg-campaign-hover")}>
                  <CaretDownIcon size={13} weight="bold" aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onSelect={() => setImporting("file")}>
                    <FileCsvIcon aria-hidden /> Import from CSV file
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setImporting("paste")}>
                    <ClipboardTextIcon aria-hidden /> Copy & paste contacts
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={downloadSample}>
                    <DownloadSimpleIcon aria-hidden /> Download sample CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger aria-label="More actions" className="inline-flex size-8 items-center justify-center rounded-lg border border-line bg-white text-ink-body hover:bg-campaign-muted focus-visible:outline-2 focus-visible:outline-brand-action data-[state=open]:bg-campaign-muted">
                <DotsThreeIcon size={18} weight="bold" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem disabled={exporting || !data?.total} onSelect={() => download({ query: { ...query, page: 1, pageSize: 200 } }, `contacts-${view}`)}>
                  <DownloadSimpleIcon aria-hidden /> Export this view ({formatNumber(data?.total ?? 0)})
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push("/lists")}>
                  <ListBulletsIcon aria-hidden /> Manage lists
                </DropdownMenuItem>
                {(filterCount > 0 || search) && (
                  <DropdownMenuItem
                    onSelect={() => {
                      setFilters({});
                      setParam({ q: null });
                    }}
                  >
                    <ArrowCounterClockwiseIcon aria-hidden /> Clear search and filters
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Active search / filters / selection */}
      {(search || filterCount > 0 || selected.size > 0) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line-soft bg-white px-4 py-2 sm:px-5" aria-live="polite">
          {selected.size > 0 ? (
            <>
              <span className="text-[13px] font-medium text-ink">{pluralize(selected.size, "contact")} selected</span>
              <OutlineButton icon={ProhibitIcon} className="h-7 text-[12.5px]" disabled={busy} onClick={() => bulk("excluded", () => setExcluded.mutateAsync({ ids, excluded: true }))}>
                Exclude
              </OutlineButton>
              <OutlineButton icon={UsersThreeIcon} className="h-7 text-[12.5px]" disabled={busy} onClick={() => bulk("included", () => setExcluded.mutateAsync({ ids, excluded: false }))}>
                Include
              </OutlineButton>
              <OutlineButton icon={UserMinusIcon} className="h-7 text-[12.5px]" disabled={busy} onClick={() => bulk("unsubscribed", () => setSubscription.mutateAsync({ ids, status: "unsubscribed" }))}>
                Unsubscribe
              </OutlineButton>
              <OutlineButton icon={DownloadSimpleIcon} className="h-7 text-[12.5px]" disabled={exporting} onClick={() => download({ ids }, "contacts-selected")}>
                Export
              </OutlineButton>
              <OutlineButton icon={TrashIcon} className="h-7 text-[12.5px] text-[#B42318] hover:text-[#B42318]" disabled={busy} onClick={() => setDeleting(true)}>
                Delete
              </OutlineButton>
              <button type="button" onClick={() => setSelected(new Set())} className="ml-auto rounded text-[12.5px] font-medium text-brand hover:text-brand-press">
                Clear selection
              </button>
            </>
          ) : (
            <>
              {search && (
                <Chip onRemove={() => setParam({ q: null })}>
                  Search: <span className="font-medium">{search}</span>
                </Chip>
              )}
              {filterCount > 0 && <Chip onRemove={() => setFilters({})}>{pluralize(filterCount, "filter")} applied</Chip>}
              <span className="text-[12.5px] text-ink-muted">{data ? `${formatNumber(data.total)} matching in ${viewLabel}` : ""}</span>
            </>
          )}
        </div>
      )}

      {/* Table */}
      <div id="contacts-panel" role="tabpanel" aria-label={viewLabel} className="bg-white">
        {isError ? (
          <ErrorState hint="The contacts couldn't be loaded." action={<OutlineButton onClick={() => refetch()}>Try again</OutlineButton>} />
        ) : (
          <div className="relative overflow-x-auto scrollbar-thin">
            <table className={cn("w-full min-w-[1080px] border-collapse transition-opacity", isFetching && data && "opacity-70")}>
              <caption className="sr-only">{viewLabel}</caption>
              <thead>
                <tr className="border-b border-line-soft">
                  <th scope="col" className="w-10 py-2.5 pr-0 pl-4 sm:pl-5">
                    <Checkbox
                      aria-label="Select all contacts on this page"
                      checked={allOnPage ? true : someOnPage ? "indeterminate" : false}
                      onCheckedChange={(v) => {
                        const next = new Set(selected);
                        rows.forEach((r) => (v === true ? next.add(r.id) : next.delete(r.id)));
                        setSelected(next);
                      }}
                      disabled={!rows.length}
                    />
                  </th>
                  <SortHeader label="Contact Email" sortKey="email" sort={sort} onSort={toggleSort} className="min-w-[230px]" />
                  {visible.map((c) => (c.sort ? <SortHeader key={c.key} label={c.label} sortKey={c.sort} sort={sort} onSort={toggleSort} /> : <th key={c.key} scope="col" className={th}>{c.label}</th>))}
                  <th scope="col" className="w-12 pr-4 text-right sm:pr-5">
                    <ColumnSettings value={columns} onChange={setColumns} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {!data
                  ? Array.from({ length: 6 }, (_, i) => (
                      <tr key={i} className="border-b border-line-soft">
                        <td colSpan={visible.length + 3} className="px-5 py-3.5">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      </tr>
                    ))
                  : rows.map((c) => {
                      const on = selected.has(c.id);
                      return (
                        <tr key={c.id} data-selected={on} className="border-b border-line-soft transition-colors hover:bg-campaign-surface data-[selected=true]:bg-campaign-surface">
                          <td className="py-3.5 pr-0 pl-4 sm:pl-5">
                            <Checkbox
                              aria-label={`Select ${c.email}`}
                              checked={on}
                              onCheckedChange={(v) => {
                                const next = new Set(selected);
                                if (v === true) next.add(c.id);
                                else next.delete(c.id);
                                setSelected(next);
                              }}
                            />
                          </td>
                          <td className={cn(td, "text-ink")}>
                            <Link href={contactHref(c.id)} className="block max-w-[280px] truncate rounded font-medium hover:text-campaign-action focus-visible:outline-2 focus-visible:outline-brand-action" title={c.email}>
                              {c.email}
                            </Link>
                          </td>
                          {visible.map((col) => (
                            <td key={col.key} className={cn(td, col.className)}>
                              {col.render(c)}
                            </td>
                          ))}
                          <td className="pr-4 text-right sm:pr-5">
                            <RowMenu
                              label={`Actions for ${c.email}`}
                              actions={[
                                { label: "View contact", icon: ArrowSquareOutIcon, href: contactHref(c.id) },
                                { label: "Edit", icon: PencilSimpleIcon, onSelect: () => setEditing(c) },
                                { label: "Delete", icon: TrashIcon, destructive: true, separatorBefore: true, onSelect: () => setDeletingOne(c) },
                              ]}
                            />
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
            {data && rows.length === 0 && (
              <EmptyState
                icon={UsersThreeIcon}
                title={search || filterCount ? "No contacts match" : `No ${viewLabel.toLowerCase()}`}
                hint={search || filterCount ? "Try a different search or clear the filters." : CONTACT_TABS.find((t) => t.key === view)?.hint}
                action={
                  search || filterCount ? (
                    <OutlineButton
                      icon={XIcon}
                      onClick={() => {
                        setFilters({});
                        setParam({ q: null });
                      }}
                    >
                      Clear search and filters
                    </OutlineButton>
                  ) : undefined
                }
              />
            )}
          </div>
        )}
        {data && data.total > 0 && (
          <div className="border-t border-line-soft px-4 py-3 sm:px-5">
            <Pagination page={data.page} pageCount={Math.max(1, Math.ceil(data.total / data.pageSize))} total={data.total} pageSize={data.pageSize} pageSizes={PAGE_SIZES} noun="contacts" onPage={setPage} onPageSize={setPageSize} />
          </div>
        )}
      </div>

      <div className="flex-1 bg-white px-4 pt-10 pb-6 sm:px-5">
        <SetupExplore
          items={[
            { title: "Beginner's Guide", text: "Learn how to manage and grow your contact list effectively.", action: "View Guide", onClick: () => setGuide(true) },
            { title: "Custom Fields", text: "Add custom fields to segment contacts based on more attributes.", action: "Manage Fields", onClick: () => notInPhase("Custom fields") },
            { title: "Segments", text: "Automatically group contacts based on conditions and behavior for more precise targeting.", action: "Create Segment", href: "/segments/new" },
          ]}
        />
      </div>

      <ImportContactsDialog
        open={!!importMode}
        initialMode={importMode ?? "file"}
        onOpenChange={(o) => {
          if (o) return;
          setImporting(null);
          if (wantsImport) setParam({ import: null });
        }}
        onViewImported={() => {
          setSort({ key: "addedAt", dir: "desc" });
          setFilters({});
          setParam({ tab: "all", q: null });
        }}
      />
      <ContactFormPanel contact={editing === "new" ? null : editing} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} />
      <ConfirmDialog
        open={!!deletingOne}
        onOpenChange={(o) => !o && setDeletingOne(null)}
        title="Delete this contact?"
        description={`${deletingOne?.email ?? ""} is removed from every list and segment, and their engagement history is deleted. This can't be undone.`}
        confirmLabel="Delete contact"
        pending={del.isPending}
        onConfirm={() =>
          deletingOne &&
          del.mutate([deletingOne.id], {
            onSuccess: () => {
              toast.success("Contact deleted", { description: deletingOne.email });
              setDeletingOne(null);
            },
          })
        }
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${pluralize(selected.size, "contact")}?`}
        description="They're removed from every list and segment, and their engagement history is deleted. This can't be undone — exclude them instead to keep their history."
        confirmLabel="Delete"
        pending={del.isPending}
        onConfirm={() =>
          del.mutate(ids, {
            onSuccess: (r) => {
              setDeleting(false);
              setSelected(new Set());
              toast.success(`${pluralize(r.done, "contact")} deleted`);
            },
            onError: (e) => toast.error("Couldn't delete", { description: e.message }),
          })
        }
      />
      <GuideDialog
        open={guide}
        onOpenChange={setGuide}
        title="Managing your contacts"
        intro="Campaigns send only to reachable contacts: subscribed, with a valid address, and not suppressed or excluded."
        steps={[
          { title: "Import your contacts", text: "Upload a CSV, map its columns and review the result before anything is added." },
          { title: "Keep the list healthy", text: "Hard bounces and spam complaints are suppressed automatically; invalid addresses are flagged." },
          { title: "Exclude instead of deleting", text: "Excluded contacts stay subscribed and keep their history, but never receive campaigns." },
          { title: "Target with lists and segments", text: "Choose up to 10 lists or segments in a campaign's Recipients section." },
        ]}
      />
    </div>
  );
}

function Chip({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-brand-soft bg-brand-surface py-0.5 pr-1 pl-2.5 text-[12.5px] text-campaign-depth">
      {children}
      <button type="button" onClick={onRemove} aria-label="Remove" className="inline-flex size-5 items-center justify-center rounded-full text-ink-muted hover:bg-white hover:text-ink">
        <XIcon size={11} weight="bold" aria-hidden />
      </button>
    </span>
  );
}

function SortHeader({ label, sortKey, sort, onSort, className }: { label: string; sortKey: ContactSortKey; sort: { key: ContactSortKey; dir: "asc" | "desc" }; onSort: (k: ContactSortKey) => void; className?: string }) {
  const active = sort.key === sortKey;
  const Arrow = sort.dir === "asc" ? ArrowUpIcon : ArrowDownIcon;
  return (
    <th scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={cn(th, className)}>
      <button type="button" onClick={() => onSort(sortKey)} className={cn("group inline-flex items-center gap-1 rounded transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-action", active && "text-ink")}>
        {label}
        <Arrow size={12} aria-hidden className={cn("transition-opacity", active ? "opacity-100" : "opacity-0 group-hover:opacity-40")} />
      </button>
    </th>
  );
}

function ColumnSettings({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <Popover>
      <PopoverTrigger aria-label="Choose columns" title="Choose columns" className="inline-flex size-7 items-center justify-center rounded-md text-ink-body hover:bg-brand-depth-10 focus-visible:outline-2 focus-visible:outline-brand-action data-[state=open]:bg-brand-depth-10">
        <FadersHorizontalIcon size={16} aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <p className="px-1.5 pt-0.5 pb-2 text-[12px] font-medium text-ink">Columns</p>
        <label className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-[13px] text-ink-muted">
          <Checkbox checked disabled aria-label="Contact Email (always shown)" /> Contact Email
        </label>
        {COLUMNS.map((c) => (
          <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-[13px] text-ink hover:bg-brand-surface">
            <Checkbox checked={value.includes(c.key)} onCheckedChange={(v) => onChange(v === true ? COLUMNS.map((x) => x.key).filter((k) => k === c.key || value.includes(k)) : value.filter((k) => k !== c.key))} aria-label={c.label} />
            {c.label}
          </label>
        ))}
        <button type="button" onClick={() => onChange(DEFAULT_COLUMNS)} className="mt-1 w-full rounded-md px-1.5 py-1.5 text-left text-[12.5px] font-medium text-brand hover:bg-brand-surface">
          Reset to default
        </button>
      </PopoverContent>
    </Popover>
  );
}

function FilterPopover({ filters, onApply, count }: { filters: Filters; onApply: (f: Filters) => void; count: number }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(filters);
  const { data: tags } = useContactTags();
  const { data: lists } = useLists();

  const sel = (label: string, value: string, onChange: (v: string) => void, options: { value: string; label: string }[], id: string) => (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-[12px] font-medium text-ink-body">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cn(fieldClass, "h-8 text-[12.5px]", value && "border-brand-soft bg-brand-surface")}>
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(filters);
      }}
    >
      <PopoverTrigger aria-label={count ? `Filter (${count} applied)` : "Filter"} className={cn("relative inline-flex size-8 items-center justify-center rounded-lg border bg-white text-ink-body transition-colors hover:bg-campaign-muted focus-visible:outline-2 focus-visible:outline-brand-action data-[state=open]:bg-campaign-muted", count ? "border-brand-soft text-brand" : "border-line")}>
        <FunnelSimpleIcon size={16} aria-hidden />
        {count > 0 && <span className="absolute -top-1.5 -right-1.5 inline-flex size-4 items-center justify-center rounded-full bg-brand text-[10px] font-semibold text-white">{count}</span>}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[300px] p-0">
        <div className="grid gap-3 p-4">
          <p className="text-[13px] font-semibold text-ink">Filter contacts</p>
          {sel("Subscription status", draft.subscription ?? "", (v) => setDraft({ ...draft, subscription: (v || undefined) as SubscriptionStatus | undefined }), [{ value: "subscribed", label: "Subscribed" }, { value: "unsubscribed", label: "Unsubscribed" }], "flt-sub")}
          {sel("Email validity", draft.emailStatus ?? "", (v) => setDraft({ ...draft, emailStatus: (v || undefined) as EmailStatus | undefined }), [{ value: "valid", label: "Valid" }, { value: "invalid", label: "Invalid" }], "flt-valid")}
          {sel("Contact source", draft.source ?? "", (v) => setDraft({ ...draft, source: (v || undefined) as ContactSource | undefined }), Object.entries(SOURCE_LABEL).map(([value, label]) => ({ value, label })), "flt-source")}
          {sel("Added date", draft.addedWithinDays ? String(draft.addedWithinDays) : "", (v) => setDraft({ ...draft, addedWithinDays: v ? Number(v) : undefined }), ADDED_OPTIONS, "flt-added")}
          {sel("Tag", draft.tag ?? "", (v) => setDraft({ ...draft, tag: v || undefined }), (tags ?? []).map((t) => ({ value: t.tag, label: `${t.tag} (${formatNumber(t.count)})` })), "flt-tag")}
          {sel("List", draft.listId ?? "", (v) => setDraft({ ...draft, listId: v || undefined }), (lists ?? []).map((l) => ({ value: l.id, label: l.name })), "flt-list")}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-line-soft bg-campaign-muted px-4 py-2.5">
          <button
            type="button"
            onClick={() => {
              setDraft({});
              onApply({});
              setOpen(false);
            }}
            className="rounded text-[12.5px] font-medium text-ink-body hover:text-ink"
          >
            Clear filters
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(Object.fromEntries(Object.entries(draft).filter(([, v]) => v !== undefined && v !== "")) as Filters);
              setOpen(false);
            }}
            className={cn(primaryButtonClass, "h-8 px-3.5 text-[13px]")}
          >
            Apply
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ContactsViewFallback() {
  return (
    <div className="p-5">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="mt-3 h-[420px] w-full" />
    </div>
  );
}

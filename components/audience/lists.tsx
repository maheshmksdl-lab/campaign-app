"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowSquareOutIcon, CopyIcon, ListBulletsIcon, PencilSimpleIcon, PlusIcon, TrashIcon, UserMinusIcon, UserPlusIcon, UsersThreeIcon } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { Badge, Breadcrumbs, Card, ConfirmDialog, fieldClass, FilterSelect, FormField, OutlineButton, PageHeading, PageShell, PrimaryButton, SearchInput } from "@/components/shared/campaign-ui";
import { byNumber, byText, DataTable, type Column } from "@/components/shared/data-table";
import { FormDialog } from "@/components/shared/form-kit";
import { SidePanel } from "@/components/shared/side-panel";
import { EmptyState, ErrorState } from "@/components/shared/state-panels";
import { useAddToList, useContacts, useCreateList, useDeleteList, useDuplicateList, useList, useLists, useRemoveFromList, useUpdateList } from "@/hooks/use-audience";
import { ApiError } from "@/lib/api/errors";
import { contactName, normalizeTags } from "@/lib/audience";
import { formatDate, formatDateTime, formatNumber, pluralize } from "@/lib/format";
import type { ListSummary } from "@/lib/types/audience";
import { cn } from "@/lib/utils";
import { ContactPicker } from "./contact-picker";

export const LISTS_ROUTE = "/lists";
export const listHref = (id: string) => `${LISTS_ROUTE}/${encodeURIComponent(id)}`;

/** In use by a campaign that hasn't sent, has contacts, or is empty. */
function listStatus(l: ListSummary) {
  if (l.usedBy.length) return { label: `In use · ${pluralize(l.usedBy.length, "campaign")}`, fg: "var(--campaign-primary)", bg: "var(--campaign-tint)" };
  if (l.contactCount === 0) return { label: "Empty", fg: "var(--neutral-fg)", bg: "var(--neutral-bg)" };
  return { label: "Active", fg: "var(--success)", bg: "var(--success-bg)" };
}

// ── Create / edit ────────────────────────────────────────────────────

export function ListFormPanel({ list, open, onOpenChange, onSaved }: { list?: ListSummary | null; open: boolean; onOpenChange: (o: boolean) => void; onSaved?: (l: ListSummary) => void }) {
  return open ? <ListForm key={list?.id ?? "new"} list={list ?? null} onOpenChange={onOpenChange} onSaved={onSaved} /> : null;
}

function ListForm({ list, onOpenChange, onSaved }: { list: ListSummary | null; onOpenChange: (o: boolean) => void; onSaved?: (l: ListSummary) => void }) {
  const [name, setName] = useState(list?.name ?? "");
  const [description, setDescription] = useState(list?.description ?? "");
  const [tags, setTags] = useState(list?.tags.join(", ") ?? "");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const create = useCreateList();
  const update = useUpdateList();
  const add = useAddToList();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError("Enter a list name (at least 2 characters)");
    const input = { name, description, tags: normalizeTags(tags.split(",")) };
    try {
      const saved = list ? await update.mutateAsync({ id: list.id, input }) : await create.mutateAsync(input);
      if (picked.size) await add.mutateAsync({ ids: [...picked], listId: saved.id });
      toast.success(list ? "List updated" : "List created", { description: picked.size ? `${saved.name} · ${pluralize(picked.size, "contact")} added` : saved.name });
      onOpenChange(false);
      onSaved?.(saved);
    } catch (err) {
      if (err instanceof ApiError && err.field === "name") setError(err.message);
      else toast.error("Couldn't save the list", { description: (err as Error).message });
    }
  };

  return (
    <SidePanel open onOpenChange={onOpenChange} title={list ? "Edit list" : "Create list"} description="A list is a fixed group of contacts you choose. Campaigns can send to up to 10 lists and segments." onSubmit={submit} submitLabel={list ? "Save list" : "Create list"} saving={create.isPending || update.isPending || add.isPending} wide>
      <FormField label="List name" htmlFor="list-name" error={error} required>
        <input id="list-name" value={name} onChange={(e) => (setError(""), setName(e.target.value))} maxLength={80} aria-invalid={error ? true : undefined} className={fieldClass} placeholder="e.g. Spring event leads" autoFocus />
      </FormField>
      <FormField label="Description" htmlFor="list-description">
        <textarea id="list-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={300} className={cn(fieldClass, "h-auto resize-y py-2")} placeholder="Who is on this list and why" />
      </FormField>
      <FormField label="Tags" htmlFor="list-tags" hint="Separate tags with commas.">
        <input id="list-tags" value={tags} onChange={(e) => setTags(e.target.value)} className={fieldClass} placeholder="events, leads" />
      </FormField>
      <div className="grid gap-1.5">
        <p className="text-field-label text-ink-body">{list ? "Add more contacts" : "Add contacts"}</p>
        <ContactPicker selected={picked} onChange={setPicked} listId={list?.id} />
      </div>
    </SidePanel>
  );
}

// ── Shared actions ───────────────────────────────────────────────────

function useListActions(onDeleted?: () => void) {
  const router = useRouter();
  const duplicate = useDuplicateList();
  const del = useDeleteList();
  const [editing, setEditing] = useState<ListSummary | null>(null);
  const [deleting, setDeleting] = useState<ListSummary | null>(null);

  const actionsFor = (l: ListSummary, onDetail = false) => [
    !onDetail && { label: "View list", icon: ArrowSquareOutIcon, href: listHref(l.id) },
    { label: "Edit", icon: PencilSimpleIcon, onSelect: () => setEditing(l) },
    {
      label: "Duplicate",
      icon: CopyIcon,
      onSelect: () =>
        duplicate.mutate(l.id, {
          onSuccess: (c) => toast.success("List duplicated", { description: `${c.name} · same contacts`, action: { label: "Open", onClick: () => router.push(listHref(c.id)) } }),
          onError: (e) => toast.error("Couldn't duplicate", { description: e.message }),
        }),
    },
    { label: "Delete", icon: TrashIcon, destructive: true, separatorBefore: true, onSelect: () => setDeleting(l) },
  ];

  const element = (
    <>
      <ListFormPanel list={editing} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this list?"
        description={
          <>
            <p>
              <span className="font-medium text-ink">{deleting?.name}</span> is removed; its {formatNumber(deleting?.contactCount ?? 0)} contacts stay in Contacts.
            </p>
            {!!deleting?.usedBy.length && <p className="mt-2">{pluralize(deleting.usedBy.length, "campaign")} that send to it will need a new audience: {deleting.usedBy.map((u) => u.name).join(", ")}.</p>}
          </>
        }
        confirmLabel="Delete list"
        pending={del.isPending}
        onConfirm={() =>
          deleting &&
          del.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("List deleted", { description: deleting.name });
              setDeleting(null);
              onDeleted?.();
            },
            onError: (e) => toast.error("Couldn't delete", { description: e.message }),
          })
        }
      />
    </>
  );
  return { actionsFor, element, edit: setEditing, remove: setDeleting, duplicating: duplicate.isPending };
}

// ── Lists page ───────────────────────────────────────────────────────

export function ListsView() {
  const router = useRouter();
  const { data, isError, refetch } = useLists();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [tag, setTag] = useState("");
  const [creating, setCreating] = useState(false);
  const actions = useListActions();

  const term = q.trim().toLowerCase();
  const rows = data?.filter((l) => (!term || l.name.toLowerCase().includes(term) || l.description.toLowerCase().includes(term)) && (!tag || l.tags.includes(tag)) && (!status || listStatus(l).label.toLowerCase().startsWith(status)));
  const tags = [...new Set((data ?? []).flatMap((l) => l.tags))].sort();
  const filtered = !!(term || status || tag);

  const columns: Column<ListSummary>[] = [
    {
      key: "name",
      label: "List name",
      sort: byText((l) => l.name),
      render: (l) => (
        <>
          <Link href={listHref(l.id)} onClick={(e) => e.stopPropagation()} className="block max-w-[300px] truncate rounded font-semibold text-ink hover:text-brand focus-visible:outline-2 focus-visible:outline-brand-action">
            {l.name}
          </Link>
          <span className="block max-w-[300px] truncate text-[12px] text-ink-muted">{l.description || "No description"}</span>
        </>
      ),
    },
    { key: "contacts", label: "Contacts", align: "right", sort: byNumber((l) => l.contactCount), render: (l) => <span className="font-medium text-ink">{formatNumber(l.contactCount)}</span> },
    { key: "reachable", label: "Reachable", align: "right", sort: byNumber((l) => l.reachableCount), render: (l) => formatNumber(l.reachableCount), hideBelow: "md" },
    { key: "status", label: "Status", render: (l) => <Badge {...listStatus(l)}>{listStatus(l).label}</Badge> },
    { key: "tags", label: "Tags", hideBelow: "lg", render: (l) => (l.tags.length ? <span className="flex flex-wrap gap-1">{l.tags.map((t) => <Badge key={t} fg="var(--ink-body)" bg="var(--neutral-bg)">{t}</Badge>)}</span> : <span className="text-ink-faint">—</span>) },
    { key: "created", label: "Created", sort: byText((l) => l.createdAt), render: (l) => <span className="whitespace-nowrap">{formatDate(l.createdAt)}</span>, hideBelow: "md" },
    { key: "updated", label: "Updated", sort: byText((l) => l.updatedAt), render: (l) => <span className="whitespace-nowrap">{formatDate(l.updatedAt)}</span> },
  ];

  return (
    <PageShell>
      <PageHeading
        crumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Lists" }]}
        title="Lists"
        description="Fixed groups of contacts you add yourself — campaigns can send to them directly."
        actions={
          <>
            <SearchInput value={q} onChange={setQ} placeholder="Search lists…" label="Search lists" className="w-full sm:w-[240px]" />
            <PrimaryButton icon={PlusIcon} onClick={() => setCreating(true)}>
              Create List
            </PrimaryButton>
          </>
        }
      />
      <Card className="mt-5" label="Lists">
        <div className="flex flex-wrap items-center gap-2 px-4 pt-4 pb-3 sm:px-5">
          <FilterSelect label="Status" allLabel="All statuses" value={status} onChange={setStatus} options={[{ value: "active", label: "Active" }, { value: "in use", label: "In use by campaigns" }, { value: "empty", label: "Empty" }]} className="w-[190px]" />
          <FilterSelect label="Tag" allLabel="All tags" value={tag} onChange={setTag} options={tags.map((t) => ({ value: t, label: t }))} className="w-[160px]" />
          {data && <span className="ml-auto text-[12.5px] text-ink-muted">{pluralize(rows?.length ?? 0, "list")}</span>}
        </div>
        {isError ? (
          <ErrorState hint="The lists couldn't be loaded." action={<OutlineButton onClick={() => refetch()}>Try again</OutlineButton>} />
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(l) => l.id}
            rowLabel={(l) => l.name}
            onRowClick={(l) => router.push(listHref(l.id))}
            actions={(l) => actions.actionsFor(l)}
            defaultSort={{ key: "created", dir: "desc" }}
            noun="lists"
            caption="Contact lists"
            empty={
              <EmptyState
                icon={ListBulletsIcon}
                title={filtered ? "No lists match" : "No lists yet"}
                hint={filtered ? "Try a different search or filter." : "Create a list, then add contacts to it or import them."}
                action={filtered ? <OutlineButton onClick={() => (setQ(""), setStatus(""), setTag(""))}>Clear filters</OutlineButton> : <PrimaryButton icon={PlusIcon} onClick={() => setCreating(true)}>Create List</PrimaryButton>}
              />
            }
          />
        )}
      </Card>
      <ListFormPanel open={creating} onOpenChange={setCreating} onSaved={(l) => router.push(listHref(l.id))} />
      {actions.element}
    </PageShell>
  );
}

// ── List detail ──────────────────────────────────────────────────────

export function ListDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { data: list, isError, error } = useList(id);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const { data: members } = useContacts({ tab: "all", listId: id, search: q, page, pageSize: 25, sort: { key: "addedAt", dir: "desc" } });
  const remove = useRemoveFromList();
  const actions = useListActions(() => router.push(LISTS_ROUTE));

  if (isError)
    return (
      <PageShell>
        <Breadcrumbs items={[{ label: "Lists", href: LISTS_ROUTE }, { label: "Not found" }]} />
        <Card className="mt-4">
          <EmptyState icon={ListBulletsIcon} title={error?.message === "List not found" ? "This list doesn't exist" : "Something went wrong"} hint="It may have been deleted, or the demo data was reset." action={<Link href={LISTS_ROUTE} className="text-[13px] font-medium text-brand">Back to Lists</Link>} />
        </Card>
      </PageShell>
    );

  const pageCount = members ? Math.max(1, Math.ceil(members.total / members.pageSize)) : 1;
  const ids = [...selected];

  return (
    <PageShell>
      <PageHeading
        crumbs={[{ label: "Lists", href: LISTS_ROUTE }, { label: list?.name ?? "List" }]}
        title={list?.name ?? "…"}
        description={list?.description || "No description"}
        actions={
          list && (
            <>
              <OutlineButton icon={PencilSimpleIcon} onClick={() => actions.edit(list)}>
                Edit
              </OutlineButton>
              <OutlineButton icon={TrashIcon} onClick={() => actions.remove(list)}>
                Delete
              </OutlineButton>
              <PrimaryButton icon={UserPlusIcon} onClick={() => setAdding(true)}>
                Add contacts
              </PrimaryButton>
            </>
          )
        }
      />
      {list && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Contacts", value: formatNumber(list.contactCount) },
            { label: "Reachable", value: formatNumber(list.reachableCount), note: "Subscribed, valid, not suppressed" },
            { label: "Used by", value: list.usedBy.length ? pluralize(list.usedBy.length, "campaign") : "Not used", note: list.usedBy.map((u) => u.name).join(", ") || "No upcoming campaigns" },
            { label: "Last updated", value: formatDate(list.updatedAt), note: `Created ${formatDate(list.createdAt)} by ${list.createdBy}` },
          ].map((m) => (
            <div key={m.label} className="rounded-xl border border-line bg-white p-4 shadow-card">
              <p className="text-[12.5px] text-ink-muted">{m.label}</p>
              <p className="mt-1 text-[20px] leading-7 font-semibold text-campaign-depth tabular-nums">{m.value}</p>
              {m.note && <p className="truncate text-[12px] text-ink-muted" title={m.note}>{m.note}</p>}
            </div>
          ))}
        </div>
      )}
      <Card className="mt-4" label="List members">
        <div className="flex flex-wrap items-center gap-2 px-4 pt-4 pb-3 sm:px-5">
          <SearchInput value={q} onChange={(v) => (setQ(v), setPage(1), setSelected(new Set()))} placeholder="Search this list…" label="Search list members" className="w-full sm:w-[260px]" />
          {selected.size > 0 && (
            <>
              <span className="text-[13px] font-medium text-ink">{pluralize(selected.size, "contact")} selected</span>
              <OutlineButton
                icon={UserMinusIcon}
                className="h-8"
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(
                    { ids, listId: id },
                    {
                      onSuccess: (r) => {
                        toast.success(`${pluralize(r.done, "contact")} removed from the list`, { description: "They stay in Contacts." });
                        setSelected(new Set());
                      },
                    },
                  )
                }
              >
                Remove from list
              </OutlineButton>
            </>
          )}
          <span className="ml-auto text-[12.5px] text-ink-muted">{members ? `${formatNumber(members.total)} ${members.total === 1 ? "member" : "members"}` : ""}</span>
        </div>
        <DataTable
          rows={members?.rows}
          columns={[
            { key: "email", label: "Contact Email", render: (c) => <Link href={`/contacts/${c.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-ink hover:text-brand">{c.email}</Link> },
            { key: "name", label: "Name", render: (c) => contactName(c) },
            { key: "company", label: "Company", render: (c) => c.company ?? <span className="text-ink-faint">—</span>, hideBelow: "md" },
            { key: "status", label: "Subscription", render: (c) => (c.subscription === "subscribed" ? <Badge fg="var(--success)" bg="var(--success-bg)">Subscribed</Badge> : <Badge fg="var(--warning)" bg="var(--warning-bg)">Unsubscribed</Badge>) },
            { key: "added", label: "Added", render: (c) => <span className="whitespace-nowrap">{formatDateTime(c.addedAt)}</span>, hideBelow: "md" },
          ]}
          rowKey={(c) => c.id}
          rowLabel={(c) => c.email}
          onRowClick={(c) => router.push(`/contacts/${c.id}`)}
          selected={selected}
          onSelectedChange={setSelected}
          noun="contacts"
          caption="Contacts in this list"
          minWidth={720}
          empty={<EmptyState icon={UsersThreeIcon} title={q ? "No members match" : "This list is empty"} hint={q ? "Try another search." : "Add contacts from your audience, or import a CSV into this list."} action={!q && <PrimaryButton icon={UserPlusIcon} onClick={() => setAdding(true)}>Add contacts</PrimaryButton>} />}
        />
        {members && pageCount > 1 && (
          <div className="flex items-center justify-end gap-2 border-t border-line-soft px-5 py-2.5 text-[12.5px] text-ink-muted">
            Server page {members.page} of {pageCount}
            <OutlineButton className="h-7" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </OutlineButton>
            <OutlineButton className="h-7" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
              Next
            </OutlineButton>
          </div>
        )}
      </Card>
      {list && <AddContactsDialog open={adding} onOpenChange={setAdding} listId={id} listName={list.name} />}
      {actions.element}
    </PageShell>
  );
}

function AddContactsDialog({ open, onOpenChange, listId, listName }: { open: boolean; onOpenChange: (o: boolean) => void; listId: string; listName: string }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const add = useAddToList();
  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setPicked(new Set());
        onOpenChange(o);
      }}
      title={`Add contacts to ${listName}`}
      description="Search your contacts and tick the ones to add."
      submitLabel={picked.size ? `Add ${pluralize(picked.size, "contact")}` : "Add contacts"}
      saving={add.isPending}
      wide
      onSubmit={(e) => {
        e.preventDefault();
        if (!picked.size) return void toast.info("Select at least one contact");
        add.mutate(
          { ids: [...picked], listId },
          {
            onSuccess: (r) => {
              toast.success(`${pluralize(r.done, "contact")} added`, { description: r.skipped ? `${pluralize(r.skipped, "contact")} were already on the list` : listName });
              setPicked(new Set());
              onOpenChange(false);
            },
          },
        );
      }}
    >
      <ContactPicker selected={picked} onChange={setPicked} listId={listId} className="sm:col-span-2" />
    </FormDialog>
  );
}

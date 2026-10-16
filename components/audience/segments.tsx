"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CopyIcon, FunnelIcon, PencilSimpleIcon, PlusIcon, StackIcon, TrashIcon, UsersThreeIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge, Card, ConfirmDialog, fieldClass, FilterSelect, OutlineButton, PageHeading, PageShell, PrimaryButton, SearchInput } from "@/components/shared/campaign-ui";
import { byNumber, byText, DataTable, type Column } from "@/components/shared/data-table";
import { EditorColumns, EditorHeader, EditorPage, EditorShellSkeleton, headerOutlineClass, headerPrimaryClass, Pill } from "@/components/shared/editor-shell";
import { EmptyState, ErrorState } from "@/components/shared/state-panels";
import { EditorCard } from "@/components/campaigns/editor/fields";
import { useCreateSegment, useDeleteSegment, useDuplicateSegment, useSegment, useSegmentPreview, useSegments, useUpdateSegment } from "@/hooks/use-audience";
import { ApiError } from "@/lib/api/errors";
import { conditionComplete, contactName, describeCondition, OPERATOR_LABEL, SEGMENT_FIELDS, valueKind } from "@/lib/audience";
import { formatDate, formatNumber, pluralize } from "@/lib/format";
import type { SegmentCondition, SegmentField, SegmentInput, SegmentSummary } from "@/lib/types/audience";
import { cn } from "@/lib/utils";

export const SEGMENTS_ROUTE = "/segments";
export const segmentHref = (id: string) => `${SEGMENTS_ROUTE}/${encodeURIComponent(id)}`;

// ── List ─────────────────────────────────────────────────────────────

export function SegmentsView() {
  const router = useRouter();
  const { data, isError, refetch } = useSegments();
  const duplicate = useDuplicateSegment();
  const del = useDeleteSegment();
  const [q, setQ] = useState("");
  const [usage, setUsage] = useState("");
  const [deleting, setDeleting] = useState<SegmentSummary | null>(null);

  const term = q.trim().toLowerCase();
  const rows = data?.filter((s) => (!term || s.name.toLowerCase().includes(term) || s.description.toLowerCase().includes(term)) && (!usage || (usage === "used" ? s.usedBy.length > 0 : s.usedBy.length === 0)));

  const columns: Column<SegmentSummary>[] = [
    {
      key: "name",
      label: "Segment name",
      sort: byText((s) => s.name),
      render: (s) => (
        <>
          <Link href={segmentHref(s.id)} onClick={(e) => e.stopPropagation()} className="block max-w-[280px] truncate rounded font-semibold text-ink hover:text-brand focus-visible:outline-2 focus-visible:outline-brand-action">
            {s.name}
          </Link>
          <span className="block max-w-[280px] truncate text-[12px] text-ink-muted">{s.description || "No description"}</span>
        </>
      ),
    },
    { key: "conditions", label: "Conditions", hideBelow: "lg", render: (s) => <span className="block max-w-[300px] truncate text-[12.5px]" title={s.conditions.map(describeCondition).join(s.match === "all" ? " AND " : " OR ")}>{s.conditions.map(describeCondition).join(s.match === "all" ? " · and · " : " · or · ")}</span> },
    { key: "contacts", label: "Est. contacts", align: "right", sort: byNumber((s) => s.contactCount), render: (s) => <span className="font-medium text-ink">{formatNumber(s.contactCount)}</span> },
    { key: "reachable", label: "Reachable", align: "right", sort: byNumber((s) => s.reachableCount), render: (s) => formatNumber(s.reachableCount), hideBelow: "md" },
    { key: "used", label: "Used by", render: (s) => (s.usedBy.length ? <Badge fg="var(--campaign-primary)" bg="var(--campaign-tint)">{pluralize(s.usedBy.length, "campaign")}</Badge> : <span className="text-ink-faint">—</span>) },
    { key: "updated", label: "Last updated", sort: byText((s) => s.updatedAt), render: (s) => <span className="whitespace-nowrap">{formatDate(s.updatedAt)}</span> },
  ];

  return (
    <PageShell>
      <PageHeading
        crumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Segments" }]}
        title="Segments"
        description="Groups that update themselves: contacts join or leave as they match your conditions."
        actions={
          <>
            <SearchInput value={q} onChange={setQ} placeholder="Search segments…" label="Search segments" className="w-full sm:w-[240px]" />
            <PrimaryButton icon={PlusIcon} onClick={() => router.push(`${SEGMENTS_ROUTE}/new`)}>
              Create Segment
            </PrimaryButton>
          </>
        }
      />
      <Card className="mt-5" label="Segments">
        <div className="flex flex-wrap items-center gap-2 px-4 pt-4 pb-3 sm:px-5">
          <FilterSelect label="Usage" allLabel="All segments" value={usage} onChange={setUsage} options={[{ value: "used", label: "Used by campaigns" }, { value: "unused", label: "Not used yet" }]} className="w-[190px]" />
          {data && <span className="ml-auto text-[12.5px] text-ink-muted">{pluralize(rows?.length ?? 0, "segment")}</span>}
        </div>
        {isError ? (
          <ErrorState hint="The segments couldn't be loaded." action={<OutlineButton onClick={() => refetch()}>Try again</OutlineButton>} />
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(s) => s.id}
            rowLabel={(s) => s.name}
            onRowClick={(s) => router.push(segmentHref(s.id))}
            defaultSort={{ key: "updated", dir: "desc" }}
            actions={(s) => [
              { label: "Edit", icon: PencilSimpleIcon, href: segmentHref(s.id) },
              {
                label: "Duplicate",
                icon: CopyIcon,
                onSelect: () =>
                  duplicate.mutate(s.id, {
                    onSuccess: (c) => toast.success("Segment duplicated", { description: c.name, action: { label: "Open", onClick: () => router.push(segmentHref(c.id)) } }),
                    onError: (e) => toast.error("Couldn't duplicate", { description: e.message }),
                  }),
              },
              { label: "Delete", icon: TrashIcon, destructive: true, separatorBefore: true, onSelect: () => setDeleting(s) },
            ]}
            noun="segments"
            caption="Segments"
            empty={<EmptyState icon={StackIcon} title={term || usage ? "No segments match" : "No segments yet"} hint={term || usage ? "Try another search or filter." : "Build a segment from conditions such as tags, country or engagement."} action={!term && !usage && <PrimaryButton icon={PlusIcon} onClick={() => router.push(`${SEGMENTS_ROUTE}/new`)}>Create Segment</PrimaryButton>} />}
          />
        )}
      </Card>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this segment?"
        description={
          <>
            <p>
              <span className="font-medium text-ink">{deleting?.name}</span> is removed. Contacts aren&apos;t affected.
            </p>
            {!!deleting?.usedBy.length && <p className="mt-2">{pluralize(deleting.usedBy.length, "campaign")} that send to it will need a new audience.</p>}
          </>
        }
        confirmLabel="Delete segment"
        pending={del.isPending}
        onConfirm={() =>
          deleting &&
          del.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("Segment deleted", { description: deleting.name });
              setDeleting(null);
            },
          })
        }
      />
    </PageShell>
  );
}

// ── Builder ──────────────────────────────────────────────────────────

let seq = 0;
const newCondition = (field: SegmentField = "subscription"): SegmentCondition => ({ id: `cond-${Date.now().toString(36)}-${++seq}`, field, operator: SEGMENT_FIELDS[field].operators[0], value: SEGMENT_FIELDS[field].options?.[0]?.value ?? "" });

const FIELD_OPTIONS = (Object.keys(SEGMENT_FIELDS) as SegmentField[]).map((f) => ({ value: f, label: SEGMENT_FIELDS[f].label }));

export function SegmentEditorRoute({ id }: { id: string }) {
  const isNew = id === "new";
  const { data, isError } = useSegment(isNew ? "" : id);
  if (isNew) return <SegmentEditor key="new" segment={null} />;
  if (isError)
    return (
      <PageShell>
        <Card>
          <EmptyState icon={StackIcon} title="This segment doesn't exist" hint="It may have been deleted." action={<Link href={SEGMENTS_ROUTE} className="text-[13px] font-medium text-brand">Back to Segments</Link>} />
        </Card>
      </PageShell>
    );
  if (!data) return <EditorShellSkeleton />;
  return <SegmentEditor key={data.id} segment={data} />;
}

function SegmentEditor({ segment }: { segment: SegmentSummary | null }) {
  const router = useRouter();
  const [v, setV] = useState<SegmentInput>(() => ({ name: segment?.name ?? "", description: segment?.description ?? "", match: segment?.match ?? "all", conditions: segment?.conditions.map((c) => ({ ...c })) ?? [newCondition("subscription")] }));
  const [nameError, setNameError] = useState("");
  const [condError, setCondError] = useState("");
  const create = useCreateSegment();
  const update = useUpdateSegment();
  const { data: preview, isFetching } = useSegmentPreview({ match: v.match, conditions: v.conditions });
  const incomplete = v.conditions.filter((c) => !conditionComplete(c)).length;
  const dirty = !segment || JSON.stringify({ name: segment.name, description: segment.description, match: segment.match, conditions: segment.conditions }) !== JSON.stringify(v);

  const setCond = (id: string, patch: Partial<SegmentCondition>) => {
    setCondError("");
    setV({ ...v, conditions: v.conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  };

  const save = async () => {
    if (v.name.trim().length < 2) {
      setNameError("Enter a segment name (at least 2 characters)");
      document.getElementById("editor-name")?.focus();
      return;
    }
    if (!v.conditions.length) return setCondError("Add at least one condition");
    if (incomplete) return setCondError(`Complete or remove ${pluralize(incomplete, "unfinished condition")}`);
    try {
      const saved = segment ? await update.mutateAsync({ id: segment.id, input: v }) : await create.mutateAsync(v);
      toast.success(segment ? "Segment saved" : "Segment created", { description: `${saved.name} · ${formatNumber(saved.contactCount)} contacts match` });
      if (!segment) router.replace(segmentHref(saved.id));
    } catch (e) {
      if (e instanceof ApiError && e.field === "name") setNameError(e.message);
      else if (e instanceof ApiError && e.field === "conditions") setCondError(e.message);
      else toast.error("Couldn't save", { description: (e as Error).message });
    }
  };

  return (
    <EditorPage>
      <EditorHeader
        backHref={SEGMENTS_ROUTE}
        backLabel="Back to Segments"
        name={v.name}
        onName={(name) => {
          setNameError("");
          setV({ ...v, name });
        }}
        nameLabel="Segment name"
        placeholder="Untitled segment"
        nameError={nameError}
        pill={<Pill>{segment ? "Segment" : "New segment"}</Pill>}
        meta={dirty ? <span className="font-medium text-[var(--warning)]">Unsaved changes</span> : segment ? `Last updated ${formatDate(segment.updatedAt)}` : null}
        actions={
          <>
            <button type="button" className={headerOutlineClass} onClick={() => router.push(SEGMENTS_ROUTE)}>
              Cancel
            </button>
            <button type="button" className={headerPrimaryClass} onClick={save} disabled={create.isPending || update.isPending}>
              {create.isPending || update.isPending ? "Saving…" : "Save Segment"}
            </button>
          </>
        }
      />
      <EditorColumns
        left={
          <>
            <EditorCard icon={StackIcon} title="Details">
              <div className="px-5 pb-5">
                <label htmlFor="seg-description" className="text-field-label text-ink-body">
                  Description
                </label>
                <textarea id="seg-description" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} rows={2} maxLength={300} placeholder="Who this segment is for" className={cn(fieldClass, "mt-1.5 h-auto resize-y py-2")} />
              </div>
            </EditorCard>
            <EditorCard
              icon={FunnelIcon}
              title="Conditions"
              required
              action={
                v.conditions.length > 0 && (
                  <button type="button" onClick={() => setV({ ...v, conditions: [] })} className="rounded text-[12.5px] font-medium text-ink-muted hover:text-[#B42318]">
                    Clear conditions
                  </button>
                )
              }
            >
              <div className="px-5 pb-5">
                <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-body">
                  Contacts must match
                  <div className="flex rounded-lg border border-line p-0.5" role="radiogroup" aria-label="Match">
                    {(["all", "any"] as const).map((m) => (
                      <button key={m} type="button" role="radio" aria-checked={v.match === m} onClick={() => setV({ ...v, match: m })} className={cn("rounded-md px-3 py-1 text-[12.5px] font-medium transition-colors", v.match === m ? "bg-campaign-tint text-campaign-primary" : "text-ink-muted hover:text-ink")}>
                        {m === "all" ? "ALL conditions (AND)" : "ANY condition (OR)"}
                      </button>
                    ))}
                  </div>
                </div>
                {condError && (
                  <p role="alert" className="mt-3 rounded-lg bg-[var(--danger-bg)] px-3 py-2 text-[12.5px] font-medium text-[#B42318]">
                    {condError}
                  </p>
                )}
                <ol className="mt-4 grid gap-2">
                  {v.conditions.map((c, i) => {
                    const meta = SEGMENT_FIELDS[c.field];
                    const kind = valueKind(c.field, c.operator);
                    const done = conditionComplete(c);
                    return (
                      <li key={c.id}>
                        {i > 0 && <p className="mb-2 ml-3 text-[11px] font-semibold tracking-wide text-campaign-action uppercase">{v.match === "all" ? "and" : "or"}</p>}
                        <div className={cn("grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_auto] sm:items-center", done ? "border-line" : "border-[#F8DDAE] bg-[var(--warning-bg)]/40")}>
                          <select
                            aria-label={`Condition ${i + 1} field`}
                            value={c.field}
                            onChange={(e) => {
                              const f = e.target.value as SegmentField;
                              const fresh = newCondition(f);
                              setCond(c.id, { field: f, operator: fresh.operator, value: fresh.value });
                            }}
                            className={fieldClass}
                          >
                            {FIELD_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          <select aria-label={`Condition ${i + 1} operator`} value={c.operator} onChange={(e) => setCond(c.id, { operator: e.target.value as SegmentCondition["operator"] })} className={fieldClass}>
                            {meta.operators.map((op) => (
                              <option key={op} value={op}>
                                {OPERATOR_LABEL[op]}
                              </option>
                            ))}
                          </select>
                          {kind === "none" ? (
                            <span className="hidden text-[12.5px] text-ink-faint sm:block">No value needed</span>
                          ) : kind === "option" ? (
                            <select aria-label={`Condition ${i + 1} value`} value={c.value} onChange={(e) => setCond(c.id, { value: e.target.value })} className={fieldClass}>
                              <option value="">Choose…</option>
                              {meta.options!.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              aria-label={`Condition ${i + 1} value`}
                              type={kind === "days" ? "number" : kind === "date" ? "date" : "text"}
                              min={kind === "days" ? 1 : undefined}
                              value={c.value}
                              placeholder={kind === "days" ? "Days" : "Value"}
                              onChange={(e) => setCond(c.id, { value: e.target.value })}
                              className={fieldClass}
                            />
                          )}
                          <button type="button" onClick={() => setV({ ...v, conditions: v.conditions.filter((x) => x.id !== c.id) })} aria-label={`Remove condition ${i + 1}`} className="inline-flex size-9 items-center justify-center justify-self-end rounded-lg text-ink-muted hover:bg-[var(--danger-bg)] hover:text-[#B42318]">
                            <XIcon size={15} aria-hidden />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
                {v.conditions.length === 0 && <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-6 text-center text-[13px] text-ink-muted">No conditions yet — a segment with no conditions matches nobody.</p>}
                <button type="button" onClick={() => setV({ ...v, conditions: [...v.conditions, newCondition("tags")] })} className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg border border-dashed border-campaign-soft px-4 text-[13.5px] font-medium text-campaign-action hover:border-campaign-action hover:bg-campaign-surface">
                  <PlusIcon size={15} weight="bold" aria-hidden /> Add condition
                </button>
              </div>
            </EditorCard>
          </>
        }
        right={
          <EditorCard icon={UsersThreeIcon} title="Estimated contacts">
            <div className="px-5 pb-5" aria-live="polite">
              {preview ? (
                <>
                  <p className={cn("text-[34px] leading-10 font-semibold text-campaign-depth tabular-nums transition-opacity", isFetching && "opacity-60")}>{formatNumber(preview.contactCount)}</p>
                  <p className="text-[13px] text-ink-muted">
                    contacts match · <span className="font-medium text-ink">{formatNumber(preview.reachableCount)}</span> reachable
                  </p>
                  {incomplete > 0 && <p className="mt-2 text-[12px] text-[var(--warning)]">{pluralize(incomplete, "unfinished condition")} ignored in this estimate.</p>}
                  <div className="mt-4 rounded-xl bg-campaign-surface p-3">
                    <p className="text-[12px] font-medium text-campaign-depth">In plain words</p>
                    <p className="mt-1 text-[12.5px] leading-5 text-ink-body">{v.conditions.filter(conditionComplete).map(describeCondition).join(v.match === "all" ? " and " : " or ") || "No complete conditions yet."}</p>
                  </div>
                  <p className="mt-4 mb-1.5 text-[12px] font-medium text-ink-muted">Sample matches</p>
                  {preview.sample.length ? (
                    <ul className="divide-y divide-line-soft rounded-xl border border-line">
                      {preview.sample.map((s) => (
                        <li key={s.id}>
                          <Link href={`/contacts/${s.id}`} className="block px-3 py-2 hover:bg-campaign-surface">
                            <span className="block truncate text-[13px] font-medium text-ink">{contactName(s)}</span>
                            <span className="block truncate text-[12px] text-ink-muted">{s.email}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[12.5px] text-ink-faint">No contacts match yet.</p>
                  )}
                </>
              ) : (
                <Skeleton className="h-40 rounded-xl" />
              )}
            </div>
          </EditorCard>
        }
      />
    </EditorPage>
  );
}

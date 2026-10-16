"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChatsCircleIcon, CheckCircleIcon, CopyIcon, PaperPlaneTiltIcon, PencilSimpleIcon, PlusIcon, TextTIcon, TrashIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { Card, ConfirmDialog, FilterSelect, OutlineButton, PageHeading, PageShell, PrimaryButton, SearchInput, ToneBadge } from "@/components/shared/campaign-ui";
import { byText, DataTable, type Column } from "@/components/shared/data-table";
import { EditorColumns, EditorHeader, EditorPage, EditorShellSkeleton, headerOutlineClass, headerPrimaryClass, Pill } from "@/components/shared/editor-shell";
import { EmptyState, ErrorState } from "@/components/shared/state-panels";
import { EditorCard, EditorRow, InlineInput } from "@/components/campaigns/editor/fields";
import { useCreateItem, useDeleteItems, useDuplicateItem, useItem, useItems, useUpdateItem } from "@/hooks/use-workspace";
import { ApiError } from "@/lib/api/errors";
import { formatDate } from "@/lib/format";
import { languageLabel, WA_LANGUAGES } from "@/lib/mock-data/workspace";
import type { WaTemplate, WaTemplateCategory } from "@/lib/types/workspace";
import { cn } from "@/lib/utils";
import { MessageEditor, WA_CATEGORY_LABEL, WA_LIMITS, WA_TEMPLATE_STATUS, WaPhonePreview } from "./wa-ui";

export const WA_TEMPLATES_ROUTE = "/templates/whatsapp";
export const waTemplateHref = (id: string) => `${WA_TEMPLATES_ROUTE}/${encodeURIComponent(id)}`;

const selectClass = "h-11 w-full rounded-lg border border-[#E4E0EC] bg-white px-3 text-[13.5px] text-ink outline-none hover:border-[#D3CCE3] focus:border-campaign-action focus:ring-3 focus:ring-brand-10";

// ── List ─────────────────────────────────────────────────────────────

export function WaTemplatesView() {
  const router = useRouter();
  const { data, isError, refetch } = useItems("waTemplates");
  const duplicate = useDuplicateItem("waTemplates");
  const del = useDeleteItems("waTemplates");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [language, setLanguage] = useState("");
  const [deleting, setDeleting] = useState<WaTemplate | null>(null);

  const term = q.trim().toLowerCase();
  const rows = data?.filter((t) => (!term || t.name.includes(term) || t.body.toLowerCase().includes(term)) && (!category || t.category === category) && (!status || t.status === status) && (!language || t.language === language));
  const filtered = !!(term || category || status || language);

  const columns: Column<WaTemplate>[] = [
    {
      key: "name",
      label: "Template name",
      sort: byText((t) => t.name),
      render: (t) => (
        <Link href={waTemplateHref(t.id)} onClick={(e) => e.stopPropagation()} className="font-mono text-[12.5px] font-semibold text-ink hover:text-brand">
          {t.name}
        </Link>
      ),
    },
    { key: "category", label: "Category", sort: byText((t) => t.category), render: (t) => WA_CATEGORY_LABEL[t.category] },
    { key: "language", label: "Language", render: (t) => languageLabel(t.language), hideBelow: "md" },
    { key: "preview", label: "Message preview", render: (t) => <span className="block max-w-[340px] truncate text-ink-body" title={t.body}>{t.body}</span> },
    { key: "status", label: "Status", sort: byText((t) => t.status), render: (t) => <ToneBadge tone={WA_TEMPLATE_STATUS[t.status]} /> },
    { key: "updated", label: "Updated", sort: byText((t) => t.updatedAt), render: (t) => <span className="whitespace-nowrap">{formatDate(t.updatedAt)}</span>, hideBelow: "lg" },
  ];

  return (
    <PageShell>
      <PageHeading
        crumbs={[{ label: "Overview", href: "/dashboard" }, { label: "WhatsApp Templates" }]}
        title="WhatsApp Templates"
        description="Pre-approved message formats for WhatsApp campaigns. Approval here is simulated."
        actions={
          <>
            <SearchInput value={q} onChange={setQ} placeholder="Search templates…" label="Search WhatsApp templates" className="w-full sm:w-[240px]" />
            <PrimaryButton icon={PlusIcon} onClick={() => router.push(`${WA_TEMPLATES_ROUTE}/new`)}>
              Create Template
            </PrimaryButton>
          </>
        }
      />
      <Card className="mt-5" label="WhatsApp templates">
        <div className="flex flex-wrap items-center gap-2 px-4 pt-4 pb-3 sm:px-5">
          <FilterSelect label="Category" allLabel="All categories" value={category} onChange={setCategory} options={Object.entries(WA_CATEGORY_LABEL).map(([value, label]) => ({ value, label }))} className="w-[170px]" />
          <FilterSelect label="Status" allLabel="All statuses" value={status} onChange={setStatus} options={Object.entries(WA_TEMPLATE_STATUS).map(([value, t]) => ({ value, label: t.label }))} className="w-[160px]" />
          <FilterSelect label="Language" allLabel="All languages" value={language} onChange={setLanguage} options={WA_LANGUAGES} className="w-[170px]" />
        </div>
        {isError ? (
          <ErrorState action={<OutlineButton onClick={() => refetch()}>Try again</OutlineButton>} />
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(t) => t.id}
            rowLabel={(t) => t.name}
            onRowClick={(t) => router.push(waTemplateHref(t.id))}
            defaultSort={{ key: "updated", dir: "desc" }}
            actions={(t) => [
              { label: "Edit", icon: PencilSimpleIcon, href: waTemplateHref(t.id) },
              { label: "Duplicate", icon: CopyIcon, onSelect: () => duplicate.mutate(t.id, { onSuccess: (c) => toast.success("Template duplicated", { description: `${c.name} · saved as a draft` }) }) },
              { label: "Delete", icon: TrashIcon, destructive: true, separatorBefore: true, onSelect: () => setDeleting(t) },
            ]}
            noun="templates"
            caption="WhatsApp templates"
            empty={<EmptyState icon={ChatsCircleIcon} title={filtered ? "No templates match" : "No WhatsApp templates yet"} hint={filtered ? "Try another search or filter." : "Create a template, then use it in a WhatsApp campaign."} action={!filtered && <PrimaryButton icon={PlusIcon} onClick={() => router.push(`${WA_TEMPLATES_ROUTE}/new`)}>Create Template</PrimaryButton>} />}
          />
        )}
      </Card>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this template?"
        description={<>Campaigns that already used <span className="font-mono font-medium text-ink">{deleting?.name}</span> keep their message.</>}
        confirmLabel="Delete template"
        pending={del.isPending}
        onConfirm={() => deleting && del.mutate([deleting.id], { onSuccess: () => (toast.success("Template deleted"), setDeleting(null)) })}
      />
    </PageShell>
  );
}

// ── Editor ───────────────────────────────────────────────────────────

type Draft = Pick<WaTemplate, "name" | "category" | "language" | "header" | "body" | "footer" | "buttons">;
type Errors = Partial<Record<"name" | "body" | "footer", string>>;

export function WaTemplateEditorRoute({ id }: { id: string }) {
  const isNew = id === "new";
  const { data, isError } = useItem("waTemplates", id, !isNew);
  if (isNew) return <WaTemplateEditor key="new" template={null} />;
  if (isError)
    return (
      <PageShell>
        <Card>
          <EmptyState icon={ChatsCircleIcon} title="This template doesn't exist" action={<Link href={WA_TEMPLATES_ROUTE} className="text-[13px] font-medium text-brand">Back to WhatsApp Templates</Link>} />
        </Card>
      </PageShell>
    );
  if (!data) return <EditorShellSkeleton />;
  return <WaTemplateEditor key={data.id} template={data} />;
}

function validate(d: Draft): Errors {
  const e: Errors = {};
  if (!/^[a-z0-9_]{2,}$/.test(d.name.trim())) e.name = "Use at least 2 lower-case letters, numbers or underscores (e.g. summer_sale)";
  if (d.body.trim().length < 10) e.body = "Write the message body (at least 10 characters)";
  if (d.category === "marketing" && !/stop|opt.?out|unsubscribe/i.test(`${d.footer ?? ""} ${d.body}`)) e.footer = "Marketing templates need an opt-out, e.g. “Reply STOP to opt out”";
  return e;
}

function WaTemplateEditor({ template }: { template: WaTemplate | null }) {
  const router = useRouter();
  const create = useCreateItem("waTemplates");
  const update = useUpdateItem("waTemplates");
  const [d, setD] = useState<Draft>(() => ({ name: template?.name ?? "", category: template?.category ?? "marketing", language: template?.language ?? "en_US", header: template?.header ?? "", body: template?.body ?? "", footer: template?.footer ?? "Reply STOP to opt out", buttons: template?.buttons ?? [] }));
  const [errors, setErrors] = useState<Errors>({});
  const [shown, setShown] = useState(false);
  const status = template?.status ?? "draft";
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    const next = { ...d, [k]: v };
    setD(next);
    if (shown) setErrors(validate(next));
  };

  const save = async (submit: boolean) => {
    const errs = validate(d);
    setShown(true);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const patch = { ...d, name: d.name.trim(), buttons: d.buttons.map((b) => b.trim()).filter(Boolean), status: submit ? ("pending" as const) : status === "approved" || status === "rejected" ? ("draft" as const) : status, rejectionReason: undefined };
    try {
      const saved = template ? await update.mutateAsync({ id: template.id, patch, note: submit ? "Submitted for approval" : undefined }) : await create.mutateAsync(patch);
      toast.success(submit ? "Submitted for review" : "Template saved", { description: submit ? `${saved.name} · approval is simulated in this demo` : `${saved.name} · draft` });
      if (!template) router.replace(waTemplateHref(saved.id));
    } catch (e) {
      if (e instanceof ApiError && e.field === "name") setErrors({ ...errs, name: e.message });
      else toast.error("Couldn't save", { description: (e as Error).message });
    }
  };

  const simulateReview = (approve: boolean) =>
    template &&
    update.mutate(
      { id: template.id, patch: approve ? { status: "approved", rejectionReason: undefined } : { status: "rejected", rejectionReason: "The message reads as promotional but doesn't explain why the contact receives it." }, note: approve ? "Template approved (simulated)" : "Template rejected (simulated)" },
      { onSuccess: () => toast.success(approve ? "Template approved" : "Template rejected", { description: "Simulated review — nothing was sent to WhatsApp." }) },
    );

  const saving = create.isPending || update.isPending;

  return (
    <EditorPage>
      <EditorHeader
        backHref={WA_TEMPLATES_ROUTE}
        backLabel="Back to WhatsApp Templates"
        name={d.name}
        onName={(v) => set("name", v.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
        nameLabel="Template name"
        placeholder="template_name"
        nameError={errors.name}
        pill={<Pill fg={WA_TEMPLATE_STATUS[status].fg} bg={WA_TEMPLATE_STATUS[status].bg}>{WA_TEMPLATE_STATUS[status].label}</Pill>}
        meta={template ? `Last saved ${formatDate(template.updatedAt)}` : "Not saved yet"}
        actions={
          <>
            {status === "pending" && (
              <>
                <button type="button" className={headerOutlineClass} onClick={() => simulateReview(false)}>
                  <XIcon size={15} aria-hidden /> Simulate rejection
                </button>
                <button type="button" className={headerOutlineClass} onClick={() => simulateReview(true)}>
                  <CheckCircleIcon size={15} aria-hidden /> Simulate approval
                </button>
              </>
            )}
            <button type="button" className={headerOutlineClass} onClick={() => save(false)} disabled={saving}>
              Save Draft
            </button>
            <button type="button" className={headerPrimaryClass} onClick={() => save(true)} disabled={saving || status === "pending"}>
              <PaperPlaneTiltIcon size={15} aria-hidden /> Submit for approval
            </button>
          </>
        }
      />
      <EditorColumns
        left={
          <>
            {template?.status === "rejected" && template.rejectionReason && (
              <p role="status" className="rounded-xl border border-[#FECDCA] bg-[var(--danger-bg)] px-4 py-3 text-[13px] text-[#B42318]">
                <span className="font-semibold">Rejected (simulated):</span> {template.rejectionReason} Edit the template and submit it again.
              </p>
            )}
            <EditorCard icon={ChatsCircleIcon} title="Template details">
              <div className="pb-4">
                <EditorRow label="Category" required htmlFor="wat-category">
                  <select id="wat-category" value={d.category} onChange={(e) => set("category", e.target.value as WaTemplateCategory)} className={selectClass}>
                    {Object.entries(WA_CATEGORY_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </EditorRow>
                <EditorRow label="Language" required htmlFor="wat-language">
                  <select id="wat-language" value={d.language} onChange={(e) => set("language", e.target.value)} className={selectClass}>
                    {WA_LANGUAGES.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </EditorRow>
              </div>
            </EditorCard>
            <EditorCard icon={TextTIcon} title="Message">
              <div className="pb-4">
                <EditorRow label="Header" htmlFor="wat-header">
                  <InlineInput id="wat-header" value={d.header ?? ""} onChange={(e) => set("header", e.target.value)} maxLength={WA_LIMITS.header} placeholder="Optional bold first line" />
                </EditorRow>
                <EditorRow label="Body" required htmlFor="wat-body" error={errors.body} className="sm:items-start [&>label]:sm:pt-3">
                  <MessageEditor id="wat-body" value={d.body} onChange={(v) => set("body", v)} max={WA_LIMITS.body} invalid={!!errors.body} placeholder="Hi {{first_name}}, …" />
                </EditorRow>
                <EditorRow label="Footer" htmlFor="wat-footer" error={errors.footer}>
                  <InlineInput id="wat-footer" value={d.footer ?? ""} onChange={(e) => set("footer", e.target.value)} invalid={!!errors.footer} maxLength={WA_LIMITS.footer} placeholder="Reply STOP to opt out" />
                </EditorRow>
                <ButtonsRow buttons={d.buttons} onChange={(b) => set("buttons", b)} />
              </div>
            </EditorCard>
          </>
        }
        right={
          <section aria-label="Preview" className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <h2 className="mb-4 text-[16px] font-semibold text-campaign-depth">Preview</h2>
            <WaPhonePreview header={d.header} body={d.body} footer={d.footer} buttons={d.buttons} />
            <p className="mt-3 text-center text-[12px] text-ink-muted">Personalization shows sample values.</p>
          </section>
        }
      />
    </EditorPage>
  );
}

/** Up to three short button labels. */
export function ButtonsRow({ buttons, onChange, disabled }: { buttons: string[]; onChange: (b: string[]) => void; disabled?: boolean }) {
  return (
    <EditorRow label="Buttons" className="sm:items-start [&>span:first-child]:sm:pt-3">
      <div className="grid w-full gap-2">
        {buttons.map((b, i) => (
          <div key={i} className="flex items-center gap-2">
            <InlineInput aria-label={`Button ${i + 1} label`} value={b} onChange={(e) => onChange(buttons.map((x, j) => (j === i ? e.target.value : x)))} maxLength={WA_LIMITS.button} placeholder="Button label" disabled={disabled} />
            {!disabled && (
              <button type="button" onClick={() => onChange(buttons.filter((_, j) => j !== i))} aria-label={`Remove button ${i + 1}`} className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-[var(--danger-bg)] hover:text-[#B42318]">
                <XIcon size={15} aria-hidden />
              </button>
            )}
          </div>
        ))}
        {!disabled && buttons.length < WA_LIMITS.buttons && (
          <button type="button" onClick={() => onChange([...buttons, ""])} className={cn("inline-flex h-9 w-fit items-center gap-1.5 rounded-lg border border-dashed border-campaign-soft px-3 text-[13px] font-medium text-campaign-action hover:border-campaign-action hover:bg-campaign-surface")}>
            <PlusIcon size={14} weight="bold" aria-hidden /> Add button
          </button>
        )}
        {buttons.length === 0 && disabled && <span className="text-[13px] text-ink-faint">No buttons</span>}
      </div>
    </EditorRow>
  );
}

"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Icon } from "@phosphor-icons/react";
import {
  ArchiveIcon,
  ArrowCounterClockwiseIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  BrowserIcon,
  BuildingsIcon,
  CaretDownIcon,
  CheckCircleIcon,
  CheckSquareIcon,
  CopyIcon,
  EnvelopeSimpleIcon,
  EyeIcon,
  GearSixIcon,
  ListChecksIcon,
  PencilSimpleIcon,
  PhoneIcon,
  PlusIcon,
  ShieldCheckIcon,
  TextAaIcon,
  TrashIcon,
  UserIcon,
} from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge, Card, ConfirmDialog, FilterSelect, OutlineButton, PageHeading, PageShell, PrimaryButton, SearchInput } from "@/components/shared/campaign-ui";
import { byNumber, byText, DataTable, type Column } from "@/components/shared/data-table";
import { EditorColumns, EditorHeader, EditorPage, EditorShellSkeleton, headerOutlineClass, headerPrimaryClass, Pill } from "@/components/shared/editor-shell";
import { Switch } from "@/components/shared/email-ui";
import { EmptyState, ErrorState } from "@/components/shared/state-panels";
import { EditorCard, EditorRow, editorInputClass, InlineInput } from "@/components/campaigns/editor/fields";
import { useLists } from "@/hooks/use-audience";
import { useCreateItem, useDeleteItems, useDuplicateItem, useItem, useItems, useUpdateItem } from "@/hooks/use-workspace";
import { ApiError } from "@/lib/api/errors";
import { isValidEmail } from "@/lib/audience";
import { formatDate, formatNumber, formatPercent, pct } from "@/lib/format";
import type { FormFieldDef, FormFieldType, FormKind, FormStatus, SignupForm } from "@/lib/types/workspace";
import { cn } from "@/lib/utils";

export const FORMS_ROUTE = "/forms";
export const formHref = (id: string) => `${FORMS_ROUTE}/${encodeURIComponent(id)}`;

const KIND_LABEL: Record<FormKind, string> = { embedded: "Embedded form", popup: "Pop-up", landing: "Landing page" };
const STATUS: Record<FormStatus, { label: string; fg: string; bg: string }> = {
  draft: { label: "Draft", fg: "var(--neutral-fg)", bg: "var(--neutral-bg)" },
  active: { label: "Active", fg: "var(--success)", bg: "var(--success-bg)" },
  archived: { label: "Archived", fg: "#8a8699", bg: "#f4f3f7" },
};

const FIELD_TYPES: { type: FormFieldType; label: string; icon: Icon; defaults: Partial<FormFieldDef> }[] = [
  { type: "firstName", label: "First Name", icon: UserIcon, defaults: { label: "First name" } },
  { type: "lastName", label: "Last Name", icon: UserIcon, defaults: { label: "Last name" } },
  { type: "email", label: "Email", icon: EnvelopeSimpleIcon, defaults: { label: "Email address", required: true, placeholder: "you@example.com" } },
  { type: "phone", label: "Phone", icon: PhoneIcon, defaults: { label: "Phone number" } },
  { type: "company", label: "Company", icon: BuildingsIcon, defaults: { label: "Company" } },
  { type: "text", label: "Custom Text", icon: TextAaIcon, defaults: { label: "Your question" } },
  { type: "dropdown", label: "Dropdown", icon: CaretDownIcon, defaults: { label: "Choose one", options: ["Option 1", "Option 2"] } },
  { type: "checkbox", label: "Checkbox", icon: CheckSquareIcon, defaults: { label: "Tick this box" } },
  { type: "consent", label: "Consent", icon: ShieldCheckIcon, defaults: { label: "I agree to receive marketing emails.", required: true } },
];
const typeMeta = (t: FormFieldType) => FIELD_TYPES.find((x) => x.type === t)!;
/** These map to one contact field each, so they can only be added once. */
const SINGLE: FormFieldType[] = ["firstName", "lastName", "email", "phone", "company"];

let seq = 0;
const newField = (type: FormFieldType): FormFieldDef => ({ id: `fld-${Date.now().toString(36)}-${++seq}`, type, required: false, label: "", ...typeMeta(type).defaults }) as FormFieldDef;

// ── Rendered form (builder preview and Preview dialog) ───────────────

export function FormRender({ form, interactive = true }: { form: Pick<SignupForm, "fields" | "settings" | "kind">; interactive?: boolean }) {
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const { fields, settings } = form;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!interactive) return;
    const errs: Record<string, string> = {};
    for (const f of fields) {
      const v = values[f.id];
      if (f.required && (v === undefined || v === "" || v === false)) errs[f.id] = f.type === "consent" ? "Please tick to continue" : "This field is required";
      else if (f.type === "email" && typeof v === "string" && v && !isValidEmail(v)) errs[f.id] = "Enter a valid email address";
    }
    setErrors(errs);
    if (!Object.keys(errs).length) setDone(true);
  };

  if (done)
    return (
      <div className="flex flex-col items-center rounded-2xl bg-white px-6 py-10 text-center">
        <CheckCircleIcon size={36} weight="fill" className="text-[var(--success)]" aria-hidden />
        <p className="mt-3 text-[15px] font-semibold text-campaign-depth">{settings.successMessage || "Thanks!"}</p>
        <p className="mt-1 text-[12px] text-ink-muted">Test submission only — no contact was created.</p>
        <button type="button" onClick={() => (setDone(false), setValues({}))} className="mt-4 rounded text-[13px] font-medium text-campaign-action hover:underline">
          Reset preview
        </button>
      </div>
    );

  return (
    <form noValidate onSubmit={submit} className={cn("rounded-2xl bg-white p-6", form.kind === "popup" && "shadow-pop ring-1 ring-line")}>
      <h3 className="text-[19px] leading-7 font-semibold text-campaign-depth">{settings.title || "Untitled form"}</h3>
      {settings.description && <p className="mt-1 text-[13px] leading-5 text-ink-muted">{settings.description}</p>}
      <div className="mt-5 grid gap-3.5">
        {fields.map((f) => {
          const id = `preview-${f.id}`;
          const err = errors[f.id];
          const label = (
            <>
              {f.label || "Untitled field"}
              {f.required && <span className="ml-0.5 text-[#E5484D]">*</span>}
            </>
          );
          if (f.type === "checkbox" || f.type === "consent")
            return (
              <div key={f.id}>
                <label className="flex items-start gap-2 text-[13px] leading-5 text-ink-body">
                  <input type="checkbox" checked={!!values[f.id]} onChange={(e) => setValues({ ...values, [f.id]: e.target.checked })} className="mt-0.5 size-4 accent-[var(--campaign-action)]" />
                  <span>{label}</span>
                </label>
                {err && <p className="mt-1 text-[12px] font-medium text-[#D92D20]">{err}</p>}
              </div>
            );
          return (
            <div key={f.id} className="grid gap-1">
              <label htmlFor={id} className="text-[13px] font-medium text-ink-body">
                {label}
              </label>
              {f.type === "dropdown" ? (
                <select id={id} value={String(values[f.id] ?? "")} onChange={(e) => setValues({ ...values, [f.id]: e.target.value })} className={editorInputClass}>
                  <option value="">Choose…</option>
                  {(f.options ?? []).filter(Boolean).map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input id={id} type={f.type === "email" ? "email" : f.type === "phone" ? "tel" : "text"} placeholder={f.placeholder} value={String(values[f.id] ?? "")} onChange={(e) => setValues({ ...values, [f.id]: e.target.value })} aria-invalid={err ? true : undefined} className={editorInputClass} />
              )}
              {err && <p className="text-[12px] font-medium text-[#D92D20]">{err}</p>}
            </div>
          );
        })}
      </div>
      <button type="submit" className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-lg bg-campaign-action text-[14px] font-semibold text-white hover:bg-campaign-hover">
        {settings.submitLabel || "Submit"}
      </button>
    </form>
  );
}

function PreviewFormDialog({ form, onOpenChange }: { form: SignupForm | null; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={!!form} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(820px,calc(100dvh-2rem))] overflow-y-auto bg-[#F7F5FB] p-5 sm:max-w-lg">
        <DialogTitle className="text-[15px] font-semibold text-campaign-depth">Preview · {form?.name}</DialogTitle>
        {form && <FormRender key={form.id} form={form} />}
      </DialogContent>
    </Dialog>
  );
}

// ── List ─────────────────────────────────────────────────────────────

export function FormsView() {
  const router = useRouter();
  const { data, isError, refetch } = useItems("forms");
  const update = useUpdateItem("forms");
  const duplicate = useDuplicateItem("forms");
  const del = useDeleteItems("forms");
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [previewing, setPreviewing] = useState<SignupForm | null>(null);
  const [deleting, setDeleting] = useState<SignupForm | null>(null);

  const term = q.trim().toLowerCase();
  const rows = data?.filter((f) => (!term || f.name.toLowerCase().includes(term) || f.settings.title.toLowerCase().includes(term)) && (!kind || f.kind === kind) && (status ? f.status === status : f.status !== "archived"));

  const columns: Column<SignupForm>[] = [
    {
      key: "name",
      label: "Form name",
      sort: byText((f) => f.name),
      render: (f) => (
        <>
          <Link href={formHref(f.id)} onClick={(e) => e.stopPropagation()} className="block max-w-[260px] truncate font-semibold text-ink hover:text-brand">
            {f.name}
          </Link>
          <span className="block max-w-[260px] truncate text-[12px] text-ink-muted">{f.settings.title}</span>
        </>
      ),
    },
    { key: "kind", label: "Form type", sort: byText((f) => f.kind), render: (f) => KIND_LABEL[f.kind] },
    { key: "status", label: "Status", sort: byText((f) => f.status), render: (f) => <Badge {...STATUS[f.status]} dot>{STATUS[f.status].label}</Badge> },
    { key: "submissions", label: "Submissions", align: "right", sort: byNumber((f) => f.submissions), render: (f) => <span className="font-medium text-ink">{formatNumber(f.submissions)}</span> },
    { key: "conversion", label: "Conversion", align: "right", sort: byNumber((f) => pct(f.submissions, f.views)), render: (f) => (f.views ? formatPercent(pct(f.submissions, f.views)) : <span className="text-ink-faint">—</span>), hideBelow: "md" },
    { key: "created", label: "Created", sort: byText((f) => f.createdAt), render: (f) => <span className="whitespace-nowrap">{formatDate(f.createdAt)}</span>, hideBelow: "md" },
  ];

  return (
    <PageShell>
      <PageHeading
        crumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Forms" }]}
        title="Forms"
        description="Signup and lead-capture forms that add people to your lists. Submissions here are demo data."
        actions={
          <>
            <SearchInput value={q} onChange={setQ} placeholder="Search forms…" label="Search forms" className="w-full sm:w-[240px]" />
            <PrimaryButton icon={PlusIcon} onClick={() => router.push(`${FORMS_ROUTE}/new`)}>
              Create Form
            </PrimaryButton>
          </>
        }
      />
      <Card className="mt-5" label="Forms">
        <div className="flex flex-wrap items-center gap-2 px-4 pt-4 pb-3 sm:px-5">
          <FilterSelect label="Form type" allLabel="All types" value={kind} onChange={setKind} options={Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))} className="w-[170px]" />
          <FilterSelect label="Status" allLabel="Active and drafts" value={status} onChange={setStatus} options={Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))} className="w-[180px]" />
        </div>
        {isError ? (
          <ErrorState action={<OutlineButton onClick={() => refetch()}>Try again</OutlineButton>} />
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(f) => f.id}
            rowLabel={(f) => f.name}
            onRowClick={(f) => router.push(formHref(f.id))}
            defaultSort={{ key: "created", dir: "desc" }}
            actions={(f) => [
              { label: "Edit", icon: PencilSimpleIcon, href: formHref(f.id) },
              { label: "Preview", icon: EyeIcon, onSelect: () => setPreviewing(f) },
              { label: "Duplicate", icon: CopyIcon, onSelect: () => duplicate.mutate(f.id, { onSuccess: (c) => toast.success("Form duplicated", { description: `${c.name} · draft` }) }) },
              f.status === "archived"
                ? { label: "Restore", icon: ArrowCounterClockwiseIcon, separatorBefore: true, onSelect: () => update.mutate({ id: f.id, patch: { status: "draft" }, note: "Restored" }, { onSuccess: () => toast.success("Form restored as a draft") }) }
                : { label: "Archive", icon: ArchiveIcon, separatorBefore: true, onSelect: () => update.mutate({ id: f.id, patch: { status: "archived" }, note: "Archived" }, { onSuccess: () => toast.success("Form archived", { description: "It no longer accepts submissions." }) }) },
              { label: "Delete", icon: TrashIcon, destructive: true, onSelect: () => setDeleting(f) },
            ]}
            noun="forms"
            caption="Signup forms"
            empty={<EmptyState icon={BrowserIcon} title={term || kind || status ? "No forms match" : "No forms yet"} hint={term || kind || status ? "Try another search or filter." : "Build a signup form and connect it to a list."} action={!term && !kind && !status && <PrimaryButton icon={PlusIcon} onClick={() => router.push(`${FORMS_ROUTE}/new`)}>Create Form</PrimaryButton>} />}
          />
        )}
      </Card>
      <PreviewFormDialog form={previewing} onOpenChange={(o) => !o && setPreviewing(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this form?"
        description={<>{deleting?.name} is removed and its submission counts are lost. Contacts it created stay. Archive it instead to keep the numbers.</>}
        confirmLabel="Delete form"
        pending={del.isPending}
        onConfirm={() => deleting && del.mutate([deleting.id], { onSuccess: () => (toast.success("Form deleted"), setDeleting(null)) })}
      />
    </PageShell>
  );
}

// ── Builder ──────────────────────────────────────────────────────────

type Draft = Pick<SignupForm, "name" | "kind" | "fields" | "settings">;

export function FormEditorRoute({ id }: { id: string }) {
  const isNew = id === "new";
  const { data, isError } = useItem("forms", id, !isNew);
  if (isNew) return <FormEditor key="new" form={null} />;
  if (isError)
    return (
      <PageShell>
        <Card>
          <EmptyState icon={BrowserIcon} title="This form doesn't exist" action={<Link href={FORMS_ROUTE} className="text-[13px] font-medium text-brand">Back to Forms</Link>} />
        </Card>
      </PageShell>
    );
  if (!data) return <EditorShellSkeleton />;
  return <FormEditor key={data.id} form={data} />;
}

function FormEditor({ form }: { form: SignupForm | null }) {
  const router = useRouter();
  const { data: lists } = useLists();
  const create = useCreateItem("forms");
  const update = useUpdateItem("forms");
  const [d, setD] = useState<Draft>(() =>
    form
      ? { name: form.name, kind: form.kind, fields: form.fields.map((f) => ({ ...f })), settings: { ...form.settings } }
      : { name: "", kind: "embedded", fields: [newField("email"), newField("firstName"), newField("consent")], settings: { title: "Join our newsletter", description: "", submitLabel: "Subscribe", successMessage: "Thanks for subscribing!" } },
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [nameError, setNameError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [previewKey, setPreviewKey] = useState(0);
  const status = form?.status ?? "draft";

  const setField = (id: string, patch: Partial<FormFieldDef>) => setD({ ...d, fields: d.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= d.fields.length) return;
    const fields = [...d.fields];
    [fields[i], fields[j]] = [fields[j], fields[i]];
    setD({ ...d, fields });
  };
  const add = (type: FormFieldType) => {
    if (SINGLE.includes(type) && d.fields.some((f) => f.type === type)) return void toast.info(`${typeMeta(type).label} is already on the form`);
    const f = newField(type);
    setFieldError("");
    setD({ ...d, fields: [...d.fields, f] });
    setSelected(f.id);
  };

  const save = async (nextStatus?: FormStatus) => {
    if (d.name.trim().length < 2) {
      setNameError("Enter a form name (at least 2 characters)");
      document.getElementById("editor-name")?.focus();
      return;
    }
    if (!d.fields.some((f) => f.type === "email")) return setFieldError("Add an Email field — submissions need an address to create a contact.");
    if (d.fields.some((f) => !f.label.trim())) return setFieldError("Give every field a label.");
    if (d.fields.some((f) => f.type === "dropdown" && (f.options ?? []).filter((o) => o.trim()).length < 2)) return setFieldError("Dropdowns need at least two options.");
    const patch = { ...d, name: d.name.trim(), status: nextStatus ?? status, fields: d.fields.map((f) => ({ ...f, label: f.label.trim(), options: f.options?.map((o) => o.trim()).filter(Boolean) })) };
    try {
      const saved = form ? await update.mutateAsync({ id: form.id, patch, note: nextStatus === "active" ? "Published" : undefined }) : await create.mutateAsync({ ...patch, submissions: 0, views: 0 });
      toast.success(nextStatus === "active" ? "Form published" : nextStatus === "draft" && status === "active" ? "Form unpublished" : "Form saved", { description: nextStatus === "active" ? `${saved.name} · embed code is simulated in this demo` : saved.name });
      if (!form) router.replace(formHref(saved.id));
    } catch (e) {
      if (e instanceof ApiError && e.field === "name") setNameError(e.message);
      else toast.error("Couldn't save", { description: (e as Error).message });
    }
  };
  const saving = create.isPending || update.isPending;
  const sel = d.fields.find((f) => f.id === selected);

  return (
    <EditorPage>
      <EditorHeader
        backHref={FORMS_ROUTE}
        backLabel="Back to Forms"
        name={d.name}
        onName={(name) => (setNameError(""), setD({ ...d, name }))}
        nameLabel="Form name"
        placeholder="Untitled form"
        nameError={nameError}
        pill={<Pill fg={STATUS[status].fg} bg={STATUS[status].bg}>{STATUS[status].label}</Pill>}
        meta={form ? `${formatNumber(form.submissions)} submissions · last saved ${formatDate(form.updatedAt)}` : "Not saved yet"}
        actions={
          <>
            <button type="button" className={headerOutlineClass} onClick={() => save()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            {status === "active" ? (
              <button type="button" className={headerOutlineClass} onClick={() => save("draft")} disabled={saving}>
                Unpublish
              </button>
            ) : (
              <button type="button" className={headerPrimaryClass} onClick={() => save("active")} disabled={saving}>
                Publish
              </button>
            )}
          </>
        }
      />
      <EditorColumns
        ratio="lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
        left={
          <>
            <EditorCard icon={ListChecksIcon} title="Fields" required>
              <div className="px-5 pb-5">
                {fieldError && (
                  <p role="alert" className="mb-3 rounded-lg bg-[var(--danger-bg)] px-3 py-2 text-[12.5px] font-medium text-[#B42318]">
                    {fieldError}
                  </p>
                )}
                <ol className="grid gap-2">
                  {d.fields.map((f, i) => {
                    const meta = typeMeta(f.type);
                    const open = selected === f.id;
                    return (
                      <li key={f.id} className={cn("min-w-0 rounded-xl border bg-white", open ? "border-campaign-soft ring-1 ring-campaign-soft" : "border-line")}>
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-campaign-tint text-campaign-action" aria-hidden>
                            <meta.icon size={16} />
                          </span>
                          <button type="button" onClick={() => setSelected(open ? null : f.id)} aria-expanded={open} className="min-w-0 flex-1 text-left">
                            <span className="block truncate text-[13.5px] font-medium text-ink">{f.label || "Untitled field"}</span>
                            <span className="block text-[12px] text-ink-muted">
                              {meta.label}
                              {f.required ? " · required" : " · optional"}
                            </span>
                          </button>
                          <IconBtn label={`Move ${f.label} up`} onClick={() => move(i, -1)} disabled={i === 0}>
                            <ArrowUpIcon size={14} />
                          </IconBtn>
                          <IconBtn label={`Move ${f.label} down`} onClick={() => move(i, 1)} disabled={i === d.fields.length - 1}>
                            <ArrowDownIcon size={14} />
                          </IconBtn>
                          <IconBtn label={`Remove ${f.label}`} onClick={() => setD({ ...d, fields: d.fields.filter((x) => x.id !== f.id) })} danger>
                            <TrashIcon size={14} />
                          </IconBtn>
                        </div>
                        {open && sel && (
                          <div className="grid gap-3 border-t border-line-soft px-3 py-3 sm:grid-cols-2">
                            <label className="grid gap-1 sm:col-span-2">
                              <span className="text-[12px] font-medium text-ink-body">Label</span>
                              <InlineInput value={sel.label} onChange={(e) => setField(sel.id, { label: e.target.value })} maxLength={160} />
                            </label>
                            {sel.type !== "checkbox" && sel.type !== "consent" && sel.type !== "dropdown" && (
                              <label className="grid gap-1 sm:col-span-2">
                                <span className="text-[12px] font-medium text-ink-body">Placeholder</span>
                                <InlineInput value={sel.placeholder ?? ""} onChange={(e) => setField(sel.id, { placeholder: e.target.value })} maxLength={80} />
                              </label>
                            )}
                            {sel.type === "dropdown" && (
                              <label className="grid gap-1 sm:col-span-2">
                                <span className="text-[12px] font-medium text-ink-body">Options (one per line)</span>
                                <textarea value={(sel.options ?? []).join("\n")} onChange={(e) => setField(sel.id, { options: e.target.value.split("\n") })} rows={4} className={cn(editorInputClass, "h-auto py-2")} />
                              </label>
                            )}
                            <span className="flex items-center justify-between gap-3 text-[13px] text-ink sm:col-span-2">
                              Required
                              <Switch checked={sel.required} onChange={(required) => setField(sel.id, { required })} label="Required field" showState={false} disabled={sel.type === "email"} />
                            </span>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
                <p className="mt-5 mb-2 text-[13px] font-medium text-campaign-depth">Add a field</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {FIELD_TYPES.map((t) => {
                    const used = SINGLE.includes(t.type) && d.fields.some((f) => f.type === t.type);
                    return (
                      <button key={t.type} type="button" onClick={() => add(t.type)} disabled={used} className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-left text-[12.5px] text-ink transition hover:border-campaign-soft hover:bg-campaign-surface disabled:opacity-45 disabled:hover:bg-white">
                        <t.icon size={15} aria-hidden className="shrink-0 text-campaign-action" />
                        {t.label}
                        {used && <span className="sr-only">(already added)</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </EditorCard>
            <EditorCard icon={GearSixIcon} title="Form settings">
              <div className="pb-4">
                <EditorRow label="Form type" htmlFor="frm-kind">
                  <select id="frm-kind" value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value as FormKind })} className={editorInputClass}>
                    {Object.entries(KIND_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </EditorRow>
                <EditorRow label="Title" htmlFor="frm-title">
                  <InlineInput id="frm-title" value={d.settings.title} onChange={(e) => setD({ ...d, settings: { ...d.settings, title: e.target.value } })} maxLength={120} />
                </EditorRow>
                <EditorRow label="Description" htmlFor="frm-desc">
                  <InlineInput id="frm-desc" value={d.settings.description} onChange={(e) => setD({ ...d, settings: { ...d.settings, description: e.target.value } })} maxLength={240} placeholder="Optional" />
                </EditorRow>
                <EditorRow label="Button label" htmlFor="frm-submit">
                  <InlineInput id="frm-submit" value={d.settings.submitLabel} onChange={(e) => setD({ ...d, settings: { ...d.settings, submitLabel: e.target.value } })} maxLength={40} />
                </EditorRow>
                <EditorRow label="Success message" htmlFor="frm-success">
                  <InlineInput id="frm-success" value={d.settings.successMessage} onChange={(e) => setD({ ...d, settings: { ...d.settings, successMessage: e.target.value } })} maxLength={200} />
                </EditorRow>
                <EditorRow label="Add to list" htmlFor="frm-list">
                  <select id="frm-list" value={d.settings.listId ?? ""} onChange={(e) => setD({ ...d, settings: { ...d.settings, listId: e.target.value || undefined } })} className={editorInputClass}>
                    <option value="">Don&apos;t add to a list</option>
                    {(lists ?? []).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </EditorRow>
              </div>
            </EditorCard>
          </>
        }
        right={
          <section aria-label="Live preview" className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-[16px] font-semibold text-campaign-depth">Live preview</h2>
              <button type="button" onClick={() => setPreviewKey((k) => k + 1)} className="rounded text-[12.5px] font-medium text-campaign-action hover:underline">
                Reset
              </button>
            </div>
            <div className={cn("rounded-2xl p-4", d.kind === "popup" ? "bg-campaign-depth/70" : "bg-campaign-surface")}>
              <FormRender key={previewKey} form={d} />
            </div>
            <p className="mt-3 text-[12px] text-ink-muted">Try submitting — validation runs, but nothing is saved.</p>
          </section>
        }
      />
    </EditorPage>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-brand-depth-10 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent", danger && "hover:bg-[var(--danger-bg)] hover:text-[#B42318]")}>
      {children}
    </button>
  );
}

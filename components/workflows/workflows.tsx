"use client";

import { Fragment, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Icon } from "@phosphor-icons/react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ClockIcon,
  CopyIcon,
  EnvelopeSimpleIcon,
  FlagCheckeredIcon,
  GitBranchIcon,
  LightningIcon,
  PauseIcon,
  PencilSimpleIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
  TreeStructureIcon,
  UserGearIcon,
} from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge, Card, ConfirmDialog, FilterSelect, OutlineButton, PageHeading, PageShell, PrimaryButton, SearchInput, td, th, UnderlineTabs } from "@/components/shared/campaign-ui";
import { byNumber, byText, DataTable, type Column } from "@/components/shared/data-table";
import { EditorHeader, EditorPage, EditorShellSkeleton, headerOutlineClass, headerPrimaryClass, Pill } from "@/components/shared/editor-shell";
import { EmptyState, ErrorState } from "@/components/shared/state-panels";
import { EditorCard, editorInputClass, InlineInput } from "@/components/campaigns/editor/fields";
import { useLists } from "@/hooks/use-audience";
import { useTemplates } from "@/hooks/use-templates";
import { useCreateItem, useDeleteItems, useDuplicateItem, useItem, useItems, useUpdateItem } from "@/hooks/use-workspace";
import { ApiError } from "@/lib/api/errors";
import { demoNow } from "@/lib/api/store";
import { formatDate, formatDateTime, formatNumber, pluralize } from "@/lib/format";
import type { StepType, TriggerType, Workflow, WorkflowRun, WorkflowStatus, WorkflowStep } from "@/lib/types/workspace";
import { cn } from "@/lib/utils";

export const WORKFLOWS_ROUTE = "/workflows";
export const workflowHref = (id: string) => `${WORKFLOWS_ROUTE}/${encodeURIComponent(id)}`;

const STATUS: Record<WorkflowStatus, { label: string; fg: string; bg: string }> = {
  draft: { label: "Draft", fg: "var(--neutral-fg)", bg: "var(--neutral-bg)" },
  active: { label: "Active", fg: "var(--success)", bg: "var(--success-bg)" },
  paused: { label: "Paused", fg: "var(--warning)", bg: "var(--warning-bg)" },
};

const STEP_META: Record<StepType, { label: string; icon: Icon; fg: string; bg: string }> = {
  email: { label: "Send Email", icon: EnvelopeSimpleIcon, fg: "var(--ch-email-fg)", bg: "var(--ch-email-bg)" },
  wait: { label: "Wait / Delay", icon: ClockIcon, fg: "var(--ch-journey-fg)", bg: "var(--ch-journey-bg)" },
  condition: { label: "Condition", icon: GitBranchIcon, fg: "var(--ch-automation-fg)", bg: "var(--ch-automation-bg)" },
  update: { label: "Update Contact", icon: UserGearIcon, fg: "var(--ch-sms-fg)", bg: "var(--ch-sms-bg)" },
  end: { label: "End", icon: FlagCheckeredIcon, fg: "var(--neutral-fg)", bg: "var(--neutral-bg)" },
};

const TRIGGERS: { value: TriggerType; label: string }[] = [
  { value: "list-join", label: "Contact joins a list" },
  { value: "form-submit", label: "A form is submitted" },
  { value: "tag-added", label: "A tag is added" },
  { value: "date-field", label: "On a date (e.g. birthday)" },
  { value: "manual", label: "Started manually" },
];

const CONDITIONS = [
  { value: "opened", label: "Opened the previous email" },
  { value: "clicked", label: "Clicked a link in the previous email" },
  { value: "has-tag", label: "Has a tag" },
  { value: "in-list", label: "Is in a list" },
];
const ACTIONS = [
  { value: "add-tag", label: "Add a tag" },
  { value: "remove-tag", label: "Remove a tag" },
  { value: "add-to-list", label: "Add to a list" },
  { value: "unsubscribe", label: "Unsubscribe from marketing" },
];

function triggerLabel(w: Pick<Workflow, "trigger">, names: Map<string, string>) {
  const v = w.trigger.value ? names.get(w.trigger.value) ?? w.trigger.value : "";
  switch (w.trigger.type) {
    case "list-join":
      return `Joins ${v || "a list"}`;
    case "form-submit":
      return `Submits ${v || "a form"}`;
    case "tag-added":
      return `Tagged “${v || "…"}”`;
    case "date-field":
      return `On ${v || "a date field"}`;
    default:
      return "Started manually";
  }
}

export function stepSummary(s: WorkflowStep, names: Map<string, string>) {
  switch (s.type) {
    case "email":
      return s.subject ? `“${s.subject}”` : "No subject yet";
    case "wait":
      return `Wait ${pluralize(s.delay ?? 1, s.unit === "hours" ? "hour" : "day")}`;
    case "condition": {
      const c = CONDITIONS.find((x) => x.value === s.condition)?.label ?? "Choose a condition";
      return s.condition === "has-tag" || s.condition === "in-list" ? `${c}: ${names.get(s.conditionValue ?? "") ?? s.conditionValue ?? "…"}` : `${c} — otherwise exit`;
    }
    case "update": {
      const a = ACTIONS.find((x) => x.value === s.action)?.label ?? "Choose an action";
      return s.action === "unsubscribe" ? a : `${a}: ${names.get(s.actionValue ?? "") ?? s.actionValue ?? "…"}`;
    }
    default:
      return "Contacts leave the workflow";
  }
}

/** Names for ids used in triggers and steps (lists, forms). */
function useNames() {
  const { data: lists } = useLists();
  const { data: forms } = useItems("forms");
  return new Map<string, string>([...(lists ?? []).map((l) => [l.id, l.name] as [string, string]), ...(forms ?? []).map((f) => [f.id, f.name] as [string, string])]);
}

// ── List ─────────────────────────────────────────────────────────────

function useWorkflowActions() {
  const router = useRouter();
  const update = useUpdateItem("workflows");
  const duplicate = useDuplicateItem("workflows");
  const del = useDeleteItems("workflows");
  const [deleting, setDeleting] = useState<Workflow | null>(null);

  const setStatus = (w: Workflow, status: WorkflowStatus) =>
    update.mutate({ id: w.id, patch: { status }, note: status === "active" ? (w.status === "paused" ? "Resumed" : "Activated") : "Paused" }, { onSuccess: () => toast.success(status === "active" ? `${w.name} is running` : `${w.name} paused`, { description: status === "active" ? "Simulated — no emails are sent." : "No new contacts enter until you resume." }) });

  const actionsFor = (w: Workflow) => [
    { label: "Edit", icon: PencilSimpleIcon, href: workflowHref(w.id) },
    { label: "Duplicate", icon: CopyIcon, onSelect: () => duplicate.mutate(w.id, { onSuccess: (c) => toast.success("Workflow duplicated", { description: `${c.name} · draft`, action: { label: "Open", onClick: () => router.push(workflowHref(c.id)) } }) }) },
    w.status === "active" ? { label: "Pause", icon: PauseIcon, separatorBefore: true, onSelect: () => setStatus(w, "paused") } : { label: w.status === "paused" ? "Resume" : "Activate", icon: PlayIcon, separatorBefore: true, onSelect: () => setStatus(w, "active") },
    { label: "Delete", icon: TrashIcon, destructive: true, onSelect: () => setDeleting(w) },
  ];

  const element = (onDeleted?: () => void) => (
    <ConfirmDialog
      open={!!deleting}
      onOpenChange={(o) => !o && setDeleting(null)}
      title="Delete this workflow?"
      description={
        <>
          <span className="font-medium text-ink">{deleting?.name}</span> and its run history are removed. Contacts currently in it ({formatNumber(deleting?.runs.filter((r) => r.outcome === "in-progress").length ?? 0)}) simply stop. This can&apos;t be undone.
        </>
      }
      confirmLabel="Delete workflow"
      pending={del.isPending}
      onConfirm={() =>
        deleting &&
        del.mutate([deleting.id], {
          onSuccess: () => {
            toast.success("Workflow deleted", { description: deleting.name });
            setDeleting(null);
            onDeleted?.();
          },
        })
      }
    />
  );
  return { actionsFor, element, setStatus, update };
}

export function WorkflowsView() {
  const router = useRouter();
  const { data, isError, refetch } = useItems("workflows");
  const names = useNames();
  const actions = useWorkflowActions();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [trigger, setTrigger] = useState("");

  const term = q.trim().toLowerCase();
  const rows = data?.filter((w) => (!term || w.name.toLowerCase().includes(term) || w.description.toLowerCase().includes(term)) && (!status || w.status === status) && (!trigger || w.trigger.type === trigger));

  const columns: Column<Workflow>[] = [
    {
      key: "name",
      label: "Workflow",
      sort: byText((w) => w.name),
      render: (w) => (
        <>
          <Link href={workflowHref(w.id)} onClick={(e) => e.stopPropagation()} className="block max-w-[280px] truncate font-semibold text-ink hover:text-brand">
            {w.name}
          </Link>
          <span className="block max-w-[280px] truncate text-[12px] text-ink-muted">{pluralize(w.steps.filter((s) => s.type !== "end").length, "step")} · {w.description || "No description"}</span>
        </>
      ),
    },
    { key: "status", label: "Status", sort: byText((w) => w.status), render: (w) => <Badge {...STATUS[w.status]} dot>{STATUS[w.status].label}</Badge> },
    { key: "trigger", label: "Trigger", render: (w) => <span className="flex items-center gap-1.5"><LightningIcon size={14} aria-hidden className="shrink-0 text-campaign-action" /><span className="truncate">{triggerLabel(w, names)}</span></span> },
    { key: "processed", label: "Contacts processed", align: "right", sort: byNumber((w) => w.processed), render: (w) => <span className="font-medium text-ink">{formatNumber(w.processed)}</span> },
    { key: "last", label: "Last run", sort: byText((w) => w.lastRunAt), render: (w) => (w.lastRunAt ? <span className="whitespace-nowrap">{formatDateTime(w.lastRunAt)}</span> : <span className="text-ink-faint">Never</span>), hideBelow: "md" },
    { key: "created", label: "Created", sort: byText((w) => w.createdAt), render: (w) => <span className="whitespace-nowrap">{formatDate(w.createdAt)}</span>, hideBelow: "lg" },
  ];

  return (
    <PageShell>
      <PageHeading
        crumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Workflows" }]}
        title="Workflows"
        description="Automated sequences that react to what contacts do. Runs here are simulated."
        actions={
          <>
            <SearchInput value={q} onChange={setQ} placeholder="Search workflows…" label="Search workflows" className="w-full sm:w-[240px]" />
            <PrimaryButton icon={PlusIcon} onClick={() => router.push(`${WORKFLOWS_ROUTE}/new`)}>
              Create Workflow
            </PrimaryButton>
          </>
        }
      />
      <Card className="mt-5" label="Workflows">
        <div className="flex flex-wrap items-center gap-2 px-4 pt-4 pb-3 sm:px-5">
          <FilterSelect label="Status" allLabel="All statuses" value={status} onChange={setStatus} options={Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))} className="w-[160px]" />
          <FilterSelect label="Trigger" allLabel="All triggers" value={trigger} onChange={setTrigger} options={TRIGGERS} className="w-[210px]" />
        </div>
        {isError ? (
          <ErrorState action={<OutlineButton onClick={() => refetch()}>Try again</OutlineButton>} />
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(w) => w.id}
            rowLabel={(w) => w.name}
            onRowClick={(w) => router.push(workflowHref(w.id))}
            actions={actions.actionsFor}
            defaultSort={{ key: "last", dir: "desc" }}
            noun="workflows"
            caption="Workflows"
            empty={<EmptyState icon={TreeStructureIcon} title={term || status || trigger ? "No workflows match" : "No workflows yet"} hint={term || status || trigger ? "Try another search or filter." : "Start with a trigger, then add emails, waits and conditions."} action={!term && !status && !trigger && <PrimaryButton icon={PlusIcon} onClick={() => router.push(`${WORKFLOWS_ROUTE}/new`)}>Create Workflow</PrimaryButton>} />}
          />
        )}
      </Card>
      {actions.element()}
    </PageShell>
  );
}

// ── Builder ──────────────────────────────────────────────────────────

let seq = 0;
const newStep = (type: StepType): WorkflowStep => ({ id: `step-${Date.now().toString(36)}-${++seq}`, type, ...(type === "wait" ? { delay: 1, unit: "days" as const } : type === "condition" ? { condition: "opened" as const } : type === "update" ? { action: "add-tag" as const, actionValue: "" } : {}) });

type Draft = Pick<Workflow, "name" | "description" | "trigger" | "steps">;

export function WorkflowRoute({ id }: { id: string }) {
  const isNew = id === "new";
  const { data, isError } = useItem("workflows", id, !isNew);
  if (isNew) return <WorkflowEditor key="new" workflow={null} />;
  if (isError)
    return (
      <PageShell>
        <Card>
          <EmptyState icon={TreeStructureIcon} title="This workflow doesn't exist" action={<Link href={WORKFLOWS_ROUTE} className="text-[13px] font-medium text-brand">Back to Workflows</Link>} />
        </Card>
      </PageShell>
    );
  if (!data) return <EditorShellSkeleton />;
  return <WorkflowEditor key={data.id} workflow={data} />;
}

function validateDraft(d: Draft): string[] {
  const out: string[] = [];
  if (d.name.trim().length < 2) out.push("Enter a workflow name");
  if (d.trigger.type !== "manual" && !d.trigger.value?.trim()) out.push("Choose what starts the workflow");
  if (!d.steps.some((s) => s.type === "email")) out.push("Add at least one Send Email step");
  d.steps.forEach((s, i) => {
    if (s.type === "email" && !s.subject?.trim()) out.push(`Step ${i + 1}: add an email subject`);
    if (s.type === "wait" && (!s.delay || s.delay < 1)) out.push(`Step ${i + 1}: wait at least 1 ${s.unit === "hours" ? "hour" : "day"}`);
    if (s.type === "condition" && (s.condition === "has-tag" || s.condition === "in-list") && !s.conditionValue) out.push(`Step ${i + 1}: complete the condition`);
    if (s.type === "update" && s.action !== "unsubscribe" && !s.actionValue?.trim()) out.push(`Step ${i + 1}: choose what to update`);
  });
  return out;
}

function WorkflowEditor({ workflow: w }: { workflow: Workflow | null }) {
  const router = useRouter();
  const names = useNames();
  const create = useCreateItem("workflows");
  const update = useUpdateItem("workflows");
  const actions = useWorkflowActions();
  const [tab, setTab] = useState<"builder" | "details">("builder");
  const [d, setD] = useState<Draft>(() => (w ? { name: w.name, description: w.description, trigger: { ...w.trigger }, steps: w.steps.map((s) => ({ ...s })) } : { name: "", description: "", trigger: { type: "list-join", value: "" }, steps: [newStep("email"), newStep("end")] }));
  const [selected, setSelected] = useState<string>("trigger");
  const [problems, setProblems] = useState<string[]>([]);
  const status = w?.status ?? "draft";

  const set = (next: Draft) => {
    setD(next);
    if (problems.length) setProblems(validateDraft(next));
  };
  const setStep = (id: string, patch: Partial<WorkflowStep>) => set({ ...d, steps: d.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const insertAt = (index: number, type: StepType) => {
    const s = newStep(type);
    const steps = [...d.steps];
    steps.splice(index, 0, s);
    set({ ...d, steps });
    setSelected(s.id);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    // The End step stays last.
    if (j < 0 || j >= d.steps.length || d.steps[j].type === "end") return;
    const steps = [...d.steps];
    [steps[i], steps[j]] = [steps[j], steps[i]];
    set({ ...d, steps });
  };

  const save = async (nextStatus?: WorkflowStatus) => {
    const errs = validateDraft(d);
    setProblems(errs);
    if (errs.length) return void toast.error(`Fix ${pluralize(errs.length, "issue")} before saving`);
    const steps = d.steps.some((s) => s.type === "end") ? d.steps : [...d.steps, newStep("end")];
    const patch = { ...d, name: d.name.trim(), steps, status: nextStatus ?? status };
    try {
      const saved = w ? await update.mutateAsync({ id: w.id, patch, note: nextStatus === "active" ? "Activated" : nextStatus === "paused" ? "Paused" : "Edited" }) : await create.mutateAsync({ ...patch, processed: 0, runs: [] });
      toast.success(nextStatus === "active" ? "Workflow activated" : nextStatus === "paused" ? "Workflow paused" : "Workflow saved", { description: `${saved.name} · simulated, nothing is sent` });
      if (!w) router.replace(workflowHref(saved.id));
    } catch (e) {
      if (e instanceof ApiError) setProblems([e.message]);
      else toast.error("Couldn't save", { description: (e as Error).message });
    }
  };

  const saving = create.isPending || update.isPending;
  const sel = d.steps.find((s) => s.id === selected);
  const selIndex = d.steps.findIndex((s) => s.id === selected);

  return (
    <EditorPage>
      <EditorHeader
        backHref={WORKFLOWS_ROUTE}
        backLabel="Back to Workflows"
        name={d.name}
        onName={(name) => set({ ...d, name })}
        nameLabel="Workflow name"
        placeholder="Untitled workflow"
        pill={<Pill fg={STATUS[status].fg} bg={STATUS[status].bg}>{STATUS[status].label}</Pill>}
        meta={w ? `${formatNumber(w.processed)} contacts processed${w.lastRunAt ? ` · last run ${formatDateTime(w.lastRunAt)}` : ""}` : "Not saved yet"}
        actions={
          <>
            <button type="button" className={headerOutlineClass} onClick={() => save()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            {status === "active" ? (
              <button type="button" className={headerOutlineClass} onClick={() => save("paused")} disabled={saving}>
                <PauseIcon size={15} aria-hidden /> Pause
              </button>
            ) : (
              <button type="button" className={headerPrimaryClass} onClick={() => save("active")} disabled={saving}>
                <PlayIcon size={15} aria-hidden /> {status === "paused" ? "Resume" : "Activate"}
              </button>
            )}
          </>
        }
      />
      {w && (
        <div className="mx-auto w-full max-w-[1600px] px-4 pt-3 sm:px-6">
          <UnderlineTabs label="Workflow view" idPrefix="wf" value={tab} onChange={setTab} tabs={[{ value: "builder", label: "Builder" }, { value: "details", label: "Stages & run history" }]} />
        </div>
      )}
      {tab === "details" && w ? (
        <WorkflowDetails w={w} names={names} onSimulate={(run) => update.mutate({ id: w.id, patch: { runs: [run, ...w.runs], processed: w.processed + 1, lastRunAt: run.at } }, { onSuccess: () => toast.success("Test run simulated", { description: `${run.contact} entered the workflow` }) })} />
      ) : (
        <div id="wf-panel" role="tabpanel" className="mx-auto grid w-full max-w-[1600px] flex-1 items-start gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          {/* Canvas */}
          <section aria-label="Workflow steps" className="min-w-0 rounded-2xl border border-line bg-[radial-gradient(circle,#E7E2F1_1px,transparent_1px)] bg-[length:18px_18px] p-4 sm:p-6">
            {problems.length > 0 && (
              <ul role="alert" className="mb-4 space-y-1 rounded-xl border border-[#FECDCA] bg-[var(--danger-bg)] px-4 py-3 text-[12.5px] text-[#B42318]">
                {problems.map((p) => (
                  <li key={p}>• {p}</li>
                ))}
              </ul>
            )}
            <div className="mx-auto flex w-full max-w-[460px] flex-col items-center">
              <NodeCard selected={selected === "trigger"} onSelect={() => setSelected("trigger")} icon={LightningIcon} fg="var(--campaign-action)" bg="var(--campaign-tint)" title="Trigger" summary={triggerLabel(d, names)} />
              {d.steps.map((s, i) => {
                const m = STEP_META[s.type];
                return (
                  <Fragment key={s.id}>
                    <Connector onAdd={(type) => insertAt(i, type)} canAddEnd={false} />
                    <NodeCard
                      selected={selected === s.id}
                      onSelect={() => setSelected(s.id)}
                      icon={m.icon}
                      fg={m.fg}
                      bg={m.bg}
                      title={`${i + 1}. ${m.label}`}
                      summary={stepSummary(s, names)}
                      tools={
                        s.type !== "end" && (
                          <>
                            <ToolBtn label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
                              <ArrowUpIcon size={13} />
                            </ToolBtn>
                            <ToolBtn label="Move down" onClick={() => move(i, 1)} disabled={i >= d.steps.length - 1 || d.steps[i + 1]?.type === "end"}>
                              <ArrowDownIcon size={13} />
                            </ToolBtn>
                            <ToolBtn label="Delete step" onClick={() => (set({ ...d, steps: d.steps.filter((x) => x.id !== s.id) }), setSelected("trigger"))} danger>
                              <TrashIcon size={13} />
                            </ToolBtn>
                          </>
                        )
                      }
                    />
                  </Fragment>
                );
              })}
              {!d.steps.some((s) => s.type === "end") && <Connector onAdd={(type) => insertAt(d.steps.length, type)} canAddEnd />}
            </div>
          </section>

          {/* Properties */}
          <div className="grid gap-4 lg:sticky lg:top-[calc(var(--header-h)+88px)]">
            <EditorCard icon={selected === "trigger" ? LightningIcon : sel ? STEP_META[sel.type].icon : TreeStructureIcon} title={selected === "trigger" ? "Trigger" : sel ? STEP_META[sel.type].label : "Step"}>
              <div className="grid gap-3 px-5 pb-5">
                {selected === "trigger" ? (
                  <TriggerFields d={d} onChange={(trigger) => set({ ...d, trigger })} />
                ) : sel ? (
                  <StepFields step={sel} index={selIndex} onChange={(patch) => setStep(sel.id, patch)} />
                ) : (
                  <p className="text-[13px] text-ink-muted">Select a step in the workflow to edit it.</p>
                )}
              </div>
            </EditorCard>
            <EditorCard icon={PencilSimpleIcon} title="About this workflow">
              <div className="px-5 pb-5">
                <label htmlFor="wf-desc" className="text-[12.5px] font-medium text-ink-body">
                  Description
                </label>
                <textarea id="wf-desc" value={d.description} onChange={(e) => set({ ...d, description: e.target.value })} rows={2} maxLength={240} className={cn(editorInputClass, "mt-1 h-auto py-2")} placeholder="What this workflow does" />
              </div>
            </EditorCard>
          </div>
        </div>
      )}
      {w && actions.element(() => router.push(WORKFLOWS_ROUTE))}
    </EditorPage>
  );
}

function NodeCard({ selected, onSelect, icon: IconCmp, fg, bg, title, summary, tools }: { selected: boolean; onSelect: () => void; icon: Icon; fg: string; bg: string; title: string; summary: string; tools?: ReactNode }) {
  return (
    <div className={cn("group flex w-full items-center gap-3 rounded-xl border bg-white px-3 py-3 shadow-card transition", selected ? "border-campaign-action ring-2 ring-campaign-soft" : "border-line hover:border-campaign-soft")}>
      <button type="button" onClick={onSelect} aria-pressed={selected} className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-brand-action">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ color: fg, backgroundColor: bg }} aria-hidden>
          <IconCmp size={20} />
        </span>
        <span className="min-w-0">
          <span className="block text-[13.5px] font-semibold text-campaign-depth">{title}</span>
          <span className="block truncate text-[12.5px] text-ink-muted">{summary}</span>
        </span>
      </button>
      {tools && <span className="flex shrink-0 items-center opacity-70 group-hover:opacity-100">{tools}</span>}
    </div>
  );
}

function Connector({ onAdd, canAddEnd }: { onAdd: (t: StepType) => void; canAddEnd: boolean }) {
  return (
    <div className="flex h-12 flex-col items-center justify-center" aria-hidden={false}>
      <span className="h-3 w-px bg-campaign-soft" aria-hidden />
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Add a step here" className="inline-flex size-6 items-center justify-center rounded-full border border-campaign-soft bg-white text-campaign-action shadow-card transition hover:border-campaign-action hover:bg-campaign-surface focus-visible:outline-2 focus-visible:outline-brand-action data-[state=open]:border-campaign-action">
          <PlusIcon size={12} weight="bold" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-52">
          {(Object.keys(STEP_META) as StepType[])
            .filter((t) => t !== "end" || canAddEnd)
            .map((t) => {
              const m = STEP_META[t];
              return (
                <DropdownMenuItem key={t} onSelect={() => onAdd(t)}>
                  <m.icon aria-hidden style={{ color: m.fg }} /> {m.label}
                </DropdownMenuItem>
              );
            })}
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="h-3 w-px bg-campaign-soft" aria-hidden />
    </div>
  );
}

function ToolBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className={cn("inline-flex size-7 items-center justify-center rounded-md text-ink-muted hover:bg-brand-depth-10 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent", danger && "hover:bg-[var(--danger-bg)] hover:text-[#B42318]")}>
      {children}
    </button>
  );
}

function Labeled({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <label htmlFor={htmlFor} className="text-[12.5px] font-medium text-ink-body">
        {label}
      </label>
      {children}
    </div>
  );
}

function TriggerFields({ d, onChange }: { d: Draft; onChange: (t: Draft["trigger"]) => void }) {
  const { data: lists } = useLists();
  const { data: forms } = useItems("forms");
  const t = d.trigger;
  return (
    <>
      <Labeled label="Start this workflow when" htmlFor="wf-trigger">
        <select id="wf-trigger" value={t.type} onChange={(e) => onChange({ type: e.target.value as TriggerType, value: "" })} className={editorInputClass}>
          {TRIGGERS.map((x) => (
            <option key={x.value} value={x.value}>
              {x.label}
            </option>
          ))}
        </select>
      </Labeled>
      {t.type === "list-join" && (
        <Labeled label="List" htmlFor="wf-trigger-value">
          <select id="wf-trigger-value" value={t.value ?? ""} onChange={(e) => onChange({ ...t, value: e.target.value })} className={editorInputClass}>
            <option value="">Choose a list…</option>
            {(lists ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Labeled>
      )}
      {t.type === "form-submit" && (
        <Labeled label="Form" htmlFor="wf-trigger-value">
          <select id="wf-trigger-value" value={t.value ?? ""} onChange={(e) => onChange({ ...t, value: e.target.value })} className={editorInputClass}>
            <option value="">Choose a form…</option>
            {(forms ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Labeled>
      )}
      {t.type === "tag-added" && (
        <Labeled label="Tag" htmlFor="wf-trigger-value">
          <InlineInput id="wf-trigger-value" value={t.value ?? ""} onChange={(e) => onChange({ ...t, value: e.target.value.toLowerCase() })} placeholder="e.g. trial" />
        </Labeled>
      )}
      {t.type === "date-field" && (
        <Labeled label="Date field" htmlFor="wf-trigger-value">
          <select id="wf-trigger-value" value={t.value ?? ""} onChange={(e) => onChange({ ...t, value: e.target.value })} className={editorInputClass}>
            <option value="">Choose a field…</option>
            <option value="birthday">Birthday</option>
            <option value="signup anniversary">Signup anniversary</option>
            <option value="renewal date">Renewal date</option>
          </select>
        </Labeled>
      )}
      {t.type === "manual" && <p className="text-[12.5px] text-ink-muted">You add contacts by hand, or run a test from the Stages tab.</p>}
    </>
  );
}

function StepFields({ step: s, index, onChange }: { step: WorkflowStep; index: number; onChange: (p: Partial<WorkflowStep>) => void }) {
  const { data: templates } = useTemplates({});
  const { data: lists } = useLists();
  const id = `wf-step-${index}`;
  switch (s.type) {
    case "email":
      return (
        <>
          <Labeled label="Subject" htmlFor={`${id}-subject`}>
            <InlineInput id={`${id}-subject`} value={s.subject ?? ""} onChange={(e) => onChange({ subject: e.target.value })} maxLength={150} placeholder="What the email is about" />
          </Labeled>
          <Labeled label="Email template" htmlFor={`${id}-tpl`}>
            <select id={`${id}-tpl`} value={s.templateId ?? ""} onChange={(e) => onChange({ templateId: e.target.value || undefined })} className={editorInputClass}>
              <option value="">Choose later</option>
              {(templates ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.system ? "" : " (mine)"}
                </option>
              ))}
            </select>
          </Labeled>
        </>
      );
    case "wait":
      return (
        <div className="grid grid-cols-[1fr_1fr] gap-2">
          <Labeled label="Wait for" htmlFor={`${id}-delay`}>
            <input id={`${id}-delay`} type="number" min={1} max={365} value={s.delay ?? 1} onChange={(e) => onChange({ delay: Math.max(0, Number(e.target.value)) })} className={editorInputClass} />
          </Labeled>
          <Labeled label="Unit" htmlFor={`${id}-unit`}>
            <select id={`${id}-unit`} value={s.unit ?? "days"} onChange={(e) => onChange({ unit: e.target.value as "hours" | "days" })} className={editorInputClass}>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </Labeled>
        </div>
      );
    case "condition":
      return (
        <>
          <Labeled label="Continue only if the contact" htmlFor={`${id}-cond`}>
            <select id={`${id}-cond`} value={s.condition ?? "opened"} onChange={(e) => onChange({ condition: e.target.value as WorkflowStep["condition"], conditionValue: "" })} className={editorInputClass}>
              {CONDITIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Labeled>
          {s.condition === "has-tag" && (
            <Labeled label="Tag" htmlFor={`${id}-cv`}>
              <InlineInput id={`${id}-cv`} value={s.conditionValue ?? ""} onChange={(e) => onChange({ conditionValue: e.target.value.toLowerCase() })} />
            </Labeled>
          )}
          {s.condition === "in-list" && (
            <Labeled label="List" htmlFor={`${id}-cv`}>
              <select id={`${id}-cv`} value={s.conditionValue ?? ""} onChange={(e) => onChange({ conditionValue: e.target.value })} className={editorInputClass}>
                <option value="">Choose a list…</option>
                {(lists ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Labeled>
          )}
          <p className="text-[12px] text-ink-muted">Contacts who don&apos;t match leave the workflow at this step.</p>
        </>
      );
    case "update":
      return (
        <>
          <Labeled label="Action" htmlFor={`${id}-action`}>
            <select id={`${id}-action`} value={s.action ?? "add-tag"} onChange={(e) => onChange({ action: e.target.value as WorkflowStep["action"], actionValue: "" })} className={editorInputClass}>
              {ACTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </Labeled>
          {(s.action === "add-tag" || s.action === "remove-tag") && (
            <Labeled label="Tag" htmlFor={`${id}-av`}>
              <InlineInput id={`${id}-av`} value={s.actionValue ?? ""} onChange={(e) => onChange({ actionValue: e.target.value.toLowerCase() })} />
            </Labeled>
          )}
          {s.action === "add-to-list" && (
            <Labeled label="List" htmlFor={`${id}-av`}>
              <select id={`${id}-av`} value={s.actionValue ?? ""} onChange={(e) => onChange({ actionValue: e.target.value })} className={editorInputClass}>
                <option value="">Choose a list…</option>
                {(lists ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Labeled>
          )}
        </>
      );
    default:
      return <p className="text-[13px] text-ink-muted">Contacts finish the workflow here. Every workflow ends with this step.</p>;
  }
}

// ── Details ──────────────────────────────────────────────────────────

const OUTCOME = {
  completed: { label: "Completed", fg: "var(--success)", bg: "var(--success-bg)" },
  "in-progress": { label: "In progress", fg: "var(--campaign-primary)", bg: "var(--campaign-tint)" },
  exited: { label: "Exited", fg: "var(--neutral-fg)", bg: "var(--neutral-bg)" },
};

function WorkflowDetails({ w, names, onSimulate }: { w: Workflow; names: Map<string, string>; onSimulate: (run: WorkflowRun) => void }) {
  // Each stage keeps a share of the contacts that reached the stage before it.
  const stages = w.steps.reduce<{ s: WorkflowStep; reached: number }[]>((acc, s, i) => {
    const prev = acc[i - 1];
    const reached = prev ? Math.round(prev.reached * (prev.s.type === "condition" ? 0.58 : 0.97)) : w.processed;
    return [...acc, { s, reached }];
  }, []);
  const simulate = () => {
    const people = ["alex.morgan@example.com", "priya.n@brightwave.com", "j.lee@quartzsoftware.com", "sam.ortiz@gmail.com", "nina.k@outlook.com"];
    onSimulate({ id: `run-${Date.now().toString(36)}`, at: demoNow(), contact: people[w.runs.length % people.length], outcome: "in-progress", step: STEP_META[w.steps[0]?.type ?? "end"].label });
  };
  return (
    <div id="wf-panel" role="tabpanel" className="mx-auto grid w-full max-w-[1600px] flex-1 items-start gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <EditorCard icon={TreeStructureIcon} title="Stages">
        <ol className="grid gap-2 px-5 pb-5">
          {stages.map(({ s, reached: n }, i) => {
            const m = STEP_META[s.type];
            const share = w.processed ? (n / w.processed) * 100 : 0;
            return (
              <li key={s.id} className="rounded-xl border border-line-soft p-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ color: m.fg, backgroundColor: m.bg }} aria-hidden>
                    <m.icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-ink">
                      {i + 1}. {m.label}
                    </span>
                    <span className="block truncate text-[12px] text-ink-muted">{stepSummary(s, names)}</span>
                  </span>
                  <span className="text-[13px] font-semibold text-campaign-depth tabular-nums">{formatNumber(n)}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-campaign-tint" aria-hidden>
                  <div className="h-full rounded-full bg-campaign-action" style={{ width: `${share}%` }} />
                </div>
              </li>
            );
          })}
        </ol>
        <p className="px-5 pb-4 text-[12px] text-ink-muted">Contacts reaching each stage (simulated from {formatNumber(w.processed)} entries).</p>
      </EditorCard>
      <EditorCard icon={ClockIcon} title="Run history" action={<OutlineButton icon={PlayIcon} className="h-8" onClick={simulate}>Simulate a run</OutlineButton>}>
        {w.runs.length === 0 ? (
          <EmptyState icon={ClockIcon} title="No runs yet" hint="Runs appear once the workflow is active, or simulate one." className="py-10" />
        ) : (
          <div className="overflow-x-auto pb-2 scrollbar-thin">
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr className="border-y border-line-soft bg-campaign-muted">
                  <th scope="col" className={th}>Contact</th>
                  <th scope="col" className={th}>Entered</th>
                  <th scope="col" className={th}>Current / last step</th>
                  <th scope="col" className={th}>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {w.runs.slice(0, 25).map((r) => (
                  <tr key={r.id} className="border-b border-line-soft last:border-0">
                    <td className={cn(td, "font-medium text-ink")}>{r.contact}</td>
                    <td className={cn(td, "whitespace-nowrap")}>{formatDateTime(r.at)}</td>
                    <td className={td}>{r.step}</td>
                    <td className={td}>
                      <Badge {...OUTCOME[r.outcome]}>{OUTCOME[r.outcome].label}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </EditorCard>
    </div>
  );
}

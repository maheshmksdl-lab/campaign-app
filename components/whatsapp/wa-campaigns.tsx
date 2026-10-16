"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowSquareOutIcon, CalendarCheckIcon, ChatTextIcon, CheckCircleIcon, CopyIcon, PauseIcon, PencilSimpleIcon, PlayIcon, PlusIcon, TrashIcon, WarningCircleIcon, WhatsappLogoIcon } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { Card, ConfirmDialog, fieldClass, OutlineButton, PageHeading, PageShell, PrimaryButton, SearchInput, ToneBadge, UnderlineTabs } from "@/components/shared/campaign-ui";
import { byNumber, byText, DataTable, type Column } from "@/components/shared/data-table";
import { EditorColumns, EditorHeader, EditorPage, EditorShellSkeleton, headerOutlineClass, headerPrimaryClass, Pill } from "@/components/shared/editor-shell";
import { EmptyState, ErrorState } from "@/components/shared/state-panels";
import { EditorCard, EditorRow, InlineInput } from "@/components/campaigns/editor/fields";
import { RecipientsCard } from "@/components/campaigns/editor/recipients-card";
import { useCreateItem, useDeleteItems, useDuplicateItem, useItem, useItems, useUpdateItem } from "@/hooks/use-workspace";
import { ApiError } from "@/lib/api/errors";
import { demoNow } from "@/lib/api/store";
import { addDays, formatDateTime, formatNumber, formatPercent, pct, pluralize } from "@/lib/format";
import { DEMO_TODAY } from "@/lib/mock-data/campaigns";
import type { WaCampaign, WaStatus } from "@/lib/types/workspace";
import { cn } from "@/lib/utils";
import { ButtonsRow, WA_TEMPLATES_ROUTE } from "./wa-templates";
import { MessageEditor, WA_LIMITS, WA_STATUS, WaPhonePreview } from "./wa-ui";

export const WA_CAMPAIGNS_ROUTE = "/campaigns/whatsapp";
export const waCampaignHref = (id: string) => `${WA_CAMPAIGNS_ROUTE}/${encodeURIComponent(id)}`;

const TABS: { value: "" | WaStatus; label: string }[] = [
  { value: "", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "scheduled", label: "Scheduled" },
  { value: "sending", label: "Sending" },
  { value: "sent", label: "Sent" },
  { value: "paused", label: "Paused" },
];

const readRate = (c: WaCampaign) => (c.delivered ? pct(c.read ?? 0, c.delivered) : undefined);
const deliveryRate = (c: WaCampaign) => (c.sent ? pct(c.delivered ?? 0, c.sent) : undefined);

// ── List ─────────────────────────────────────────────────────────────

function useWaActions() {
  const router = useRouter();
  const update = useUpdateItem("whatsapp");
  const duplicate = useDuplicateItem("whatsapp");
  const del = useDeleteItems("whatsapp");
  const [deleting, setDeleting] = useState<WaCampaign | null>(null);

  const actionsFor = (c: WaCampaign) => [
    { label: "View details", icon: ArrowSquareOutIcon, href: waCampaignHref(c.id) },
    (c.status === "draft" || c.status === "scheduled" || c.status === "paused") && { label: "Edit", icon: PencilSimpleIcon, href: waCampaignHref(c.id) },
    { label: "Duplicate", icon: CopyIcon, onSelect: () => duplicate.mutate(c.id, { onSuccess: (x) => toast.success("Campaign duplicated", { description: `${x.name} · draft`, action: { label: "Open", onClick: () => router.push(waCampaignHref(x.id)) } }) }) },
    c.status === "scheduled" && { label: "Pause", icon: PauseIcon, separatorBefore: true, onSelect: () => update.mutate({ id: c.id, patch: { status: "paused" }, note: "Paused" }, { onSuccess: () => toast.success(`${c.name} paused`) }) },
    c.status === "paused" && {
      label: "Resume",
      icon: PlayIcon,
      separatorBefore: true,
      onSelect: () => {
        if (!c.scheduledAt || c.scheduledAt <= demoNow()) return void toast.info("Choose a new send time", { description: "The scheduled time has passed — open the campaign to reschedule." });
        update.mutate({ id: c.id, patch: { status: "scheduled" }, note: "Resumed" }, { onSuccess: () => toast.success(`${c.name} resumed`) });
      },
    },
    c.status !== "sending" && { label: "Delete", icon: TrashIcon, destructive: true, separatorBefore: true, onSelect: () => setDeleting(c) },
  ];

  const element = (onDeleted?: () => void) => (
    <ConfirmDialog
      open={!!deleting}
      onOpenChange={(o) => !o && setDeleting(null)}
      title="Delete this WhatsApp campaign?"
      description={<><span className="font-medium text-ink">{deleting?.name}</span> and its results are removed. This can&apos;t be undone.</>}
      confirmLabel="Delete"
      pending={del.isPending}
      onConfirm={() =>
        deleting &&
        del.mutate([deleting.id], {
          onSuccess: () => {
            toast.success("Campaign deleted", { description: deleting.name });
            setDeleting(null);
            onDeleted?.();
          },
        })
      }
    />
  );
  return { actionsFor, element, askDelete: setDeleting, update };
}

export function WaCampaignsView() {
  const router = useRouter();
  const { data, isError, refetch } = useItems("whatsapp");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"" | WaStatus>("");
  const actions = useWaActions();

  const term = q.trim().toLowerCase();
  const searched = data?.filter((c) => !term || c.name.toLowerCase().includes(term) || c.body.toLowerCase().includes(term) || c.audience.toLowerCase().includes(term));
  const rows = searched?.filter((c) => !tab || c.status === tab);
  const sent = (data ?? []).filter((c) => c.sent);
  const totals = { sent: sent.reduce((n, c) => n + (c.sent ?? 0), 0), delivered: sent.reduce((n, c) => n + (c.delivered ?? 0), 0), read: sent.reduce((n, c) => n + (c.read ?? 0), 0), replied: sent.reduce((n, c) => n + (c.replied ?? 0), 0) };

  const columns: Column<WaCampaign>[] = [
    {
      key: "name",
      label: "Campaign",
      sort: byText((c) => c.name),
      render: (c) => (
        <>
          <Link href={waCampaignHref(c.id)} onClick={(e) => e.stopPropagation()} className="block max-w-[260px] truncate rounded font-semibold text-ink hover:text-brand">
            {c.name}
          </Link>
          <span className="block max-w-[260px] truncate text-[12px] text-ink-muted" title={c.body}>
            {c.body}
          </span>
        </>
      ),
    },
    { key: "audience", label: "Audience", render: (c) => <span className="block max-w-[180px] truncate">{c.audience}</span>, hideBelow: "md" },
    { key: "recipients", label: "Recipients", align: "right", sort: byNumber((c) => c.recipients), render: (c) => formatNumber(c.recipients) },
    { key: "date", label: "Scheduled / sent", sort: byText((c) => c.sentAt ?? c.scheduledAt ?? c.createdAt), render: (c) => <span className="whitespace-nowrap">{c.sentAt ? formatDateTime(c.sentAt) : c.scheduledAt ? formatDateTime(c.scheduledAt) : <span className="text-ink-faint">Not scheduled</span>}</span> },
    { key: "status", label: "Status", sort: byText((c) => c.status), render: (c) => <ToneBadge tone={WA_STATUS[c.status]} /> },
    { key: "delivered", label: "Delivered", align: "right", sort: byNumber(deliveryRate), render: (c) => (deliveryRate(c) === undefined ? <span className="text-ink-faint">—</span> : formatPercent(deliveryRate(c)!)), hideBelow: "lg" },
    { key: "read", label: "Read rate", align: "right", sort: byNumber(readRate), render: (c) => (readRate(c) === undefined ? <span className="text-ink-faint">—</span> : <span className="font-medium text-ink">{formatPercent(readRate(c)!)}</span>) },
    { key: "replies", label: "Replies · clicks", align: "right", render: (c) => (c.sent ? `${formatNumber(c.replied ?? 0)} · ${formatNumber(c.clicks ?? 0)}` : <span className="text-ink-faint">—</span>), hideBelow: "lg" },
  ];

  return (
    <PageShell>
      <PageHeading
        crumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Campaigns", href: "/campaigns" }, { label: "WhatsApp" }]}
        title="WhatsApp Campaigns"
        description="Template-based WhatsApp messages to contacts who opted in. Sending is simulated."
        actions={
          <>
            <SearchInput value={q} onChange={setQ} placeholder="Search WhatsApp campaigns…" label="Search WhatsApp campaigns" className="w-full sm:w-[260px]" />
            <PrimaryButton icon={PlusIcon} onClick={() => router.push(`${WA_CAMPAIGNS_ROUTE}/new`)}>
              Create WhatsApp Campaign
            </PrimaryButton>
          </>
        }
      />
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Messages sent", value: formatNumber(totals.sent) },
          { label: "Delivery rate", value: formatPercent(pct(totals.delivered, totals.sent)) },
          { label: "Read rate", value: formatPercent(pct(totals.read, totals.delivered)) },
          { label: "Reply rate", value: formatPercent(pct(totals.replied, totals.read)) },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-line bg-white p-4 shadow-card">
            <p className="flex items-center gap-1.5 text-[12.5px] text-ink-muted">
              <WhatsappLogoIcon size={14} aria-hidden className="text-[var(--campaign-accent-green)]" /> {m.label}
            </p>
            <p className="mt-1 text-[22px] leading-8 font-semibold text-campaign-depth tabular-nums">{data ? m.value : "—"}</p>
          </div>
        ))}
      </div>
      <UnderlineTabs label="Campaign status" idPrefix="wa" className="mt-5" value={tab} onChange={setTab} tabs={TABS.map((t) => ({ ...t, count: searched ? searched.filter((c) => !t.value || c.status === t.value).length : undefined }))} />
      <Card className="mt-4" label="WhatsApp campaigns">
        <div id="wa-panel" role="tabpanel">
          {isError ? (
            <ErrorState action={<OutlineButton onClick={() => refetch()}>Try again</OutlineButton>} />
          ) : (
            <DataTable
              rows={rows}
              columns={columns}
              rowKey={(c) => c.id}
              rowLabel={(c) => c.name}
              onRowClick={(c) => router.push(waCampaignHref(c.id))}
              actions={actions.actionsFor}
              defaultSort={{ key: "date", dir: "desc" }}
              noun="campaigns"
              caption="WhatsApp campaigns"
              empty={<EmptyState icon={WhatsappLogoIcon} title={term || tab ? "No campaigns match" : "No WhatsApp campaigns yet"} hint={term || tab ? "Try another search or tab." : "Create one from an approved template."} action={!term && !tab && <PrimaryButton icon={PlusIcon} onClick={() => router.push(`${WA_CAMPAIGNS_ROUTE}/new`)}>Create WhatsApp Campaign</PrimaryButton>} />}
            />
          )}
        </div>
      </Card>
      {actions.element()}
    </PageShell>
  );
}

// ── Editor / details ─────────────────────────────────────────────────

type Draft = Pick<WaCampaign, "name" | "templateId" | "header" | "body" | "footer" | "buttons" | "audienceIds">;
type Errors = Partial<Record<"name" | "audience" | "body" | "template" | "schedule", string>>;

export function WaCampaignRoute({ id }: { id: string }) {
  const isNew = id === "new";
  const { data, isError } = useItem("whatsapp", id, !isNew);
  if (isNew) return <WaCampaignEditor key="new" campaign={null} />;
  if (isError)
    return (
      <PageShell>
        <Card>
          <EmptyState icon={WhatsappLogoIcon} title="This campaign doesn't exist" action={<Link href={WA_CAMPAIGNS_ROUTE} className="text-[13px] font-medium text-brand">Back to WhatsApp Campaigns</Link>} />
        </Card>
      </PageShell>
    );
  if (!data) return <EditorShellSkeleton />;
  return <WaCampaignEditor key={data.id} campaign={data} />;
}

function WaCampaignEditor({ campaign: c }: { campaign: WaCampaign | null }) {
  const router = useRouter();
  const { data: templates } = useItems("waTemplates");
  const create = useCreateItem("whatsapp");
  const update = useUpdateItem("whatsapp");
  const actions = useWaActions();
  const duplicate = useDuplicateItem("whatsapp");
  const locked = !!c && (c.status === "sent" || c.status === "sending");
  const [d, setD] = useState<Draft>(() => ({ name: c?.name ?? "", templateId: c?.templateId, header: c?.header ?? "", body: c?.body ?? "", footer: c?.footer ?? "", buttons: c?.buttons ?? [], audienceIds: c?.audienceIds ?? [] }));
  const [date, setDate] = useState(c?.scheduledAt?.slice(0, 10) ?? addDays(DEMO_TODAY, 1));
  const [time, setTime] = useState(c?.scheduledAt?.slice(11, 16) ?? "10:00");
  const [errors, setErrors] = useState<Errors>({});
  const [shown, setShown] = useState(false);
  const approved = (templates ?? []).filter((t) => t.status === "approved");
  const template = templates?.find((t) => t.id === d.templateId);
  const status = c?.status ?? "draft";

  const validate = (x: Draft, full: boolean): Errors => {
    const e: Errors = {};
    if (x.name.trim().length < 2) e.name = "Enter a campaign name (at least 2 characters)";
    if (!full) return e;
    if (!x.audienceIds.length) e.audience = "Select at least one list or segment";
    if (!x.templateId) e.template = "Choose an approved template — WhatsApp requires one for marketing messages";
    else if (template && template.status !== "approved") e.template = "This template isn't approved yet";
    if (x.body.trim().length < 10) e.body = "Write the message (at least 10 characters)";
    return e;
  };
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    const next = { ...d, [k]: v };
    setD(next);
    if (shown) setErrors(validate(next, true));
  };
  const applyTemplate = (id: string) => {
    const t = templates?.find((x) => x.id === id);
    if (!t) return set("templateId", undefined);
    const next = { ...d, templateId: t.id, header: t.header ?? "", body: t.body, footer: t.footer ?? "", buttons: [...t.buttons] };
    setD(next);
    if (shown) setErrors(validate(next, true));
  };

  const persist = async (patch: Partial<WaCampaign>, message: string) => {
    try {
      const body = { ...d, name: d.name.trim(), buttons: d.buttons.map((b) => b.trim()).filter(Boolean), ...patch };
      const saved = c ? await update.mutateAsync({ id: c.id, patch: body, note: patch.status === "scheduled" ? `Scheduled for ${formatDateTime(patch.scheduledAt!)}` : undefined }) : await create.mutateAsync({ status: "draft", audience: "", recipients: 0, ...body } as never);
      toast.success(message, { description: `${saved.name} · ${pluralize(saved.recipients, "recipient")} · demo only, nothing is sent` });
      if (!c) router.replace(waCampaignHref(saved.id));
    } catch (e) {
      if (e instanceof ApiError && e.field === "name") setErrors({ name: e.message });
      else toast.error("Couldn't save", { description: (e as Error).message });
    }
  };

  const saveDraft = () => {
    const e = validate(d, false);
    setErrors(e);
    if (Object.keys(e).length) return;
    void persist(c?.status === "scheduled" || c?.status === "paused" ? {} : { status: "draft" }, c ? "Changes saved" : "Draft saved");
  };

  const schedule = () => {
    setShown(true);
    const e = validate(d, true);
    const at = `${date}T${time}:00`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) e.schedule = "Choose a send date and time";
    else if (at <= demoNow()) e.schedule = "Choose a time in the future";
    setErrors(e);
    if (Object.keys(e).length) return void toast.error(`Fix ${pluralize(Object.keys(e).length, "issue")} before scheduling`);
    void persist({ status: "scheduled", scheduledAt: at }, c?.status === "scheduled" ? "Campaign rescheduled" : "Campaign scheduled");
  };

  const saving = create.isPending || update.isPending;
  const issues = Object.keys(validate(d, true)).length;

  return (
    <EditorPage>
      <EditorHeader
        backHref={WA_CAMPAIGNS_ROUTE}
        backLabel="Back to WhatsApp Campaigns"
        name={d.name}
        onName={locked ? undefined : (v) => set("name", v)}
        nameLabel="Campaign name"
        placeholder="Untitled WhatsApp campaign"
        nameError={errors.name}
        pill={<Pill fg={WA_STATUS[status].fg} bg={WA_STATUS[status].bg}>{WA_STATUS[status].label}</Pill>}
        meta={c ? (c.sentAt ? `Sent ${formatDateTime(c.sentAt)}` : c.scheduledAt && status !== "draft" ? `Sends ${formatDateTime(c.scheduledAt)}` : `Last saved ${formatDateTime(c.updatedAt)}`) : "Not saved yet"}
        actions={
          locked ? (
            <button type="button" className={headerOutlineClass} onClick={() => duplicate.mutate(c!.id, { onSuccess: (x) => (toast.success("Campaign duplicated", { description: `${x.name} · draft` }), router.push(waCampaignHref(x.id))) })} disabled={duplicate.isPending}>
              <CopyIcon size={15} aria-hidden /> Duplicate
            </button>
          ) : (
            <>
              <span className={cn("inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-3.5 text-[14px] font-medium", issues ? "border-[#F0A8A4] text-[#D92D20]" : "border-[#BFE5D6] text-[var(--success)]")}>
                {issues ? <WarningCircleIcon size={18} aria-hidden /> : <CheckCircleIcon size={18} aria-hidden />}
                {issues} {issues === 1 ? "Error" : "Errors"}
              </span>
              <button type="button" className={headerOutlineClass} onClick={saveDraft} disabled={saving}>
                {saving ? "Saving…" : "Save Draft"}
              </button>
              <button type="button" className={headerPrimaryClass} onClick={schedule} disabled={saving}>
                <CalendarCheckIcon size={16} aria-hidden /> {status === "scheduled" ? "Reschedule" : "Schedule"}
              </button>
            </>
          )
        }
      />
      <EditorColumns
        left={
          <>
            {locked && c && <ResultsCard c={c} />}
            <RecipientsCard campaign={{ type: "sms" }} topic="Marketing" audienceIds={d.audienceIds} onTopic={() => undefined} onAudience={(ids) => set("audienceIds", ids)} error={errors.audience} disabled={locked} />
            <EditorCard icon={ChatTextIcon} title="Message">
              <div className="pb-4">
                <EditorRow label="Template" required htmlFor="wa-template" error={errors.template}>
                  <div className="grid w-full gap-1">
                    <select id="wa-template" value={d.templateId ?? ""} disabled={locked} onChange={(e) => applyTemplate(e.target.value)} aria-invalid={errors.template ? true : undefined} className={cn(fieldClass, "h-11 text-[13.5px]")}>
                      <option value="">Choose an approved template…</option>
                      {approved.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                      {template && template.status !== "approved" && <option value={template.id}>{template.name} (not approved)</option>}
                    </select>
                    <Link href={WA_TEMPLATES_ROUTE} className="w-fit text-[12px] font-medium text-campaign-action hover:underline">
                      Manage WhatsApp templates
                    </Link>
                  </div>
                </EditorRow>
                <EditorRow label="Header" htmlFor="wa-header">
                  <InlineInput id="wa-header" value={d.header ?? ""} onChange={(e) => set("header", e.target.value)} maxLength={WA_LIMITS.header} placeholder="Optional bold first line" disabled={locked} />
                </EditorRow>
                <EditorRow label="Message" required htmlFor="wa-body" error={errors.body} className="sm:items-start [&>label]:sm:pt-3">
                  <MessageEditor id="wa-body" value={d.body} onChange={(v) => set("body", v)} max={WA_LIMITS.body} invalid={!!errors.body} placeholder="Hi {{first_name}}, …" disabled={locked} />
                </EditorRow>
                <EditorRow label="Footer" htmlFor="wa-footer">
                  <InlineInput id="wa-footer" value={d.footer ?? ""} onChange={(e) => set("footer", e.target.value)} maxLength={WA_LIMITS.footer} placeholder="Reply STOP to opt out" disabled={locked} />
                </EditorRow>
                <ButtonsRow buttons={d.buttons} onChange={(b) => set("buttons", b)} disabled={locked} />
              </div>
            </EditorCard>
            {!locked && (
              <EditorCard icon={CalendarCheckIcon} title="Schedule">
                <div className="pb-4">
                  <EditorRow label="Send on" required htmlFor="wa-date" error={errors.schedule}>
                    <div className="flex w-full flex-wrap gap-2">
                      <input id="wa-date" type="date" min={DEMO_TODAY} value={date} onChange={(e) => setDate(e.target.value)} className={cn(fieldClass, "h-11 w-[170px]")} />
                      <input aria-label="Send time" type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} className={cn(fieldClass, "h-11 w-[130px]")} />
                    </div>
                  </EditorRow>
                  <p className="px-5 text-[12px] text-ink-muted">Times use your local time zone. Nothing is sent from this demo.</p>
                </div>
              </EditorCard>
            )}
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
      {c && actions.element(() => router.push(WA_CAMPAIGNS_ROUTE))}
    </EditorPage>
  );
}

function ResultsCard({ c }: { c: WaCampaign }) {
  const rows = [
    { label: "Sent", value: c.sent ?? 0, note: `of ${formatNumber(c.recipients)}` },
    { label: "Delivered", value: c.delivered ?? 0, note: formatPercent(pct(c.delivered ?? 0, c.sent ?? 0)) },
    { label: "Read", value: c.read ?? 0, note: formatPercent(pct(c.read ?? 0, c.delivered ?? 0)) },
    { label: "Replied", value: c.replied ?? 0, note: formatPercent(pct(c.replied ?? 0, c.read ?? 0)) },
    { label: "Button clicks", value: c.clicks ?? 0, note: formatPercent(pct(c.clicks ?? 0, c.read ?? 0)) },
    { label: "Failed", value: c.failed ?? 0, note: formatPercent(pct(c.failed ?? 0, c.sent ?? 0)) },
  ];
  return (
    <EditorCard icon={WhatsappLogoIcon} title={c.status === "sending" ? "Results so far" : "Results"}>
      <div className="grid grid-cols-2 gap-3 px-5 pb-5 sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.label} className="rounded-xl border border-line-soft bg-campaign-surface/60 p-3">
            <p className="text-[12px] text-ink-muted">{r.label}</p>
            <p className="text-[18px] leading-7 font-semibold text-campaign-depth tabular-nums">{formatNumber(r.value)}</p>
            <p className="text-[12px] text-[var(--ch-sms-fg)]">{r.note}</p>
          </div>
        ))}
      </div>
      <p className="px-5 pb-4 text-[12px] text-ink-muted">Content is locked once a campaign starts sending. Duplicate it to send a variation.</p>
    </EditorCard>
  );
}

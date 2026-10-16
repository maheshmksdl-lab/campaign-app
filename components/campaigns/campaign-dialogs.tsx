"use client";

import { useState } from "react";
import { ChatCircleDotsIcon, EnvelopeSimpleIcon, LockSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Badge, fieldClass, FormField, OutlineButton, StatusBadge, TypeIcon } from "@/components/shared/campaign-ui";
import { ChoiceField, FormDialog, SESSION_NOTE, TextAreaField, TextField, useZodForm } from "@/components/shared/form-kit";
import { useAudiences, useCreateCampaign, useScheduleCampaign, useUpdateCampaign } from "@/hooks/use-campaigns";
import { contentLocked, isSms, smsSegments, TYPE_META } from "@/lib/campaign-meta";
import { addDays, formatDateTime, formatNumber } from "@/lib/format";
import { CURRENT_USER, DEMO_TODAY } from "@/lib/mock-data/campaigns";
import { createCampaignSchema, editCampaignSchema, scheduleSchema, SMS_MAX, type CreateCampaignValues, type EditCampaignValues, type ScheduleValues } from "@/lib/schemas/campaign";
import type { Campaign } from "@/lib/types/campaigns";
import { cn } from "@/lib/utils";

function useAudienceOptions() {
  const { data } = useAudiences();
  return (data ?? []).map((a) => ({ value: a.id, label: `${a.name} · ${formatNumber(a.size)}` }));
}

function SmsCounter({ text }: { text: string }) {
  const n = [...text].length;
  const seg = smsSegments(text);
  return (
    <span className="tabular-nums">
      {n}/{SMS_MAX} characters · {seg || 0} SMS segment{seg === 1 ? "" : "s"}
    </span>
  );
}

// ── Create ───────────────────────────────────────────────────────────

/** Frontend-only "new campaign" form: saves a draft to the browser's demo store. */
export function CreateCampaignDialog({ open, onOpenChange, initialType = "email", onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; initialType?: "email" | "sms"; onCreated?: (c: Campaign) => void }) {
  return open ? <CreateForm onOpenChange={onOpenChange} initialType={initialType} onCreated={onCreated} /> : null;
}

function CreateForm({ onOpenChange, initialType, onCreated }: { onOpenChange: (o: boolean) => void; initialType: "email" | "sms"; onCreated?: (c: Campaign) => void }) {
  const audiences = useAudienceOptions();
  const create = useCreateCampaign();
  const form = useZodForm<CreateCampaignValues>(createCampaignSchema, { name: "", type: initialType, subject: "", message: "", audienceId: initialType === "sms" ? "aud-sms" : "" }, "new-campaign");
  const sms = form.values.type === "sms";

  const submit = form.handleSubmit(async (v) => {
    const c = await create.mutateAsync({ name: v.name, type: v.type, subject: v.subject, message: v.message, audienceId: v.audienceId });
    onOpenChange(false);
    toast.success("Draft saved", { description: `${c.name} · ${SESSION_NOTE}` });
    onCreated?.(c);
  });

  return (
    <FormDialog open onOpenChange={onOpenChange} title="Create campaign" description="Start with the basics. You can edit content and schedule the send later." onSubmit={submit} submitLabel="Save as Draft" saving={form.saving} note="Saved as a draft — nothing is sent.">
      <TextField form={form} name="name" label="Campaign name" required placeholder="e.g. June Newsletter" className="sm:col-span-2" autoFocus maxLength={100} />
      <fieldset className="grid gap-1.5 sm:col-span-2">
        <legend className="mb-1.5 text-field-label text-ink-body">
          Campaign type<span className="ml-0.5 text-[#DC2626]" aria-hidden>*</span>
        </legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Campaign type">
          {(["email", "sms"] as const).map((t) => {
            const m = TYPE_META[t];
            const on = form.values.type === t;
            const IconCmp = t === "email" ? EnvelopeSimpleIcon : ChatCircleDotsIcon;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={on}
                id={t === "email" ? form.id("type") : undefined}
                onClick={() => form.setValues({ ...form.values, type: t, audienceId: t === "sms" && !form.values.audienceId ? "aud-sms" : form.values.audienceId })}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-brand-action",
                  on ? "border-brand-soft bg-brand-surface ring-1 ring-brand-soft" : "border-line bg-white hover:border-[#D7D1E3]",
                )}
              >
                <span className="inline-flex size-9 items-center justify-center rounded-lg" style={{ color: m.fg, backgroundColor: m.bg }} aria-hidden>
                  <IconCmp size={19} />
                </span>
                <span>
                  <span className="block text-[13.5px] font-semibold text-ink">{m.label}</span>
                  <span className="block text-[12px] leading-4 text-ink-muted">{t === "email" ? "Newsletters, offers, updates" : "Short texts with a link"}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>
      {sms ? (
        <TextAreaField form={form} name="message" label="Message" hint={<SmsCounter text={form.values.message} />} placeholder="EVOQ: … Reply STOP to opt out" maxLength={SMS_MAX} className="sm:col-span-2" />
      ) : (
        <TextField form={form} name="subject" label="Subject line" required placeholder="What will make people open it?" className="sm:col-span-2" maxLength={150} />
      )}
      <ChoiceField form={form} name="audienceId" label="Audience" required options={audiences} placeholder="Choose a list or segment" className="sm:col-span-2" />
    </FormDialog>
  );
}

// ── Edit ─────────────────────────────────────────────────────────────

export function EditCampaignDialog({ campaign, onOpenChange }: { campaign: Campaign | null; onOpenChange: (o: boolean) => void }) {
  return campaign ? <EditForm key={campaign.id} campaign={campaign} onOpenChange={onOpenChange} /> : null;
}

function EditForm({ campaign: c, onOpenChange }: { campaign: Campaign; onOpenChange: (o: boolean) => void }) {
  const audiences = useAudienceOptions();
  const update = useUpdateCampaign();
  const locked = contentLocked(c);
  const sms = isSms(c);
  const form = useZodForm<EditCampaignValues>(
    editCampaignSchema,
    {
      name: c.name,
      type: c.type,
      locked,
      subject: c.subject ?? "",
      previewText: c.previewText ?? "",
      message: c.message ?? "",
      senderName: c.senderName,
      senderEmail: c.senderEmail ?? "",
      audienceId: c.audienceId,
    },
    `edit-${c.id}`,
  );

  const submit = form.handleSubmit(async (v) => {
    if (!form.dirty) {
      onOpenChange(false);
      return;
    }
    await update.mutateAsync({
      id: c.id,
      edit: locked ? { name: v.name } : sms ? { name: v.name, message: v.message, audienceId: v.audienceId } : { name: v.name, subject: v.subject, previewText: v.previewText, senderName: v.senderName, senderEmail: v.senderEmail, audienceId: v.audienceId },
    });
    onOpenChange(false);
    toast.success("Campaign updated", { description: `${v.name} · ${SESSION_NOTE}` });
  });

  return (
    <FormDialog open onOpenChange={onOpenChange} title="Edit campaign" description={`${TYPE_META[c.type].label} campaign`} onSubmit={submit} submitLabel="Save changes" saving={form.saving} wide={!sms && !locked}>
      {locked && (
        <p className="flex items-start gap-2 rounded-lg bg-campaign-muted px-3 py-2 text-[12.5px] leading-5 text-ink-body sm:col-span-2">
          <LockSimpleIcon size={16} aria-hidden className="mt-0.5 shrink-0 text-ink-muted" />
          This campaign has already gone out, so its content and audience are locked. You can still rename it.
        </p>
      )}
      <TextField form={form} name="name" label="Campaign name" required className="sm:col-span-2" maxLength={100} />
      {!locked &&
        (sms ? (
          <TextAreaField form={form} name="message" label="Message" required rows={4} hint={<SmsCounter text={form.values.message} />} maxLength={SMS_MAX} className="sm:col-span-2" />
        ) : (
          <>
            <TextField form={form} name="subject" label="Subject line" required className="sm:col-span-2" maxLength={150} />
            <TextField form={form} name="previewText" label="Preview text" hint="Shown after the subject in most inboxes." className="sm:col-span-2" maxLength={150} />
            <TextField form={form} name="senderName" label="Sender name" required maxLength={60} />
            <TextField form={form} name="senderEmail" label="Sender email" required type="email" />
          </>
        ))}
      {!locked && <ChoiceField form={form} name="audienceId" label="Audience" required options={audiences} className="sm:col-span-2" />}
    </FormDialog>
  );
}

// ── Schedule ─────────────────────────────────────────────────────────

export function ScheduleDialog({ campaign, onOpenChange }: { campaign: Campaign | null; onOpenChange: (o: boolean) => void }) {
  return campaign ? <ScheduleForm key={campaign.id} campaign={campaign} onOpenChange={onOpenChange} /> : null;
}

function ScheduleForm({ campaign: c, onOpenChange }: { campaign: Campaign; onOpenChange: (o: boolean) => void }) {
  const schedule = useScheduleCampaign();
  const existing = c.scheduledAt && c.status !== "draft" ? c.scheduledAt : undefined;
  const planned = c.scheduledAt && c.scheduledAt.slice(0, 10) > DEMO_TODAY ? c.scheduledAt.slice(0, 10) : addDays(DEMO_TODAY, 1);
  const form = useZodForm<ScheduleValues>(scheduleSchema, { date: existing?.slice(0, 10) ?? planned, time: existing?.slice(11, 16) ?? "09:00" }, `schedule-${c.id}`);

  const submit = form.handleSubmit(async (v) => {
    const at = `${v.date}T${v.time}:00`;
    await schedule.mutateAsync({ id: c.id, at });
    onOpenChange(false);
    toast.success(existing ? "Campaign rescheduled" : "Campaign scheduled", { description: `${c.name} · ${formatDateTime(at)} · demo only, nothing will be sent` });
  });

  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      title={existing ? "Reschedule campaign" : "Schedule campaign"}
      description={
        <>
          <span className="font-medium text-ink-body">{c.name}</span> goes to {formatNumber(c.recipients)} {isSms(c) ? "phone numbers" : "contacts"} in {c.audience}.
        </>
      }
      onSubmit={submit}
      submitLabel={existing ? "Reschedule" : "Schedule"}
      saving={form.saving}
      note="Times use your local time zone."
    >
      {existing && (
        <p className="rounded-lg bg-campaign-muted px-3 py-2 text-[12.5px] text-ink-body sm:col-span-2">
          Currently scheduled for <span className="font-medium text-ink">{formatDateTime(existing)}</span>
        </p>
      )}
      <FormField label="Send date" htmlFor={form.id("date")} error={form.errors.date} required>
        <input id={form.id("date")} type="date" min={DEMO_TODAY} value={form.values.date} onChange={(e) => form.set("date", e.target.value)} aria-invalid={form.errors.date ? true : undefined} className={fieldClass} />
      </FormField>
      <FormField label="Send time" htmlFor={form.id("time")} error={form.errors.time} required>
        <input id={form.id("time")} type="time" step={900} value={form.values.time} onChange={(e) => form.set("time", e.target.value)} aria-invalid={form.errors.time ? true : undefined} className={fieldClass} />
      </FormField>
    </FormDialog>
  );
}

// ── Preview ──────────────────────────────────────────────────────────

const ctaFor = (name: string) => (/sale|deal|offer|flash|easter|black friday|gift/i.test(name) ? "Shop the sale" : /webinar/i.test(name) ? "Save my seat" : /survey|feedback/i.test(name) ? "Take the survey" : /product|feature|launch|tips|update/i.test(name) ? "See what's new" : "Read more");

function EmailPreview({ c }: { c: Campaign }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <dl className="space-y-1 border-b border-line-soft bg-campaign-muted px-4 py-3 text-[12.5px]">
        <div className="flex gap-2">
          <dt className="w-14 shrink-0 text-ink-muted">From</dt>
          <dd className="min-w-0 truncate text-ink">
            {c.senderName} &lt;{c.senderEmail}&gt;
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-14 shrink-0 text-ink-muted">To</dt>
          <dd className="min-w-0 truncate text-ink-body">
            {c.audience} · {formatNumber(c.recipients)} contacts
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-14 shrink-0 text-ink-muted">Subject</dt>
          <dd className="min-w-0 font-semibold text-ink">{c.subject || <span className="font-normal text-ink-faint">No subject yet</span>}</dd>
        </div>
        {c.previewText && (
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 text-ink-muted">Preview</dt>
            <dd className="min-w-0 text-ink-body">{c.previewText}</dd>
          </div>
        )}
      </dl>
      <div className="max-h-[46vh] overflow-y-auto bg-[#F4F2F8] p-4 scrollbar-thin sm:p-6">
        <article className="mx-auto max-w-[520px] overflow-hidden rounded-lg bg-white shadow-card">
          <div className="bg-gradient-hero px-6 py-7 text-white">
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase opacity-80">{c.senderName}</p>
            <h3 className="mt-2 text-[21px] leading-7 font-semibold">{c.subject || c.name}</h3>
          </div>
          <div className="space-y-3 px-6 py-6 text-[14px] leading-[22px] text-ink-body">
            <p>Hi {"{{first_name}}"},</p>
            <p>{c.previewText || "We put together something we think you'll like. Here's a quick look at what's new and why it matters to you."}</p>
            <p>As always, thanks for being part of the {c.senderName} community — we read every reply.</p>
            <p className="pt-2">
              <span className="inline-flex h-10 items-center rounded-lg bg-brand px-5 text-[14px] font-semibold text-white">{ctaFor(c.name)}</span>
            </p>
            <p className="pt-2 text-[13px] text-ink-muted">— The {c.senderName} team</p>
          </div>
          <footer className="border-t border-line-soft px-6 py-4 text-center text-[11.5px] leading-4 text-ink-muted">
            You&apos;re receiving this because you subscribed to {c.audience}.<br />
            <span className="underline">Unsubscribe</span> · <span className="underline">Update preferences</span>
          </footer>
        </article>
      </div>
    </div>
  );
}

function SmsPreview({ c }: { c: Campaign }) {
  const text = c.message ?? "";
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-full max-w-[300px] rounded-[30px] border-[6px] border-[#2B2540] bg-[#F7F6FA] p-3 shadow-pop">
        <p className="mb-3 text-center text-[11px] font-medium text-ink-muted">{c.senderId}</p>
        <div className="min-h-[160px]">
          {text ? (
            <p className="max-w-[88%] rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[13.5px] leading-5 break-words text-ink shadow-card">{text}</p>
          ) : (
            <p className="pt-8 text-center text-[12.5px] text-ink-faint">No message written yet</p>
          )}
        </div>
      </div>
      {text && (
        <p className="text-[12px] text-ink-muted">
          <SmsCounter text={text} />
        </p>
      )}
    </div>
  );
}

export function PreviewDialog({ campaign: c, onOpenChange, onEdit }: { campaign: Campaign | null; onOpenChange: (o: boolean) => void; onEdit?: (c: Campaign) => void }) {
  return (
    <Dialog open={!!c} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(780px,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {c && (
          <>
            <div className="flex items-start gap-3 border-b border-line-soft px-5 pt-5 pb-4">
              <TypeIcon type={c.type} size={36} />
              <div className="min-w-0 flex-1 pr-8">
                <DialogTitle className="truncate text-[17px] font-semibold text-ink">Preview · {c.name}</DialogTitle>
                <DialogDescription className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-muted">
                  <StatusBadge status={c.status} />
                  Sample content with merge tags — what recipients see may vary by inbox.
                </DialogDescription>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">{isSms(c) ? <SmsPreview c={c} /> : <EmailPreview c={c} />}</div>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line-soft bg-campaign-muted px-5 py-3">
              <Badge fg="var(--ink-muted)" bg="white" className="mr-auto border border-line">
                Signed in as {CURRENT_USER.name}
              </Badge>
              {onEdit && !contentLocked(c) && c.status !== "archived" && (
                <OutlineButton
                  onClick={() => {
                    onOpenChange(false);
                    onEdit(c);
                  }}
                >
                  Edit
                </OutlineButton>
              )}
              <OutlineButton onClick={() => onOpenChange(false)}>Close</OutlineButton>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Local open/close state for the create dialog with a preset type. */
export function useCreateDialog() {
  const [state, setState] = useState<{ open: boolean; type: "email" | "sms" }>({ open: false, type: "email" });
  return {
    open: (type: "email" | "sms" = "email") => setState({ open: true, type }),
    props: { open: state.open, initialType: state.type, onOpenChange: (o: boolean) => setState((s) => ({ ...s, open: o })) },
  };
}

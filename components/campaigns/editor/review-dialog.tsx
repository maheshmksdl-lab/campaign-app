"use client";

import { useState, type ReactNode } from "react";
import { CalendarCheckIcon, CheckCircleIcon, FloppyDiskIcon } from "@phosphor-icons/react/dist/ssr";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { fieldClass, OutlineButton, PrimaryButton } from "@/components/shared/campaign-ui";
import { EmailThumb } from "@/components/shared/email-ui";
import { useAudienceEstimate } from "@/hooks/use-audience";
import { useAudiences } from "@/hooks/use-campaigns";
import { canSchedule, isSms } from "@/lib/campaign-meta";
import type { CampaignDraft } from "@/lib/content-session";
import { addDays, formatDateTime, formatNumber } from "@/lib/format";
import { DEMO_TODAY } from "@/lib/mock-data/campaigns";
import type { Campaign } from "@/lib/types/campaigns";
import { cn } from "@/lib/utils";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 border-b border-line-soft py-2.5 text-[13px] leading-5 last:border-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  );
}

export function ReviewDialog({
  open,
  onOpenChange,
  campaign: c,
  draft,
  saving,
  onSaveDraft,
  onSchedule,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  campaign: Campaign;
  draft: CampaignDraft;
  saving: boolean;
  onSaveDraft: () => void;
  onSchedule: (at: string) => void;
}) {
  const sms = isSms(c);
  const { data: audiences } = useAudiences();
  const chosen = (audiences ?? []).filter((a) => draft.audienceIds.includes(a.id));
  const { data: estimate } = useAudienceEstimate(
    { listIds: chosen.filter((a) => a.kind !== "segment").map((a) => a.id), segmentIds: chosen.filter((a) => a.kind === "segment").map((a) => a.id) },
    open && chosen.length > 0,
  );
  const existing = c.status !== "draft" && c.scheduledAt ? c.scheduledAt : undefined;
  const [date, setDate] = useState(existing?.slice(0, 10) ?? (c.scheduledAt && c.scheduledAt.slice(0, 10) > DEMO_TODAY ? c.scheduledAt.slice(0, 10) : addDays(DEMO_TODAY, 1)));
  const [time, setTime] = useState(existing?.slice(11, 16) ?? "09:00");
  const [dateError, setDateError] = useState("");
  const schedulable = canSchedule(c);

  const schedule = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return setDateError("Choose a send date and time");
    if (date < DEMO_TODAY) return setDateError("Choose a date in the future");
    setDateError("");
    onSchedule(`${date}T${time}:00`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(820px,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <div className="flex items-start gap-3 border-b border-line-soft px-5 pt-5 pb-4 pr-12">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--success-bg)] text-[var(--success)]" aria-hidden>
            <CheckCircleIcon size={20} weight="fill" />
          </span>
          <div className="min-w-0">
            <DialogTitle className="text-[17px] font-semibold text-ink">Review and launch</DialogTitle>
            <DialogDescription className="mt-0.5 text-[13px] text-ink-muted">Everything checks out. Review the details, then save or schedule — this demo never sends real messages.</DialogDescription>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto px-5 py-4 scrollbar-thin md:grid-cols-[minmax(0,1fr)_220px]">
          <dl>
            <Row label="Campaign">{draft.name}</Row>
            <Row label="Recipients">
              {chosen.map((a) => a.name).join(", ")}
              <span className="block text-[12px] text-ink-muted">{estimate ? `≈ ${formatNumber(estimate.eligible)} ${sms ? "phone numbers" : "contacts"} will receive it` : "Estimating…"}</span>
            </Row>
            <Row label="Topic">{draft.topic}</Row>
            {sms ? (
              <Row label="Message">{draft.message}</Row>
            ) : (
              <>
                <Row label="From">
                  {draft.senderName} &lt;{draft.senderEmail}&gt;
                </Row>
                <Row label="Reply-to">{draft.replyTo}</Row>
                <Row label="Subject">
                  {draft.subject}
                  {draft.previewText && <span className="block text-[12px] text-ink-muted">{draft.previewText}</span>}
                </Row>
                <Row label="Content">{draft.contentSource || "Custom content"}</Row>
                <Row label="Tracking">{[draft.trackOpens && "Opens", draft.trackClicks && "Clicks", draft.trackReplies && "Replies"].filter(Boolean).join(", ") || "Off"}</Row>
                {draft.attachments.length > 0 && <Row label="Attachments">{draft.attachments.map((a) => a.name).join(", ")}</Row>}
              </>
            )}
          </dl>
          {!sms && draft.content && (
            <div className="hidden overflow-hidden rounded-lg border border-line md:block">
              <EmailThumb content={draft.content} className="h-[300px] w-full" />
            </div>
          )}
        </div>

        <div className="border-t border-line-soft bg-campaign-muted px-5 py-4">
          {schedulable ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1">
                <label htmlFor="review-date" className="text-field-label text-ink-body">
                  Send date
                </label>
                <input id="review-date" type="date" min={DEMO_TODAY} value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={dateError ? true : undefined} className={cn(fieldClass, "w-[160px]")} />
              </div>
              <div className="grid gap-1">
                <label htmlFor="review-time" className="text-field-label text-ink-body">
                  Time
                </label>
                <input id="review-time" type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} className={cn(fieldClass, "w-[120px]")} />
              </div>
              <div className="ml-auto flex flex-wrap gap-2">
                <OutlineButton icon={FloppyDiskIcon} onClick={onSaveDraft} disabled={saving}>
                  Save Draft
                </OutlineButton>
                <PrimaryButton icon={CalendarCheckIcon} onClick={schedule} disabled={saving}>
                  {saving ? "Working…" : existing ? "Reschedule Campaign" : "Schedule Campaign"}
                </PrimaryButton>
              </div>
              {dateError ? (
                <p role="alert" className="w-full text-[12px] font-medium text-[#DC2626]">
                  {dateError}
                </p>
              ) : (
                existing && <p className="w-full text-[12px] text-ink-muted">Currently scheduled for {formatDateTime(existing)}. Times use your local time zone.</p>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <p className="mr-auto text-[12.5px] text-ink-muted">Automations and journeys start from their trigger — save the changes to keep them.</p>
              <PrimaryButton icon={FloppyDiskIcon} onClick={onSaveDraft} disabled={saving}>
                Save changes
              </PrimaryButton>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

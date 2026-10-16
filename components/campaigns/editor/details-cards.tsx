"use client";

import { useRef, type ReactNode } from "react";
import { ChatCircleDotsIcon, EnvelopeSimpleIcon, GearSixIcon, PaperclipIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { Switch } from "@/components/shared/email-ui";
import type { CampaignDraft } from "@/lib/content-session";
import { smsSegments } from "@/lib/campaign-meta";
import { CURRENT_USER, DEFAULT_SENDER } from "@/lib/mock-data/campaigns";
import { SMS_MAX } from "@/lib/schemas/campaign";
import { cn } from "@/lib/utils";
import type { DraftErrors } from "./draft";
import { MessageEditor } from "@/components/whatsapp/wa-ui";
import { editorInputClass, EditorCard, EditorRow, EmailPickerInput, InlineInput, PersonalizedInput } from "./fields";

type Set = <K extends keyof CampaignDraft>(key: K, value: CampaignDraft[K]) => void;

/** Sender addresses offered in the From Email dropdown (any valid address can be typed). */
const KNOWN_SENDERS = [DEFAULT_SENDER.email, CURRENT_USER.email, "news@evoqsolutions.com", "support@evoqsolutions.com"];
const PERSONALIZE_HINT = "Type @ to add personalization and : to insert emojis";

export function EmailDetailsCard({ draft, set, errors, disabled }: { draft: CampaignDraft; set: Set; errors: DraftErrors; disabled?: boolean }) {
  return (
    <EditorCard id="email-details" icon={EnvelopeSimpleIcon} title="Email Details">
      <div className="pb-4">
        <datalist id="known-senders">
          {KNOWN_SENDERS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <EditorRow label="From Email" required htmlFor="f-senderEmail" error={errors.senderEmail}>
          <EmailPickerInput id="f-senderEmail" type="email" options={KNOWN_SENDERS} value={draft.senderEmail} onChange={(v) => set("senderEmail", v)} invalid={!!errors.senderEmail} placeholder="name@yourdomain.com" disabled={disabled} autoComplete="off" />
        </EditorRow>
        <EditorRow label="From Name" required htmlFor="f-senderName" error={errors.senderName}>
          <InlineInput id="f-senderName" value={draft.senderName} onChange={(e) => set("senderName", e.target.value)} invalid={!!errors.senderName} placeholder="Your name" maxLength={60} disabled={disabled} />
        </EditorRow>
        <EditorRow label="Reply-to" required htmlFor="f-replyTo" error={errors.replyTo}>
          <InlineInput id="f-replyTo" type="email" list="known-senders" value={draft.replyTo} onChange={(e) => set("replyTo", e.target.value)} invalid={!!errors.replyTo} placeholder="name@yourdomain.com" disabled={disabled} autoComplete="off" />
        </EditorRow>
        <EditorRow label="Subject" required htmlFor="f-subject" error={errors.subject}>
          <PersonalizedInput id="f-subject" value={draft.subject} onChange={(v) => set("subject", v)} invalid={!!errors.subject} placeholder={PERSONALIZE_HINT} maxLength={150} />
        </EditorRow>
        <EditorRow label="Preheader" htmlFor="f-previewText" error={errors.previewText}>
          <PersonalizedInput id="f-previewText" value={draft.previewText} onChange={(v) => set("previewText", v)} invalid={!!errors.previewText} placeholder={PERSONALIZE_HINT} maxLength={150} />
        </EditorRow>
      </div>
    </EditorCard>
  );
}

export function SmsDetailsCard({ draft, set, errors, senderId }: { draft: CampaignDraft; set: Set; errors: DraftErrors; senderId?: string }) {
  const n = [...draft.message].length;
  const seg = smsSegments(draft.message);
  return (
    <EditorCard id="sms-details" icon={ChatCircleDotsIcon} title="SMS Details">
      <div className="pb-4">
        <EditorRow label="Sender ID">
          <span className={cn(editorInputClass, "flex items-center justify-between gap-3 bg-campaign-muted")}>
            <span>{senderId ?? DEFAULT_SENDER.smsId}</span>
            <span className="truncate text-[12px] text-ink-muted">Registered sender</span>
          </span>
        </EditorRow>
        <EditorRow label="Message" required htmlFor="f-message" error={errors.message} className="sm:items-start [&>label]:sm:pt-3">
          <div className="w-full">
            <MessageEditor id="f-message" value={draft.message} onChange={(v) => set("message", v)} max={SMS_MAX} invalid={!!errors.message} rows={5} placeholder="EVOQ: … Reply STOP to opt out" />
            <p className="mt-1 text-[12px] text-ink-muted tabular-nums">
              {seg || 0} SMS segment{seg === 1 ? "" : "s"} · 160 characters fit in one, 153 each when split{n > 0 && /{{/.test(draft.message) ? " · personalization adds a few characters per contact" : ""}
            </p>
          </div>
        </EditorRow>
      </div>
    </EditorCard>
  );
}

const MAX_ATTACH_BYTES = 10 * 1024 * 1024;
const fileSize = (b: number) => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

function ConfigRow({ title, description, children, className }: { title: string; description: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line-soft px-5 py-4 first:border-t-0", className)}>
      <div className="min-w-0 flex-1 basis-[240px]">
        <p className="text-[14px] leading-5 font-medium text-campaign-depth">{title}</p>
        <p className="mt-1 text-[13px] leading-[18px] text-ink-muted">{description}</p>
      </div>
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  );
}

export function OtherConfigCard({ draft, set, sms }: { draft: CampaignDraft; set: Set; sms: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const total = draft.attachments.reduce((s, a) => s + a.size, 0);

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    let size = total;
    const next = [...draft.attachments];
    for (const f of Array.from(files)) {
      if (next.some((a) => a.name === f.name)) continue;
      if (size + f.size > MAX_ATTACH_BYTES) {
        toast.error("Attachments are limited to 10 MB in total", { description: `${f.name} wasn't added.` });
        continue;
      }
      size += f.size;
      next.push({ name: f.name, size: f.size });
    }
    set("attachments", next);
  };

  return (
    <EditorCard id="other-config" icon={GearSixIcon} title="Other Configuration">
      <div className="pb-1">
        {!sms && (
          <ConfigRow title="Track Replies" description="Automatically track and forward responses to your selected Reply-to address.">
            <Switch checked={draft.trackReplies} onChange={(v) => set("trackReplies", v)} label="Track replies" />
          </ConfigRow>
        )}
        {!sms && (
          <ConfigRow title="Track Opens" description="Count opens with an invisible pixel. Some inboxes block it, so opens are an estimate.">
            <Switch checked={draft.trackOpens} onChange={(v) => set("trackOpens", v)} label="Track opens" />
          </ConfigRow>
        )}
        <ConfigRow title="Track Link Clicks" description={sms ? "Shorten links so clicks show in the report." : "Wrap links so clicks show in the report, per link."}>
          <Switch checked={draft.trackClicks} onChange={(v) => set("trackClicks", v)} label="Track link clicks" />
        </ConfigRow>
        {!sms && (
          <ConfigRow title="File Attachments" description="Attach files to your email campaign — up to 10 MB in total.">
            <input
              ref={fileRef}
              type="file"
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-campaign-soft bg-white px-4 text-[14px] font-medium text-campaign-action transition-colors hover:border-campaign-action hover:bg-campaign-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-action"
            >
              <PaperclipIcon size={17} aria-hidden /> Attach Files
            </button>
          </ConfigRow>
        )}
        {!sms && draft.attachments.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 px-5 pb-4" aria-label="Attachments">
            {draft.attachments.map((a) => (
              <li key={a.name} className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-campaign-soft bg-campaign-surface py-1 pr-1 pl-2.5 text-[12.5px] text-ink-body">
                <PaperclipIcon size={13} aria-hidden className="shrink-0 text-campaign-action" />
                <span className="truncate">{a.name}</span>
                <span className="text-ink-muted">{fileSize(a.size)}</span>
                <button type="button" onClick={() => set("attachments", draft.attachments.filter((x) => x.name !== a.name))} aria-label={`Remove ${a.name}`} className="inline-flex size-5 items-center justify-center rounded text-ink-muted hover:bg-white hover:text-ink">
                  <XIcon size={11} weight="bold" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </EditorCard>
  );
}

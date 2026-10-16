"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, ChartBarIcon, CheckCircleIcon, DotsThreeIcon, EyeIcon, PaperPlaneRightIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog, OutlineButton } from "@/components/shared/campaign-ui";
import { RowMenu } from "@/components/shared/row-menu";
import { SESSION_NOTE } from "@/components/shared/form-kit";
import { useCreateDraftCampaign, useScheduleCampaign, useUpdateCampaign } from "@/hooks/use-campaigns";
import { useStoredState } from "@/hooks/use-stored-state";
import { ApiError } from "@/lib/api/campaigns";
import { demoNow } from "@/lib/api/store";
import { isSms, STATUS_META } from "@/lib/campaign-meta";
import { draftKey, NONE, pendingKey, type CampaignDraft, type PendingContent } from "@/lib/content-session";
import { formatDateTime, formatRelative, parseDateTime, pluralize } from "@/lib/format";
import { CURRENT_USER } from "@/lib/mock-data/campaigns";
import { campaignHref, getCampaignsListHref } from "@/lib/routes";
import type { Campaign } from "@/lib/types/campaigns";
import { cn } from "@/lib/utils";
import { useCampaignActions } from "../campaign-actions";
import { ContentCard, PreviewDialog } from "./content-card";
import { EmailDetailsCard, OtherConfigCard, SmsDetailsCard } from "./details-cards";
import { draftFromCampaign, editFromDraft, FIELD_ORDER, sameDraft, validateDraft, type DraftField } from "./draft";
import { RecipientsCard } from "./recipients-card";
import { ReviewDialog } from "./review-dialog";

const FIELD_TARGET: Record<DraftField, string> = {
  name: "f-name",
  audience: "audience-picker",
  senderEmail: "f-senderEmail",
  senderName: "f-senderName",
  replyTo: "f-replyTo",
  subject: "f-subject",
  previewText: "f-previewText",
  message: "f-message",
  content: "content",
};

/** "a few seconds ago", "12 minutes ago", then the shared relative format. */
function savedAgo(iso: string) {
  const now = demoNow();
  const mins = (parseDateTime(now).getTime() - parseDateTime(iso).getTime()) / 60_000;
  if (mins < 1) return "a few seconds ago";
  if (mins < 60) return `${Math.floor(mins)} minute${Math.floor(mins) === 1 ? "" : "s"} ago`;
  return formatRelative(iso, now).toLowerCase().replace(/^(\d+)h ago$/, "$1 hours ago").replace(/^(\d+)d ago$/, "$1 days ago");
}

/** Status pill: violet for drafts, the status tone otherwise. */
function StatusPill({ status }: { status: Campaign["status"] }) {
  const t = STATUS_META[status];
  const draft = status === "draft";
  return (
    <span className={cn("inline-flex h-7 shrink-0 items-center rounded-md px-2.5 text-[13px] font-medium", draft && "bg-campaign-tint text-campaign-primary")} style={draft ? undefined : { color: t.fg, backgroundColor: t.bg }}>
      {t.label}
    </span>
  );
}

/**
 * The full-page campaign editor (Recipients, Email Details, Other
 * Configuration, Content), for new and existing campaigns alike. Unsaved
 * changes are kept per campaign in this tab, so opening the Template Gallery
 * or the content editor and coming back never loses them; Save Draft writes
 * them (creating the campaign the first time), Cancel discards them.
 */
export function CampaignEditor({ campaign: c, isNew = false }: { campaign: Campaign; isNew?: boolean }) {
  const router = useRouter();
  const listHref = getCampaignsListHref();
  const actions = useCampaignActions({ onDeleted: () => router.push(listHref) });
  const createDraft = useCreateDraftCampaign();
  const update = useUpdateCampaign();
  const scheduleM = useScheduleCampaign();
  const sms = isSms(c);

  const [stored, setStored] = useStoredState<CampaignDraft | null>(draftKey(c.id), NONE, "session");
  const [pending, setPending] = useStoredState<PendingContent | null>(pendingKey(c.id), NONE, "session");
  const base = useMemo(() => draftFromCampaign(c), [c]);
  const draft = stored ?? base;
  const dirty = !!stored && !sameDraft(stored, base);

  const [showErrors, setShowErrors] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [nameError, setNameError] = useState("");

  const errors = validateDraft(draft, c);
  if (nameError) errors.name = nameError;
  const errorCount = Object.keys(errors).length;
  const shown = showErrors ? errors : {};

  const set = <K extends keyof CampaignDraft>(key: K, value: CampaignDraft[K]) => {
    if (key === "name") setNameError("");
    setStored({ ...draft, [key]: value });
  };

  // Content picked in the gallery or the content editor lands here.
  useEffect(() => {
    if (!pending) return;
    setStored({ ...(stored ?? base), content: pending.content, contentSource: pending.source });
    setPending(null);
    toast.success("Content added", { description: `${pending.source} · save the campaign to keep it` });
  }, [pending, stored, base, setStored, setPending]);

  const focusFirstError = () => {
    const first = FIELD_ORDER.find((f) => errors[f]);
    if (!first) return;
    const el = document.getElementById(FIELD_TARGET[first]);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (el && first !== "content") requestAnimationFrame(() => el.focus({ preventScroll: true }));
  };

  const revealErrors = () => {
    setShowErrors(true);
    requestAnimationFrame(focusFirstError);
  };

  /**
   * Writes the draft and returns the campaign id (null when it couldn't be
   * saved). A new campaign is created first; `open` then moves to its page.
   */
  const save = async ({ quiet = false, open = true } = {}): Promise<string | null> => {
    if (draft.name.trim().length < 3) {
      setShowErrors(true);
      setNameError("Enter a campaign name (at least 3 characters)");
      document.getElementById("f-name")?.focus();
      return null;
    }
    try {
      const id = isNew ? (await createDraft.mutateAsync({ type: sms ? "sms" : "email", name: draft.name })).id : c.id;
      await update.mutateAsync({ id, edit: editFromDraft(draft, c) });
      setStored(null);
      if (!quiet) toast.success(c.status === "draft" ? "Draft saved" : "Changes saved", { description: `${draft.name.trim()} · ${SESSION_NOTE}` });
      if (isNew && open) router.replace(campaignHref(id));
      return id;
    } catch (e) {
      if (e instanceof ApiError && e.field === "name") {
        setShowErrors(true);
        setNameError(e.message);
        document.getElementById("f-name")?.focus();
      } else toast.error("Couldn't save", { description: (e as Error).message });
      return null;
    }
  };

  const review = () => {
    if (errorCount) {
      revealErrors();
      toast.error(`Fix ${pluralize(errorCount, "issue")} before launching`, { description: "Fields that need attention are marked in red." });
      return;
    }
    setReviewing(true);
  };

  const schedule = async (at: string) => {
    const id = await save({ quiet: true, open: false });
    if (!id) return;
    try {
      await scheduleM.mutateAsync({ id, at });
      setReviewing(false);
      toast.success(c.status === "scheduled" ? "Campaign rescheduled" : "Campaign scheduled", { description: `${draft.name.trim()} · ${formatDateTime(at)} · demo only, nothing will be sent` });
    } catch (e) {
      toast.error("Couldn't schedule", { description: (e as Error).message });
    }
    if (isNew) router.replace(campaignHref(id));
  };

  const discard = () => {
    setStored(null);
    setNameError("");
    setShowErrors(false);
    setDiscarding(false);
    if (isNew) router.push(listHref);
    else toast.info("Changes discarded");
  };

  const lastBy = [...c.history].reverse().find((h) => h.user)?.user ?? CURRENT_USER.name;
  const saving = createDraft.isPending || update.isPending || scheduleM.isPending;
  const showSave = isNew || dirty;

  const menu = [
    !sms && draft.content && { label: "Preview", icon: EyeIcon, onSelect: () => setPreviewing(true) },
    !sms && {
      label: "Send test email",
      icon: PaperPlaneRightIcon,
      onSelect: () => (draft.content ? toast.success("Test email simulated", { description: `Would go to ${CURRENT_USER.email} — nothing is sent in this demo.` }) : toast.info("Add content first", { description: "Choose a template or write the email, then send a test." })),
    },
    !isNew && { label: "View activity", icon: ChartBarIcon, href: `${campaignHref(c.id)}?view=report` },
    ...(isNew ? [] : actions.actionsFor(c, { onDetails: true }).filter((a) => a && !["Edit", "Preview", "Schedule", "Reschedule"].includes(a.label))),
  ];

  return (
    <div className="flex flex-1 flex-col bg-[#F7F5FB]">
      {/* Page header */}
      <div className="sticky top-[60px] z-20 border-b border-line bg-white lg:top-[var(--header-h)]">
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Link href={listHref} aria-label="Back to Campaigns" className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-campaign-depth transition-colors hover:bg-campaign-surface hover:text-campaign-action focus-visible:outline-2 focus-visible:outline-brand-action">
              <ArrowLeftIcon size={20} aria-hidden />
            </Link>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
                <label htmlFor="f-name" className="sr-only">
                  Campaign name
                </label>
                <input
                  id="f-name"
                  value={draft.name}
                  onChange={(e) => set("name", e.target.value)}
                  maxLength={100}
                  size={Math.min(48, Math.max(12, draft.name.length + 1))}
                  aria-invalid={shown.name ? true : undefined}
                  aria-describedby={shown.name ? "f-name-error" : undefined}
                  title="Click to rename"
                  className="-mx-2 h-9 w-full max-w-full min-w-0 rounded-lg border border-transparent bg-transparent px-2 text-[18px] sm:w-auto font-semibold text-campaign-depth outline-none transition-colors hover:border-line hover:bg-campaign-surface/60 focus:border-campaign-action focus:bg-white focus:ring-3 focus:ring-brand-10 aria-invalid:border-[#F0A8A4]"
                />
                <StatusPill status={c.status} />
                <span className="hidden h-5 w-px bg-line sm:block" aria-hidden />
                <span className="text-[13.5px] text-ink-body" title={isNew ? undefined : `Last updated on ${formatDateTime(c.updatedAt)} by ${lastBy}`}>
                  {dirty ? <span className="font-medium text-[var(--warning)]">Unsaved changes</span> : isNew ? "Not saved yet" : `Last saved ${savedAgo(c.updatedAt)}`}
                  {c.status === "scheduled" && c.scheduledAt && <span className="text-ink-muted"> · sends {formatDateTime(c.scheduledAt)}</span>}
                </span>
              </div>
              {shown.name && (
                <p id="f-name-error" role="alert" className="mt-0.5 text-[12px] font-medium text-[#D92D20]">
                  {shown.name}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {showSave && (
              <>
                <OutlineButton className="h-10 px-4" onClick={() => (isNew && !dirty ? discard() : setDiscarding(true))} disabled={saving}>
                  Cancel
                </OutlineButton>
                <OutlineButton className="h-10 border-campaign-soft px-4 text-campaign-action hover:border-campaign-action hover:bg-campaign-surface hover:text-campaign-hover" onClick={() => save()} disabled={saving}>
                  {update.isPending || createDraft.isPending ? "Saving…" : c.status === "draft" ? "Save Draft" : "Save Changes"}
                </OutlineButton>
              </>
            )}
            <button
              type="button"
              onClick={revealErrors}
              aria-label={errorCount ? `${pluralize(errorCount, "error")} — show them` : "No errors"}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-3.5 text-[14px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand-action",
                errorCount ? "border-[#F0A8A4] text-[#D92D20] hover:bg-[var(--danger-bg)]" : "border-[#BFE5D6] text-[var(--success)] hover:bg-[var(--success-bg)]",
              )}
            >
              {errorCount ? <WarningCircleIcon size={18} aria-hidden /> : <CheckCircleIcon size={18} aria-hidden />}
              {errorCount} {errorCount === 1 ? "Error" : "Errors"}
            </button>
            <button
              type="button"
              onClick={review}
              disabled={saving}
              className="inline-flex h-10 items-center rounded-lg bg-campaign-action px-5 text-[14px] font-semibold text-white shadow-[0_1px_2px_rgb(61_30_92/0.25)] transition-colors hover:bg-campaign-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-action"
            >
              Review &amp; Launch
            </button>
            <RowMenu
              label="More actions"
              actions={menu}
              trigger={
                <OutlineButton aria-label="More actions" className="h-10 w-10 px-0">
                  <DotsThreeIcon size={20} weight="bold" aria-hidden />
                </OutlineButton>
              }
            />
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="mx-auto grid w-full max-w-[1600px] flex-1 items-start gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-4">
          <RecipientsCard campaign={c} topic={draft.topic} audienceIds={draft.audienceIds} onTopic={(t) => set("topic", t)} onAudience={(ids) => set("audienceIds", ids)} error={shown.audience} />
          {sms ? <SmsDetailsCard draft={draft} set={set} errors={shown} senderId={c.senderId} /> : <EmailDetailsCard draft={draft} set={set} errors={shown} />}
          <OtherConfigCard draft={draft} set={set} sms={sms} />
        </div>
        <div className="min-w-0 lg:sticky lg:top-[calc(var(--header-h)+88px)]">
          {sms ? (
            <SmsPreviewCard message={draft.message} senderId={c.senderId} />
          ) : (
            <ContentCard
              campaignId={c.id}
              campaignName={draft.name}
              content={draft.content}
              source={draft.contentSource}
              previewText={draft.previewText}
              onChange={(content, source) => setStored({ ...draft, content, contentSource: source })}
              error={shown.content}
            />
          )}
        </div>
      </div>

      <ReviewDialog
        key={reviewing ? "open" : "closed"}
        open={reviewing}
        onOpenChange={setReviewing}
        campaign={c}
        draft={draft}
        saving={saving}
        onSaveDraft={async () => {
          if (await save()) setReviewing(false);
        }}
        onSchedule={schedule}
      />
      <ConfirmDialog
        open={discarding}
        onOpenChange={setDiscarding}
        title={isNew ? "Discard this campaign?" : "Discard unsaved changes?"}
        description={isNew ? "It hasn't been saved yet, so everything entered here is lost." : "The campaign goes back to its last saved version. Changes made since then are lost."}
        confirmLabel={isNew ? "Discard campaign" : "Discard changes"}
        onConfirm={discard}
      />
      {draft.content && <PreviewDialog open={previewing} onOpenChange={setPreviewing} content={draft.content} preheader={draft.previewText} title={draft.name} />}
      {!isNew && actions.element()}
    </div>
  );
}

function SmsPreviewCard({ message, senderId }: { message: string; senderId?: string }) {
  return (
    <section aria-label="Message preview" className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <h2 className="text-[16px] leading-6 font-semibold text-campaign-depth">Message preview</h2>
      <div className="mx-auto mt-4 w-full max-w-[280px] rounded-[28px] border-[6px] border-campaign-depth bg-campaign-surface p-3 shadow-pop">
        <p className="mb-3 text-center text-[11px] font-medium text-ink-muted">{senderId}</p>
        <div className="min-h-[180px]">
          {message ? <p className="max-w-[88%] rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[13px] leading-5 break-words text-ink shadow-card">{message}</p> : <p className="pt-10 text-center text-[12.5px] text-ink-faint">Your message appears here</p>}
        </div>
      </div>
    </section>
  );
}

export function EditorSkeleton() {
  return (
    <div className="flex flex-1 flex-col bg-[#F7F5FB]" aria-busy="true" aria-label="Loading campaign">
      <div className="border-b border-line bg-white px-6 py-4">
        <Skeleton className="h-7 w-96" />
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-[1.15fr_1fr]">
        <div className="grid gap-4">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
        <Skeleton className="h-[640px] rounded-2xl" />
      </div>
    </div>
  );
}

/** Content changes only for campaigns that haven't sent; the rest open their report. */
export const opensInEditor = (c: Campaign) => c.status === "draft" || c.status === "scheduled" || (c.status === "paused" && c.pausedFrom === "scheduled" && !c.sent);

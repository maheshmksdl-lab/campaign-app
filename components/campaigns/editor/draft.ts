/**
 * The campaign editor's working copy: built from the saved campaign, checked
 * before Review and Launch, and turned back into an API edit on save.
 */
import { isValidEmail } from "@/lib/audience";
import type { CampaignDraft } from "@/lib/content-session";
import { buildLayout, idFactory } from "@/lib/email-blocks";
import { isSms } from "@/lib/campaign-meta";
import { DEFAULT_SENDER } from "@/lib/mock-data/campaigns";
import { MAX_AUDIENCE_SOURCES } from "@/lib/audience";
import { SMS_MAX } from "@/lib/schemas/campaign";
import type { Campaign, CampaignEdit } from "@/lib/types/campaigns";
import type { EmailContent } from "@/lib/types/templates";

export const TOPICS = ["Marketing", "Newsletter", "Product Updates", "Events", "Offers & Promotions"] as const;

/**
 * Seeded campaigns that were already scheduled predate stored content; give
 * them a simple design built from their subject so the editor isn't empty.
 */
function fallbackContent(c: Campaign): EmailContent | null {
  if (isSms(c) || c.status === "draft") return null;
  const content = buildLayout("single-column", idFactory(`${c.id}-c`));
  if (content.kind === "design") {
    const h = content.blocks.find((b) => b.type === "heading" && b.text !== "{{org_name}}");
    if (h && h.type === "heading") h.text = c.subject || c.name;
  }
  return content;
}

export function draftFromCampaign(c: Campaign): CampaignDraft {
  const content = c.content ?? fallbackContent(c);
  return {
    name: c.name,
    topic: c.topic ?? "Marketing",
    audienceIds: c.audienceIds?.length ? [...c.audienceIds] : c.audienceId ? [c.audienceId] : [],
    senderEmail: c.senderEmail ?? DEFAULT_SENDER.email,
    senderName: c.senderName,
    replyTo: c.replyTo ?? c.senderEmail ?? DEFAULT_SENDER.email,
    subject: c.subject ?? "",
    previewText: c.previewText ?? "",
    message: c.message ?? "",
    trackReplies: c.trackReplies ?? false,
    trackOpens: c.trackOpens ?? true,
    trackClicks: c.trackClicks ?? true,
    attachments: c.attachments ? c.attachments.map((a) => ({ ...a })) : [],
    content,
    contentSource: c.content ? (c.contentSource ?? "Custom content") : content ? "Single column layout" : "",
  };
}

export type DraftField = "name" | "audience" | "senderEmail" | "senderName" | "replyTo" | "subject" | "previewText" | "message" | "content";
export type DraftErrors = Partial<Record<DraftField, string>>;

/** Order matches the page, so "first error" scrolls top-down. */
export const FIELD_ORDER: DraftField[] = ["name", "audience", "senderEmail", "senderName", "replyTo", "subject", "previewText", "message", "content"];

export function validateDraft(d: CampaignDraft, c: Pick<Campaign, "type">): DraftErrors {
  const e: DraftErrors = {};
  const name = d.name.trim();
  if (name.length < 3) e.name = "Enter a campaign name (at least 3 characters)";
  else if (name.length > 100) e.name = "Keep the name under 100 characters";
  if (!d.audienceIds.length) e.audience = "Select at least one list or segment";
  else if (d.audienceIds.length > MAX_AUDIENCE_SOURCES) e.audience = `Select up to ${MAX_AUDIENCE_SOURCES} lists or segments`;
  if (isSms(c)) {
    const m = d.message.trim();
    if (m.length < 10) e.message = "Write the SMS message (at least 10 characters)";
    else if ([...m].length > SMS_MAX) e.message = `Keep the message under ${SMS_MAX} characters`;
    return e;
  }
  if (!d.senderEmail.trim()) e.senderEmail = "Enter the email address this campaign is sent from";
  else if (!isValidEmail(d.senderEmail)) e.senderEmail = "Enter a valid email address";
  if (d.senderName.trim().length < 2) e.senderName = "Enter a sender name";
  else if (d.senderName.trim().length > 60) e.senderName = "Keep the sender name under 60 characters";
  if (!d.replyTo.trim()) e.replyTo = "Enter the address replies go to";
  else if (!isValidEmail(d.replyTo)) e.replyTo = "Enter a valid email address";
  if (d.subject.trim().length < 3) e.subject = "Enter a subject line (at least 3 characters)";
  else if (d.subject.trim().length > 150) e.subject = "Keep the subject under 150 characters";
  if (d.previewText.trim().length > 150) e.previewText = "Keep the preheader under 150 characters";
  if (!d.content) e.content = "Choose a template or create the email content";
  return e;
}

export function editFromDraft(d: CampaignDraft, c: Pick<Campaign, "type">): CampaignEdit {
  const common = { name: d.name.trim(), audienceIds: d.audienceIds, topic: d.topic, trackReplies: d.trackReplies, trackOpens: d.trackOpens, trackClicks: d.trackClicks };
  if (isSms(c)) return { ...common, message: d.message.trim() };
  return {
    ...common,
    subject: d.subject.trim(),
    previewText: d.previewText.trim(),
    senderName: d.senderName.trim(),
    senderEmail: d.senderEmail.trim(),
    replyTo: d.replyTo.trim(),
    attachments: d.attachments,
    content: d.content,
    contentSource: d.contentSource,
  };
}

export const sameDraft = (a: CampaignDraft, b: CampaignDraft) => JSON.stringify(a) === JSON.stringify(b);

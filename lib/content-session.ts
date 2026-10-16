/**
 * Hand-offs between the campaign editor, the Template Gallery and the content
 * editor. Everything lives in this tab's sessionStorage (via useStoredState),
 * so moving between pages — or reloading — never loses unsaved work.
 *
 * - Campaign draft: the editor's unsaved values for one campaign.
 * - Pending content: content picked in the gallery / content editor, waiting
 *   for the campaign editor to apply it to the draft.
 * - Content session: what the content editor is editing and where it returns.
 */
import type { CampaignAttachment } from "@/lib/types/campaigns";
import type { EmailContent, TemplateCategory, TemplateOrigin } from "@/lib/types/templates";

export const draftKey = (campaignId: string) => `evoq-campaigns:draft:${campaignId}`;
export const pendingKey = (campaignId: string) => `evoq-campaigns:pending-content:${campaignId}`;
export const CONTENT_SESSION_KEY = "evoq-campaigns:content-session";

/** Stable fallback for useStoredState. */
export const NONE = null;

export interface CampaignDraft {
  name: string;
  topic: string;
  audienceIds: string[];
  senderEmail: string;
  senderName: string;
  replyTo: string;
  subject: string;
  previewText: string;
  message: string;
  trackReplies: boolean;
  trackOpens: boolean;
  trackClicks: boolean;
  attachments: CampaignAttachment[];
  content: EmailContent | null;
  contentSource: string;
}

export interface PendingContent {
  content: EmailContent;
  source: string;
}

/** Where the content editor saves to. */
export type ContentTarget =
  | { kind: "campaign"; campaignId: string; campaignName: string }
  | { kind: "template"; templateId?: string; name: string; category: TemplateCategory; origin: TemplateOrigin };

export interface ContentSession {
  target: ContentTarget;
  content: EmailContent;
  /** Shown in the editor header ("Two columns layout", "Welcome Travel"…). */
  source: string;
}

// ── Routes ───────────────────────────────────────────────────────────

export const TEMPLATES_ROUTE = "/templates";
export const GALLERY_ROUTE = "/templates/gallery";
export const CONTENT_EDITOR_ROUTE = "/templates/editor";
export const CONTACTS_ROUTE = "/contacts";

/** Gallery opened from a campaign (selecting returns to it) or for a new template. */
export function galleryHref(o: { campaignId?: string; templateName?: string; section?: "gallery" | "layouts" | "mine"; category?: string } = {}) {
  const p = new URLSearchParams();
  if (o.campaignId) p.set("campaign", o.campaignId);
  if (o.templateName) p.set("name", o.templateName);
  if (o.section && o.section !== "gallery") p.set("section", o.section);
  if (o.category) p.set("category", o.category);
  const s = p.toString();
  return s ? `${GALLERY_ROUTE}?${s}` : GALLERY_ROUTE;
}

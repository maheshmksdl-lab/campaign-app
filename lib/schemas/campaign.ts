import { z } from "zod";
import type { CampaignStatus, CampaignType } from "@/lib/types/campaigns";

// ── Listing query (kept in the URL) ──────────────────────────────────

export const CAMPAIGN_SORTS = ["newest", "oldest", "name-asc", "name-desc", "open-rate", "click-rate", "recipients"] as const;
export type CampaignSort = (typeof CAMPAIGN_SORTS)[number];
export const PAGE_SIZES = [10, 25, 50] as const;

/** "" = All campaigns (everything except archived). */
export type StatusTab = "" | CampaignStatus;

export interface CampaignQuery {
  q: string;
  status: StatusTab;
  type: "" | CampaignType;
  from: string;
  to: string;
  sort: CampaignSort;
  page: number;
  size: (typeof PAGE_SIZES)[number];
}

export const DEFAULT_CAMPAIGN_QUERY: CampaignQuery = { q: "", status: "", type: "", from: "", to: "", sort: "newest", page: 1, size: 10 };

const oneOf = <T extends string>(v: string | null, allowed: readonly T[], fallback: T): T => (v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback);
const isoDate = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

export function parseCampaignQuery(p: URLSearchParams): CampaignQuery {
  const size = Number(p.get("size"));
  const page = Number(p.get("page"));
  return {
    q: p.get("q") ?? "",
    status: oneOf(p.get("status"), ["", "draft", "scheduled", "sending", "sent", "paused", "archived"] as const, ""),
    type: oneOf(p.get("type"), ["", "email", "sms", "automation", "journey"] as const, ""),
    from: isoDate(p.get("from")),
    to: isoDate(p.get("to")),
    sort: oneOf(p.get("sort"), CAMPAIGN_SORTS, "newest"),
    page: Number.isInteger(page) && page > 0 ? page : 1,
    size: (PAGE_SIZES as readonly number[]).includes(size) ? (size as CampaignQuery["size"]) : 10,
  };
}

/** Only non-default values go in the URL. */
export function campaignQueryString(q: CampaignQuery): string {
  const p = new URLSearchParams();
  if (q.status) p.set("status", q.status);
  if (q.q) p.set("q", q.q);
  if (q.type) p.set("type", q.type);
  if (q.from) p.set("from", q.from);
  if (q.to) p.set("to", q.to);
  if (q.sort !== "newest") p.set("sort", q.sort);
  if (q.page > 1) p.set("page", String(q.page));
  if (q.size !== 10) p.set("size", String(q.size));
  const s = p.toString();
  return s ? `?${s}` : "";
}

// ── Forms ────────────────────────────────────────────────────────────

const name = z.string().trim().min(3, "Enter a campaign name (at least 3 characters)").max(100, "Keep the name under 100 characters");
/** Three SMS segments at most. */
export const SMS_MAX = 459;

export const createCampaignSchema = z
  .object({
    name,
    type: z.enum(["email", "sms"], { message: "Choose Email or SMS" }),
    subject: z.string().trim().max(150, "Keep the subject under 150 characters"),
    message: z.string().trim().max(SMS_MAX, `Keep the message under ${SMS_MAX} characters`),
    audienceId: z.string().min(1, "Choose an audience"),
  })
  .superRefine((v, ctx) => {
    if (v.type === "email" && v.subject.length < 3) ctx.addIssue({ code: "custom", path: ["subject"], message: "Enter a subject line (at least 3 characters)" });
  });

export type CreateCampaignValues = z.input<typeof createCampaignSchema>;

export const editCampaignSchema = z
  .object({
    name,
    type: z.enum(["email", "sms", "automation", "journey"]),
    locked: z.boolean(),
    subject: z.string().trim().max(150, "Keep the subject under 150 characters"),
    previewText: z.string().trim().max(150, "Keep the preview text under 150 characters"),
    message: z.string().trim().max(SMS_MAX, `Keep the message under ${SMS_MAX} characters`),
    senderName: z.string().trim().max(60, "Keep the sender name under 60 characters"),
    senderEmail: z.string().trim(),
    audienceId: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.locked) return;
    if (v.type !== "sms") {
      if (v.subject.length < 3) ctx.addIssue({ code: "custom", path: ["subject"], message: "Enter a subject line (at least 3 characters)" });
      if (v.senderName.length < 2) ctx.addIssue({ code: "custom", path: ["senderName"], message: "Enter a sender name" });
      if (!z.email().safeParse(v.senderEmail).success) ctx.addIssue({ code: "custom", path: ["senderEmail"], message: "Enter a valid email address" });
    } else if (v.message.length < 10) ctx.addIssue({ code: "custom", path: ["message"], message: "Write the SMS message (at least 10 characters)" });
    if (!v.audienceId) ctx.addIssue({ code: "custom", path: ["audienceId"], message: "Choose an audience" });
  });

export type EditCampaignValues = z.input<typeof editCampaignSchema>;

export const scheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Choose a time"),
});

export type ScheduleValues = z.input<typeof scheduleSchema>;

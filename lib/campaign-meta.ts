/**
 * Labels, tones and rules shared by every screen. Status tones always ship
 * with a text label; channel colours follow the Campaigns palette
 * (email orange, SMS green, automation pink, journey blue).
 */
import type { Icon } from "@phosphor-icons/react";
import { ChatCircleDotsIcon, EnvelopeSimpleIcon, PathIcon, TreeStructureIcon } from "@phosphor-icons/react/dist/ssr";
import type { Campaign, CampaignStatus, CampaignType } from "@/lib/types/campaigns";

export interface Tone {
  label: string;
  fg: string;
  bg: string;
  dot: boolean;
}

export const tone = (label: string, fg: string, bg: string, dot = true): Tone => ({ label, fg, bg, dot });

export const STATUS_META: Record<CampaignStatus, Tone> = {
  draft: tone("Draft", "var(--neutral-fg)", "var(--neutral-bg)"),
  scheduled: tone("Scheduled", "var(--info)", "var(--info-bg)"),
  sending: tone("Sending", "var(--campaign-primary)", "var(--campaign-tint)"),
  sent: tone("Sent", "var(--success)", "var(--success-bg)"),
  paused: tone("Paused", "var(--warning)", "var(--warning-bg)"),
  archived: tone("Archived", "#8a8699", "#f4f3f7"),
};

export const STATUS_ORDER: CampaignStatus[] = ["draft", "scheduled", "sending", "sent", "paused", "archived"];

export interface ChannelMeta {
  label: string;
  short: string;
  icon: Icon;
  /** Chart / dot colour. */
  color: string;
  fg: string;
  bg: string;
}

export const TYPE_META: Record<CampaignType, ChannelMeta> = {
  email: { label: "Email", short: "Email", icon: EnvelopeSimpleIcon, color: "var(--ch-email)", fg: "var(--ch-email-fg)", bg: "var(--ch-email-bg)" },
  sms: { label: "SMS", short: "SMS", icon: ChatCircleDotsIcon, color: "var(--ch-sms)", fg: "var(--ch-sms-fg)", bg: "var(--ch-sms-bg)" },
  automation: { label: "Automation", short: "Automation", icon: TreeStructureIcon, color: "var(--ch-automation)", fg: "var(--ch-automation-fg)", bg: "var(--ch-automation-bg)" },
  journey: { label: "Journey", short: "Journey", icon: PathIcon, color: "var(--ch-journey)", fg: "var(--ch-journey-fg)", bg: "var(--ch-journey-bg)" },
};

export const TYPE_ORDER: CampaignType[] = ["email", "sms", "automation", "journey"];

/** Hex values for places CSS variables can't reach (SVG gradients in charts). */
export const CHART_HEX = {
  violet: "#7C3AED",
  orange: "#FF7D3D",
  green: "#2D9D78",
  pink: "#E85D87",
  blue: "#3B5998",
  grid: "#EFEDF4",
  muted: "#777386",
} as const;

export const TYPE_HEX: Record<CampaignType, string> = { email: CHART_HEX.orange, sms: CHART_HEX.green, automation: CHART_HEX.pink, journey: CHART_HEX.blue };

// ── Rules ────────────────────────────────────────────────────────────

/** SMS shows deliveries and link clicks; everything else is email-like (opens and clicks). */
export const isSms = (c: Pick<Campaign, "type">) => c.type === "sms";
export const isFlow = (c: Pick<Campaign, "type">) => c.type === "automation" || c.type === "journey";
export const hasResults = (c: Pick<Campaign, "sent">) => (c.sent ?? 0) > 0;

/** The date a campaign is listed and filtered by: sent, else scheduled, else created. */
export const campaignDate = (c: Pick<Campaign, "sentAt" | "scheduledAt" | "createdAt">) => c.sentAt ?? c.scheduledAt ?? c.createdAt;

/** A draft's date is only a plan (no time chosen yet). */
export const hasPlannedTime = (c: Pick<Campaign, "status" | "scheduledAt">) => !!c.scheduledAt && c.status !== "draft";

/** Drafts, scheduled campaigns and campaigns paused before sending can be (re)scheduled. */
export const canSchedule = (c: Pick<Campaign, "status" | "type" | "pausedFrom">) => !isFlow(c) && (c.status === "draft" || c.status === "scheduled" || (c.status === "paused" && c.pausedFrom === "scheduled"));
export const canPause = (c: Pick<Campaign, "status">) => c.status === "scheduled" || c.status === "sending";
export const canResume = (c: Pick<Campaign, "status">) => c.status === "paused";
/** Content is locked once sending starts; only the name can change. */
export const contentLocked = (c: Pick<Campaign, "status" | "sent">) => c.status === "sending" || c.status === "sent" || (c.status === "archived" && hasResults(c)) || (c.status === "paused" && hasResults(c));

/** SMS segments (GSM-7: 160 characters, or 153 each when split). */
export function smsSegments(text: string): number {
  const n = [...text].length;
  if (n === 0) return 0;
  return n <= 160 ? 1 : Math.ceil(n / 153);
}

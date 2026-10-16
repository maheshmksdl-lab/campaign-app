/** Campaign records and the analytics derived from them. Dates are local datetimes (YYYY-MM-DDTHH:mm:ss). */

export type CampaignType = "email" | "sms" | "automation" | "journey";
export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "paused" | "archived";

export type CampaignEventKind = "created" | "audience" | "edited" | "scheduled" | "paused" | "resumed" | "sending" | "sent" | "delivered" | "engagement" | "archived" | "restored" | "duplicated";

export interface CampaignEvent {
  at: string;
  kind: CampaignEventKind;
  text: string;
  user?: string;
}

export interface Audience {
  id: string;
  name: string;
  /** Contacts a campaign would reach (reachable members). */
  size: number;
  kind?: "list" | "segment";
}

export interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  /** Email-like campaigns (email, automation, journey). */
  subject?: string;
  previewText?: string;
  /** SMS body. */
  message?: string;
  senderName: string;
  /** Email sender address. */
  senderEmail?: string;
  /** SMS sender ID. */
  senderId?: string;
  audienceId: string;
  audience: string;
  recipients: number;
  createdAt: string;
  updatedAt: string;
  scheduledAt?: string;
  sentAt?: string;
  /** Delivery finished (sent campaigns). */
  completedAt?: string;
  // Results — present once a campaign has started sending.
  sent?: number;
  delivered?: number;
  opens?: number;
  clicks?: number;
  /** % of delivered */
  openRate?: number;
  /** % of delivered */
  clickRate?: number;
  bounces?: number;
  unsubscribes?: number;
  conversions?: number;
  /** SMS: messages the carrier rejected. */
  failed?: number;
  /** Automations / journeys: average sends a day while running. */
  dailyVolume?: number;
  /** Where Pause / Archive came from, so Resume / Restore can return there. */
  pausedFrom?: "scheduled" | "sending";
  archivedFrom?: Exclude<CampaignStatus, "archived">;
  history: CampaignEvent[];
}

/** One day of account-wide sending, built from the campaign records. */
export interface DayStats {
  date: string;
  emailsSent: number;
  opens: number;
  clicks: number;
  conversions: number;
  smsSent: number;
  newContacts: number;
  totalContacts: number;
}

export interface ActivityEntry {
  id: string;
  at: string;
  kind: "email" | "sms" | "automation" | "journey" | "contacts" | "list" | "segment" | "template" | "form" | "deleted";
  title: string;
  detail: string;
  campaignId?: string;
}

export interface Kpi {
  value: number;
  /** Change vs the previous period: % for counts, percentage points for rates, a plain count for campaigns. */
  change: number;
  changeUnit: "%" | "pts" | "count";
  spark: number[];
}

export interface DashboardData {
  range: { start: string; end: string; days: number };
  previous: { start: string; end: string };
  now: string;
  kpis: {
    contacts: Kpi;
    emailsSent: Kpi;
    openRate: Kpi;
    clickRate: Kpi;
    campaigns: Kpi;
    conversions: Kpi;
  };
  days: DayStats[];
  /** Contact growth, at least 28 days so the line has shape. */
  growth: { date: string; total: number }[];
  newContacts: { value: number; change: number; previousStart: string; previousEnd: string };
  channels: { type: CampaignType; count: number }[];
  best: Campaign[];
  upcoming: Campaign[];
  activity: ActivityEntry[];
  contactLimit: number;
}

export interface EngagementPoint {
  label: string;
  /** Full label for tooltips. */
  title: string;
  opens: number;
  clicks: number;
}

export interface CampaignAnalytics {
  engagement: EngagementPoint[];
  engagementUnit: "hour" | "day";
  devices: { name: string; value: number }[];
  /** Email clients, or mobile carriers for SMS. */
  clients: { name: string; value: number }[];
  links: { label: string; url: string; clicks: number; unique: number }[];
  /** Account average for the same channel, for comparison chips. */
  benchmark: { openRate: number; clickRate: number; bounceRate: number; unsubscribeRate: number; deliveryRate: number };
}

export interface CampaignDetail {
  campaign: Campaign;
  analytics: CampaignAnalytics | null;
  now: string;
}

export interface CampaignInput {
  name: string;
  type: "email" | "sms";
  subject: string;
  message: string;
  audienceId: string;
}

export interface CampaignEdit {
  name: string;
  subject?: string;
  previewText?: string;
  message?: string;
  senderName?: string;
  senderEmail?: string;
  audienceId?: string;
}

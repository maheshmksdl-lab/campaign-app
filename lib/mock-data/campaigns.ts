/**
 * Fixed demo data: audiences and campaigns. Results (delivered, opens, clicks…)
 * are derived here from a few rates with a seeded generator, so every screen
 * shows the same numbers. Changes people make are saved on top (lib/api/store).
 */
import { addDays, addMinutes, daysBetween, formatDateTime, formatNumber, pct } from "@/lib/format";
import type { Audience, Campaign, CampaignEvent, CampaignStatus, CampaignType } from "@/lib/types/campaigns";

/** The demo's "today" — matches the reference dashboard (May 12 – May 18, 2025). */
export const DEMO_TODAY = "2025-05-18";
export const DEMO_NOW = `${DEMO_TODAY}T10:30:00`;

/** Who is signed in to the demo. */
export const CURRENT_USER = { name: "Alex John", firstName: "Alex", org: "Evoq Solutions", email: "alex.john@evoqsolutions.com" };
const TEAM = ["Alex John", "Priya Sharma", "Daniel Kim"];

export const CONTACT_COUNT = 12_458;
export const CONTACT_LIMIT = 25_000;
export const PLAN_NAME = "Professional";

export const DEFAULT_SENDER = { name: "Evoq Solutions", email: "hello@evoqsolutions.com", smsId: "EVOQSOL" };

// ── Seeded randomness ────────────────────────────────────────────────

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic 0–1 stream (mulberry32). */
export function rng(seed: string | number) {
  let a = typeof seed === "number" ? seed : hash(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Share of a campaign's opens / clicks landing on day 0, 1, 2… after sending. */
export const ENGAGEMENT_CURVE = [0.52, 0.2, 0.1, 0.06, 0.04, 0.03, 0.02, 0.015, 0.01, 0.005];

// ── Audiences ────────────────────────────────────────────────────────

export const AUDIENCES: Audience[] = [
  { id: "aud-all", name: "All Subscribers", size: 11_860 },
  { id: "aud-customers", name: "Customers", size: 6_710 },
  { id: "aud-engaged", name: "Engaged Subscribers", size: 4_980 },
  { id: "aud-newsletter", name: "Newsletter Subscribers", size: 8_245 },
  { id: "aud-product", name: "Product Users", size: 10_245 },
  { id: "aud-sms", name: "SMS Opt-in", size: 5_432 },
  { id: "aud-new", name: "New Signups (30 days)", size: 1_320 },
  { id: "aud-loyalty", name: "Loyalty Members", size: 5_320 },
  { id: "aud-purchasers", name: "Recent Purchasers", size: 3_245 },
  { id: "aud-inactive", name: "Inactive 90+ days", size: 3_720 },
  { id: "aud-webinar", name: "Webinar Prospects", size: 4_890 },
  { id: "aud-vip", name: "VIP Customers", size: 2_140 },
];

export const audienceById = (id: string) => AUDIENCES.find((a) => a.id === id);

// ── Campaign seeds ───────────────────────────────────────────────────

interface Seed {
  id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  audienceId: string;
  /** Audience label at send time when it differs from the saved audience. */
  audience?: string;
  recipients?: number;
  subject?: string;
  previewText?: string;
  message?: string;
  scheduledAt?: string;
  sentAt?: string;
  /** Email / SMS sends in progress: share delivered so far. */
  progress?: number;
  /** Fractions of delivered. */
  open?: number;
  click?: number;
  bounce?: number;
  unsub?: number;
  conv?: number;
  fail?: number;
  dailyVolume?: number;
  pausedFrom?: "scheduled" | "sending";
  pausedAt?: string;
  archivedFrom?: Exclude<CampaignStatus, "archived">;
  createdDaysBefore?: number;
  owner?: string;
}

const SEEDS: Seed[] = [
  // Sent this week (May 12 – 18)
  { id: "cmp-1001", name: "Summer Sale Email", type: "email", status: "sent", audienceId: "aud-engaged", subject: "☀️ Summer Sale is here — up to 40% off", previewText: "Our biggest sale of the season starts now.", sentAt: "2025-05-15T09:00:00", open: 0.492, click: 0.09, bounce: 0.011, unsub: 0.0026, conv: 0.021 },
  { id: "cmp-1006", name: "Weekly Digest #19", type: "email", status: "sent", audienceId: "aud-newsletter", audience: "Digest Readers", recipients: 2_140, subject: "Your weekly digest: 5 ideas for better campaigns", sentAt: "2025-05-12T08:00:00", open: 0.441, click: 0.052, bounce: 0.008, unsub: 0.002, conv: 0.004 },
  { id: "cmp-1007", name: "Spring Collection Recap", type: "email", status: "sent", audienceId: "aud-customers", recipients: 4_180, subject: "Missed it? The best of our spring collection", sentAt: "2025-05-13T11:00:00", open: 0.368, click: 0.047, bounce: 0.013, unsub: 0.0031, conv: 0.011 },
  { id: "cmp-1008", name: "Loyalty Points Reminder", type: "email", status: "sent", audienceId: "aud-loyalty", subject: "You have points waiting to be redeemed", sentAt: "2025-05-14T09:30:00", open: 0.528, click: 0.061, bounce: 0.006, unsub: 0.0012, conv: 0.016 },
  { id: "cmp-2001", name: "Exclusive Offer SMS", type: "sms", status: "sent", audienceId: "aud-sms", message: "EVOQ: Exclusive for you — 25% off everything today only. Use code VIP25 at checkout: evoq.one/vip25 Reply STOP to opt out", sentAt: "2025-05-14T12:00:00", click: 0.066, fail: 0.012, unsub: 0.0035, conv: 0.019 },
  { id: "cmp-1009", name: "Webinar Invitation: Email Automation 101", type: "email", status: "sent", audienceId: "aud-webinar", subject: "Live webinar: build your first automation in 30 minutes", sentAt: "2025-05-16T10:00:00", open: 0.402, click: 0.068, bounce: 0.012, unsub: 0.0024, conv: 0.014 },
  { id: "cmp-1010", name: "Weekend Flash Deals", type: "email", status: "sent", audienceId: "aud-engaged", audience: "Deal Seekers", recipients: 3_720, subject: "48 hours only: weekend flash deals", sentAt: "2025-05-17T08:00:00", open: 0.384, click: 0.058, bounce: 0.01, unsub: 0.003, conv: 0.017 },
  { id: "cmp-1011", name: "Product Tips: Getting Started", type: "email", status: "sending", audienceId: "aud-customers", subject: "3 quick tips to get more from Evoq", sentAt: "2025-05-18T09:00:00", progress: 0.78, open: 0.21, click: 0.031, bounce: 0.009, unsub: 0.001, conv: 0.003 },
  // Sent last week (May 5 – 11)
  { id: "cmp-1002", name: "Product Update – May", type: "email", status: "sent", audienceId: "aud-product", recipients: 6_980, subject: "What's new in May: smarter templates and faster reports", sentAt: "2025-05-10T10:00:00", open: 0.385, click: 0.079, bounce: 0.012, unsub: 0.0021, conv: 0.009 },
  { id: "cmp-1005", name: "Abandoned Cart Reminder", type: "email", status: "sent", audienceId: "aud-customers", audience: "Cart Abandoners", recipients: 3_210, subject: "You left something behind 🛒", sentAt: "2025-05-08T14:00:00", open: 0.452, click: 0.063, bounce: 0.009, unsub: 0.002, conv: 0.034 },
  { id: "cmp-1012", name: "Mother's Day Gift Guide", type: "email", status: "sent", audienceId: "aud-all", audience: "Gift Shoppers", recipients: 5_600, subject: "Gifts she'll love — ready in time for Sunday", sentAt: "2025-05-08T07:30:00", open: 0.417, click: 0.055, bounce: 0.011, unsub: 0.0028, conv: 0.022 },
  { id: "cmp-1013", name: "Weekly Digest #18", type: "email", status: "sent", audienceId: "aud-newsletter", audience: "Digest Readers", recipients: 2_090, subject: "Your weekly digest: subject lines that get opened", sentAt: "2025-05-05T08:00:00", open: 0.436, click: 0.049, bounce: 0.008, unsub: 0.0019, conv: 0.004 },
  { id: "cmp-1014", name: "Customer Stories: April", type: "email", status: "sent", audienceId: "aud-customers", recipients: 3_400, subject: "How three teams doubled their email revenue", sentAt: "2025-05-06T11:00:00", open: 0.348, click: 0.041, bounce: 0.014, unsub: 0.0027, conv: 0.006 },
  { id: "cmp-1015", name: "Feature Spotlight: Templates", type: "email", status: "sent", audienceId: "aud-product", recipients: 3_900, subject: "Design emails in minutes with new templates", sentAt: "2025-05-07T10:00:00", open: 0.371, click: 0.057, bounce: 0.01, unsub: 0.0018, conv: 0.007 },
  { id: "cmp-1016", name: "Partner Newsletter", type: "email", status: "sent", audienceId: "aud-vip", audience: "Partners", recipients: 2_800, subject: "Partner update: co-marketing kits for Q2", sentAt: "2025-05-09T09:00:00", open: 0.462, click: 0.044, bounce: 0.007, unsub: 0.0011, conv: 0.003 },
  { id: "cmp-1004", name: "Welcome Email Series", type: "email", status: "sent", audienceId: "aud-new", subject: "Welcome to Evoq — here's how to get started", sentAt: "2025-05-01T09:00:00", open: 0.618, click: 0.069, bounce: 0.015, unsub: 0.004, conv: 0.028 },
  { id: "cmp-2002", name: "Flash Sale Alert", type: "sms", status: "sent", audienceId: "aud-sms", recipients: 5_210, message: "EVOQ Flash Sale! 30% off for the next 6 hours: evoq.one/flash Reply STOP to opt out", sentAt: "2025-05-03T11:00:00", click: 0.058, fail: 0.014, unsub: 0.004, conv: 0.016 },
  // Earlier
  { id: "cmp-2003", name: "Appointment Reminder", type: "sms", status: "sent", audienceId: "aud-customers", audience: "Booked Appointments", recipients: 860, message: "Hi from EVOQ: reminder of your demo call tomorrow. Reschedule: evoq.one/demo Reply STOP to opt out", sentAt: "2025-04-28T09:00:00", click: 0.031, fail: 0.008, unsub: 0.001, conv: 0.004 },
  { id: "cmp-1017", name: "April Newsletter", type: "email", status: "sent", audienceId: "aud-newsletter", recipients: 7_960, subject: "April newsletter: spring launches and tips", sentAt: "2025-04-24T09:00:00", open: 0.394, click: 0.051, bounce: 0.012, unsub: 0.0024, conv: 0.006 },
  { id: "cmp-1019", name: "Easter Weekend Sale", type: "email", status: "sent", audienceId: "aud-engaged", audience: "Deal Seekers", recipients: 4_400, subject: "Hop to it: Easter weekend savings", sentAt: "2025-04-18T08:00:00", open: 0.405, click: 0.062, bounce: 0.01, unsub: 0.0029, conv: 0.019 },
  { id: "cmp-1018", name: "Spring Collection Launch", type: "email", status: "sent", audienceId: "aud-all", recipients: 10_980, subject: "New season, new collection 🌸", sentAt: "2025-04-15T10:00:00", open: 0.356, click: 0.048, bounce: 0.015, unsub: 0.0033, conv: 0.012 },
  { id: "cmp-1020", name: "March Product Roundup", type: "email", status: "sent", audienceId: "aud-product", recipients: 9_100, subject: "Everything we shipped in March", sentAt: "2025-03-27T10:00:00", open: 0.342, click: 0.046, bounce: 0.013, unsub: 0.0022, conv: 0.005 },
  // Scheduled
  { id: "cmp-2004", name: "Summer Sale SMS", type: "sms", status: "scheduled", audienceId: "aud-sms", message: "EVOQ Summer Sale starts now — up to 40% off: evoq.one/summer Reply STOP to opt out", scheduledAt: "2025-05-20T10:00:00", createdDaysBefore: 2 },
  { id: "cmp-1021", name: "Newsletter – May Edition", type: "email", status: "scheduled", audienceId: "aud-newsletter", subject: "May newsletter: summer plans, new features and more", previewText: "Everything you need to know this month.", scheduledAt: "2025-05-22T09:00:00", createdDaysBefore: 3 },
  { id: "cmp-1022", name: "Product Launch Announcement", type: "email", status: "scheduled", audienceId: "aud-product", subject: "Introducing Evoq Journeys", previewText: "Map every step of your customer's path.", scheduledAt: "2025-05-25T14:00:00", createdDaysBefore: 5 },
  { id: "cmp-1023", name: "June Webinar Series", type: "email", status: "scheduled", audienceId: "aud-webinar", subject: "Save your seat: June webinar series", scheduledAt: "2025-06-03T10:00:00", createdDaysBefore: 1 },
  // Drafts
  { id: "cmp-1024", name: "Customer Feedback Survey", type: "email", status: "draft", audienceId: "aud-purchasers", subject: "How did we do? 2 minutes to tell us", scheduledAt: "2025-05-28T00:00:00", createdDaysBefore: 1 },
  { id: "cmp-1025", name: "Back-to-School Preview", type: "email", status: "draft", audienceId: "aud-customers", subject: "", createdDaysBefore: 0, owner: "Priya Sharma" },
  { id: "cmp-2005", name: "Weekend Event SMS", type: "sms", status: "draft", audienceId: "aud-sms", message: "EVOQ: Join us this Saturday for our pop-up event. Details: evoq.one/event", createdDaysBefore: 4, owner: "Daniel Kim" },
  // Paused
  { id: "cmp-1026", name: "Referral Program Promo", type: "email", status: "paused", audienceId: "aud-customers", subject: "Give $20, get $20 — invite a friend", scheduledAt: "2025-05-21T11:00:00", pausedFrom: "scheduled", pausedAt: "2025-05-16T15:20:00", createdDaysBefore: 6 },
  { id: "cmp-3002", name: "Win-back Inactive Customers", type: "automation", status: "paused", audienceId: "aud-inactive", subject: "We miss you — here's 15% off", sentAt: "2025-03-01T09:00:00", dailyVolume: 70, pausedFrom: "sending", pausedAt: "2025-05-10T17:00:00", open: 0.214, click: 0.028, bounce: 0.02, unsub: 0.006, conv: 0.008 },
  // Running automations and journeys
  { id: "cmp-3001", name: "Welcome Automation", type: "automation", status: "sending", audienceId: "aud-new", subject: "Welcome aboard! Your first steps with Evoq", sentAt: "2025-02-10T09:00:00", dailyVolume: 150, open: 0.584, click: 0.087, bounce: 0.012, unsub: 0.003, conv: 0.031 },
  { id: "cmp-3003", name: "Birthday Rewards", type: "automation", status: "sending", audienceId: "aud-loyalty", subject: "Happy birthday! A gift from us 🎁", sentAt: "2025-01-15T08:00:00", dailyVolume: 40, open: 0.633, click: 0.121, bounce: 0.008, unsub: 0.001, conv: 0.052 },
  { id: "cmp-4001", name: "New Customer Onboarding Journey", type: "journey", status: "sending", audienceId: "aud-purchasers", subject: "Getting the most from your first order", sentAt: "2025-03-05T09:00:00", dailyVolume: 190, open: 0.472, click: 0.072, bounce: 0.01, unsub: 0.0025, conv: 0.024 },
  // Archived
  { id: "cmp-1090", name: "Black Friday 2024", type: "email", status: "archived", archivedFrom: "sent", audienceId: "aud-all", recipients: 9_870, subject: "Black Friday: our best prices of the year", sentAt: "2024-11-29T07:00:00", open: 0.428, click: 0.083, bounce: 0.014, unsub: 0.003, conv: 0.041 },
  { id: "cmp-1091", name: "Holiday Greetings 2024", type: "email", status: "archived", archivedFrom: "sent", audienceId: "aud-all", recipients: 10_120, subject: "Happy holidays from all of us", sentAt: "2024-12-20T09:00:00", open: 0.381, click: 0.022, bounce: 0.013, unsub: 0.0015, conv: 0.001 },
  { id: "cmp-2090", name: "Year-End Clearance SMS", type: "sms", status: "archived", archivedFrom: "sent", audienceId: "aud-sms", recipients: 4_870, message: "EVOQ Year-End Clearance: up to 60% off: evoq.one/clear Reply STOP to opt out", sentAt: "2024-12-27T10:00:00", click: 0.054, fail: 0.016, unsub: 0.005, conv: 0.013 },
];

// ── Automations: daily sends while running ───────────────────────────

/** Last day an automation / journey sent (its pause date, or today). */
export function runEnd(c: Pick<Campaign, "status" | "history" | "pausedFrom" | "archivedFrom">, today: string): string {
  if (c.status === "paused" || c.status === "archived") {
    const paused = [...c.history].reverse().find((e) => e.kind === "paused" || e.kind === "archived");
    return paused ? paused.at.slice(0, 10) : today;
  }
  return today;
}

/** Sends on a given day for an automation / journey (seeded, varies ±25%, quieter at weekends). */
export function automationSends(c: Pick<Campaign, "id" | "dailyVolume">, date: string): number {
  const r = rng(`${c.id}:${date}`)();
  const dow = new Date(`${date}T12:00:00`).getDay();
  const weekend = dow === 0 || dow === 6 ? 0.7 : 1;
  return Math.round((c.dailyVolume ?? 0) * weekend * (0.75 + r * 0.5));
}

// ── Building records ─────────────────────────────────────────────────

const round1 = (n: number) => Math.round(n * 10) / 10;

function results(s: Seed, recipients: number) {
  const r = rng(s.id);
  const jitter = () => 0.97 + r() * 0.06;
  if (s.type === "sms") {
    const sent = recipients;
    const failed = Math.round(sent * (s.fail ?? 0.012) * jitter());
    const delivered = sent - failed;
    const clicks = Math.round(delivered * (s.click ?? 0) * jitter());
    return {
      sent,
      delivered,
      failed,
      clicks,
      clickRate: round1(pct(clicks, delivered)),
      bounces: 0,
      unsubscribes: Math.round(delivered * (s.unsub ?? 0) * jitter()),
      conversions: Math.round(delivered * (s.conv ?? 0) * jitter()),
    };
  }
  const sent = recipients;
  const bounces = Math.round(sent * (s.bounce ?? 0.01) * jitter());
  const delivered = sent - bounces;
  const opens = Math.round(delivered * (s.open ?? 0) * jitter());
  const clicks = Math.round(delivered * (s.click ?? 0) * jitter());
  return {
    sent,
    delivered,
    bounces,
    opens,
    clicks,
    openRate: round1(pct(opens, delivered)),
    clickRate: round1(pct(clicks, delivered)),
    unsubscribes: Math.round(delivered * (s.unsub ?? 0) * jitter()),
    conversions: Math.round(delivered * (s.conv ?? 0) * jitter()),
  };
}

function seedHistory(s: Seed, c: Campaign): CampaignEvent[] {
  const owner = s.owner ?? TEAM[hash(s.id) % TEAM.length];
  const ev: CampaignEvent[] = [{ at: c.createdAt, kind: "created", text: "Campaign created", user: owner }];
  ev.push({ at: addMinutes(c.createdAt, 18), kind: "audience", text: `Audience selected: ${c.audience} (${formatNumber(c.recipients)} contacts)`, user: owner });
  const isFlow = c.type === "automation" || c.type === "journey";
  if (s.scheduledAt && c.status !== "draft") {
    ev.push({ at: addMinutes(c.createdAt, 95), kind: "scheduled", text: `Scheduled for ${formatDateTime(s.scheduledAt)}`, user: owner });
  } else if (c.sentAt && !isFlow) {
    ev.push({ at: addMinutes(c.sentAt, -60 * 26), kind: "scheduled", text: `Scheduled for ${formatDateTime(c.sentAt)}`, user: owner });
  }
  if (c.sentAt) {
    if (isFlow) {
      ev.push({ at: c.sentAt, kind: "sending", text: `${c.type === "journey" ? "Journey" : "Automation"} activated — contacts enter as they qualify`, user: owner });
    } else {
      ev.push({ at: c.sentAt, kind: "sending", text: `Sending started to ${formatNumber(c.recipients)} ${c.type === "sms" ? "phone numbers" : "contacts"}` });
      if (c.completedAt) ev.push({ at: c.completedAt, kind: "delivered", text: `Delivery completed — ${formatNumber(c.delivered ?? 0)} delivered` });
      if (c.status !== "sending") {
        const engagedAt = addMinutes(c.sentAt, 60 * 48);
        ev.push({
          at: engagedAt > DEMO_NOW ? addMinutes(c.completedAt ?? c.sentAt, 30) : engagedAt,
          kind: "engagement",
          text: c.type === "sms" ? `Engagement recorded — ${formatNumber(c.clicks ?? 0)} link clicks` : `Engagement recorded — ${formatNumber(c.opens ?? 0)} opens, ${formatNumber(c.clicks ?? 0)} clicks`,
        });
      }
    }
  }
  if (s.pausedAt) ev.push({ at: s.pausedAt, kind: "paused", text: s.pausedFrom === "sending" ? "Automation paused — no new contacts enter" : "Paused before sending", user: owner });
  if (c.status === "archived") ev.push({ at: addMinutes(c.completedAt ?? c.createdAt, 60 * 24 * 30), kind: "archived", text: "Archived", user: owner });
  return ev.sort((a, b) => a.at.localeCompare(b.at));
}

function build(s: Seed): Campaign {
  const aud = audienceById(s.audienceId)!;
  const recipients = s.recipients ?? aud.size;
  const anchor = s.sentAt ?? s.scheduledAt ?? DEMO_NOW;
  const created =
    s.createdDaysBefore !== undefined
      ? `${addDays(DEMO_TODAY, -s.createdDaysBefore)}T${String(9 + (hash(s.id) % 7)).padStart(2, "0")}:${String(hash(s.name) % 60).padStart(2, "0")}:00`
      : addMinutes(anchor, -60 * 24 * (3 + (hash(s.id) % 6)) - (hash(s.name) % 300));

  const isEmailLike = s.type !== "sms";
  const c: Campaign = {
    id: s.id,
    name: s.name,
    type: s.type,
    status: s.status,
    subject: isEmailLike ? s.subject : undefined,
    previewText: isEmailLike ? s.previewText : undefined,
    message: s.type === "sms" ? s.message : undefined,
    senderName: DEFAULT_SENDER.name,
    senderEmail: isEmailLike ? DEFAULT_SENDER.email : undefined,
    senderId: s.type === "sms" ? DEFAULT_SENDER.smsId : undefined,
    audienceId: s.audienceId,
    audience: s.audience ?? aud.name,
    recipients,
    createdAt: created,
    updatedAt: created,
    scheduledAt: s.scheduledAt,
    sentAt: s.sentAt,
    dailyVolume: s.dailyVolume,
    pausedFrom: s.pausedFrom,
    archivedFrom: s.archivedFrom,
    history: [],
  };

  if (s.sentAt) {
    if (s.dailyVolume) {
      // Automations / journeys: results are the sum of every day they ran.
      const end = s.pausedAt ? s.pausedAt.slice(0, 10) : DEMO_TODAY;
      let sent = 0;
      for (let d = s.sentAt.slice(0, 10); d <= end; d = addDays(d, 1)) sent += automationSends(c, d);
      const r = results(s, sent);
      Object.assign(c, r, { recipients: aud.size });
    } else if (s.progress !== undefined) {
      Object.assign(c, results(s, Math.round(recipients * s.progress)));
    } else {
      Object.assign(c, results(s, recipients));
      // Delivery takes ~1 minute per 150 messages.
      c.completedAt = addMinutes(s.sentAt, Math.max(4, Math.round(recipients / 150)));
    }
  }

  c.history = seedHistory(s, c);
  c.updatedAt = c.history[c.history.length - 1].at;
  return c;
}

export function seedCampaigns(): Campaign[] {
  return SEEDS.map(build);
}

// ── Contacts ─────────────────────────────────────────────────────────

/** New contacts a day, ramping up over time (seeded noise). */
export function newContactsOn(date: string): number {
  const age = daysBetween("2024-11-19", date); // 0 … 180
  const base = 22 + Math.max(0, age) * 0.62;
  const r = rng(`contacts:${date}`)();
  const dow = new Date(`${date}T12:00:00`).getDay();
  return Math.max(0, Math.round(base * (dow === 0 || dow === 6 ? 0.72 : 1) * (0.8 + r * 0.4)));
}

// ── Activity feed ────────────────────────────────────────────────────

export function seedActivity() {
  return [
    { id: "act-5", at: "2025-05-18T10:28:00", kind: "email" as const, title: "Product Tips: Getting Started", detail: "Sending to 6,710 contacts", campaignId: "cmp-1011" },
    { id: "act-4", at: "2025-05-18T10:15:00", kind: "sms" as const, title: "New SMS Campaign", detail: "Summer Sale SMS scheduled for May 20, 10:00 AM", campaignId: "cmp-2004" },
    { id: "act-3", at: "2025-05-18T09:30:00", kind: "automation" as const, title: "Welcome Automation", detail: "12 new contacts enrolled", campaignId: "cmp-3001" },
    { id: "act-2", at: "2025-05-18T08:30:00", kind: "contacts" as const, title: "New Contacts Imported", detail: "Added 120 new contacts" },
    { id: "act-1", at: "2025-05-18T07:30:00", kind: "form" as const, title: "Newsletter Signup Form", detail: "23 new submissions" },
  ];
}

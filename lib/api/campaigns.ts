/**
 * Mock Campaigns API — the only module to replace when a backend exists.
 * State lives in memory in this browser tab and resets on reload; nothing is
 * sent to a server and no email or SMS ever goes out. Every screen reads
 * through these functions, so a change made here shows up on the dashboard,
 * the listing and the details page alike.
 */
import { addDays, daysBetween, formatDateTime, formatNumber, parseDateTime, pct, pluralize } from "@/lib/format";
import { canPause, canResume, canSchedule, contentLocked, isFlow, isSms } from "@/lib/campaign-meta";
import { AUDIENCES, audienceById, automationSends, CONTACT_COUNT, CONTACT_LIMIT, CURRENT_USER, DEFAULT_SENDER, DEMO_TODAY, ENGAGEMENT_CURVE, hash, newContactsOn, rng, runEnd } from "@/lib/mock-data/campaigns";
import { activity, campaigns, clone, delay, demoNow, replaceCampaigns } from "./store";
import type { ActivityEntry, Audience, Campaign, CampaignAnalytics, CampaignDetail, CampaignEdit, CampaignEvent, CampaignInput, CampaignType, DashboardData, DayStats, Kpi } from "@/lib/types/campaigns";

let seq = 0;
const newId = () => `cmp-${Date.now().toString(36)}${++seq}`;

export class ApiError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}

function find(id: string): Campaign {
  const c = campaigns().find((x) => x.id === id);
  if (!c) throw new ApiError("Campaign not found");
  return c;
}

function record(c: Campaign, kind: CampaignEvent["kind"], text: string) {
  const at = demoNow();
  c.history.push({ at, kind, text, user: CURRENT_USER.name });
  c.updatedAt = at;
}

function log(entry: Omit<ActivityEntry, "id" | "at">) {
  activity().unshift({ ...entry, id: `act-${Date.now().toString(36)}-${++seq}`, at: demoNow() });
}

const activityKind = (t: CampaignType): ActivityEntry["kind"] => t;

// ── Lookups ──────────────────────────────────────────────────────────

export async function getAudiences(): Promise<Audience[]> {
  await delay(40);
  return clone(AUDIENCES);
}

// ── Lists ────────────────────────────────────────────────────────────

/** Every campaign, archived included (the listing filters). */
export async function listCampaigns(): Promise<Campaign[]> {
  await delay();
  return clone(campaigns());
}

export async function searchCampaigns(term: string): Promise<Campaign[]> {
  await delay(60);
  const t = term.trim().toLowerCase();
  if (!t) return [];
  return clone(
    campaigns()
      .filter((c) => [c.name, c.subject ?? "", c.audience].some((v) => v.toLowerCase().includes(t)))
      .sort((a, b) => Number(a.status === "archived") - Number(b.status === "archived") || a.name.localeCompare(b.name))
      .slice(0, 6),
  );
}

// ── Account-wide daily figures ───────────────────────────────────────

/** Weights for days 0…n-1 after sending, renormalised over the days that have passed. */
function curveWeights(elapsedDays: number): number[] {
  const w = ENGAGEMENT_CURVE.slice(0, Math.max(1, Math.min(elapsedDays, ENGAGEMENT_CURVE.length)));
  const sum = w.reduce((s, x) => s + x, 0);
  return w.map((x) => x / sum);
}

/** One row per day from `from` to `to`, built from the campaign records. */
function dailyStats(from: string, to: string, today: string): DayStats[] {
  const n = daysBetween(from, to) + 1;
  const rows: DayStats[] = Array.from({ length: n }, (_, i) => ({ date: addDays(from, i), emailsSent: 0, opens: 0, clicks: 0, conversions: 0, smsSent: 0, newContacts: 0, totalContacts: 0 }));
  const at = (date: string) => rows[daysBetween(from, date)];
  const inRange = (date: string) => date >= from && date <= to;

  for (const c of campaigns()) {
    if (!c.sentAt || !c.sent) continue;
    const start = c.sentAt.slice(0, 10);
    if (isFlow(c)) {
      const end = runEnd(c, today);
      const convPerSend = (c.conversions ?? 0) / Math.max(1, c.sent);
      for (let d = start > from ? start : from; d <= end && d <= to; d = addDays(d, 1)) {
        const s = automationSends(c, d);
        const row = at(d);
        row.emailsSent += s;
        row.opens += s * ((c.openRate ?? 0) / 100);
        row.clicks += s * ((c.clickRate ?? 0) / 100);
        row.conversions += s * convPerSend;
      }
      continue;
    }
    const weights = curveWeights(daysBetween(start, today) + 1);
    if (inRange(start)) {
      if (isSms(c)) at(start).smsSent += c.sent;
      else at(start).emailsSent += c.sent;
    }
    weights.forEach((w, i) => {
      const d = addDays(start, i);
      if (!inRange(d)) return;
      const row = at(d);
      if (!isSms(c)) {
        row.opens += (c.opens ?? 0) * w;
        row.clicks += (c.clicks ?? 0) * w;
      }
      row.conversions += (c.conversions ?? 0) * w;
    });
  }

  // Contacts: today's total is fixed; earlier totals subtract each day's sign-ups.
  let total = CONTACT_COUNT;
  for (let d = today; d > to; d = addDays(d, -1)) total -= newContactsOn(d);
  for (let i = n - 1; i >= 0; i--) {
    const row = rows[i];
    row.newContacts = newContactsOn(row.date);
    row.totalContacts = total;
    total -= row.newContacts;
  }
  return rows.map((r) => ({ ...r, opens: Math.round(r.opens), clicks: Math.round(r.clicks), conversions: Math.round(r.conversions) }));
}

const sum = (rows: DayStats[], k: keyof Omit<DayStats, "date">) => rows.reduce((s, r) => s + r[k], 0);
const changePct = (now: number, before: number) => (before > 0 ? ((now - before) / before) * 100 : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;

export async function getDashboard(days: number): Promise<DashboardData> {
  await delay();
  const now = demoNow();
  const today = DEMO_TODAY;
  const span = Math.max(days * 2, 28);
  const all = dailyStats(addDays(today, -(span - 1)), today, today);
  const cur = all.slice(-days);
  const prev = all.slice(-days * 2, -days);
  const live = campaigns().filter((c) => c.status !== "archived");

  const rate = (rows: DayStats[], k: "opens" | "clicks") => pct(sum(rows, k), sum(rows, "emailsSent"));
  const createdIn = (rows: DayStats[]) => live.filter((c) => c.createdAt.slice(0, 10) >= rows[0].date && c.createdAt.slice(0, 10) <= rows[rows.length - 1].date).length;

  const kpi = (value: number, change: number, changeUnit: Kpi["changeUnit"], spark: number[]): Kpi => ({ value, change: round1(change), changeUnit, spark });
  const contactsNow = cur[cur.length - 1].totalContacts;
  const contactsBefore = prev[prev.length - 1].totalContacts;

  const kpis = {
    contacts: kpi(contactsNow, changePct(contactsNow, contactsBefore), "%", cur.map((r) => r.totalContacts)),
    emailsSent: kpi(sum(cur, "emailsSent"), changePct(sum(cur, "emailsSent"), sum(prev, "emailsSent")), "%", cur.map((r) => r.emailsSent)),
    openRate: kpi(round1(rate(cur, "opens")), rate(cur, "opens") - rate(prev, "opens"), "pts", cur.map((r) => pct(r.opens, r.emailsSent))),
    clickRate: kpi(round1(rate(cur, "clicks")), rate(cur, "clicks") - rate(prev, "clicks"), "pts", cur.map((r) => pct(r.clicks, r.emailsSent))),
    campaigns: kpi(
      live.length,
      createdIn(cur),
      "count",
      cur.map((r) => live.filter((c) => c.createdAt.slice(0, 10) <= r.date).length),
    ),
    conversions: kpi(sum(cur, "conversions"), changePct(sum(cur, "conversions"), sum(prev, "conversions")), "%", cur.map((r) => r.conversions)),
  };

  const growthDays = Math.max(28, days);
  const growth = all.slice(-growthDays).map((r) => ({ date: r.date, total: r.totalContacts }));

  const bestSince = addDays(today, -Math.max(days, 30));
  const best = live
    .filter((c) => c.status === "sent" && (c.type === "email" || c.type === "sms") && c.sentAt && c.sentAt.slice(0, 10) >= bestSince)
    .sort((a, b) => (b.clickRate ?? 0) - (a.clickRate ?? 0) || (b.clicks ?? 0) - (a.clicks ?? 0))
    .slice(0, 5);

  const upcoming = live
    .filter((c) => (c.status === "scheduled" || c.status === "draft") && c.scheduledAt && c.scheduledAt.slice(0, 10) >= today && (c.status === "draft" || c.scheduledAt > now))
    .sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!))
    .slice(0, 4);

  const channels = (["email", "sms", "automation", "journey"] as const).map((type) => ({ type, count: live.filter((c) => c.type === type).length }));

  return clone({
    range: { start: cur[0].date, end: today, days },
    previous: { start: prev[0].date, end: prev[prev.length - 1].date },
    now,
    kpis,
    days: cur,
    growth,
    newContacts: { value: sum(cur, "newContacts"), change: round1(changePct(sum(cur, "newContacts"), sum(prev, "newContacts"))), previousStart: prev[0].date, previousEnd: prev[prev.length - 1].date },
    channels,
    best,
    upcoming,
    activity: activity().slice(0, 5),
    contactLimit: CONTACT_LIMIT,
  });
}

/** Contacts on the plan, for the sidebar card. */
export async function getPlanUsage() {
  await delay(40);
  return { contacts: CONTACT_COUNT, limit: CONTACT_LIMIT };
}

// ── Campaign details ─────────────────────────────────────────────────

function split(total: number, weights: number[]): number[] {
  const s = weights.reduce((a, b) => a + b, 0);
  const out = weights.map((w) => Math.floor((total * w) / s));
  out[0] += total - out.reduce((a, b) => a + b, 0);
  return out;
}

function shares(seed: string, names: string[], base: number[]): { name: string; value: number }[] {
  const r = rng(seed);
  const raw = base.map((b) => b * (0.85 + r() * 0.3));
  const total = raw.reduce((a, b) => a + b, 0);
  const vals = raw.map((v) => Math.round((v / total) * 1000) / 10);
  vals[0] = Math.round((100 - vals.slice(1).reduce((a, b) => a + b, 0)) * 10) / 10;
  return names.map((name, i) => ({ name, value: vals[i] }));
}

const LINK_SETS: { match: RegExp; links: [string, string][] }[] = [
  { match: /sale|deal|offer|clearance|black friday|easter|flash/i, links: [["Shop the sale", "evoq.one/sale"], ["Best sellers", "evoq.one/best-sellers"], ["New arrivals", "evoq.one/new"], ["Gift cards", "evoq.one/gift-cards"], ["Manage preferences", "evoq.one/preferences"]] },
  { match: /webinar/i, links: [["Register now", "evoq.one/webinar/register"], ["Agenda", "evoq.one/webinar/agenda"], ["Speaker bios", "evoq.one/webinar/speakers"], ["Add to calendar", "evoq.one/webinar/ics"]] },
  { match: /product|feature|tips|update|roundup|launch/i, links: [["See what's new", "evoq.one/whats-new"], ["Read the guide", "evoq.one/docs/getting-started"], ["Watch the demo", "evoq.one/demo"], ["Book a call", "evoq.one/contact"], ["Manage preferences", "evoq.one/preferences"]] },
  { match: /welcome|onboarding/i, links: [["Get started", "evoq.one/start"], ["Import contacts", "evoq.one/docs/import"], ["Browse templates", "evoq.one/templates"], ["Help center", "evoq.one/help"]] },
];
const DEFAULT_LINKS: [string, string][] = [["Read more", "evoq.one/blog"], ["Shop now", "evoq.one/shop"], ["Visit our website", "evoq.one"], ["Follow us", "evoq.one/social"]];

function benchmarkFor(type: "email" | "sms") {
  const pool = campaigns().filter((c) => c.status !== "draft" && !isFlow(c) && c.sent && c.completedAt && (type === "sms" ? isSms(c) : !isSms(c)));
  const avg = (f: (c: Campaign) => number) => (pool.length ? pool.reduce((s, c) => s + f(c), 0) / pool.length : 0);
  return {
    openRate: round1(avg((c) => c.openRate ?? 0)),
    clickRate: round1(avg((c) => c.clickRate ?? 0)),
    bounceRate: round1(avg((c) => pct(c.bounces ?? 0, c.sent ?? 0))) || 0,
    unsubscribeRate: Math.round(avg((c) => pct(c.unsubscribes ?? 0, c.delivered ?? 0)) * 100) / 100,
    deliveryRate: round1(avg((c) => pct(c.delivered ?? 0, c.sent ?? 0))),
  };
}

function analyticsFor(c: Campaign, now: string): CampaignAnalytics | null {
  if (!c.sentAt || !c.sent) return null;
  const today = now.slice(0, 10);
  let engagement: CampaignAnalytics["engagement"] = [];
  let engagementUnit: CampaignAnalytics["engagementUnit"] = "day";
  const label = (d: string) => {
    const dt = parseDateTime(d);
    return `${dt.toLocaleString("en-US", { month: "short" })} ${String(dt.getDate()).padStart(2, "0")}`;
  };

  if (isFlow(c)) {
    const end = runEnd(c, today);
    const start = addDays(end, -13) > c.sentAt.slice(0, 10) ? addDays(end, -13) : c.sentAt.slice(0, 10);
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const s = automationSends(c, d);
      engagement.push({ label: label(d), title: label(d), opens: Math.round((s * (c.openRate ?? 0)) / 100), clicks: Math.round((s * (c.clickRate ?? 0)) / 100) });
    }
  } else {
    const hours = (parseDateTime(now).getTime() - parseDateTime(c.sentAt).getTime()) / 3_600_000;
    if (hours < 48) {
      engagementUnit = "hour";
      const n = Math.max(1, Math.min(24, Math.ceil(hours)));
      const w = Array.from({ length: n }, (_, h) => Math.exp(-h / 5));
      const opens = split(c.opens ?? 0, w);
      const clicks = split(c.clicks ?? 0, w);
      const startHour = parseDateTime(c.sentAt);
      engagement = w.map((_, h) => {
        const t = new Date(startHour.getTime() + h * 3_600_000);
        const hh = `${String(t.getHours()).padStart(2, "0")}:00`;
        return { label: hh, title: `${label(c.sentAt!.slice(0, 10))}, ${hh}`, opens: opens[h], clicks: clicks[h] };
      });
    } else {
      const weights = curveWeights(daysBetween(c.sentAt.slice(0, 10), today) + 1);
      const opens = weights.map((x) => Math.round((c.opens ?? 0) * x));
      const clicks = weights.map((x) => Math.round((c.clicks ?? 0) * x));
      engagement = weights.map((_, i) => {
        const d = addDays(c.sentAt!.slice(0, 10), i);
        return { label: label(d), title: label(d), opens: opens[i], clicks: clicks[i] };
      });
    }
  }

  const sms = isSms(c);
  const devices = sms ? shares(`${c.id}:dev`, ["iOS", "Android"], [54, 46]) : shares(`${c.id}:dev`, ["Mobile", "Desktop", "Tablet"], [57, 36, 7]);
  const clients = sms
    ? shares(`${c.id}:carrier`, ["Verizon", "AT&T", "T-Mobile", "Other"], [34, 29, 27, 10])
    : shares(`${c.id}:client`, ["Apple Mail", "Gmail", "Outlook", "Yahoo Mail", "Other"], [38, 31, 16, 6, 9]);

  const set = (LINK_SETS.find((s) => s.match.test(c.name))?.links ?? DEFAULT_LINKS).slice(0, sms ? 1 : 5);
  const linkWeights = [0.46, 0.25, 0.15, 0.09, 0.05].slice(0, set.length);
  const totalClicks = c.clicks ?? 0;
  const counts = split(totalClicks, linkWeights);
  const links = set.map(([labelText, url], i) => ({ label: labelText, url: sms ? (c.message?.match(/evoq\.one\/\S+/)?.[0] ?? url) : url, clicks: counts[i], unique: Math.round(counts[i] * (0.76 + (hash(`${c.id}${i}`) % 10) / 100)) }));

  return { engagement, engagementUnit, devices, clients, links, benchmark: benchmarkFor(sms ? "sms" : "email") };
}

export async function getCampaign(id: string): Promise<CampaignDetail> {
  await delay();
  const c = find(id);
  const now = demoNow();
  return clone({ campaign: c, analytics: analyticsFor(c, now), now });
}

// ── Changes ──────────────────────────────────────────────────────────

function uniqueName(base: string): string {
  const names = new Set(campaigns().map((c) => c.name.toLowerCase()));
  if (!names.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) if (!names.has(`${base} (${i})`.toLowerCase())) return `${base} (${i})`;
}

export async function createCampaign(input: CampaignInput): Promise<Campaign> {
  await delay();
  const aud = audienceById(input.audienceId);
  if (!aud) throw new ApiError("Choose an audience", "audienceId");
  const name = input.name.trim();
  if (campaigns().some((c) => c.name.toLowerCase() === name.toLowerCase())) throw new ApiError("A campaign with this name already exists", "name");
  const now = demoNow();
  const sms = input.type === "sms";
  const c: Campaign = {
    id: newId(),
    name,
    type: input.type,
    status: "draft",
    subject: sms ? undefined : input.subject.trim(),
    message: sms ? input.message.trim() : undefined,
    senderName: DEFAULT_SENDER.name,
    senderEmail: sms ? undefined : DEFAULT_SENDER.email,
    senderId: sms ? DEFAULT_SENDER.smsId : undefined,
    audienceId: aud.id,
    audience: aud.name,
    recipients: aud.size,
    createdAt: now,
    updatedAt: now,
    history: [
      { at: now, kind: "created", text: "Campaign created", user: CURRENT_USER.name },
      { at: now, kind: "audience", text: `Audience selected: ${aud.name} (${formatNumber(aud.size)} contacts)`, user: CURRENT_USER.name },
    ],
  };
  campaigns().unshift(c);
  log({ kind: activityKind(c.type), title: c.name, detail: `${sms ? "SMS" : "Email"} draft created for ${formatNumber(aud.size)} contacts`, campaignId: c.id });
  return clone(c);
}

export async function updateCampaign(id: string, edit: CampaignEdit): Promise<Campaign> {
  await delay();
  const c = find(id);
  const name = edit.name.trim();
  if (campaigns().some((x) => x.id !== id && x.name.toLowerCase() === name.toLowerCase())) throw new ApiError("A campaign with this name already exists", "name");
  const changed: string[] = [];
  const set = <K extends keyof Campaign>(k: K, v: Campaign[K] | undefined, label: string) => {
    if (v !== undefined && v !== c[k]) {
      c[k] = v as Campaign[K];
      changed.push(label);
    }
  };
  set("name", name, "name");
  if (!contentLocked(c)) {
    set("subject", edit.subject?.trim(), "subject line");
    set("previewText", edit.previewText?.trim(), "preview text");
    set("message", edit.message?.trim(), "message");
    set("senderName", edit.senderName?.trim(), "sender name");
    set("senderEmail", edit.senderEmail?.trim(), "sender email");
    if (edit.audienceId && edit.audienceId !== c.audienceId) {
      const aud = audienceById(edit.audienceId);
      if (!aud) throw new ApiError("Choose an audience", "audienceId");
      c.audienceId = aud.id;
      c.audience = aud.name;
      c.recipients = aud.size;
      changed.push("audience");
    }
  }
  if (changed.length) record(c, "edited", `Edited ${changed.join(", ")}`);
  return clone(c);
}

export async function duplicateCampaign(id: string): Promise<Campaign> {
  await delay();
  const src = find(id);
  const now = demoNow();
  const aud = audienceById(src.audienceId);
  const copy: Campaign = {
    id: newId(),
    name: uniqueName(`Copy of ${src.name}`),
    type: src.type,
    status: "draft",
    subject: src.subject,
    previewText: src.previewText,
    message: src.message,
    senderName: src.senderName,
    senderEmail: src.senderEmail,
    senderId: src.senderId,
    audienceId: src.audienceId,
    audience: aud?.name ?? src.audience,
    recipients: aud?.size ?? src.recipients,
    createdAt: now,
    updatedAt: now,
    history: [{ at: now, kind: "duplicated", text: `Created as a copy of “${src.name}”`, user: CURRENT_USER.name }],
  };
  const i = campaigns().findIndex((c) => c.id === id);
  campaigns().splice(Math.max(0, i), 0, copy);
  log({ kind: activityKind(copy.type), title: copy.name, detail: `Duplicated from ${src.name}`, campaignId: copy.id });
  return clone(copy);
}

export async function scheduleCampaign(id: string, at: string): Promise<Campaign> {
  await delay();
  const c = find(id);
  if (!canSchedule(c)) throw new ApiError("This campaign can't be scheduled");
  if (at <= demoNow()) throw new ApiError("Choose a time in the future", "date");
  const before = c.status === "scheduled" || (c.status === "paused" && c.scheduledAt) ? c.scheduledAt : undefined;
  c.status = "scheduled";
  c.scheduledAt = at;
  c.pausedFrom = undefined;
  record(c, "scheduled", before ? `Rescheduled from ${formatDateTime(before)} to ${formatDateTime(at)}` : `Scheduled for ${formatDateTime(at)}`);
  log({ kind: activityKind(c.type), title: c.name, detail: `${before ? "Rescheduled" : "Scheduled"} for ${formatDateTime(at)}`, campaignId: c.id });
  return clone(c);
}

export async function pauseCampaign(id: string): Promise<Campaign> {
  await delay();
  const c = find(id);
  if (!canPause(c)) throw new ApiError("Only scheduled or sending campaigns can be paused");
  c.pausedFrom = c.status === "scheduled" ? "scheduled" : "sending";
  c.status = "paused";
  record(c, "paused", isFlow(c) ? "Paused — no new contacts enter" : c.pausedFrom === "scheduled" ? "Paused before sending" : "Sending paused");
  log({ kind: activityKind(c.type), title: c.name, detail: "Paused" , campaignId: c.id });
  return clone(c);
}

export async function resumeCampaign(id: string): Promise<Campaign> {
  await delay();
  const c = find(id);
  if (!canResume(c)) throw new ApiError("Only paused campaigns can be resumed");
  if (c.pausedFrom === "scheduled" || !c.pausedFrom) {
    if (!c.scheduledAt || c.scheduledAt <= demoNow()) throw new ApiError("The scheduled time has passed — choose a new time", "reschedule");
    c.status = "scheduled";
  } else c.status = "sending";
  c.pausedFrom = undefined;
  record(c, "resumed", c.status === "scheduled" ? `Resumed — sends ${formatDateTime(c.scheduledAt!)}` : "Resumed");
  log({ kind: activityKind(c.type), title: c.name, detail: "Resumed", campaignId: c.id });
  return clone(c);
}

export interface BulkResult {
  done: number;
  skipped: number;
}

/** Sending campaigns must be paused first, so they're skipped. */
export async function archiveCampaigns(ids: string[]): Promise<BulkResult> {
  await delay();
  let done = 0;
  for (const id of ids) {
    const c = campaigns().find((x) => x.id === id);
    if (!c || c.status === "archived" || c.status === "sending") continue;
    c.archivedFrom = c.status;
    c.status = "archived";
    record(c, "archived", "Archived");
    done++;
  }
  if (done) log({ kind: "email", title: done === 1 ? (campaigns().find((c) => ids.includes(c.id) && c.status === "archived")?.name ?? "Campaign") : pluralize(done, "campaign"), detail: "Archived" });
  return { done, skipped: ids.length - done };
}

/** Campaigns archived while scheduled come back paused, so nothing sends unexpectedly. */
export async function restoreCampaigns(ids: string[]): Promise<BulkResult> {
  await delay();
  let done = 0;
  for (const id of ids) {
    const c = campaigns().find((x) => x.id === id);
    if (!c || c.status !== "archived") continue;
    const from = c.archivedFrom ?? (c.sent ? "sent" : "draft");
    if (from === "scheduled") {
      c.status = "paused";
      c.pausedFrom = "scheduled";
    } else c.status = from;
    c.archivedFrom = undefined;
    record(c, "restored", from === "scheduled" ? "Restored as paused — reschedule or resume to send" : "Restored from archive");
    done++;
  }
  return { done, skipped: ids.length - done };
}

/** Deleting can't be undone; campaigns that are sending are skipped. */
export async function deleteCampaigns(ids: string[]): Promise<BulkResult> {
  await delay();
  const removable = new Set(campaigns().filter((c) => ids.includes(c.id) && c.status !== "sending").map((c) => c.id));
  const names = campaigns().filter((c) => removable.has(c.id)).map((c) => c.name);
  replaceCampaigns(campaigns().filter((c) => !removable.has(c.id)));
  if (removable.size) log({ kind: "deleted", title: removable.size === 1 ? names[0] : pluralize(removable.size, "campaign"), detail: "Deleted" });
  return { done: removable.size, skipped: ids.length - removable.size };
}

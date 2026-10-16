/**
 * Seeded demo contacts, lists and segments. Generated (not stored) so the
 * 12,458 contacts behind the dashboard don't fill browser storage: the store
 * keeps only the changes made on top of this seed.
 *
 * The numbers line up with the rest of the demo: sign-up dates follow the
 * same daily curve as the dashboard's contact growth, list sizes and segment
 * counts match the audience sizes the seeded campaigns were sent to.
 */
import { addDays, addMinutes } from "@/lib/format";
import type { Contact, ContactList, ContactSource, EngagementLevel, Segment, SuppressionReason } from "@/lib/types/audience";
import { CONTACT_COUNT, DEMO_NOW, DEMO_TODAY, hash, newContactsOn, rng } from "./campaigns";

const FIRST = [
  "Aarav", "Abigail", "Adrian", "Aisha", "Alejandro", "Amelia", "Ananya", "Andre", "Anna", "Arjun", "Ava", "Benjamin", "Bianca", "Caleb", "Camila", "Carlos", "Charlotte", "Chen", "Chloe", "Daniel",
  "Diego", "Elena", "Eli", "Emily", "Emma", "Ethan", "Fatima", "Felix", "Gabriel", "Grace", "Hana", "Harper", "Hiro", "Isabella", "Ivan", "Jack", "James", "Jasmine", "Jin", "Julia",
  "Kai", "Kavya", "Leah", "Leo", "Liam", "Lucas", "Lucia", "Maya", "Mateo", "Mia", "Mohammed", "Nadia", "Naomi", "Noah", "Nora", "Oliver", "Olivia", "Omar", "Priya", "Rahul",
  "Riya", "Rosa", "Ryan", "Samuel", "Sara", "Sofia", "Tariq", "Theo", "Valentina", "Victor", "Yuki", "Zara", "Zoe",
];
const LAST = [
  "Adams", "Ahmed", "Alvarez", "Anderson", "Bailey", "Banerjee", "Becker", "Bennett", "Brooks", "Brown", "Campbell", "Carter", "Chen", "Clarke", "Collins", "Cooper", "Costa", "Das", "Davis", "Diaz",
  "Edwards", "Evans", "Fischer", "Garcia", "Gomez", "Gupta", "Hall", "Harris", "Hughes", "Ito", "Iyer", "Jackson", "Johnson", "Kapoor", "Khan", "Kim", "Kowalski", "Lee", "Lopez", "Martin",
  "Martinez", "Mehta", "Miller", "Moore", "Morgan", "Murphy", "Nair", "Nguyen", "Novak", "Okafor", "Park", "Patel", "Perez", "Reddy", "Reyes", "Roberts", "Rossi", "Sato", "Schmidt", "Shah",
  "Silva", "Singh", "Smith", "Suzuki", "Taylor", "Thomas", "Turner", "Walker", "Wang", "Williams", "Wilson", "Wright", "Young", "Zhang",
];
const COMPANIES = [
  "Acme Retail", "Bluebird Labs", "Brightwave", "Cedar & Co", "Cobalt Systems", "Copperline", "Crestview Group", "Driftwood Studio", "Evergreen Foods", "Fernhill Health", "Foxglove Media", "Granite Logistics",
  "Harbor Analytics", "Helix Bio", "Ironclad Security", "Juniper Travel", "Kestrel Finance", "Lighthouse Learning", "Lumen Energy", "Maple Street Bakery", "Meridian Consulting", "Northwind Traders", "Oakridge Realty",
  "Orchid Beauty", "Pinnacle Sports", "Quartz Software", "Redwood Outfitters", "Riverbend Coffee", "Sable Fashion", "Silverline Motors", "Summit Partners", "Tidewater Marine", "Trailhead Gear", "Upland Farms",
  "Vantage Design", "Willow Home", "Zenith Electronics",
];
const FREE_MAIL = ["gmail.com", "outlook.com", "yahoo.com", "icloud.com", "hotmail.com", "proton.me"];
/** Typo domains for addresses that can't receive mail. */
const BAD_DOMAINS = ["gmial.com", "outlok.com", "yaho.com", "hotmial.com", "gmail.con", "icloud.co"];
const TAG_POOL = ["newsletter", "webinar", "trial", "partner", "beta", "event-2025", "wholesale", "referral", "enterprise", "smb"];
const AREA_CODES = ["212", "312", "415", "512", "617", "646", "702", "718", "206", "303", "404", "305"];

// Exact counts, so lists and segments match the audience sizes used across the demo.
const UNSUBSCRIBED = 598; // All Subscribers = 12,458 − 598 = 11,860
const INVALID = 186;
const SUPPRESSED = 142;
const EXCLUDED = 64;
const HIGHLY_ENGAGED = 1_800;
const ENGAGED = 3_180; // Engaged Subscribers = 4,980
const INACTIVE = 3_720; // Inactive 90+ days
const NEW_FORM_SIGNUPS = 1_320; // New Signups (30 days)
const PURCHASERS = 3_245; // Recent Purchasers

interface ListSeed {
  id: string;
  name: string;
  description: string;
  tags: string[];
  size: number;
  /** Members are drawn from this list. */
  within?: string;
  /** Members are drawn from contacts with this tag. */
  withTag?: string;
  needsMobile?: boolean;
  createdDaysBefore: number;
  createdBy: string;
}

// List ids for the original audiences are kept, so seeded campaigns still point at them.
const LIST_SEEDS: ListSeed[] = [
  { id: "aud-customers", name: "Customers", description: "Everyone who has bought from us at least once.", tags: ["customers"], size: 6_710, createdDaysBefore: 170, createdBy: "Alex John" },
  { id: "aud-newsletter", name: "Newsletter Subscribers", description: "Opted in to the monthly newsletter and weekly digest.", tags: ["newsletter"], size: 8_245, createdDaysBefore: 168, createdBy: "Priya Sharma" },
  { id: "aud-product", name: "Product Users", description: "Active product accounts — feature news and tips.", tags: ["product"], size: 10_245, createdDaysBefore: 160, createdBy: "Daniel Kim" },
  { id: "aud-sms", name: "SMS Opt-in", description: "Gave a mobile number and agreed to marketing texts.", tags: ["sms"], size: 5_432, needsMobile: true, createdDaysBefore: 150, createdBy: "Alex John" },
  { id: "aud-loyalty", name: "Loyalty Members", description: "Customers enrolled in the rewards programme.", tags: ["loyalty", "customers"], size: 5_320, within: "aud-customers", createdDaysBefore: 120, createdBy: "Priya Sharma" },
  { id: "aud-webinar", name: "Webinar Prospects", description: "Registered for, or showed interest in, a live webinar.", tags: ["events"], size: 4_890, createdDaysBefore: 95, createdBy: "Daniel Kim" },
  { id: "aud-vip", name: "VIP Customers", description: "Top customers by lifetime spend.", tags: ["customers", "vip"], size: 2_140, within: "aud-customers", createdDaysBefore: 88, createdBy: "Alex John" },
  { id: "lst-trade-show", name: "Trade Show 2025 Leads", description: "Badge scans from the spring trade show.", tags: ["events", "leads"], size: 380, withTag: "event-2025", createdDaysBefore: 34, createdBy: "Priya Sharma" },
  { id: "lst-beta", name: "Beta Testers", description: "Early-access testers for new features.", tags: ["product"], size: 240, withTag: "beta", createdDaysBefore: 21, createdBy: "Daniel Kim" },
];

const at = (daysBefore: number, time: string) => `${addDays(DEMO_TODAY, -daysBefore)}T${time}`;

export function seedLists(): ContactList[] {
  return LIST_SEEDS.map((l) => {
    const createdAt = at(l.createdDaysBefore, `${String(9 + (hash(l.id) % 8)).padStart(2, "0")}:${String(hash(l.name) % 60).padStart(2, "0")}:00`);
    return { id: l.id, name: l.name, description: l.description, tags: l.tags, createdAt, updatedAt: createdAt, createdBy: l.createdBy };
  });
}

const cond = (id: string, field: Segment["conditions"][number]["field"], operator: Segment["conditions"][number]["operator"], value = "") => ({ id, field, operator, value });

/** Segment ids for the original audiences are kept as well. */
export function seedSegments(): Segment[] {
  const seg = (id: string, name: string, description: string, match: "all" | "any", conditions: Segment["conditions"], daysBefore: number, createdBy: string): Segment => {
    const createdAt = at(daysBefore, `${String(10 + (hash(id) % 6)).padStart(2, "0")}:${String(hash(name) % 60).padStart(2, "0")}:00`);
    return { id, name, description, match, conditions, createdAt, updatedAt: createdAt, createdBy };
  };
  return [
    seg("aud-all", "All Subscribers", "Every contact who is subscribed to marketing email.", "all", [cond("c1", "subscription", "is", "subscribed")], 172, "Alex John"),
    seg("aud-engaged", "Engaged Subscribers", "Subscribers who opened or clicked recently.", "all", [cond("c1", "subscription", "is", "subscribed"), cond("c2", "engagement", "at_least", "engaged")], 140, "Priya Sharma"),
    seg("aud-new", "New Signups (30 days)", "Joined through a signup form in the last 30 days.", "all", [cond("c1", "source", "is", "form"), cond("c2", "addedAt", "in_last_days", "30")], 110, "Alex John"),
    seg("aud-purchasers", "Recent Purchasers", "Tagged as a purchaser by the store integration.", "all", [cond("c1", "tags", "contains", "purchaser")], 75, "Daniel Kim"),
    seg("aud-inactive", "Inactive 90+ days", "No opens or clicks for 90 days or more.", "all", [cond("c1", "engagement", "is", "inactive")], 60, "Priya Sharma"),
    seg("seg-partners", "Partners & Wholesale", "Partner or wholesale accounts (either tag).", "any", [cond("c1", "tags", "contains", "partner"), cond("c2", "tags", "contains", "wholesale")], 12, "Alex John"),
  ];
}

// ── Contacts ─────────────────────────────────────────────────────────

const pick = <T>(r: () => number, arr: readonly T[]) => arr[Math.floor(r() * arr.length)];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Indices ordered by a salted hash: a stable shuffle for exact-count assignments. */
function ranked(indices: number[], salt: string): number[] {
  return indices.map((i) => [hash(`${salt}:${i}`), i] as const).sort((a, b) => a[0] - b[0]).map(([, i]) => i);
}

function phone(r: () => number): string {
  return `+1 (${pick(r, AREA_CODES)}) 555-${String(Math.floor(r() * 10_000)).padStart(4, "0")}`;
}

function weighted<T extends string>(r: () => number, entries: [T, number][]): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let x = r() * total;
  for (const [v, w] of entries) if ((x -= w) < 0) return v;
  return entries[entries.length - 1][0];
}

const later = (a: string, b: string) => (a > b ? a : b);
const earlier = (a: string, b: string) => (a < b ? a : b);
const two = (n: number) => String(n).padStart(2, "0");

/** "N days before the demo's today", cached: date maths is the slow part of seeding 12k contacts. */
const daysAgoCache = new Map<number, string>();
function daysAgo(n: number): string {
  let d = daysAgoCache.get(n);
  if (!d) daysAgoCache.set(n, (d = addDays(DEMO_TODAY, -n)));
  return d;
}

/** Newest first. Deterministic: the same 12,458 contacts on every load. */
export function seedContacts(): Contact[] {
  const n = CONTACT_COUNT;

  // Sign-up dates walk back from today using the dashboard's daily sign-up curve.
  const added: string[] = [];
  for (let d = DEMO_TODAY; added.length < n; d = addDays(d, -1)) {
    const count = newContactsOn(d);
    const r = rng(`added:${d}`);
    // Today only runs until the demo's "now".
    const span = d === DEMO_TODAY ? 10 * 60 + 29 : 16 * 60;
    const start = d === DEMO_TODAY ? 0 : 7 * 60;
    const times = Array.from({ length: count }, () => start + Math.floor(r() * span)).sort((a, b) => b - a);
    for (const m of times) {
      if (added.length >= n) break;
      added.push(`${d}T${two(Math.floor(m / 60))}:${two(m % 60)}:00`);
    }
  }

  const emails = new Set<string>();
  const unique = (local: string, domain: string) => {
    let e = `${local}@${domain}`;
    for (let k = 2; emails.has(e); k++) e = `${local}${k}@${domain}`;
    emails.add(e);
    return e;
  };

  const contacts: Contact[] = added.map((addedAt, i) => {
    const r = rng(`contact:${i}`);
    const firstName = pick(r, FIRST);
    const lastName = pick(r, LAST);
    const company = r() < 0.55 ? pick(r, COMPANIES) : undefined;
    const f = slug(firstName);
    const l = slug(lastName);
    const local = company ? (r() < 0.6 ? `${f}.${l}` : `${f[0]}${l}`) : weighted(r, [[`${f}.${l}`, 4], [`${f}${l}`, 2], [`${f}.${l}${Math.floor(r() * 90) + 10}`, 2], [`${f[0]}${l}`, 1]]);
    const domain = company ? `${slug(company)}.com` : pick(r, FREE_MAIL);
    const tagCount = weighted(r, [["0", 45], ["1", 40], ["2", 15]]);
    const tags = new Set<string>();
    while (tags.size < Number(tagCount)) tags.add(pick(r, TAG_POOL));
    return {
      id: `ct-${String(n - i).padStart(5, "0")}`,
      email: unique(local, domain),
      firstName,
      lastName,
      mobile: r() < 0.6 ? phone(r) : undefined,
      phone: r() < 0.25 ? phone(r) : undefined,
      company,
      tags: [...tags],
      listIds: [],
      subscription: "subscribed",
      emailStatus: "valid",
      excluded: false,
      score: 0,
      source: weighted<ContactSource>(r, [["import", 45], ["form", 25], ["manual", 10], ["api", 10], ["integration", 10]]),
      engagement: "low",
      addedAt,
      updatedAt: addedAt,
    };
  });

  const all = contacts.map((_, i) => i);

  // Status: one stable shuffle, cut into exclusive bands.
  const status = ranked(all, "status");
  let p = 0;
  for (const i of status.slice(p, (p += UNSUBSCRIBED))) contacts[i].subscription = "unsubscribed";
  for (const i of status.slice(p, (p += INVALID))) {
    const c = contacts[i];
    c.emailStatus = "invalid";
    c.email = unique(c.email.split("@")[0], BAD_DOMAINS[hash(c.id) % BAD_DOMAINS.length]);
  }
  for (const i of status.slice(p, (p += SUPPRESSED))) {
    const c = contacts[i];
    const reason: SuppressionReason = weighted(rng(`sup:${c.id}`), [["hard-bounce", 60], ["spam-complaint", 25], ["manual", 15]]);
    c.suppression = { reason, at: earlier(addMinutes(c.addedAt, 60 * 24 * (3 + (hash(c.id) % 40))), DEMO_NOW) };
  }
  for (const i of status.slice(p, (p += EXCLUDED))) contacts[i].excluded = true;
  const reachable = status.slice(p);

  // Engagement: engaged levels go to reachable contacts; then a fixed number of inactive ones.
  const engagedRank = ranked(reachable, "engaged");
  engagedRank.slice(0, HIGHLY_ENGAGED).forEach((i) => (contacts[i].engagement = "highly-engaged"));
  engagedRank.slice(HIGHLY_ENGAGED, HIGHLY_ENGAGED + ENGAGED).forEach((i) => (contacts[i].engagement = "engaged"));
  const rest = all.filter((i) => contacts[i].engagement === "low");
  ranked(rest, "inactive")
    .slice(0, INACTIVE)
    .forEach((i) => (contacts[i].engagement = "inactive"));

  const SCORE: Record<EngagementLevel, [number, number]> = { "highly-engaged": [75, 100], engaged: [50, 80], low: [20, 55], inactive: [0, 25] };
  const LAST_SEEN: Record<EngagementLevel, [number, number]> = { "highly-engaged": [0, 6], engaged: [3, 29], low: [30, 89], inactive: [90, 220] };
  for (const c of contacts) {
    const r = rng(`eng:${c.id}`);
    const [lo, hi] = SCORE[c.engagement];
    c.score = Math.round(lo + r() * (hi - lo));
    const [from, to] = LAST_SEEN[c.engagement];
    const date = daysAgo(Math.round(from + r() * (to - from)));
    if (date < c.addedAt.slice(0, 10)) {
      // Can't engage before joining: low / inactive newcomers have never engaged; engaged ones did soon after joining.
      if (c.engagement === "inactive" || c.engagement === "low") continue;
      c.lastEngagedAt = earlier(addMinutes(c.addedAt, 90), DEMO_NOW);
    } else c.lastEngagedAt = earlier(`${date}T${two(8 + Math.floor(r() * 12))}:${two(Math.floor(r() * 60))}:00`, DEMO_NOW);
  }

  // Sources: an exact number of form signups in the last 30 days.
  const since = addDays(DEMO_TODAY, -30);
  const recent = all.filter((i) => contacts[i].addedAt.slice(0, 10) > since);
  const recentRank = ranked(recent, "form");
  recentRank.forEach((i, k) => {
    contacts[i].source = k < NEW_FORM_SIGNUPS ? "form" : weighted(rng(`src:${i}`), [["import", 50], ["manual", 20], ["api", 15], ["integration", 15]]);
  });

  // Lists: exact sizes from a stable shuffle of who is eligible.
  const members = new Map<string, number[]>();
  for (const l of LIST_SEEDS) {
    let pool = l.within ? (members.get(l.within) ?? []) : all;
    if (l.withTag) pool = pool.filter((i) => contacts[i].tags.includes(l.withTag!));
    if (l.needsMobile) pool = pool.filter((i) => !!contacts[i].mobile);
    const chosen = ranked(pool, l.id).slice(0, l.size);
    members.set(l.id, chosen);
    for (const i of chosen) contacts[i].listIds.push(l.id);
  }

  // Purchaser tag: a fixed number of customers.
  ranked(members.get("aud-customers") ?? [], "purchaser")
    .slice(0, PURCHASERS)
    .forEach((i) => contacts[i].tags.push("purchaser"));

  for (const c of contacts) c.updatedAt = later(c.updatedAt, c.suppression?.at ?? c.updatedAt);
  return contacts;
}

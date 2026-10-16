/**
 * Audience rules shared by the mock API and the screens: who is reachable,
 * which Contacts tab a contact belongs to, and how segment conditions match.
 * Pure functions only, so a backend can implement the same rules later.
 */
import { addDays } from "@/lib/format";
import type { Contact, ContactSource, ContactTab, EngagementLevel, SegmentCondition, SegmentField, SegmentOperator, SubscriptionStatus, SuppressionReason } from "@/lib/types/audience";

/** Practical email check (same rule for forms, imports and the API). */
export const EMAIL_RE = /^[^\s@"(),:;<>[\]\\]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;
export const isValidEmail = (v: string) => EMAIL_RE.test(v.trim());

export const normalizeEmail = (v: string) => v.trim().toLowerCase();

/** Tags are lower-case, trimmed, hyphenated and unique. */
export function normalizeTags(tags: string[]): string[] {
  const out = new Set<string>();
  for (const t of tags) {
    const v = t.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 40);
    if (v) out.add(v);
  }
  return [...out];
}

// ── Reachability ─────────────────────────────────────────────────────

export type UnreachableReason = "unsubscribed" | "invalid" | "suppressed" | "excluded";

/** The first reason a contact can't be sent to, or null when reachable. */
export function unreachableReason(c: Contact): UnreachableReason | null {
  if (c.subscription !== "subscribed") return "unsubscribed";
  if (c.emailStatus !== "valid") return "invalid";
  if (c.suppression) return "suppressed";
  if (c.excluded) return "excluded";
  return null;
}

export const isReachable = (c: Contact) => unreachableReason(c) === null;

export const CONTACT_TABS: { key: ContactTab; label: string; hint: string }[] = [
  { key: "reachable", label: "Reachable Contacts", hint: "Subscribed, valid and not suppressed or excluded — campaigns send to these." },
  { key: "all", label: "All Contacts", hint: "Every contact, whatever its status." },
  { key: "suppressed", label: "Suppressed Contacts", hint: "Blocked from sending after a hard bounce, a spam complaint or a manual suppression." },
  { key: "excluded", label: "Excluded Contacts", hint: "Still subscribed, but deliberately left out of every campaign." },
  { key: "invalid", label: "Invalid Contacts", hint: "The email address can't receive mail." },
];

export function inTab(c: Contact, tab: ContactTab): boolean {
  switch (tab) {
    case "all":
      return true;
    case "reachable":
      return isReachable(c);
    case "suppressed":
      return !!c.suppression;
    case "excluded":
      return c.excluded;
    case "invalid":
      return c.emailStatus === "invalid";
  }
}

// ── Labels ───────────────────────────────────────────────────────────

export const SUBSCRIPTION_LABEL: Record<SubscriptionStatus, string> = { subscribed: "Subscribed", unsubscribed: "Unsubscribed" };
export const SUPPRESSION_LABEL: Record<SuppressionReason, string> = { "hard-bounce": "Hard bounce", "spam-complaint": "Spam complaint", manual: "Suppressed manually" };
export const SOURCE_LABEL: Record<ContactSource, string> = { import: "Import", form: "Signup form", manual: "Added manually", api: "API", integration: "Integration" };
export const ENGAGEMENT_ORDER: EngagementLevel[] = ["highly-engaged", "engaged", "low", "inactive"];
export const ENGAGEMENT_LABEL: Record<EngagementLevel, string> = { "highly-engaged": "Highly engaged", engaged: "Engaged", low: "Low", inactive: "Inactive" };

export const contactName = (c: Pick<Contact, "firstName" | "lastName" | "email">) => [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email;

// ── Segment conditions ───────────────────────────────────────────────

type ValueKind = "text" | "option" | "days" | "date" | "none";

export interface SegmentFieldMeta {
  label: string;
  operators: SegmentOperator[];
  options?: { value: string; label: string }[];
}

/** Countries in the demo contact data. */
export const COUNTRY_OPTIONS = ["Australia", "Brazil", "Canada", "France", "Germany", "India", "Japan", "Spain", "United Kingdom", "United States"];

const TEXT_OPS: SegmentOperator[] = ["is", "is_not", "contains", "not_contains", "starts_with", "ends_with", "is_empty", "is_not_empty"];

export const SEGMENT_FIELDS: Record<SegmentField, SegmentFieldMeta> = {
  firstName: { label: "First Name", operators: TEXT_OPS },
  lastName: { label: "Last Name", operators: TEXT_OPS },
  email: { label: "Email", operators: TEXT_OPS },
  company: { label: "Company", operators: TEXT_OPS },
  country: { label: "Country", operators: ["is", "is_not", "is_empty", "is_not_empty"], options: COUNTRY_OPTIONS.map((c) => ({ value: c, label: c })) },
  tags: { label: "Tags", operators: ["contains", "not_contains", "is_empty", "is_not_empty"] },
  subscription: { label: "Subscription status", operators: ["is", "is_not"], options: Object.entries(SUBSCRIPTION_LABEL).map(([value, label]) => ({ value, label })) },
  emailStatus: { label: "Email status", operators: ["is", "is_not"], options: [{ value: "valid", label: "Valid" }, { value: "invalid", label: "Invalid" }] },
  addedAt: { label: "Added date", operators: ["in_last_days", "not_in_last_days", "before", "after"] },
  source: { label: "Contact source", operators: ["is", "is_not"], options: Object.entries(SOURCE_LABEL).map(([value, label]) => ({ value, label })) },
  engagement: { label: "Campaign engagement", operators: ["is", "is_not", "at_least", "at_most"], options: ENGAGEMENT_ORDER.map((value) => ({ value, label: ENGAGEMENT_LABEL[value] })) },
};

export const OPERATOR_LABEL: Record<SegmentOperator, string> = {
  is: "is",
  is_not: "is not",
  contains: "contains",
  not_contains: "does not contain",
  starts_with: "starts with",
  ends_with: "ends with",
  is_empty: "is empty",
  is_not_empty: "is not empty",
  in_last_days: "in the last (days)",
  not_in_last_days: "more than (days) ago",
  before: "is before",
  after: "is after",
  at_least: "is at least",
  at_most: "is at most",
};

/** What kind of value an operator takes on a field. */
export function valueKind(field: SegmentField, op: SegmentOperator): ValueKind {
  if (op === "is_empty" || op === "is_not_empty") return "none";
  if (op === "in_last_days" || op === "not_in_last_days") return "days";
  if (op === "before" || op === "after") return "date";
  return SEGMENT_FIELDS[field].options ? "option" : "text";
}

/** A condition that can be evaluated; incomplete rows are ignored, not matched. */
export function conditionComplete(c: SegmentCondition): boolean {
  const meta = SEGMENT_FIELDS[c.field];
  if (!meta || !meta.operators.includes(c.operator)) return false;
  const kind = valueKind(c.field, c.operator);
  if (kind === "none") return true;
  if (kind === "days") return /^\d+$/.test(c.value) && Number(c.value) > 0;
  if (kind === "date") return /^\d{4}-\d{2}-\d{2}$/.test(c.value);
  if (kind === "option") return !!meta.options?.some((o) => o.value === c.value);
  return c.value.trim().length > 0;
}

function textMatch(actual: string, op: SegmentOperator, raw: string): boolean {
  const a = actual.trim().toLowerCase();
  const v = raw.trim().toLowerCase();
  switch (op) {
    case "is":
      return a === v;
    case "is_not":
      return a !== v;
    case "contains":
      return a.includes(v);
    case "not_contains":
      return !a.includes(v);
    case "starts_with":
      return a.startsWith(v);
    case "ends_with":
      return a.endsWith(v);
    case "is_empty":
      return a === "";
    case "is_not_empty":
      return a !== "";
    default:
      return false;
  }
}

/** Whether one condition matches a contact. `today` is the demo date (YYYY-MM-DD). */
export function matchCondition(c: Contact, cond: SegmentCondition, today: string): boolean {
  const { field, operator: op, value } = cond;
  switch (field) {
    case "firstName":
    case "lastName":
    case "email":
    case "company":
      return textMatch(c[field] ?? "", op, value);
    case "tags": {
      const v = value.trim().toLowerCase();
      if (op === "is_empty") return c.tags.length === 0;
      if (op === "is_not_empty") return c.tags.length > 0;
      if (op === "contains") return c.tags.includes(v);
      if (op === "not_contains") return !c.tags.includes(v);
      return false;
    }
    case "subscription":
    case "source":
    case "emailStatus":
      return op === "is" ? c[field] === value : op === "is_not" ? c[field] !== value : false;
    case "country":
      if (op === "is_empty") return !c.country;
      if (op === "is_not_empty") return !!c.country;
      return op === "is" ? c.country === value : op === "is_not" ? c.country !== value : false;
    case "engagement": {
      const rank = (l: string) => ENGAGEMENT_ORDER.indexOf(l as EngagementLevel);
      if (op === "is") return c.engagement === value;
      if (op === "is_not") return c.engagement !== value;
      // Lower index = more engaged.
      if (op === "at_least") return rank(c.engagement) <= rank(value);
      if (op === "at_most") return rank(c.engagement) >= rank(value);
      return false;
    }
    case "addedAt": {
      const d = c.addedAt.slice(0, 10);
      if (op === "in_last_days") return d > addDays(today, -Number(value));
      if (op === "not_in_last_days") return d <= addDays(today, -Number(value));
      if (op === "before") return d < value;
      if (op === "after") return d > value;
      return false;
    }
  }
}

/**
 * A segment with no complete conditions matches nobody (an unfinished rule
 * must never quietly target every contact).
 */
export function segmentMatcher(match: "all" | "any", conditions: SegmentCondition[], today: string): (c: Contact) => boolean {
  const ready = conditions.filter(conditionComplete);
  if (!ready.length) return () => false;
  return match === "all" ? (c) => ready.every((x) => matchCondition(c, x, today)) : (c) => ready.some((x) => matchCondition(c, x, today));
}

/** "Subscription status is Subscribed", for summaries and tooltips. */
export function describeCondition(c: SegmentCondition): string {
  const meta = SEGMENT_FIELDS[c.field];
  const kind = valueKind(c.field, c.operator);
  const value = kind === "option" ? (meta.options?.find((o) => o.value === c.value)?.label ?? c.value) : c.value;
  if (kind === "none") return `${meta.label} ${OPERATOR_LABEL[c.operator]}`;
  if (c.operator === "in_last_days") return `${meta.label} in the last ${value} days`;
  if (c.operator === "not_in_last_days") return `${meta.label} more than ${value} days ago`;
  return `${meta.label} ${OPERATOR_LABEL[c.operator]} ${kind === "text" ? `“${value}”` : value}`;
}

/** A campaign can target up to this many lists and segments together. */
export const MAX_AUDIENCE_SOURCES = 10;

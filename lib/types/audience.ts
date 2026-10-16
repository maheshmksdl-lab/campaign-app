/**
 * Contacts, lists and segments. A contact's reachability is the combination of
 * four independent facts — subscription, email validity, suppression and a
 * manual exclusion — so the Contacts tabs never contradict each other:
 * reachable = subscribed AND valid email AND not suppressed AND not excluded.
 * Dates are local datetimes (YYYY-MM-DDTHH:mm:ss), as for campaigns.
 */

export type SubscriptionStatus = "subscribed" | "unsubscribed";
/** Whether the address can receive mail at all (syntax, domain, mailbox). */
export type EmailStatus = "valid" | "invalid";
export type SuppressionReason = "hard-bounce" | "spam-complaint" | "manual";
export type ContactSource = "import" | "form" | "manual" | "api" | "integration";
/** Ordered from most to least engaged. */
export type EngagementLevel = "highly-engaged" | "engaged" | "low" | "inactive";

export interface Contact {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  mobile?: string;
  company?: string;
  country?: string;
  tags: string[];
  /** Static list membership; segments are computed from the other fields. */
  listIds: string[];
  subscription: SubscriptionStatus;
  emailStatus: EmailStatus;
  /** Set while sending to this contact is blocked. */
  suppression?: { reason: SuppressionReason; at: string };
  /** Kept out of every campaign by choice, while staying subscribed. */
  excluded: boolean;
  /** 0–100, from engagement. */
  score: number;
  source: ContactSource;
  engagement: EngagementLevel;
  lastEngagedAt?: string;
  addedAt: string;
  updatedAt: string;
}

export type ContactTab = "reachable" | "all" | "suppressed" | "excluded" | "invalid";

export const CONTACT_SORT_KEYS = ["email", "firstName", "lastName", "mobile", "phone", "score", "addedAt"] as const;
export type ContactSortKey = (typeof CONTACT_SORT_KEYS)[number];

export interface ContactQuery {
  tab: ContactTab;
  search?: string;
  sort?: { key: ContactSortKey; dir: "asc" | "desc" };
  page: number;
  pageSize: number;
  listId?: string;
  segmentId?: string;
  tag?: string;
  subscription?: SubscriptionStatus;
  source?: ContactSource;
  emailStatus?: EmailStatus;
  /** Added in the last N days. */
  addedWithinDays?: number;
}

export interface ContactPage {
  rows: Contact[];
  /** Matches across all pages for the current tab and filters. */
  total: number;
  page: number;
  pageSize: number;
  /** Per-tab totals with the same search and filters applied. */
  counts: Record<ContactTab, number>;
}

/** What a person can type into the Add / Edit Contact form. */
export interface ContactInput {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  mobile?: string;
  company?: string;
  country?: string;
  tags: string[];
  listIds: string[];
  subscription: SubscriptionStatus;
  /** Manual suppression on / off; bounces and complaints are set by the system. */
  suppressed: boolean;
  excluded: boolean;
}

export interface ContactEngagementRow {
  campaignId: string;
  campaignName: string;
  sentAt: string;
  opened: boolean;
  clicked: boolean;
}

export interface ContactActivityRow {
  at: string;
  kind: "added" | "list" | "opened" | "clicked" | "unsubscribed" | "suppressed" | "edited";
  text: string;
}

export interface ContactDetail {
  contact: Contact;
  lists: { id: string; name: string }[];
  segments: { id: string; name: string }[];
  engagement: ContactEngagementRow[];
  activity: ContactActivityRow[];
}

// ── Import ───────────────────────────────────────────────────────────

/** Contact fields a CSV column can map to. */
export const IMPORT_FIELDS = ["email", "firstName", "lastName", "phone", "mobile", "company", "tags"] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
export type ImportRow = Partial<Record<ImportField, string>>;

export interface ImportOptions {
  /** Existing list to add every imported contact to. */
  listId?: string;
  /** Name of a list to create for this import. */
  newListName?: string;
  tags: string[];
  /** For rows whose email already exists: skip them, or update the existing contact. */
  duplicates: "skip" | "update";
}

export interface ImportSummary {
  imported: number;
  updated: number;
  skipped: number;
  invalid: number;
  listId?: string;
}

// ── Lists ────────────────────────────────────────────────────────────

export interface ContactList {
  id: string;
  name: string;
  description: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/** A campaign that targets a list or segment (shown before deleting it). */
export interface AudienceUsage {
  id: string;
  name: string;
  status: string;
}

export interface ListSummary extends ContactList {
  contactCount: number;
  reachableCount: number;
  usedBy: AudienceUsage[];
}

export interface ListInput {
  name: string;
  description: string;
  tags: string[];
}

// ── Segments ─────────────────────────────────────────────────────────

export type SegmentField = "firstName" | "lastName" | "email" | "company" | "country" | "tags" | "subscription" | "emailStatus" | "addedAt" | "source" | "engagement";

export type SegmentOperator =
  | "is"
  | "is_not"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "is_empty"
  | "is_not_empty"
  | "in_last_days"
  | "not_in_last_days"
  | "before"
  | "after"
  | "at_least"
  | "at_most";

export interface SegmentCondition {
  id: string;
  field: SegmentField;
  operator: SegmentOperator;
  /** Text, an option value, a number of days or a YYYY-MM-DD date, by operator. */
  value: string;
}

export interface Segment {
  id: string;
  name: string;
  description: string;
  /** "all" = AND, "any" = OR. */
  match: "all" | "any";
  conditions: SegmentCondition[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface SegmentSummary extends Segment {
  contactCount: number;
  reachableCount: number;
  usedBy: AudienceUsage[];
}

export interface SegmentInput {
  name: string;
  description: string;
  match: "all" | "any";
  conditions: SegmentCondition[];
}

// ── Campaign audiences ───────────────────────────────────────────────

/** Lists and segments a campaign sends to, and what it leaves out. */
export interface AudienceSelection {
  listIds: string[];
  segmentIds: string[];
  excludeListIds?: string[];
  excludeSegmentIds?: string[];
  excludeContactIds?: string[];
}

export interface AudienceEstimate {
  /** Unique contacts across the selected lists and segments. */
  total: number;
  /** Removed by the campaign's own exclusions. */
  excludedBySelection: number;
  /** Not reachable (unsubscribed, invalid, suppressed or excluded contacts). */
  unreachable: number;
  /** Who would actually receive the campaign. */
  eligible: number;
  /** Why unreachable contacts are left out (a contact counts once, first reason wins). */
  reasons: { unsubscribed: number; invalid: number; suppressed: number; excluded: number };
  /** Size of each selected list / segment on its own. */
  sources: { id: string; kind: "list" | "segment"; name: string; total: number }[];
}

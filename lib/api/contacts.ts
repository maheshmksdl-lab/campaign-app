/**
 * Mock Contacts API. Listing is paged and filtered here (as a server would),
 * so screens never hold all 12k+ contacts. Nothing leaves the browser.
 */
import { CONTACT_TABS, inTab, isValidEmail, normalizeEmail, normalizeTags, segmentMatcher } from "@/lib/audience";
import { addMinutes, formatNumber, pluralize } from "@/lib/format";
import { CURRENT_USER, hash, rng } from "@/lib/mock-data/campaigns";
import type { Contact, ContactActivityRow, ContactDetail, ContactEngagementRow, ContactInput, ContactPage, ContactQuery, ContactTab, ImportField, ImportOptions, ImportRow, ImportSummary } from "@/lib/types/audience";
import type { ActivityEntry } from "@/lib/types/campaigns";
import { audienceSource, segmentMembers, today } from "./audiences";
import { ApiError, type BulkResult } from "./errors";
import { activity, campaigns, clone, commit, contacts, delay, demoNow, lists, newId, replaceContacts, segments } from "./store";

function log(entry: Omit<ActivityEntry, "id" | "at">) {
  activity().unshift({ ...entry, id: newId("act"), at: demoNow() });
}

function find(id: string): Contact {
  const c = contacts().find((x) => x.id === id);
  if (!c) throw new ApiError("Contact not found");
  return c;
}

const emailTaken = (email: string, exceptId?: string) => {
  const e = normalizeEmail(email);
  return contacts().some((c) => c.id !== exceptId && c.email.toLowerCase() === e);
};

// ── Listing ──────────────────────────────────────────────────────────

/** Text matches email, name or company; 3+ digits also match phone numbers. */
function matchesSearch(c: Contact, t: string, digits: string): boolean {
  if (c.email.toLowerCase().includes(t) || `${c.firstName} ${c.lastName}`.toLowerCase().includes(t) || (c.company ?? "").toLowerCase().includes(t)) return true;
  return digits.length >= 3 && [c.mobile, c.phone].some((p) => p?.replace(/\D/g, "").includes(digits));
}

/** Contacts matching the query's search and filters (every tab). */
function filtered(q: Omit<ContactQuery, "tab" | "page" | "pageSize" | "sort">): Contact[] {
  const t = q.search?.trim().toLowerCase() ?? "";
  const digits = t.replace(/\D/g, "");
  const seg = q.segmentId ? segments().find((s) => s.id === q.segmentId) : undefined;
  const inSeg = seg ? new Set(segmentMembers(seg).map((c) => c.id)) : null;
  return contacts().filter(
    (c) =>
      (!t || matchesSearch(c, t, digits)) &&
      (!q.listId || c.listIds.includes(q.listId)) &&
      (!inSeg || inSeg.has(c.id)) &&
      (!q.tag || c.tags.includes(q.tag)) &&
      (!q.subscription || c.subscription === q.subscription) &&
      (!q.source || c.source === q.source),
  );
}

function sortContacts(rows: Contact[], sort: ContactQuery["sort"]): Contact[] {
  const { key, dir } = sort ?? { key: "addedAt", dir: "desc" };
  const m = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = a[key];
    const y = b[key];
    // Empty values sort last in either direction.
    if (x === undefined || x === "") return y === undefined || y === "" ? 0 : 1;
    if (y === undefined || y === "") return -1;
    const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { sensitivity: "base" });
    return r * m || a.id.localeCompare(b.id) * m;
  });
}

export async function listContacts(q: ContactQuery): Promise<ContactPage> {
  await delay();
  const base = filtered(q);
  const counts = Object.fromEntries(CONTACT_TABS.map((t) => [t.key, 0])) as Record<ContactTab, number>;
  for (const c of base) for (const t of CONTACT_TABS) if (inTab(c, t.key)) counts[t.key]++;
  const rows = sortContacts(base.filter((c) => inTab(c, q.tab)), q.sort);
  const pageSize = Math.max(1, Math.min(200, q.pageSize));
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(Math.max(1, q.page), pages);
  return { rows: clone(rows.slice((page - 1) * pageSize, page * pageSize)), total: rows.length, page, pageSize, counts };
}

/** Every tag in use, most used first. */
export async function getContactTags(): Promise<{ tag: string; count: number }[]> {
  await delay(40);
  const m = new Map<string, number>();
  for (const c of contacts()) for (const t of c.tags) m.set(t, (m.get(t) ?? 0) + 1);
  return [...m].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

// ── Profile ──────────────────────────────────────────────────────────

/** Opens and clicks are seeded per contact and campaign, and only happen up to the contact's last engagement. */
function engagementFor(c: Contact): ContactEngagementRow[] {
  const chance: Record<Contact["engagement"], [number, number]> = { "highly-engaged": [0.85, 0.35], engaged: [0.55, 0.14], low: [0.18, 0.03], inactive: [0.1, 0.01] };
  const [pOpen, pClick] = chance[c.engagement];
  return campaigns()
    .filter((x) => x.type === "email" && x.sentAt && x.sent && x.sentAt > c.addedAt && (x.status === "sent" || x.status === "sending" || x.status === "archived"))
    .filter((x) => audienceSource(x.audienceId)?.members.some((m) => m.id === c.id))
    .sort((a, b) => b.sentAt!.localeCompare(a.sentAt!))
    .slice(0, 12)
    .map((x) => {
      const r = rng(`${c.id}:${x.id}`);
      const canEngage = !!c.lastEngagedAt && x.sentAt! <= c.lastEngagedAt;
      const opened = canEngage && r() < pOpen;
      return { campaignId: x.id, campaignName: x.name, sentAt: x.sentAt!, opened, clicked: opened && r() < pClick / pOpen };
    });
}

function activityFor(c: Contact, engagement: ContactEngagementRow[]): ContactActivityRow[] {
  const rows: ContactActivityRow[] = [{ at: c.addedAt, kind: "added", text: `Added via ${c.source === "form" ? "signup form" : c.source === "manual" ? "manual entry" : c.source}` }];
  for (const id of c.listIds) {
    const l = lists().find((x) => x.id === id);
    if (l) rows.push({ at: l.createdAt > c.addedAt ? l.createdAt : addMinutes(c.addedAt, 1), kind: "list", text: `Added to ${l.name}` });
  }
  for (const e of engagement) {
    const minutes = 30 + (hash(`${c.id}:${e.campaignId}`) % 600);
    if (e.opened) rows.push({ at: addMinutes(e.sentAt, minutes), kind: "opened", text: `Opened “${e.campaignName}”` });
    if (e.clicked) rows.push({ at: addMinutes(e.sentAt, minutes + 2), kind: "clicked", text: `Clicked a link in “${e.campaignName}”` });
  }
  if (c.suppression) rows.push({ at: c.suppression.at, kind: "suppressed", text: c.suppression.reason === "hard-bounce" ? "Suppressed after a hard bounce" : c.suppression.reason === "spam-complaint" ? "Suppressed after a spam complaint" : "Suppressed manually" });
  const now = demoNow();
  if (c.subscription === "unsubscribed") {
    // Seeded contacts carry no change date, so place it a seeded number of days after joining.
    const at = c.updatedAt > c.addedAt ? c.updatedAt : addMinutes(c.addedAt, 60 * 24 * (5 + (hash(c.id) % 60)));
    rows.push({ at: at < now ? at : now, kind: "unsubscribed", text: "Unsubscribed from marketing email" });
  }
  return rows.filter((r) => r.at <= now).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20);
}

export async function getContact(id: string): Promise<ContactDetail> {
  await delay();
  const c = find(id);
  const t = today();
  const engagement = engagementFor(c);
  return clone({
    contact: c,
    lists: lists().filter((l) => c.listIds.includes(l.id)).map((l) => ({ id: l.id, name: l.name })),
    segments: segments().filter((s) => segmentMatcher(s.match, s.conditions, t)(c)).map((s) => ({ id: s.id, name: s.name })),
    engagement,
    activity: activityFor(c, engagement),
  });
}

// ── Create / edit ────────────────────────────────────────────────────

const clean = (v: string | undefined) => v?.trim() || undefined;

function validate(input: ContactInput, exceptId?: string) {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) throw new ApiError("Enter a valid email address", "email");
  if (emailTaken(email, exceptId)) throw new ApiError("A contact with this email already exists", "email");
  const known = new Set(lists().map((l) => l.id));
  return { email, listIds: [...new Set(input.listIds)].filter((id) => known.has(id)), tags: normalizeTags(input.tags) };
}

export async function createContact(input: ContactInput): Promise<Contact> {
  await delay();
  const { email, listIds, tags } = validate(input);
  const now = demoNow();
  const c: Contact = {
    id: newId("ct"),
    email,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    phone: clean(input.phone),
    mobile: clean(input.mobile),
    company: clean(input.company),
    tags,
    listIds,
    subscription: input.subscription,
    emailStatus: "valid",
    suppression: input.suppressed ? { reason: "manual", at: now } : undefined,
    excluded: input.excluded,
    score: 10,
    source: "manual",
    engagement: "low",
    addedAt: now,
    updatedAt: now,
  };
  contacts().unshift(c);
  log({ kind: "contacts", title: "Contact added", detail: email });
  commit();
  return clone(c);
}

/**
 * Bounce and complaint suppressions are set by the system and stay; only a
 * manual suppression can be switched off here. Correcting an invalid address
 * marks it valid again.
 */
export async function updateContact(id: string, input: ContactInput): Promise<Contact> {
  await delay();
  const c = find(id);
  const { email, listIds, tags } = validate(input, id);
  const now = demoNow();
  if (email !== c.email) c.emailStatus = "valid";
  Object.assign(c, {
    email,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    phone: clean(input.phone),
    mobile: clean(input.mobile),
    company: clean(input.company),
    tags,
    listIds,
    subscription: input.subscription,
    excluded: input.excluded,
    updatedAt: now,
  });
  if (input.suppressed && !c.suppression) c.suppression = { reason: "manual", at: now };
  if (!input.suppressed && c.suppression?.reason === "manual") c.suppression = undefined;
  commit();
  return clone(c);
}

// ── Bulk actions ─────────────────────────────────────────────────────

function eachContact(ids: string[], change: (c: Contact) => boolean): BulkResult {
  const wanted = new Set(ids);
  const now = demoNow();
  let done = 0;
  for (const c of contacts()) {
    if (!wanted.has(c.id)) continue;
    if (change(c)) {
      c.updatedAt = now;
      done++;
    }
  }
  return { done, skipped: ids.length - done };
}

function touchList(listId: string) {
  const l = lists().find((x) => x.id === listId);
  if (!l) throw new ApiError("List not found", "listId");
  l.updatedAt = demoNow();
  return l;
}

export async function addContactsToList(ids: string[], listId: string): Promise<BulkResult> {
  await delay();
  const l = touchList(listId);
  const r = eachContact(ids, (c) => (c.listIds.includes(listId) ? false : (c.listIds.push(listId), true)));
  if (r.done) log({ kind: "list", title: l.name, detail: `${pluralize(r.done, "contact")} added` });
  commit();
  return r;
}

export async function removeContactsFromList(ids: string[], listId: string): Promise<BulkResult> {
  await delay();
  const l = touchList(listId);
  const r = eachContact(ids, (c) => {
    const i = c.listIds.indexOf(listId);
    if (i === -1) return false;
    c.listIds.splice(i, 1);
    return true;
  });
  if (r.done) log({ kind: "list", title: l.name, detail: `${pluralize(r.done, "contact")} removed` });
  commit();
  return r;
}

export async function addContactTags(ids: string[], tags: string[]): Promise<BulkResult> {
  await delay();
  const add = normalizeTags(tags);
  if (!add.length) throw new ApiError("Enter at least one tag", "tags");
  const r = eachContact(ids, (c) => {
    const before = c.tags.length;
    c.tags = normalizeTags([...c.tags, ...add]);
    return c.tags.length !== before;
  });
  commit();
  return r;
}

export async function removeContactTags(ids: string[], tags: string[]): Promise<BulkResult> {
  await delay();
  const drop = new Set(normalizeTags(tags));
  const r = eachContact(ids, (c) => {
    const before = c.tags.length;
    c.tags = c.tags.filter((t) => !drop.has(t));
    return c.tags.length !== before;
  });
  commit();
  return r;
}

/** Excluded contacts stay subscribed but are left out of every campaign. */
export async function setContactsExcluded(ids: string[], excluded: boolean): Promise<BulkResult> {
  await delay();
  const r = eachContact(ids, (c) => (c.excluded === excluded ? false : ((c.excluded = excluded), true)));
  if (r.done) log({ kind: "contacts", title: excluded ? "Contacts excluded" : "Exclusion removed", detail: `${pluralize(r.done, "contact")} ${excluded ? "will be left out of campaigns" : "can receive campaigns again"}` });
  commit();
  return r;
}

export async function setContactsSubscription(ids: string[], status: Contact["subscription"]): Promise<BulkResult> {
  await delay();
  const r = eachContact(ids, (c) => (c.subscription === status ? false : ((c.subscription = status), true)));
  if (r.done) log({ kind: "contacts", title: status === "subscribed" ? "Contacts resubscribed" : "Contacts unsubscribed", detail: pluralize(r.done, "contact") });
  commit();
  return r;
}

export async function deleteContacts(ids: string[]): Promise<BulkResult> {
  await delay();
  const drop = new Set(ids);
  const before = contacts().length;
  replaceContacts(contacts().filter((c) => !drop.has(c.id)));
  const done = before - contacts().length;
  if (done) log({ kind: "deleted", title: done === 1 ? "Contact deleted" : `${formatNumber(done)} contacts deleted`, detail: "Removed from every list" });
  commit();
  return { done, skipped: ids.length - done };
}

/** Full records for a CSV download: chosen ids, or everything matching a query (all pages). */
export async function exportContacts(sel: { ids: string[] } | { query: ContactQuery }): Promise<Contact[]> {
  await delay(80);
  if ("ids" in sel) {
    const wanted = new Set(sel.ids);
    return clone(contacts().filter((c) => wanted.has(c.id)));
  }
  return clone(sortContacts(filtered(sel.query).filter((c) => inTab(c, sel.query.tab)), sel.query.sort));
}

// ── Import ───────────────────────────────────────────────────────────

export type ImportRowStatus = "new" | "existing" | "duplicate" | "invalid";

export interface ImportCheck {
  rows: { status: ImportRowStatus; reason?: string }[];
  counts: Record<ImportRowStatus, number>;
}

/** What would happen to each mapped row, before importing (preview step). */
export async function checkImport(rows: ImportRow[]): Promise<ImportCheck> {
  await delay(80);
  const existing = new Set(contacts().map((c) => c.email.toLowerCase()));
  const seen = new Set<string>();
  const counts: ImportCheck["counts"] = { new: 0, existing: 0, duplicate: 0, invalid: 0 };
  const out = rows.map((r) => {
    const email = normalizeEmail(r.email ?? "");
    let res: ImportCheck["rows"][number];
    if (!email) res = { status: "invalid", reason: "Missing email" };
    else if (!isValidEmail(email)) res = { status: "invalid", reason: "Invalid email" };
    else if (seen.has(email)) res = { status: "duplicate", reason: "Repeated in this file" };
    else if (existing.has(email)) res = { status: "existing", reason: "Already a contact" };
    else res = { status: "new" };
    if (email) seen.add(email);
    counts[res.status]++;
    return res;
  });
  return { rows: out, counts };
}

const FIELD_SETTERS: Record<Exclude<ImportField, "email" | "tags">, keyof Contact> = { firstName: "firstName", lastName: "lastName", phone: "phone", mobile: "mobile", company: "company" };

export async function importContacts(rows: ImportRow[], options: ImportOptions): Promise<ImportSummary> {
  await delay(300);
  let listId = options.listId;
  if (options.newListName?.trim()) {
    const name = options.newListName.trim();
    if (lists().some((l) => l.name.toLowerCase() === name.toLowerCase())) throw new ApiError("A list with this name already exists", "newListName");
    const now = demoNow();
    listId = newId("lst");
    lists().unshift({ id: listId, name, description: `Created by a contact import on ${now.slice(0, 10)}.`, tags: [], createdAt: now, updatedAt: now, createdBy: CURRENT_USER.name });
  } else if (listId && !lists().some((l) => l.id === listId)) throw new ApiError("Choose an existing list", "listId");

  const tags = normalizeTags(options.tags);
  const byEmail = new Map(contacts().map((c) => [c.email.toLowerCase(), c]));
  const seen = new Set<string>();
  const now = demoNow();
  const created: Contact[] = [];
  const summary: ImportSummary = { imported: 0, updated: 0, skipped: 0, invalid: 0, listId };

  for (const r of rows) {
    const email = normalizeEmail(r.email ?? "");
    if (!isValidEmail(email)) {
      summary.invalid++;
      continue;
    }
    if (seen.has(email)) {
      summary.skipped++;
      continue;
    }
    seen.add(email);
    const rowTags = normalizeTags([...(r.tags ?? "").split(/[,;|]/), ...tags]);
    const found = byEmail.get(email);
    if (found) {
      if (options.duplicates === "skip") {
        summary.skipped++;
        continue;
      }
      // Update: fill in what the file provides, keep everything else.
      for (const [field, key] of Object.entries(FIELD_SETTERS)) {
        const v = r[field as ImportField]?.trim();
        if (v) (found as unknown as Record<string, unknown>)[key] = v;
      }
      found.tags = normalizeTags([...found.tags, ...rowTags]);
      if (listId && !found.listIds.includes(listId)) found.listIds.push(listId);
      found.updatedAt = now;
      summary.updated++;
      continue;
    }
    created.push({
      id: newId("ct"),
      email,
      firstName: r.firstName?.trim() ?? "",
      lastName: r.lastName?.trim() ?? "",
      phone: clean(r.phone),
      mobile: clean(r.mobile),
      company: clean(r.company),
      tags: rowTags,
      listIds: listId ? [listId] : [],
      subscription: "subscribed",
      emailStatus: "valid",
      excluded: false,
      score: 10,
      source: "import",
      engagement: "low",
      addedAt: now,
      updatedAt: now,
    });
    summary.imported++;
  }
  contacts().unshift(...created);
  if (summary.imported || summary.updated) {
    log({ kind: "contacts", title: "Contacts imported", detail: [summary.imported && `Added ${formatNumber(summary.imported)} new`, summary.updated && `updated ${formatNumber(summary.updated)}`].filter(Boolean).join(", ") });
  }
  commit();
  return summary;
}

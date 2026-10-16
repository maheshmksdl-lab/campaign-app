/** Mock Segments API: saved rules evaluated against the contacts whenever they're read. */
import { conditionComplete, SEGMENT_FIELDS } from "@/lib/audience";
import { CURRENT_USER } from "@/lib/mock-data/campaigns";
import type { Contact, Segment, SegmentInput, SegmentSummary } from "@/lib/types/audience";
import type { ActivityEntry, Campaign } from "@/lib/types/campaigns";
import { audienceUsage, reachableCount, segmentMembers } from "./audiences";
import { ApiError } from "./errors";
import { activity, campaigns, clone, commit, delay, demoNow, newId, replaceSegments, segments } from "./store";

function log(entry: Omit<ActivityEntry, "id" | "at">) {
  activity().unshift({ ...entry, id: newId("act"), at: demoNow() });
}

function find(id: string): Segment {
  const s = segments().find((x) => x.id === id);
  if (!s) throw new ApiError("Segment not found");
  return s;
}

function summary(s: Segment): SegmentSummary {
  const members = segmentMembers(s);
  return { ...s, contactCount: members.length, reachableCount: reachableCount(members), usedBy: audienceUsage(s.id) };
}

function validate(input: SegmentInput, exceptId?: string): SegmentInput {
  const name = input.name.trim();
  if (name.length < 2) throw new ApiError("Enter a segment name (at least 2 characters)", "name");
  if (name.length > 80) throw new ApiError("Keep the name under 80 characters", "name");
  if (segments().some((s) => s.id !== exceptId && s.name.toLowerCase() === name.toLowerCase())) throw new ApiError("A segment with this name already exists", "name");
  const conditions = input.conditions.filter((c) => SEGMENT_FIELDS[c.field]);
  if (!conditions.length) throw new ApiError("Add at least one condition", "conditions");
  if (conditions.some((c) => !conditionComplete(c))) throw new ApiError("Complete or remove the unfinished conditions", "conditions");
  return { name, description: input.description.trim(), match: input.match === "any" ? "any" : "all", conditions: conditions.map((c) => ({ ...c, value: c.value.trim() })) };
}

function uniqueName(base: string): string {
  const names = new Set(segments().map((s) => s.name.toLowerCase()));
  if (!names.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) if (!names.has(`${base} (${i})`.toLowerCase())) return `${base} (${i})`;
}

/** Newest first. */
export async function listSegments(): Promise<SegmentSummary[]> {
  await delay();
  return clone([...segments()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(summary));
}

export async function getSegment(id: string): Promise<SegmentSummary> {
  await delay();
  return clone(summary(find(id)));
}

export interface SegmentPreview {
  contactCount: number;
  reachableCount: number;
  /** A few matching contacts to show in the builder. */
  sample: Pick<Contact, "id" | "email" | "firstName" | "lastName">[];
}

/** Live estimate for an unsaved definition (incomplete conditions are ignored). */
export async function previewSegment(def: Pick<SegmentInput, "match" | "conditions">): Promise<SegmentPreview> {
  await delay(60);
  const members = segmentMembers({ match: def.match, conditions: def.conditions });
  return { contactCount: members.length, reachableCount: reachableCount(members), sample: members.slice(0, 5).map(({ id, email, firstName, lastName }) => ({ id, email, firstName, lastName })) };
}

export async function createSegment(input: SegmentInput): Promise<SegmentSummary> {
  await delay();
  const v = validate(input);
  const now = demoNow();
  const s: Segment = { id: newId("seg"), ...v, createdAt: now, updatedAt: now, createdBy: CURRENT_USER.name };
  segments().unshift(s);
  log({ kind: "segment", title: s.name, detail: "Segment created" });
  commit();
  return clone(summary(s));
}

export async function updateSegment(id: string, input: SegmentInput): Promise<SegmentSummary> {
  await delay();
  const s = find(id);
  const v = validate(input, id);
  const renamed = v.name !== s.name;
  Object.assign(s, v, { updatedAt: demoNow() });
  if (renamed) for (const c of campaigns()) if (c.audienceId === id && c.status !== "sent" && c.status !== "sending" && c.status !== "archived") c.audience = v.name;
  commit();
  return clone(summary(s));
}

export async function duplicateSegment(id: string): Promise<SegmentSummary> {
  await delay();
  const src = find(id);
  const now = demoNow();
  const copy: Segment = { ...clone(src), id: newId("seg"), name: uniqueName(`Copy of ${src.name}`), createdAt: now, updatedAt: now, createdBy: CURRENT_USER.name };
  segments().splice(segments().indexOf(src), 0, copy);
  log({ kind: "segment", title: copy.name, detail: `Duplicated from ${src.name}` });
  commit();
  return clone(summary(copy));
}

/** Deletes the rule only; contacts are untouched. Affected campaigns get a history note. */
export async function deleteSegment(id: string): Promise<{ affected: Pick<Campaign, "id" | "name">[] }> {
  await delay();
  const s = find(id);
  const usage = audienceUsage(id);
  const now = demoNow();
  replaceSegments(segments().filter((x) => x.id !== id));
  for (const u of usage) {
    const c = campaigns().find((x) => x.id === u.id);
    if (!c) continue;
    c.history.push({ at: now, kind: "edited", text: `Audience segment “${s.name}” was deleted — choose a new audience before sending`, user: CURRENT_USER.name });
    c.updatedAt = now;
  }
  log({ kind: "deleted", title: s.name, detail: "Segment deleted" });
  commit();
  return { affected: usage.map(({ id: cid, name }) => ({ id: cid, name })) };
}

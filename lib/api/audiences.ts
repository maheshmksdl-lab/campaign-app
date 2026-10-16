/**
 * Audience lookups shared by the mock APIs: list and segment members, which
 * campaigns use them, and how many people a campaign would reach. Derived
 * values are cached until the store next changes.
 */
import { segmentMatcher, unreachableReason, MAX_AUDIENCE_SOURCES } from "@/lib/audience";
import type { AudienceEstimate, AudienceSelection, AudienceUsage, Contact, Segment } from "@/lib/types/audience";
import type { Audience, Campaign } from "@/lib/types/campaigns";
import { ApiError } from "./errors";
import { campaigns, contacts, delay, demoNow, derived, lists, segments } from "./store";

export const today = () => demoNow().slice(0, 10);

/** Members of every list, built in one pass over the contacts. */
function listIndex(): Map<string, Contact[]> {
  return derived("list-index", () => {
    const m = new Map<string, Contact[]>(lists().map((l) => [l.id, []]));
    for (const c of contacts()) for (const id of c.listIds) m.get(id)?.push(c);
    return m;
  });
}

export const listMembers = (listId: string): Contact[] => listIndex().get(listId) ?? [];

/** Members of a saved segment (cached) or of an unsaved definition (computed). */
export function segmentMembers(seg: Pick<Segment, "match" | "conditions"> & { id?: string }): Contact[] {
  const run = () => {
    const match = segmentMatcher(seg.match, seg.conditions, today());
    return contacts().filter(match);
  };
  return seg.id ? derived(`segment:${seg.id}`, run) : run();
}

export const reachableCount = (members: Contact[]) => members.reduce((n, c) => n + (unreachableReason(c) ? 0 : 1), 0);

/** A list or segment by id, with its members. */
export function audienceSource(id: string): { id: string; kind: "list" | "segment"; name: string; members: Contact[] } | null {
  const l = lists().find((x) => x.id === id);
  if (l) return { id, kind: "list", name: l.name, members: listMembers(id) };
  const s = segments().find((x) => x.id === id);
  if (s) return { id, kind: "segment", name: s.name, members: segmentMembers(s) };
  return null;
}

/** The campaign-facing summary of a list or segment: who it would reach. */
export function liveAudience(id: string): Audience | undefined {
  const src = audienceSource(id);
  return src ? { id, name: src.name, kind: src.kind, size: derived(`reach:${id}`, () => reachableCount(src.members)) } : undefined;
}

/** A campaign's selected lists and segments (older records hold only `audienceId`). */
export const campaignAudienceIds = (c: Pick<Campaign, "audienceId" | "audienceIds">): string[] => (c.audienceIds?.length ? c.audienceIds : c.audienceId ? [c.audienceId] : []);

/** Label and reach for a selection: "Customers + 2 more", unique eligible contacts. */
export function selectionSummary(ids: string[]): { ids: string[]; label: string; recipients: number } {
  const valid = [...new Set(ids)].filter((id) => !!audienceSource(id));
  if (valid.length > MAX_AUDIENCE_SOURCES) throw new ApiError(`Choose up to ${MAX_AUDIENCE_SOURCES} lists or segments`, "audience");
  if (!valid.length) return { ids: [], label: "", recipients: 0 };
  const first = audienceSource(valid[0])!.name;
  const listIds = valid.filter((id) => lists().some((l) => l.id === id));
  const segmentIds = valid.filter((id) => !listIds.includes(id));
  return { ids: valid, label: valid.length === 1 ? first : `${first} + ${valid.length - 1} more`, recipients: estimateAudienceNow({ listIds, segmentIds }).eligible };
}

/** Campaigns that will still send to this list or segment (drafts, scheduled, paused before sending). */
export function audienceUsage(id: string): AudienceUsage[] {
  return campaigns()
    .filter((c: Campaign) => campaignAudienceIds(c).includes(id) && (c.status === "draft" || c.status === "scheduled" || (c.status === "paused" && c.pausedFrom === "scheduled")))
    .map((c) => ({ id: c.id, name: c.name, status: c.status }));
}

/** Every list, then every segment, for audience pickers. */
export async function getAudiences(): Promise<Audience[]> {
  await delay(40);
  return [...lists(), ...segments()].map((x) => liveAudience(x.id)!).filter(Boolean);
}

/** Unique, eligible recipients for a selection of lists and segments, after exclusions. */
export function estimateAudienceNow(sel: AudienceSelection): AudienceEstimate {
  const ids = [...new Set([...sel.listIds, ...sel.segmentIds])];
  if (ids.length > MAX_AUDIENCE_SOURCES) throw new ApiError(`Choose up to ${MAX_AUDIENCE_SOURCES} lists or segments`, "audience");
  const sources = ids.map(audienceSource).filter((s): s is NonNullable<typeof s> => !!s);

  const included = new Map<string, Contact>();
  for (const s of sources) for (const c of s.members) included.set(c.id, c);

  const excludedIds = new Set(sel.excludeContactIds ?? []);
  for (const id of [...(sel.excludeListIds ?? []), ...(sel.excludeSegmentIds ?? [])]) {
    for (const c of audienceSource(id)?.members ?? []) excludedIds.add(c.id);
  }

  const reasons = { unsubscribed: 0, invalid: 0, suppressed: 0, excluded: 0 };
  let excludedBySelection = 0;
  let eligible = 0;
  for (const c of included.values()) {
    if (excludedIds.has(c.id)) {
      excludedBySelection++;
      continue;
    }
    const why = unreachableReason(c);
    if (why) reasons[why]++;
    else eligible++;
  }
  const unreachable = reasons.unsubscribed + reasons.invalid + reasons.suppressed + reasons.excluded;
  return {
    total: included.size,
    excludedBySelection,
    unreachable,
    eligible,
    reasons,
    sources: sources.map((s) => ({ id: s.id, kind: s.kind, name: s.name, total: s.members.length })),
  };
}

export async function estimateAudience(sel: AudienceSelection): Promise<AudienceEstimate> {
  await delay(60);
  return estimateAudienceNow(sel);
}

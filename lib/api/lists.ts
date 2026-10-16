/** Mock Lists API: static groups of contacts that campaigns can send to. */
import { normalizeTags } from "@/lib/audience";
import { formatNumber } from "@/lib/format";
import { CURRENT_USER } from "@/lib/mock-data/campaigns";
import type { ContactList, ListInput, ListSummary } from "@/lib/types/audience";
import type { ActivityEntry, Campaign } from "@/lib/types/campaigns";
import { audienceUsage, campaignAudienceIds, listMembers, reachableCount, selectionSummary } from "./audiences";
import { ApiError } from "./errors";
import { activity, campaigns, clone, commit, contacts, delay, demoNow, lists, newId, replaceLists } from "./store";

function log(entry: Omit<ActivityEntry, "id" | "at">) {
  activity().unshift({ ...entry, id: newId("act"), at: demoNow() });
}

function find(id: string): ContactList {
  const l = lists().find((x) => x.id === id);
  if (!l) throw new ApiError("List not found");
  return l;
}

function summary(l: ContactList): ListSummary {
  const members = listMembers(l.id);
  return { ...l, contactCount: members.length, reachableCount: reachableCount(members), usedBy: audienceUsage(l.id) };
}

function checkName(name: string, exceptId?: string): string {
  const n = name.trim();
  if (n.length < 2) throw new ApiError("Enter a list name (at least 2 characters)", "name");
  if (n.length > 80) throw new ApiError("Keep the name under 80 characters", "name");
  if (lists().some((l) => l.id !== exceptId && l.name.toLowerCase() === n.toLowerCase())) throw new ApiError("A list with this name already exists", "name");
  return n;
}

function uniqueName(base: string): string {
  const names = new Set(lists().map((l) => l.name.toLowerCase()));
  if (!names.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) if (!names.has(`${base} (${i})`.toLowerCase())) return `${base} (${i})`;
}

/** Newest first. */
export async function listLists(): Promise<ListSummary[]> {
  await delay();
  return clone([...lists()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(summary));
}

export async function getList(id: string): Promise<ListSummary> {
  await delay();
  return clone(summary(find(id)));
}

export async function createList(input: ListInput): Promise<ListSummary> {
  await delay();
  const name = checkName(input.name);
  const now = demoNow();
  const l: ContactList = { id: newId("lst"), name, description: input.description.trim(), tags: normalizeTags(input.tags), createdAt: now, updatedAt: now, createdBy: CURRENT_USER.name };
  lists().unshift(l);
  log({ kind: "list", title: name, detail: "List created" });
  commit();
  return clone(summary(l));
}

/** Rename, describe and tag a list. */
export async function updateList(id: string, input: ListInput): Promise<ListSummary> {
  await delay();
  const l = find(id);
  const name = checkName(input.name, id);
  const renamed = name !== l.name;
  Object.assign(l, { name, description: input.description.trim(), tags: normalizeTags(input.tags), updatedAt: demoNow() });
  // Campaigns show the audience name they were set up with; keep drafts in step.
  if (renamed) for (const c of campaigns()) if (campaignAudienceIds(c).includes(id) && c.status !== "sent" && c.status !== "sending" && c.status !== "archived") c.audience = selectionSummary(campaignAudienceIds(c)).label || name;
  commit();
  return clone(summary(l));
}

/** A new list with the same contacts. */
export async function duplicateList(id: string): Promise<ListSummary> {
  await delay();
  const src = find(id);
  const now = demoNow();
  const copy: ContactList = { ...src, id: newId("lst"), name: uniqueName(`Copy of ${src.name}`), createdAt: now, updatedAt: now, createdBy: CURRENT_USER.name };
  for (const c of contacts()) if (c.listIds.includes(id)) c.listIds.push(copy.id);
  lists().splice(lists().indexOf(src), 0, copy);
  log({ kind: "list", title: copy.name, detail: `Duplicated from ${src.name}` });
  commit();
  return clone(summary(copy));
}

/**
 * Removes the list (its contacts stay). Campaigns that would still send to it
 * get a note in their history and must have a new audience chosen before
 * they can send; they are returned so the caller can say so.
 */
export async function deleteList(id: string): Promise<{ affected: Pick<Campaign, "id" | "name">[] }> {
  await delay();
  const l = find(id);
  const usage = audienceUsage(id);
  const count = listMembers(id).length;
  const now = demoNow();
  for (const c of contacts()) {
    const i = c.listIds.indexOf(id);
    if (i !== -1) c.listIds.splice(i, 1);
  }
  replaceLists(lists().filter((x) => x.id !== id));
  for (const u of usage) {
    const c = campaigns().find((x) => x.id === u.id);
    if (!c) continue;
    c.history.push({ at: now, kind: "edited", text: `Audience list “${l.name}” was deleted — choose a new audience before sending`, user: CURRENT_USER.name });
    c.updatedAt = now;
  }
  log({ kind: "deleted", title: l.name, detail: `List deleted · ${formatNumber(count)} contacts kept` });
  commit();
  return { affected: usage.map(({ id: cid, name }) => ({ id: cid, name })) };
}

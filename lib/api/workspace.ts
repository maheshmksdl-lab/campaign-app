/**
 * Mock API for WhatsApp campaigns and templates, signup forms, workflows and
 * files — one CRUD layer over the browser store, with the same rules as the
 * campaign API: names are unique per collection, every change is logged to
 * the activity feed, and nothing ever leaves the browser.
 */
import type { ActivityEntry } from "@/lib/types/campaigns";
import type { AssetFile, SignupForm, WaCampaign, WaTemplate, Workflow } from "@/lib/types/workspace";
import { selectionSummary } from "./audiences";
import { ApiError, type BulkResult } from "./errors";
import { activity, clone, commit, delay, demoNow, newId, replaceWorkspace, workspace } from "./store";

export interface Collections {
  whatsapp: WaCampaign;
  waTemplates: WaTemplate;
  forms: SignupForm;
  workflows: Workflow;
  files: AssetFile;
}
export type CollectionKey = keyof Collections;
export type NewItem<K extends CollectionKey> = Omit<Collections[K], "id" | "createdAt" | "updatedAt">;

const META: Record<CollectionKey, { prefix: string; noun: string; kind: ActivityEntry["kind"] }> = {
  whatsapp: { prefix: "wac", noun: "WhatsApp campaign", kind: "whatsapp" },
  waTemplates: { prefix: "wat", noun: "WhatsApp template", kind: "whatsapp" },
  forms: { prefix: "frm", noun: "Form", kind: "form" },
  workflows: { prefix: "wf", noun: "Workflow", kind: "automation" },
  files: { prefix: "fil", noun: "File", kind: "file" },
};

const items = <K extends CollectionKey>(key: K) => workspace(key) as unknown as Collections[K][];
const replace = <K extends CollectionKey>(key: K, next: Collections[K][]) => replaceWorkspace(key, next as never);

function log(key: CollectionKey, title: string, detail: string) {
  activity().unshift({ id: newId("act"), at: demoNow(), kind: META[key].kind, title, detail });
}

function find<K extends CollectionKey>(key: K, id: string): Collections[K] {
  const x = items(key).find((i) => i.id === id);
  if (!x) throw new ApiError(`${META[key].noun} not found`);
  return x;
}

function uniqueName(key: CollectionKey, base: string): string {
  const names = new Set(items(key).map((i) => i.name.toLowerCase()));
  if (!names.has(base.toLowerCase())) return base;
  const m = base.match(/^(.*?)(\.[a-z0-9]{1,6})$/i);
  const [stem, ext] = key === "files" && m ? [m[1], m[2]] : [base, ""];
  for (let i = 2; ; i++) if (!names.has(`${stem} (${i})${ext}`.toLowerCase())) return `${stem} (${i})${ext}`;
}

function checkName(key: CollectionKey, raw: string, exceptId?: string): string {
  const n = raw.trim();
  if (n.length < 2) throw new ApiError("Enter a name (at least 2 characters)", "name");
  if (n.length > 120) throw new ApiError("Keep the name under 120 characters", "name");
  if (key === "waTemplates" && !/^[a-z0-9_]+$/.test(n)) throw new ApiError("Use lower-case letters, numbers and underscores only (e.g. summer_sale)", "name");
  if (items(key).some((i) => i.id !== exceptId && i.name.toLowerCase() === n.toLowerCase())) throw new ApiError(`A ${META[key].noun.toLowerCase()} with this name already exists`, "name");
  return n;
}

/** WhatsApp audiences carry a label and reach, like email campaigns. */
function withAudience<K extends CollectionKey>(key: K, x: Collections[K]): Collections[K] {
  if (key !== "whatsapp") return x;
  const c = x as WaCampaign;
  const sel = selectionSummary(c.audienceIds ?? []);
  return { ...c, audienceIds: sel.ids, audience: sel.label || "No audience", recipients: c.status === "draft" || c.status === "scheduled" ? sel.recipients : c.recipients } as Collections[K];
}

/** Newest change first. */
export async function listItems<K extends CollectionKey>(key: K): Promise<Collections[K][]> {
  await delay();
  return clone([...items(key)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
}

export async function getItem<K extends CollectionKey>(key: K, id: string): Promise<Collections[K]> {
  await delay();
  return clone(find(key, id));
}

export async function createItem<K extends CollectionKey>(key: K, input: NewItem<K>): Promise<Collections[K]> {
  await delay();
  const now = demoNow();
  const name = key === "files" ? uniqueName(key, input.name.trim()) : checkName(key, input.name);
  const x = withAudience(key, { ...clone(input), id: newId(META[key].prefix), name, createdAt: now, updatedAt: now } as Collections[K]);
  items(key).unshift(x);
  log(key, x.name, key === "files" ? "File uploaded" : `${META[key].noun} created`);
  commit();
  return clone(x);
}

export async function updateItem<K extends CollectionKey>(key: K, id: string, patch: Partial<NewItem<K>>, note?: string): Promise<Collections[K]> {
  await delay();
  const cur = find(key, id);
  const name = patch.name !== undefined ? (key === "files" ? patch.name.trim() || cur.name : checkName(key, patch.name, id)) : cur.name;
  if (key === "files" && items(key).some((i) => i.id !== id && i.name.toLowerCase() === name.toLowerCase())) throw new ApiError("A file with this name already exists", "name");
  const next = withAudience(key, { ...cur, ...clone(patch), name, id, createdAt: cur.createdAt, updatedAt: demoNow() } as Collections[K]);
  replace(key, items(key).map((i) => (i.id === id ? next : i)));
  if (note) log(key, next.name, note);
  commit();
  return clone(next);
}

export async function duplicateItem<K extends CollectionKey>(key: K, id: string): Promise<Collections[K]> {
  await delay();
  const src = find(key, id);
  const now = demoNow();
  const base = key === "waTemplates" ? `${src.name}_copy` : `Copy of ${src.name}`;
  const reset: Partial<Collections[keyof Collections]> =
    key === "whatsapp"
      ? { status: "draft", sentAt: undefined, scheduledAt: undefined, sent: undefined, delivered: undefined, read: undefined, replied: undefined, clicks: undefined, failed: undefined }
      : key === "waTemplates"
        ? { status: "draft", rejectionReason: undefined }
        : key === "forms"
          ? { status: "draft", submissions: 0, views: 0 }
          : key === "workflows"
            ? { status: "draft", processed: 0, lastRunAt: undefined, runs: [] }
            : {};
  const copy = withAudience(key, { ...clone(src), ...reset, id: newId(META[key].prefix), name: uniqueName(key, base), createdAt: now, updatedAt: now } as Collections[K]);
  const i = items(key).findIndex((x) => x.id === id);
  items(key).splice(Math.max(0, i), 0, copy);
  log(key, copy.name, `Duplicated from ${src.name}`);
  commit();
  return clone(copy);
}

export async function deleteItems<K extends CollectionKey>(key: K, ids: string[]): Promise<BulkResult> {
  await delay();
  const drop = new Set(ids);
  const gone = items(key).filter((i) => drop.has(i.id));
  replace(
    key,
    items(key).filter((i) => !drop.has(i.id)),
  );
  if (gone.length) log(key, gone.length === 1 ? gone[0].name : `${gone.length} ${META[key].noun.toLowerCase()}s`, "Deleted");
  commit();
  return { done: gone.length, skipped: ids.length - gone.length };
}

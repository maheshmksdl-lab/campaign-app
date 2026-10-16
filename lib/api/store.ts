/**
 * The demo store behind the mock API, saved in this browser's localStorage so
 * work survives a reload. Seeded on first use from the fixed demo data.
 *
 * Contacts are generated from a seed (12k+ records), so only the changes on
 * top of it are saved: added contacts, changed fields and deleted ids. The
 * small collections are saved whole. Stored data that is missing, from an
 * older version or unreadable falls back to the seed, collection by
 * collection, and the demo keeps working when storage is unavailable.
 */
import { addMinutes } from "@/lib/format";
import { DEMO_NOW, seedActivity, seedCampaigns } from "@/lib/mock-data/campaigns";
import { seedContacts, seedLists, seedSegments } from "@/lib/mock-data/contacts";
import { seedTemplates } from "@/lib/mock-data/templates";
import { seedFiles, seedForms, seedWaCampaigns, seedWaTemplates, seedWorkflows } from "@/lib/mock-data/workspace";
import type { Contact, ContactList, Segment } from "@/lib/types/audience";
import type { ActivityEntry, Campaign } from "@/lib/types/campaigns";
import type { EmailTemplate } from "@/lib/types/templates";
import type { AssetFile, SignupForm, WaCampaign, WaTemplate, Workflow } from "@/lib/types/workspace";

const STORAGE_KEY = "evoq-campaigns:demo-data";
/** Bump when a stored shape changes incompatibly; older data is then reseeded. */
const VERSION = 1;

interface ContactDelta {
  added: Contact[];
  changed: Record<string, Partial<Contact>>;
  removed: string[];
}

interface Saved {
  v: number;
  /** Demo minutes elapsed in earlier visits. */
  clock: number;
  campaigns: Campaign[];
  activity: ActivityEntry[];
  contacts: ContactDelta;
  lists: ContactList[];
  segments: Segment[];
  templates: EmailTemplate[];
  whatsapp: WaCampaign[];
  waTemplates: WaTemplate[];
  forms: SignupForm[];
  workflows: Workflow[];
  files: AssetFile[];
}

/** Collections added in later releases; missing ones fall back to their seed. */
const WORKSPACE_SEEDS = { whatsapp: seedWaCampaigns, waTemplates: seedWaTemplates, forms: seedForms, workflows: seedWorkflows, files: seedFiles } as const;
type WorkspaceKey = keyof typeof WORKSPACE_SEEDS;

interface State {
  campaigns: Campaign[];
  activity: ActivityEntry[];
  contacts: Contact[];
  lists: ContactList[];
  segments: Segment[];
  templates: EmailTemplate[];
  whatsapp: WaCampaign[];
  waTemplates: WaTemplate[];
  forms: SignupForm[];
  workflows: Workflow[];
  files: AssetFile[];
}

let state: State | null = null;
/** The untouched seed contacts, kept to work out what changed. */
let contactSeed: Map<string, Contact> | null = null;
let clockBase = 0;
let sessionStart = 0;
/** Bumped on every change; derived data (list counts, segment members) is cached per version. */
let version = 0;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

const isRecordArray = <T>(v: unknown, check: (x: Record<string, unknown>) => boolean = () => true): v is T[] =>
  Array.isArray(v) && v.every((x) => !!x && typeof x === "object" && typeof (x as { id?: unknown }).id === "string" && check(x as Record<string, unknown>));

function readSaved(): Partial<Saved> {
  const s = storage();
  if (!s) return {};
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as Partial<Saved>;
    return data && typeof data === "object" && data.v === VERSION ? data : {};
  } catch {
    return {};
  }
}

function contactsFrom(seed: Contact[], delta: unknown): Contact[] {
  const d = delta as Partial<ContactDelta> | undefined;
  if (!d || typeof d !== "object") return seed;
  const removed = new Set(Array.isArray(d.removed) ? d.removed.filter((x): x is string => typeof x === "string") : []);
  const changed = d.changed && typeof d.changed === "object" ? d.changed : {};
  const added = isRecordArray<Contact>(d.added, (x) => typeof x.email === "string" && Array.isArray(x.listIds) && Array.isArray(x.tags)) ? d.added : [];
  const kept = seed.filter((c) => !removed.has(c.id)).map((c) => (changed[c.id] ? { ...c, ...changed[c.id] } : c));
  return [...added, ...kept];
}

/** Ready-made templates added in a later release join data saved before it (people's own templates are untouched). */
function withNewGallery(saved: EmailTemplate[]): EmailTemplate[] {
  const have = new Set(saved.map((t) => t.id));
  const missing = seedTemplates().filter((t) => t.system && !have.has(t.id));
  return missing.length ? [...saved, ...missing] : saved;
}

function load(): State {
  if (state) return state;
  const saved = readSaved();
  const seeded = seedContacts();
  contactSeed = new Map(seeded.map((c) => [c.id, c]));
  clockBase = typeof saved.clock === "number" && saved.clock >= 0 ? saved.clock : 0;
  state = {
    campaigns: isRecordArray<Campaign>(saved.campaigns, (x) => typeof x.status === "string" && Array.isArray(x.history)) ? saved.campaigns : seedCampaigns(),
    activity: isRecordArray<ActivityEntry>(saved.activity) ? saved.activity : seedActivity(),
    // Working copies, so edits never touch the seed used for diffing (cheaper than structuredClone for 12k records).
    contacts: contactsFrom(
      seeded.map((c) => ({ ...c, tags: [...c.tags], listIds: [...c.listIds], suppression: c.suppression && { ...c.suppression } })),
      saved.contacts,
    ),
    lists: isRecordArray<ContactList>(saved.lists, (x) => typeof x.name === "string") ? saved.lists : seedLists(),
    segments: isRecordArray<Segment>(saved.segments, (x) => Array.isArray(x.conditions)) ? saved.segments : seedSegments(),
    templates: isRecordArray<EmailTemplate>(saved.templates, (x) => !!x.content && typeof x.content === "object") ? withNewGallery(saved.templates) : seedTemplates(),
    whatsapp: isRecordArray<WaCampaign>(saved.whatsapp, (x) => typeof x.body === "string") ? saved.whatsapp : WORKSPACE_SEEDS.whatsapp(),
    waTemplates: isRecordArray<WaTemplate>(saved.waTemplates, (x) => typeof x.body === "string") ? saved.waTemplates : WORKSPACE_SEEDS.waTemplates(),
    forms: isRecordArray<SignupForm>(saved.forms, (x) => Array.isArray(x.fields)) ? saved.forms : WORKSPACE_SEEDS.forms(),
    workflows: isRecordArray<Workflow>(saved.workflows, (x) => Array.isArray(x.steps)) ? saved.workflows : WORKSPACE_SEEDS.workflows(),
    files: isRecordArray<AssetFile>(saved.files, (x) => typeof x.size === "number") ? saved.files : WORKSPACE_SEEDS.files(),
  };
  return state;
}

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

function contactDelta(current: Contact[]): ContactDelta {
  const seed = contactSeed ?? new Map<string, Contact>();
  const added: Contact[] = [];
  const changed: Record<string, Partial<Contact>> = {};
  const present = new Set<string>();
  for (const c of current) {
    present.add(c.id);
    const base = seed.get(c.id);
    if (!base) {
      added.push(c);
      continue;
    }
    let patch: Partial<Contact> | null = null;
    for (const k of new Set([...Object.keys(c), ...Object.keys(base)]) as Set<keyof Contact>) {
      if (!same(c[k], base[k])) (patch ??= {})[k] = c[k] as never;
    }
    if (patch) changed[c.id] = patch;
  }
  const removed = [...seed.keys()].filter((id) => !present.has(id));
  return { added, changed, removed };
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let warned = false;

function save() {
  saveTimer = null;
  const s = storage();
  if (!s || !state) return;
  const data: Saved = {
    v: VERSION,
    clock: elapsedMinutes(),
    campaigns: state.campaigns,
    activity: state.activity.slice(0, 200),
    contacts: contactDelta(state.contacts),
    lists: state.lists,
    segments: state.segments,
    templates: state.templates,
    whatsapp: state.whatsapp,
    waTemplates: state.waTemplates,
    forms: state.forms,
    workflows: state.workflows,
    files: state.files,
  };
  try {
    s.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    // Quota or blocked storage: keep working in memory for this visit.
    if (!warned) console.warn("EVOQ Campaigns demo: changes couldn't be saved in this browser.", err);
    warned = true;
  }
}

/**
 * Call after every change. Saving is batched to the end of the current task,
 * so a bulk change writes once.
 */
export function commit() {
  version++;
  if (typeof window === "undefined") return;
  if (!saveTimer) saveTimer = setTimeout(save, 0);
}

export const storeVersion = () => version;

const memo = new Map<string, { v: number; value: unknown }>();
/** Cache a value derived from the store until the next change. */
export function derived<T>(key: string, compute: () => T): T {
  const hit = memo.get(key);
  if (hit && hit.v === version) return hit.value as T;
  const value = compute();
  memo.set(key, { v: version, value });
  return value;
}

/** Forget saved changes and start again from the demo seed. */
export function resetDemoData() {
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing saved to remove.
  }
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  state = null;
  contactSeed = null;
  clockBase = 0;
  sessionStart = 0;
  memo.clear();
  version++;
}

// ── Collections ──────────────────────────────────────────────────────

export const campaigns = () => load().campaigns;
export const activity = () => load().activity;
export const contacts = () => load().contacts;
export const lists = () => load().lists;
export const segments = () => load().segments;
export const templates = () => load().templates;

/** WhatsApp campaigns and templates, forms, workflows and files. */
export function workspace<K extends WorkspaceKey>(key: K): State[K] {
  return load()[key];
}
export function replaceWorkspace<K extends WorkspaceKey>(key: K, next: State[K]) {
  load()[key] = next;
}

export const replaceCampaigns = (next: Campaign[]) => {
  load().campaigns = next;
};
export const replaceContacts = (next: Contact[]) => {
  load().contacts = next;
};
export const replaceLists = (next: ContactList[]) => {
  load().lists = next;
};
export const replaceSegments = (next: Segment[]) => {
  load().segments = next;
};
export const replaceTemplates = (next: EmailTemplate[]) => {
  load().templates = next;
};

// ── Demo clock ───────────────────────────────────────────────────────

function elapsedMinutes(): number {
  if (!sessionStart) sessionStart = Date.now();
  return clockBase + Math.floor((Date.now() - sessionStart) / 60_000);
}

/**
 * The demo clock: the fixed demo "now" plus the real time spent in the app
 * (across visits), so new actions read "Just now" next to the seeded
 * "2m ago" entries and never land before something made earlier.
 */
export function demoNow(): string {
  load();
  return addMinutes(DEMO_NOW, elapsedMinutes());
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Simulated network latency. */
export const delay = (ms = 100 + Math.random() * 160) => new Promise((r) => setTimeout(r, ms));
export const clone = <T>(v: T): T => structuredClone(v);

let seq = 0;
/** A new record id with a type prefix, e.g. newId("ct"). */
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(++seq).toString(36)}`;

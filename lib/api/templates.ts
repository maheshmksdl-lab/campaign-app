/**
 * Mock Email Templates API. Content is stored as structured data and always
 * copied on the way in and out, so a campaign that uses a template keeps its
 * own copy and later template edits never change it.
 */
import { buildLayout, LAYOUTS, reassignIds } from "@/lib/email-blocks";
import { CURRENT_USER } from "@/lib/mock-data/campaigns";
import { categoryLabel, TEMPLATE_CATEGORIES } from "@/lib/mock-data/templates";
import type { ActivityEntry } from "@/lib/types/campaigns";
import type { EmailContent, EmailLayout, EmailTemplate, LayoutKey, TemplateEdit, TemplateInput, TemplateQuery } from "@/lib/types/templates";
import { ApiError } from "./errors";
import { activity, clone, commit, delay, demoNow, newId, replaceTemplates, templates } from "./store";

/** Stored content limit — keeps browser storage healthy when images are embedded. */
export const MAX_CONTENT_BYTES = 1_500_000;

function log(entry: Omit<ActivityEntry, "id" | "at">) {
  activity().unshift({ ...entry, id: newId("act"), at: demoNow() });
}

function find(id: string): EmailTemplate {
  const t = templates().find((x) => x.id === id);
  if (!t) throw new ApiError("Template not found");
  return t;
}

function checkName(name: string, exceptId?: string): string {
  const n = name.trim();
  if (n.length < 2) throw new ApiError("Enter a template name (at least 2 characters)", "name");
  if (n.length > 80) throw new ApiError("Keep the name under 80 characters", "name");
  if (templates().some((t) => t.id !== exceptId && t.name.toLowerCase() === n.toLowerCase())) throw new ApiError("A template with this name already exists", "name");
  return n;
}

function checkContent(content: EmailContent): EmailContent {
  const ok =
    (content?.kind === "design" && Array.isArray(content.blocks) && !!content.style) ||
    (content?.kind === "html" && typeof content.html === "string") ||
    (content?.kind === "text" && typeof content.text === "string");
  if (!ok) throw new ApiError("This content can't be saved", "content");
  if (JSON.stringify(content).length > MAX_CONTENT_BYTES) throw new ApiError("This template is too large to save — use image links instead of uploaded images, or smaller images", "content");
  return clone(content);
}

const checkCategory = (c: string) => {
  if (!TEMPLATE_CATEGORIES.some((x) => x.value === c)) throw new ApiError("Choose a category", "category");
  return c as EmailTemplate["category"];
};

function uniqueName(base: string): string {
  const names = new Set(templates().map((t) => t.name.toLowerCase()));
  if (!names.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) if (!names.has(`${base} (${i})`.toLowerCase())) return `${base} (${i})`;
}

/** My Templates first (most recently updated), then the gallery. */
export async function listTemplates(q: TemplateQuery = {}): Promise<EmailTemplate[]> {
  await delay();
  const t = q.search?.trim().toLowerCase() ?? "";
  return clone(
    templates()
      .filter((x) => (q.scope === "mine" ? !x.system : q.scope === "gallery" ? x.system : true))
      .filter((x) => !q.category || x.category === q.category)
      .filter((x) => !t || x.name.toLowerCase().includes(t) || x.description.toLowerCase().includes(t) || categoryLabel(x.category).toLowerCase().includes(t))
      .sort((a, b) => Number(a.system) - Number(b.system) || b.updatedAt.localeCompare(a.updatedAt)),
  );
}

export async function getTemplate(id: string): Promise<EmailTemplate> {
  await delay();
  return clone(find(id));
}

export async function createTemplate(input: TemplateInput): Promise<EmailTemplate> {
  await delay();
  const now = demoNow();
  const t: EmailTemplate = {
    id: newId("tpl"),
    name: checkName(input.name),
    category: checkCategory(input.category),
    description: input.description?.trim() ?? "",
    system: false,
    origin: input.origin,
    createdAt: now,
    updatedAt: now,
    createdBy: CURRENT_USER.name,
    content: checkContent(input.content),
  };
  templates().unshift(t);
  log({ kind: "template", title: t.name, detail: "Email template created" });
  commit();
  return clone(t);
}

export async function updateTemplate(id: string, edit: TemplateEdit): Promise<EmailTemplate> {
  await delay();
  const t = find(id);
  if (t.system) throw new ApiError("Ready-made templates can't be changed — duplicate it to make your own copy");
  if (edit.name !== undefined) t.name = checkName(edit.name, id);
  if (edit.category !== undefined) t.category = checkCategory(edit.category);
  if (edit.description !== undefined) t.description = edit.description.trim();
  if (edit.content !== undefined) t.content = checkContent(edit.content);
  t.updatedAt = demoNow();
  commit();
  return clone(t);
}

export async function duplicateTemplate(id: string, name?: string): Promise<EmailTemplate> {
  await delay();
  const src = find(id);
  const now = demoNow();
  const content = clone(src.content);
  const copy: EmailTemplate = {
    ...clone(src),
    id: newId("tpl"),
    name: name ? checkName(name) : uniqueName(src.system ? src.name : `Copy of ${src.name}`),
    system: false,
    createdAt: now,
    updatedAt: now,
    createdBy: CURRENT_USER.name,
    content: content.kind === "design" ? { ...content, blocks: reassignIds(content.blocks) } : content,
  };
  templates().unshift(copy);
  log({ kind: "template", title: copy.name, detail: `Copied from ${src.name}` });
  commit();
  return clone(copy);
}

export async function deleteTemplate(id: string): Promise<void> {
  await delay();
  const t = find(id);
  if (t.system) throw new ApiError("Ready-made templates can't be deleted");
  replaceTemplates(templates().filter((x) => x.id !== id));
  log({ kind: "deleted", title: t.name, detail: "Email template deleted" });
  commit();
}

/** A template's content as an independent copy (new block ids), for a campaign or a new template. */
export async function copyTemplateContent(id: string): Promise<EmailContent> {
  await delay(60);
  const content = clone(find(id).content);
  return content.kind === "design" ? { ...content, blocks: reassignIds(content.blocks) } : content;
}

export const getLayouts = (): EmailLayout[] => LAYOUTS;
export const layoutContent = (key: LayoutKey): EmailContent => buildLayout(key);

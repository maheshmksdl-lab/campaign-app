/**
 * Turns stored email content into a preview document. Everything people type
 * is escaped; URLs, colours and fonts are checked; imported HTML has scripts,
 * event handlers and javascript: links removed. Previews are additionally
 * shown in a sandboxed iframe with scripts disabled, so nothing ever runs.
 */
import { DEFAULT_STYLE, FONT_OPTIONS } from "@/lib/email-blocks";
import type { Align, ColumnItem, EmailBlock, EmailContent, EmailStyle, SocialNetwork } from "@/lib/types/templates";

// ── Merge tags ───────────────────────────────────────────────────────

export interface MergeTag {
  key: string;
  label: string;
  /** Shown in previews and test sends. */
  sample: string;
}

export const MERGE_TAGS: MergeTag[] = [
  { key: "first_name", label: "First Name", sample: "Alex" },
  { key: "last_name", label: "Last Name", sample: "Morgan" },
  { key: "email", label: "Email", sample: "alex.morgan@example.com" },
  { key: "company", label: "Company", sample: "Northwind Traders" },
  { key: "org_name", label: "Your organization", sample: "Evoq Solutions" },
];

export const mergeTagToken = (key: string) => `{{${key}}}`;
export const SAMPLE_MERGE_VALUES: Record<string, string> = Object.fromEntries(MERGE_TAGS.map((t) => [t.key, t.sample]));

/** Replaces {{key}} (or {{key|fallback}}) with values; unknown tags are left as typed. */
export function applyMergeTags(text: string, values: Record<string, string> = SAMPLE_MERGE_VALUES): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*(?:\|([^}]*))?\}\}/gi, (m, key: string, fallback?: string) => {
    const v = values[key.toLowerCase()];
    if (v) return v;
    if (fallback !== undefined) return fallback.trim();
    return key.toLowerCase() in values ? "" : m;
  });
}

// ── Safety ───────────────────────────────────────────────────────────

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Links: http(s), mailto, tel or an in-page anchor; anything else becomes "#". */
export function safeHref(url: string | undefined): string {
  const u = (url ?? "").trim();
  if (/^(https?:\/\/|mailto:|tel:|#)/i.test(u)) return u;
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(u)) return `https://${u}`;
  return "#";
}

/** Images: http(s) or an inline raster / SVG data URI. */
export function safeImageSrc(src: string | undefined): string {
  const u = (src ?? "").trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml)[;,]/i.test(u)) return u;
  return "";
}

const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.\s%,]+\)|[a-z]{3,20})$/i;
export const safeColor = (v: string | undefined, fallback: string) => (v && COLOR_RE.test(v.trim()) ? v.trim() : fallback);
const safeFont = (v: string) => (FONT_OPTIONS.some((f) => f.value === v) ? v : DEFAULT_STYLE.fontFamily);
const num = (v: unknown, min: number, max: number, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback);
const align = (a: Align | undefined): Align => (a === "center" || a === "right" ? a : "left");

/** Removes scripts, embedded frames, event handlers and javascript: URLs from imported HTML. */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script\b[^>]*\/?>/gi, "")
    .replace(/<(iframe|object|embed|frame|frameset|applet)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<\/?(iframe|object|embed|frame|frameset|applet)\b[^>]*>/gi, "")
    .replace(/<(base|meta)\b[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src|action|formaction|xlink:href)\s*=\s*("|')\s*(javascript|vbscript|data:text)[^"']*\2/gi, '$1="#"')
    .replace(/(href|src|action|formaction|xlink:href)\s*=\s*(javascript|vbscript|data:text)[^\s>]*/gi, '$1="#"');
}

export interface HtmlIssue {
  level: "error" | "warning";
  message: string;
}

const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

/** Basic checks for the HTML editor and HTML import (not a full validator). */
export function checkHtml(html: string): HtmlIssue[] {
  const issues: HtmlIssue[] = [];
  if (!html.trim()) return [{ level: "error", message: "The HTML is empty." }];
  if (/<script\b/i.test(html)) issues.push({ level: "warning", message: "Scripts aren't allowed in email and will be removed." });
  if (/\son[a-z]+\s*=/i.test(html)) issues.push({ level: "warning", message: "Event handlers (onclick, onload…) will be removed." });
  if (/javascript:/i.test(html)) issues.push({ level: "warning", message: "javascript: links will be replaced." });
  if (/<(iframe|object|embed|form)\b/i.test(html)) issues.push({ level: "warning", message: "Frames, embeds and forms don't work in most email apps." });

  // These may legally be left open.
  const OPTIONAL_CLOSE = new Set(["p", "li", "td", "th", "tr", "html", "body", "head", "tbody", "thead", "option"]);
  const stack: string[] = [];
  const unclosed = new Set<string>();
  const unexpected = new Set<string>();
  const tagRe = /<\/?([a-z][a-z0-9-]*)\b[^>]*?(\/?)>/gi;
  const body = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, "");
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(body))) {
    const tag = m[1].toLowerCase();
    if (VOID_TAGS.has(tag) || m[2] === "/") continue;
    if (m[0].startsWith("</")) {
      const idx = stack.lastIndexOf(tag);
      if (idx === -1) unexpected.add(tag);
      else {
        // Anything opened inside and not closed before this tag is unclosed.
        stack.slice(idx + 1).forEach((t) => unclosed.add(t));
        stack.length = idx;
      }
    } else stack.push(tag);
  }
  stack.forEach((t) => unclosed.add(t));
  const open = [...unclosed].filter((t) => !OPTIONAL_CLOSE.has(t));
  if (open.length) issues.push({ level: "error", message: `Unclosed tag${open.length === 1 ? "" : "s"}: ${open.map((t) => `<${t}>`).join(", ")}` });
  if (unexpected.size) issues.push({ level: "error", message: `Closing tag without an opening tag: ${[...unexpected].map((t) => `</${t}>`).join(", ")}` });
  if (!/<\/?(p|div|table|h[1-6]|span|a|img|td)\b/i.test(html)) issues.push({ level: "warning", message: "No HTML elements found — is this plain text?" });
  return issues;
}

// ── Rendering ────────────────────────────────────────────────────────

const SOCIAL: Record<SocialNetwork, { label: string; mark: string; color: string }> = {
  facebook: { label: "Facebook", mark: "f", color: "#1877F2" },
  instagram: { label: "Instagram", mark: "IG", color: "#E1306C" },
  linkedin: { label: "LinkedIn", mark: "in", color: "#0A66C2" },
  x: { label: "X", mark: "X", color: "#111111" },
  youtube: { label: "YouTube", mark: "▶", color: "#FF0000" },
};

/** Escaped text with merge tags filled; blank lines become paragraphs, single newlines line breaks. */
function richText(text: string, merge: Record<string, string> | null, pStyle: string): string {
  const filled = merge ? applyMergeTags(text, merge) : text;
  return filled
    .split(/\n{2,}/)
    .map((para) => `<p style="${pStyle}">${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

interface Ctx {
  style: EmailStyle;
  merge: Record<string, string> | null;
  /** Selected block for the editor canvas highlight. */
  selectedId?: string;
}

function wrap(b: { id: string; paddingY: number; paddingX: number; background?: string }, inner: string, ctx: Ctx, extra = ""): string {
  const pad = `${num(b.paddingY, 0, 120, 12)}px ${num(b.paddingX, 0, 120, 32)}px`;
  const bg = b.background ? `background:${safeColor(b.background, "transparent")};` : "";
  const sel = ctx.selectedId === b.id ? ' data-selected="true"' : "";
  return `<div class="blk" data-block-id="${escapeHtml(b.id)}"${sel} style="padding:${pad};${bg}${extra}">${inner}</div>`;
}

function renderItem(b: ColumnItem | EmailBlock, ctx: Ctx): string {
  const s = ctx.style;
  const text = (v: string) => (ctx.merge ? applyMergeTags(v, ctx.merge) : v);
  switch (b.type) {
    case "heading": {
      const size = num(b.size, 12, 56, 26);
      return wrap(b, `<h2 style="margin:0;font-size:${size}px;line-height:1.25;font-weight:700;text-align:${align(b.align)};color:${safeColor(b.color, s.textColor)};">${escapeHtml(text(b.text))}</h2>`, ctx);
    }
    case "text": {
      const size = num(b.size, 11, 32, 15);
      return wrap(b, richText(b.text, ctx.merge, `margin:0 0 12px;font-size:${size}px;line-height:1.6;text-align:${align(b.align)};color:${safeColor(b.color, s.textColor)};`), ctx, "");
    }
    case "image": {
      const src = safeImageSrc(b.src);
      const w = num(b.width, 10, 100, 100);
      const img = src
        ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(b.alt)}" style="display:inline-block;width:${w}%;max-width:100%;height:auto;border:0;border-radius:${num(s.radius, 0, 32, 8) / 2}px;">`
        : `<div style="display:inline-block;width:${w}%;padding:40px 0;background:#F3E8FF;color:#777386;font-size:13px;border-radius:6px;">Image unavailable</div>`;
      const linked = b.href ? `<a href="${escapeHtml(safeHref(b.href))}" target="_blank" rel="noopener noreferrer">${img}</a>` : img;
      return wrap(b, `<div style="text-align:${align(b.align)};line-height:0;">${linked}</div>`, ctx);
    }
    case "button": {
      const bg = safeColor(b.color, s.buttonColor);
      const fg = safeColor(b.textColor, s.buttonTextColor);
      const width = b.fullWidth ? "display:block;" : "display:inline-block;";
      return wrap(
        b,
        `<div style="text-align:${align(b.align)};"><a href="${escapeHtml(safeHref(b.href))}" target="_blank" rel="noopener noreferrer" style="${width}padding:12px 26px;background:${bg};color:${fg};font-size:15px;font-weight:600;text-decoration:none;border-radius:${num(s.radius, 0, 32, 8)}px;text-align:center;">${escapeHtml(text(b.label))}</a></div>`,
        ctx,
      );
    }
    case "divider":
      return wrap(b, `<hr style="margin:0;border:0;border-top:${num(b.thickness, 1, 8, 1)}px solid ${safeColor(b.color, "#EAE6F1")};">`, ctx);
    case "spacer":
      return wrap(b, `<div style="height:${num(b.height, 4, 160, 24)}px;line-height:0;font-size:0;">&nbsp;</div>`, ctx);
    case "columns": {
      const gap = num(b.gap, 0, 48, 16);
      const cols = b.columns
        .slice(0, 3)
        .map((col) => `<div class="col" style="flex:1 1 0;min-width:0;">${col.map((x) => renderItem(x, ctx)).join("")}</div>`)
        .join("");
      return wrap(b, `<div class="cols" style="display:flex;gap:${gap}px;">${cols}</div>`, ctx);
    }
    case "social": {
      const links = b.links
        .filter((l) => SOCIAL[l.network])
        .map((l) => {
          const n = SOCIAL[l.network];
          return `<a href="${escapeHtml(safeHref(l.url))}" target="_blank" rel="noopener noreferrer" title="${n.label}" style="display:inline-block;width:32px;height:32px;margin:0 4px;border-radius:50%;background:${n.color};color:#fff;font:700 12px/32px Arial,sans-serif;text-align:center;text-decoration:none;">${escapeHtml(n.mark)}</a>`;
        })
        .join("");
      return wrap(b, `<div style="text-align:${align(b.align)};">${links}</div>`, ctx);
    }
    case "footer": {
      const a = align(b.align);
      const unsub = b.showUnsubscribe ? `<p style="margin:8px 0 0;font-size:12px;"><a href="#" style="color:${safeColor(s.linkColor, DEFAULT_STYLE.linkColor)};">Unsubscribe</a> · <a href="#" style="color:${safeColor(s.linkColor, DEFAULT_STYLE.linkColor)};">Manage preferences</a></p>` : "";
      return wrap(b, `<div style="text-align:${a};color:#777386;">${richText(b.text, ctx.merge, "margin:0 0 6px;font-size:12px;line-height:1.5;")}<p style="margin:0;font-size:12px;line-height:1.5;">${escapeHtml(text(b.address))}</p>${unsub}</div>`, ctx);
    }
  }
}

export interface RenderOptions {
  /** Merge-tag values; null leaves {{tags}} visible (editor canvas). Defaults to sample values. */
  merge?: Record<string, string> | null;
  /** Hidden inbox preview text. */
  preheader?: string;
  /** Editor canvas: outline the selected block and show hover outlines. */
  selectedId?: string;
  editable?: boolean;
}

const BASE_CSS = `
html,body{margin:0;padding:0;}
img{max-width:100%;}
a{word-break:break-word;}
@media (max-width:480px){.cols{flex-direction:column;}.wrap{padding:0 !important;}.card{border-radius:0 !important;}}
`;

const EDIT_CSS = `
.blk{position:relative;cursor:pointer;}
.blk:hover{outline:1px dashed #A78BFA;outline-offset:-1px;}
.blk[data-selected="true"]{outline:2px solid #7C3AED;outline-offset:-2px;}
a{pointer-events:none;}
`;

function documentFor(body: string, bg: string, opts: RenderOptions, extraCss = ""): string {
  const pre = opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(applyMergeTags(opts.preheader, opts.merge ?? SAMPLE_MERGE_VALUES))}</div>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${BASE_CSS}${opts.editable ? EDIT_CSS : ""}${extraCss}</style></head><body style="background:${bg};">${pre}${body}</body></html>`;
}

/** A complete HTML document for an iframe `srcdoc` (always render it with `sandbox` and no allow-scripts). */
export function renderEmailDocument(content: EmailContent, opts: RenderOptions = {}): string {
  const merge = opts.merge === undefined ? SAMPLE_MERGE_VALUES : opts.merge;
  if (content.kind === "text") {
    const filled = merge ? applyMergeTags(content.text, merge) : content.text;
    return documentFor(`<div style="max-width:640px;margin:0 auto;padding:24px;font:15px/1.6 Arial,Helvetica,sans-serif;color:#272238;white-space:pre-wrap;word-break:break-word;">${escapeHtml(filled)}</div>`, "#FFFFFF", opts);
  }
  if (content.kind === "html") {
    const clean = sanitizeHtml(merge ? applyMergeTags(content.html, merge) : content.html);
    // A full document keeps its own <body>; a fragment is wrapped.
    const inner = /<body[\s>]/i.test(clean) ? (clean.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? clean) : clean;
    const styles = [...clean.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].map((m) => m[1]).join("\n");
    return documentFor(inner.replace(/<style\b[\s\S]*?<\/style\s*>/gi, ""), "#FFFFFF", opts, styles);
  }
  const s = { ...DEFAULT_STYLE, ...content.style };
  const ctx: Ctx = { style: s, merge, selectedId: opts.selectedId };
  const spacing = num(s.blockSpacing, 0, 48, 0);
  const blocks = content.blocks.map((b) => renderItem(b, ctx)).join(spacing ? `<div style="height:${spacing}px"></div>` : "");
  const width = num(s.contentWidth, 320, 800, 600);
  const card = `<div class="wrap" style="padding:24px 12px;"><div class="card" style="max-width:${width}px;margin:0 auto;background:${safeColor(s.contentBackground, "#FFFFFF")};border-radius:${num(s.radius, 0, 32, 8)}px;overflow:hidden;font-family:${safeFont(s.fontFamily)};color:${safeColor(s.textColor, DEFAULT_STYLE.textColor)};">${blocks || '<p style="margin:0;padding:48px 24px;text-align:center;color:#777386;font-size:14px;">This email is empty.</p>'}</div></div>`;
  return documentFor(card, safeColor(s.background, DEFAULT_STYLE.background), opts, `a{color:${safeColor(s.linkColor, DEFAULT_STYLE.linkColor)};}`);
}

/** Readable text of any content (search, plain-text fallback, word counts). */
export function contentToText(content: EmailContent): string {
  if (content.kind === "text") return content.text;
  if (content.kind === "html") {
    return sanitizeHtml(content.html)
      .replace(/<(style|head)\b[\s\S]*?<\/\1\s*>/gi, "")
      .replace(/<br\s*\/?>|<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  const parts: string[] = [];
  const walk = (b: EmailBlock | ColumnItem) => {
    if (b.type === "heading" || b.type === "text") parts.push(b.text);
    else if (b.type === "button") parts.push(`${b.label}: ${b.href}`);
    else if (b.type === "columns") b.columns.flat().forEach(walk);
    else if (b.type === "footer") parts.push(b.text, b.address);
  };
  content.blocks.forEach(walk);
  return parts.join("\n\n");
}

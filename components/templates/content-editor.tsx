"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Icon } from "@phosphor-icons/react";
import {
  ArrowLeftIcon,
  BracketsCurlyIcon,
  ColumnsIcon,
  DesktopIcon,
  DeviceMobileIcon,
  EyeIcon,
  FootprintsIcon,
  ImageIcon,
  MinusIcon,
  NotePencilIcon,
  PaintBrushIcon,
  ShareNetworkIcon,
  SquareIcon,
  TextAaIcon,
  TextHIcon,
  WarningIcon,
  ArrowsVerticalIcon,
} from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog, fieldClass, OutlineButton, PrimaryButton } from "@/components/shared/campaign-ui";
import { EmailFrame } from "@/components/shared/email-ui";
import { EmptyState } from "@/components/shared/state-panels";
import { PreviewDialog } from "@/components/campaigns/editor/content-card";
import { useCreateTemplate, useUpdateTemplate } from "@/hooks/use-templates";
import { useHydrated } from "@/hooks/use-hydrated";
import { useStoredState, writeStored } from "@/hooks/use-stored-state";
import { ApiError } from "@/lib/api/errors";
import { MAX_CONTENT_BYTES } from "@/lib/api/templates";
import { CONTENT_SESSION_KEY, galleryHref, NONE, TEMPLATES_ROUTE, type ContentSession } from "@/lib/content-session";
import { BLOCK_LABEL, createBlock, reassignIds } from "@/lib/email-blocks";
import { checkHtml, MERGE_TAGS, mergeTagToken, renderEmailDocument } from "@/lib/email-render";
import { TEMPLATE_CATEGORIES } from "@/lib/mock-data/templates";
import { campaignHref } from "@/lib/routes";
import type { BlockType, EmailBlock, EmailContent, EmailStyle, TemplateCategory } from "@/lib/types/templates";
import { cn } from "@/lib/utils";
import { BlockInspector, findBlock, isTopLevel, removeBlock, StyleInspector, updateBlock } from "./block-inspector";
import { returnToCampaign } from "./start-editing";

type Session = ContentSession & { edited?: boolean };

const ELEMENTS: { type: BlockType; icon: Icon }[] = [
  { type: "heading", icon: TextHIcon },
  { type: "text", icon: TextAaIcon },
  { type: "image", icon: ImageIcon },
  { type: "button", icon: SquareIcon },
  { type: "divider", icon: MinusIcon },
  { type: "spacer", icon: ArrowsVerticalIcon },
  { type: "columns", icon: ColumnsIcon },
  { type: "social", icon: ShareNetworkIcon },
  { type: "footer", icon: FootprintsIcon },
];

const KIND_TITLE: Record<EmailContent["kind"], string> = { design: "Email designer", html: "HTML editor", text: "Plain text editor" };

/**
 * Full-page content editor for a campaign or a template: block designer for
 * designed emails, a code editor for HTML and a plain-text editor. The
 * working copy stays in this tab's session, so a reload doesn't lose it.
 */
export function ContentEditor() {
  const router = useRouter();
  const [session, setSession] = useStoredState<Session | null>(CONTENT_SESSION_KEY, NONE, "session");
  const hydrated = useHydrated();

  if (!hydrated) return <div className="flex-1" aria-busy="true" />;
  if (!session)
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon={NotePencilIcon}
          title="Nothing is open for editing"
          hint="Start from a template, a layout or a blank design."
          action={
            <>
              <OutlineButton onClick={() => router.push(TEMPLATES_ROUTE)}>Email Templates</OutlineButton>
              <PrimaryButton onClick={() => router.push(galleryHref())}>Open the Template Gallery</PrimaryButton>
            </>
          }
        />
      </div>
    );
  return <EditorBody session={session} setSession={setSession} />;
}

function EditorBody({ session, setSession }: { session: Session; setSession: (s: Session | null) => void }) {
  const router = useRouter();
  const { target, content } = session;
  const create = useCreateTemplate();
  const updateT = useUpdateTemplate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewing, setPreviewing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [nameError, setNameError] = useState("");

  const setContent = (next: EmailContent) => setSession({ ...session, content: next, edited: true });
  const setTarget = (patch: Partial<Extract<Session["target"], { kind: "template" }>>) => target.kind === "template" && setSession({ ...session, target: { ...target, ...patch } });

  const back = () => (target.kind === "campaign" ? campaignHref(target.campaignId) : target.templateId ? galleryHref({ section: "mine" }) : TEMPLATES_ROUTE);
  const leave = () => {
    setSession(null);
    router.push(back());
  };

  const size = JSON.stringify(content).length;
  const tooBig = size > MAX_CONTENT_BYTES;
  const htmlIssues = content.kind === "html" ? checkHtml(content.html) : [];
  const blocking = (content.kind === "html" && htmlIssues.some((i) => i.message === "The HTML is empty.")) || (content.kind === "text" && !content.text.trim()) || (content.kind === "design" && content.blocks.length === 0);

  const save = async () => {
    if (tooBig) return void toast.error("This email is too large to save", { description: "Use image links instead of uploaded images, or smaller images." });
    if (blocking) return void toast.error("The email is empty", { description: "Add some content before saving." });
    if (target.kind === "campaign") {
      returnToCampaign(router.push, target.campaignId, { content, source: session.source });
      writeStored(CONTENT_SESSION_KEY, null, "session");
      return;
    }
    const name = target.name.trim();
    if (name.length < 2) {
      setNameError("Enter a template name (at least 2 characters)");
      document.getElementById("tpl-name")?.focus();
      return;
    }
    try {
      if (target.templateId) await updateT.mutateAsync({ id: target.templateId, edit: { name, category: target.category, content } });
      else await create.mutateAsync({ name, category: target.category, origin: target.origin, content, description: session.source && session.source !== "Blank design" ? `Started from ${session.source}` : "" });
      toast.success(target.templateId ? "Template updated" : "Template saved", { description: `${name} · find it under My Templates` });
      setSession(null);
      router.push(galleryHref({ section: "mine" }));
    } catch (e) {
      if (e instanceof ApiError && e.field === "name") {
        setNameError(e.message);
        document.getElementById("tpl-name")?.focus();
      } else toast.error("Couldn't save the template", { description: (e as Error).message });
    }
  };

  const saving = create.isPending || updateT.isPending;

  return (
    <div className="flex flex-1 flex-col bg-[#F4F4F7]">
      {/* Header */}
      <div className="sticky top-[60px] z-20 border-b border-line bg-white lg:top-[var(--header-h)]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => (session.edited ? setLeaving(true) : leave())}
            aria-label="Back"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-body transition-colors hover:bg-brand-depth-10 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-action"
          >
            <ArrowLeftIcon size={18} aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            {target.kind === "template" ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-[200px] flex-1 sm:max-w-[320px]">
                  <label htmlFor="tpl-name" className="sr-only">
                    Template name
                  </label>
                  <input
                    id="tpl-name"
                    value={target.name}
                    onChange={(e) => {
                      setNameError("");
                      setTarget({ name: e.target.value });
                    }}
                    placeholder="Template name"
                    maxLength={80}
                    aria-invalid={nameError ? true : undefined}
                    className="-mx-1.5 h-8 w-full rounded-md border border-transparent bg-transparent px-1.5 text-[16px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink-faint hover:border-line focus:border-brand-hover focus:ring-3 focus:ring-brand-10 aria-invalid:border-[#F4B4B0]"
                  />
                </div>
                <label className="sr-only" htmlFor="tpl-category">
                  Category
                </label>
                <select id="tpl-category" value={target.category} onChange={(e) => setTarget({ category: e.target.value as TemplateCategory })} className={cn(fieldClass, "h-8 w-auto text-[12.5px]")}>
                  {TEMPLATE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <h1 className="truncate text-[16px] leading-6 font-semibold text-ink">{target.campaignName}</h1>
            )}
            {nameError ? (
              <p role="alert" className="text-[12px] font-medium text-[#DC2626]">
                {nameError}
              </p>
            ) : (
              <p className="truncate text-[12px] leading-4 text-ink-muted">
                {KIND_TITLE[content.kind]} · {session.source}
                {target.kind === "campaign" ? " · content for this campaign" : target.templateId ? " · editing a saved template" : " · new template"}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden rounded-lg border border-line p-0.5 sm:flex" role="group" aria-label="Canvas width">
              {(["desktop", "mobile"] as const).map((d) => (
                <button key={d} type="button" aria-pressed={device === d} aria-label={d === "desktop" ? "Desktop width" : "Mobile width"} onClick={() => setDevice(d)} className={cn("inline-flex size-7 items-center justify-center rounded-md transition-colors", device === d ? "bg-brand-surface text-brand" : "text-ink-muted hover:text-ink")}>
                  {d === "desktop" ? <DesktopIcon size={15} aria-hidden /> : <DeviceMobileIcon size={15} aria-hidden />}
                </button>
              ))}
            </div>
            <OutlineButton icon={EyeIcon} className="h-8" onClick={() => setPreviewing(true)}>
              Preview
            </OutlineButton>
            <OutlineButton className="h-8" onClick={() => (session.edited ? setLeaving(true) : leave())}>
              Cancel
            </OutlineButton>
            <PrimaryButton className="h-8" onClick={save} disabled={saving}>
              {saving ? "Saving…" : target.kind === "campaign" ? "Save & return to campaign" : target.templateId ? "Save template" : "Save as template"}
            </PrimaryButton>
          </div>
        </div>
        {tooBig && <p className="border-t border-[#F8DDAE] bg-[var(--warning-bg)] px-6 py-1.5 text-[12px] text-[var(--warning)]">This email is over the 1.5 MB limit. Replace uploaded images with image links.</p>}
      </div>

      {content.kind === "design" && <Designer content={content} onChange={setContent} selectedId={selectedId} onSelect={setSelectedId} device={device} />}
      {content.kind === "html" && <CodeEditor kind="html" value={content.html} onChange={(html) => setContent({ kind: "html", html })} issues={htmlIssues} device={device} />}
      {content.kind === "text" && <CodeEditor kind="text" value={content.text} onChange={(text) => setContent({ kind: "text", text })} issues={[]} device={device} />}

      <PreviewDialog open={previewing} onOpenChange={setPreviewing} content={content} title={target.kind === "campaign" ? target.campaignName : target.name || "New template"} />
      <ConfirmDialog
        open={leaving}
        onOpenChange={setLeaving}
        title="Leave without saving?"
        description={target.kind === "campaign" ? "Your edits to this content are lost. The campaign keeps its current content." : "Your edits to this template are lost."}
        confirmLabel="Discard edits"
        onConfirm={leave}
      />
    </div>
  );
}

// ── Designer ─────────────────────────────────────────────────────────

function Designer({ content, onChange, selectedId, onSelect, device }: { content: Extract<EmailContent, { kind: "design" }>; onChange: (c: EmailContent) => void; selectedId: string | null; onSelect: (id: string | null) => void; device: "desktop" | "mobile" }) {
  const { blocks, style } = content;
  const selected = selectedId ? findBlock(blocks, selectedId) : null;
  const setBlocks = (next: EmailBlock[]) => onChange({ ...content, blocks: next });

  const add = (type: BlockType) => {
    const block = createBlock(type);
    // Columns carry their own ids for the items inside.
    const fresh = type === "columns" ? reassignIds([block])[0] : block;
    const at = selectedId ? blocks.findIndex((b) => b.id === selectedId || (b.type === "columns" && b.columns.flat().some((x) => x.id === selectedId))) : -1;
    const next = [...blocks];
    const footerAt = next.findIndex((b) => b.type === "footer");
    const index = at >= 0 ? at + 1 : footerAt >= 0 && type !== "footer" ? footerAt : next.length;
    next.splice(index, 0, fresh);
    setBlocks(next);
    onSelect(fresh.id);
  };

  const move = (dir: -1 | 1) => {
    if (!selectedId) return;
    const i = blocks.findIndex((b) => b.id === selectedId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    setBlocks(next);
  };

  const duplicate = () => {
    const i = blocks.findIndex((b) => b.id === selectedId);
    if (i < 0) return;
    const copy = reassignIds([blocks[i]])[0];
    const next = [...blocks];
    next.splice(i + 1, 0, copy);
    setBlocks(next);
    onSelect(copy.id);
  };

  return (
    <div className="grid min-h-0 flex-1 gap-3 p-3 sm:p-4 lg:grid-cols-[200px_minmax(0,1fr)_300px]">
      {/* Elements */}
      <aside aria-label="Elements" className="h-fit rounded-xl border border-line bg-white p-3 lg:sticky lg:top-[calc(var(--header-h)+80px)]">
        <p className="mb-2 text-[12px] font-medium tracking-wide text-ink-muted uppercase">Elements</p>
        <div className="grid grid-cols-3 gap-1.5 lg:grid-cols-2">
          {ELEMENTS.map(({ type, icon: I }) => (
            <button key={type} type="button" onClick={() => add(type)} className="flex flex-col items-center gap-1 rounded-lg border border-line bg-white px-1 py-2.5 text-[11.5px] text-ink-body transition hover:border-brand-soft hover:bg-campaign-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-action">
              <I size={18} aria-hidden className="text-campaign-action" />
              {BLOCK_LABEL[type]}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11.5px] leading-4 text-ink-muted">Elements are added below the selected block.</p>
      </aside>

      {/* Canvas */}
      <div className="min-w-0 overflow-hidden rounded-xl border border-line bg-[#ECEAF2]">
        <Canvas content={content} selectedId={selectedId} onSelect={onSelect} width={device === "mobile" ? 380 : undefined} />
      </div>

      {/* Properties */}
      <aside aria-label={selected ? "Block properties" : "Email style"} className="h-fit rounded-xl border border-line bg-white p-4 lg:sticky lg:top-[calc(var(--header-h)+80px)] lg:max-h-[calc(100dvh-var(--header-h)-100px)] lg:overflow-y-auto lg:scrollbar-thin">
        {selected ? (
          <>
            <button type="button" onClick={() => onSelect(null)} className="mb-3 inline-flex items-center gap-1.5 rounded text-[12.5px] font-medium text-brand hover:text-brand-press">
              <PaintBrushIcon size={13} aria-hidden /> Email style
            </button>
            <BlockInspector
              key={selected.id}
              block={selected}
              canMove={isTopLevel(blocks, selected.id)}
              onChange={(patch) => setBlocks(updateBlock(blocks, selected.id, patch))}
              onMove={move}
              onDuplicate={duplicate}
              onDelete={() => {
                setBlocks(removeBlock(blocks, selected.id));
                onSelect(null);
              }}
            />
          </>
        ) : (
          <StyleInspector style={style} onChange={(patch: Partial<EmailStyle>) => onChange({ ...content, style: { ...style, ...patch } })} />
        )}
      </aside>
    </div>
  );
}

/**
 * The editable canvas: the real rendered email in a frame (scripts disabled);
 * clicks are read from the frame's document to select blocks, and the scroll
 * position is kept when the content re-renders.
 */
function Canvas({ content, selectedId, onSelect, width }: { content: EmailContent; selectedId: string | null; onSelect: (id: string | null) => void; width?: number }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const scroll = useRef(0);
  // Selection is marked in the frame directly, so clicking a block doesn't re-render the email.
  const doc = useMemo(() => renderEmailDocument(content, { merge: null, editable: true }), [content]);
  const onSelectRef = useRef(onSelect);
  const selectedRef = useRef(selectedId);
  useEffect(() => {
    onSelectRef.current = onSelect;
    selectedRef.current = selectedId;
    mark(ref.current?.contentDocument, selectedId);
  }, [onSelect, selectedId]);

  const onLoad = () => {
    const win = ref.current?.contentWindow;
    const d = ref.current?.contentDocument;
    if (!win || !d) return;
    win.scrollTo(0, scroll.current);
    mark(d, selectedRef.current);
    win.addEventListener("scroll", () => (scroll.current = win.scrollY), { passive: true });
    d.addEventListener("click", (e) => {
      e.preventDefault();
      const el = (e.target as Element | null)?.closest?.("[data-block-id]");
      onSelectRef.current(el?.getAttribute("data-block-id") ?? null);
    });
  };

  return (
    <div className="h-[calc(100dvh-var(--header-h)-120px)] min-h-[520px] p-3 sm:p-4">
      <iframe
        ref={ref}
        title="Email canvas — click a block to edit it"
        srcDoc={doc}
        // Same origin (no scripts) so clicks can be read from the parent page.
        sandbox="allow-same-origin"
        onLoad={onLoad}
        className="mx-auto block h-full rounded-lg border-0 bg-white shadow-card transition-[width]"
        style={{ width: width ?? "100%", maxWidth: "100%" }}
      />
    </div>
  );
}

function mark(d: Document | null | undefined, id: string | null) {
  if (!d) return;
  d.querySelectorAll("[data-selected]").forEach((el) => el.removeAttribute("data-selected"));
  if (id) d.querySelector(`[data-block-id="${CSS.escape(id)}"]`)?.setAttribute("data-selected", "true");
}

// ── HTML / plain text ────────────────────────────────────────────────

function CodeEditor({ kind, value, onChange, issues, device }: { kind: "html" | "text"; value: string; onChange: (v: string) => void; issues: ReturnType<typeof checkHtml>; device: "desktop" | "mobile" }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), 300);
    return () => clearTimeout(t);
  }, [value]);
  const preview: EmailContent = useMemo(() => (kind === "html" ? { kind: "html", html: debounced } : { kind: "text", text: debounced }), [kind, debounced]);

  const insert = (text: string) => {
    const el = ref.current;
    const s = el?.selectionStart ?? value.length;
    const e = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, s) + text + value.slice(e));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(s + text.length, s + text.length);
    });
  };

  return (
    <div className="grid min-h-0 flex-1 gap-3 p-3 sm:p-4 lg:grid-cols-2">
      <div className="flex min-h-[420px] min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-white">
        <div className="flex items-center gap-2 border-b border-line-soft px-3 py-2">
          <p className="flex-1 text-[12.5px] font-medium text-ink">{kind === "html" ? "HTML" : "Message"}</p>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12.5px] text-ink-body hover:bg-brand-depth-10 focus-visible:outline-2 focus-visible:outline-brand-action data-[state=open]:bg-brand-depth-10">
              <BracketsCurlyIcon size={14} aria-hidden /> Personalize
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {MERGE_TAGS.map((t) => (
                <DropdownMenuItem key={t.key} onSelect={() => insert(mergeTagToken(t.key))}>
                  <span className="flex-1">{t.label}</span>
                  <code className="font-mono text-[11px] text-ink-muted">{mergeTagToken(t.key)}</code>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <label htmlFor="code-editor" className="sr-only">
          {kind === "html" ? "HTML code" : "Plain text message"}
        </label>
        <textarea
          ref={ref}
          id="code-editor"
          value={value}
          spellCheck={kind === "text"}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (kind === "html" && e.key === "Tab" && !e.shiftKey) {
              e.preventDefault();
              insert("  ");
            }
          }}
          className={cn("min-h-0 flex-1 resize-none bg-white p-4 text-ink outline-none", kind === "html" ? "font-mono text-[12.5px] leading-5" : "text-[14px] leading-6")}
        />
        {kind === "html" && (
          <div className="border-t border-line-soft px-3 py-2" aria-live="polite">
            {issues.length === 0 ? (
              <p className="text-[12px] text-[var(--success)]">No problems found.</p>
            ) : (
              <ul className="space-y-1">
                {issues.map((i) => (
                  <li key={i.message} className={cn("flex items-start gap-1.5 text-[12px] leading-4", i.level === "error" ? "text-[#B42318]" : "text-[var(--warning)]")}>
                    <WarningIcon size={13} aria-hidden className="mt-px shrink-0" />
                    {i.message}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-[11.5px] text-ink-muted">Tab indents. Scripts, event handlers and frames are removed when the email is shown.</p>
          </div>
        )}
      </div>
      <div className="min-h-[420px] min-w-0 overflow-hidden rounded-xl border border-line bg-[#ECEAF2] p-3 sm:p-4">
        <div className={cn("mx-auto h-full overflow-hidden rounded-lg bg-white shadow-card", device === "mobile" && "max-w-[380px]")}>
          <EmailFrame content={preview} title="Live preview" />
        </div>
      </div>
    </div>
  );
}

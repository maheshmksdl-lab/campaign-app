"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CaretRightIcon, CodeIcon, DesktopIcon, DeviceMobileIcon, DotsNineIcon, EyeIcon, NotebookIcon, NotepadIcon, PencilSimpleIcon, PlusIcon, SwapIcon, TrashIcon, UploadSimpleIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { OutlineButton } from "@/components/shared/campaign-ui";
import { EmailFrame, EmailThumb } from "@/components/shared/email-ui";
import { writeStored } from "@/hooks/use-stored-state";
import { MAX_CONTENT_BYTES } from "@/lib/api/templates";
import { CONTENT_EDITOR_ROUTE, CONTENT_SESSION_KEY, galleryHref, type ContentSession } from "@/lib/content-session";
import { blankDesign } from "@/lib/email-blocks";
import { checkHtml, contentToText } from "@/lib/email-render";
import type { EmailContent } from "@/lib/types/templates";
import { cn } from "@/lib/utils";
import { SectionIcon } from "./fields";

const KIND_LABEL: Record<EmailContent["kind"], string> = { design: "Designed email", html: "Custom HTML", text: "Plain text" };

export const STARTER_HTML = `<div style="max-width:600px;margin:0 auto;padding:32px 24px;font-family:Arial,Helvetica,sans-serif;color:#272238;">
  <h1 style="margin:0 0 12px;font-size:26px;">Hello {{first_name}},</h1>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Write your message here.</p>
  <a href="https://evoq.one" style="display:inline-block;padding:12px 24px;background:#7C3AED;color:#ffffff;text-decoration:none;border-radius:8px;">Call to action</a>
  <p style="margin:28px 0 0;font-size:12px;color:#777386;">{{org_name}} · <a href="#" style="color:#7C3AED;">Unsubscribe</a></p>
</div>`;

export const STARTER_TEXT = "Hi {{first_name}},\n\nWrite your message here.\n\nThanks,\n{{org_name}}\n\nYou can unsubscribe from these emails at any time.";

export function ContentCard({
  campaignId,
  campaignName,
  content,
  source,
  previewText,
  onChange,
  error,
}: {
  campaignId: string;
  campaignName: string;
  content: EmailContent | null;
  source: string;
  previewText: string;
  onChange: (content: EmailContent | null, source: string) => void;
  error?: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [choosing, setChoosing] = useState(false);
  const [preview, setPreview] = useState(false);

  const openEditor = (next: EmailContent, label: string) => {
    const session: ContentSession = { target: { kind: "campaign", campaignId, campaignName }, content: next, source: label };
    writeStored(CONTENT_SESSION_KEY, session, "session");
    router.push(CONTENT_EDITOR_ROUTE);
  };

  const importHtml = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.html?$/i.test(file.name) && file.type !== "text/html") {
      toast.error("Choose an .html file", { description: `${file.name} isn't an HTML file.` });
      return;
    }
    if (file.size > MAX_CONTENT_BYTES) {
      toast.error("This file is too large", { description: "HTML imports are limited to 1.5 MB. Link images instead of embedding them." });
      return;
    }
    const html = await file.text();
    const issues = checkHtml(html);
    if (issues.some((i) => i.message === "The HTML is empty.")) {
      toast.error("This file is empty");
      return;
    }
    onChange({ kind: "html", html }, `Imported ${file.name}`);
    setChoosing(false);
    const warnings = issues.length;
    toast.success("HTML imported", {
      description: warnings ? `${warnings} issue${warnings === 1 ? "" : "s"} found — open the HTML editor to review.` : file.name,
      action: { label: "Edit HTML", onClick: () => openEditor({ kind: "html", html }, `Imported ${file.name}`) },
    });
  };

  const showOptions = !content || choosing;

  // The category card that matches the current content (Gallery is the suggested start).
  const current: Category = /layout/i.test(source) ? "layouts" : source === "Blank design" ? "scratch" : "gallery";

  return (
    <section id="content" aria-labelledby="content-title" className={cn("min-w-0 scroll-mt-32 rounded-2xl border bg-white shadow-card", error ? "border-[#F0A8A4]" : "border-line")}>
      <header className="flex items-center gap-3 px-5 pt-5 pb-2">
        <SectionIcon icon={NotebookIcon} />
        <h2 id="content-title" className="text-[16px] leading-6 font-semibold text-campaign-depth">
          Content
          <span className="ml-0.5 text-[#E5484D]" aria-hidden>
            *
          </span>
        </h2>
        <div className="ml-auto flex items-center gap-2">
          {content && choosing && (
            <button type="button" onClick={() => setChoosing(false)} className="rounded text-[13px] font-medium text-campaign-action hover:text-campaign-hover focus-visible:outline-2 focus-visible:outline-brand-action">
              Keep current content
            </button>
          )}
          <DotsNineIcon size={22} aria-hidden className="text-[#D4CEE0]" />
        </div>
      </header>

      <input
        ref={fileRef}
        type="file"
        accept=".html,.htm,text/html"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void importHtml(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {error && (
        <p id="content-error" role="alert" className="mx-5 mt-3 flex items-center gap-2 rounded-lg bg-[var(--danger-bg)] px-3 py-2 text-[12.5px] font-medium text-[#B42318]">
          <WarningCircleIcon size={16} aria-hidden className="shrink-0" />
          {error}
        </p>
      )}

      {showOptions ? (
        <div className="px-5 pt-4 pb-6">
          {content && <p className="mb-4 rounded-lg bg-[var(--warning-bg)] px-3 py-2 text-[12.5px] text-[var(--warning)]">Choosing new content replaces the current email.</p>}
          <h3 className="text-[14px] leading-5 font-medium text-campaign-depth">Template categories</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
            <CategoryCard title="Gallery" text="Choose from pre-designed templates" selected={current === "gallery"} onClick={() => router.push(galleryHref({ campaignId }))} art={<GalleryArt />} />
            <CategoryCard title="Layouts" text="Start with a layout structure" selected={current === "layouts"} onClick={() => router.push(galleryHref({ campaignId, section: "layouts" }))} art={<LayoutArt />} />
            <CategoryCard title="From Scratch" text="Build your email from scratch" selected={current === "scratch"} onClick={() => openEditor(blankDesign(), "Blank design")} art={<ScratchArt />} />
          </div>

          <h3 className="mt-8 text-[14px] leading-5 font-medium text-campaign-depth">Build your own</h3>
          <div className="mt-3 grid gap-2.5">
            <BuildCard title="Import HTML" text="Upload and use your HTML file" fg="#FF7D3D" bg="#FFF3EC" icon={<UploadSimpleIcon size={22} weight="bold" />} onClick={() => fileRef.current?.click()} />
            <BuildCard
              title="Plain Text Editor"
              text="Create a simple text email"
              fg="#2D9D78"
              bg="#E9F6F1"
              icon={<NotepadIcon size={22} />}
              onClick={() => openEditor(content?.kind === "text" ? content : { kind: "text", text: content ? contentToText(content) || STARTER_TEXT : STARTER_TEXT }, "Plain text")}
            />
            <BuildCard title="HTML Editor" text="Create and edit custom HTML" fg="#3B5998" bg="#EEF1F8" icon={<CodeIcon size={22} weight="bold" />} onClick={() => openEditor(content?.kind === "html" ? content : { kind: "html", html: STARTER_HTML }, "Custom HTML")} />
          </div>
        </div>
      ) : (
        content && (
          <div className="px-5 pt-3 pb-5">
            <div className="overflow-hidden rounded-xl border border-line bg-campaign-surface">
              <button type="button" onClick={() => setPreview(true)} className="group relative block w-full focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-action" aria-label="Preview email">
                <EmailThumb content={content} className="h-[360px] w-full" />
                <span className="absolute inset-0 flex items-center justify-center bg-campaign-depth/0 opacity-0 transition group-hover:bg-campaign-depth/25 group-hover:opacity-100">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[13px] font-medium text-ink shadow-pop">
                    <EyeIcon size={15} aria-hidden /> Preview
                  </span>
                </span>
              </button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] leading-5 font-medium text-campaign-depth">{source || "Custom content"}</p>
                <p className="text-[12.5px] leading-4 text-ink-muted">{KIND_LABEL[content.kind]}</p>
              </div>
              <OutlineButton icon={PencilSimpleIcon} className="h-9" onClick={() => openEditor(content, source || KIND_LABEL[content.kind])}>
                Edit
              </OutlineButton>
              <OutlineButton icon={SwapIcon} className="h-9" onClick={() => setChoosing(true)}>
                Change
              </OutlineButton>
              <OutlineButton icon={TrashIcon} className="h-9 w-9 px-0" aria-label="Remove content" onClick={() => onChange(null, "")} />
            </div>
          </div>
        )
      )}

      {content && <PreviewDialog open={preview} onOpenChange={setPreview} content={content} preheader={previewText} title={campaignName} />}
    </section>
  );
}

type Category = "gallery" | "layouts" | "scratch";

/** Large preview card: artwork on a lavender surface, then title and description. */
function CategoryCard({ title, text, selected, onClick, art }: { title: string; text: string; selected: boolean; onClick: () => void; art: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-selected={selected}
      className="group flex flex-col rounded-xl border border-line bg-white p-2.5 text-left transition hover:-translate-y-0.5 hover:border-campaign-soft hover:shadow-pop focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-action data-[selected=true]:border-campaign-soft data-[selected=true]:bg-campaign-tint/50 data-[selected=true]:ring-1 data-[selected=true]:ring-campaign-soft"
    >
      <span className="flex h-[156px] items-end justify-center overflow-hidden rounded-lg bg-campaign-surface px-3 pt-4 transition-colors group-hover:bg-campaign-tint/70" aria-hidden>
        {art}
      </span>
      <span className="px-1.5 pt-3 text-[15px] leading-5 font-semibold text-campaign-depth group-hover:text-campaign-primary">{title}</span>
      <span className="px-1.5 pt-1.5 pb-1.5 text-[13px] leading-5 text-ink-muted">{text}</span>
    </button>
  );
}

function GalleryArt() {
  return (
    <span className="relative block h-[140px] w-[82%]">
      <span className="absolute top-3 right-0 bottom-0 left-6 rounded-t-lg bg-[#C4B5FD]" />
      <span className="absolute top-1.5 right-2 bottom-0 left-3 rounded-t-lg bg-[#DDD6FE]" />
      <span className="absolute top-0 right-4 bottom-0 left-0 rounded-t-lg border border-line bg-white p-2.5 shadow-card">
        <span className="block h-1 w-6 rounded bg-[#E3DFEA]" />
        <span className="mt-2 block text-[9px] leading-[11px] font-bold tracking-wide text-campaign-action">OOPS..!</span>
        <span className="mt-1 block h-1 w-3/4 rounded bg-[#ECE9F2]" />
        <span className="mt-2 flex h-[46px] items-center justify-center rounded-md bg-gradient-to-br from-[#DDD6FE] to-[#A78BFA]">
          <span className="h-4 w-8 rounded bg-white/80" />
        </span>
        <span className="mt-2 block h-1 w-5/6 rounded bg-[#ECE9F2]" />
        <span className="mt-1 block h-1 w-1/2 rounded bg-[#ECE9F2]" />
      </span>
    </span>
  );
}

function LayoutArt() {
  return (
    <span className="relative block h-[140px] w-[82%]">
      <span className="absolute top-3 right-0 bottom-0 left-8 rounded-t-lg bg-[#C4B5FD]" />
      <span className="absolute top-0 right-3 bottom-0 left-0 grid grid-cols-2 content-start gap-1.5 rounded-t-lg border border-line bg-white p-2.5 shadow-card">
        <span className="col-span-2 flex h-11 items-end justify-center rounded bg-[#ECEAF1] pb-1">
          <span className="h-0 w-0 border-x-[10px] border-b-[12px] border-x-transparent border-b-[#C9C4D6]" />
        </span>
        <span className="space-y-1 pt-0.5">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="block h-1 rounded bg-[#D9D5E3]" />
          ))}
        </span>
        <span className="h-9 rounded bg-[#ECEAF1]" />
        <span className="col-span-2 mt-1 block h-1 w-2/3 justify-self-center rounded bg-[#E3E0EA]" />
      </span>
    </span>
  );
}

function ScratchArt() {
  return (
    <span className="flex h-[140px] w-[82%] items-center justify-center rounded-t-lg bg-gradient-to-b from-[#F3E8FF] to-[#E4DAFD]">
      <span className="inline-flex size-10 items-center justify-center rounded-full border-2 border-dashed border-campaign-action bg-white/70 text-campaign-action">
        <PlusIcon size={18} weight="bold" />
      </span>
    </span>
  );
}

/** Spacious horizontal action: coloured icon tile, title, description, chevron. */
function BuildCard({ title, text, icon, fg, bg, onClick }: { title: string; text: string; icon: ReactNode; fg: string; bg: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-xl border border-line bg-white px-4 py-4 text-left transition hover:border-campaign-soft hover:bg-campaign-surface hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-action"
    >
      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl" style={{ color: fg, backgroundColor: bg }} aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] leading-5 font-semibold text-campaign-depth">{title}</span>
        <span className="mt-1 block text-[13px] leading-[18px] text-ink-muted">{text}</span>
      </span>
      <CaretRightIcon size={18} aria-hidden className="shrink-0 text-ink-body transition-transform group-hover:translate-x-0.5 group-hover:text-campaign-action" />
    </button>
  );
}

/** Large preview with desktop and phone widths. */
export function PreviewDialog({ open, onOpenChange, content, preheader, title }: { open: boolean; onOpenChange: (o: boolean) => void; content: EmailContent; preheader?: string; title: string }) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(860px,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <div className="flex items-center gap-3 border-b border-line-soft px-5 py-3.5 pr-12">
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-[16px] font-semibold text-ink">Preview · {title}</DialogTitle>
            <DialogDescription className="text-[12px] text-ink-muted">Personalization shows sample values. Links are disabled in the preview.</DialogDescription>
          </div>
          <div className="flex rounded-lg border border-line p-0.5" role="group" aria-label="Preview width">
            {(["desktop", "mobile"] as const).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={device === d}
                onClick={() => setDevice(d)}
                className={cn("inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] transition-colors", device === d ? "bg-brand-surface text-brand" : "text-ink-muted hover:text-ink")}
              >
                {d === "desktop" ? <DesktopIcon size={14} aria-hidden /> : <DeviceMobileIcon size={14} aria-hidden />}
                <span className="hidden sm:inline">{d === "desktop" ? "Desktop" : "Mobile"}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 bg-[#F4F2F8] p-3 sm:p-5">
          <div className={cn("mx-auto h-full overflow-hidden rounded-lg bg-white shadow-card transition-[max-width]", device === "mobile" ? "max-w-[380px]" : "max-w-full")}>
            <EmailFrame content={content} preheader={preheader} title={`Preview of ${title}`} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

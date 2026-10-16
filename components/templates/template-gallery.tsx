"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Icon } from "@phosphor-icons/react";
import { CaretRightIcon, CheckIcon, EyeIcon, MagnifyingGlassIcon, NotePencilIcon, PencilSimpleIcon, SquaresFourIcon, SparkleIcon, StackSimpleIcon, UserCircleIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { OutlineButton, PrimaryButton } from "@/components/shared/campaign-ui";
import { EmailThumb } from "@/components/shared/email-ui";
import { EmptyState } from "@/components/shared/state-panels";
import { PreviewDialog } from "@/components/campaigns/editor/content-card";
import { useCampaign } from "@/hooks/use-campaigns";
import { useTemplates } from "@/hooks/use-templates";
import { copyTemplateContent } from "@/lib/api/templates";
import { galleryHref, TEMPLATES_ROUTE, type ContentTarget } from "@/lib/content-session";
import { blankDesign, buildLayout, idFactory, LAYOUTS } from "@/lib/email-blocks";
import { formatDate } from "@/lib/format";
import { categoryLabel, GALLERY_FILTERS } from "@/lib/mock-data/templates";
import { campaignHref, NEW_CAMPAIGN_ID } from "@/lib/routes";
import type { EmailContent, EmailTemplate, LayoutKey, TemplateCategory } from "@/lib/types/templates";
import { cn } from "@/lib/utils";
import { returnToCampaign, startEditing } from "./start-editing";

type Section = "gallery" | "layouts" | "mine";

interface Pick {
  key: string;
  name: string;
  category?: TemplateCategory;
  content: EmailContent;
  /** Gallery or saved template id (content is copied from it). */
  templateId?: string;
  layout?: LayoutKey;
  mine?: boolean;
}

const SECTIONS: { key: Section | "scratch"; label: string; icon: Icon; fg: string; bg: string }[] = [
  { key: "gallery", label: "Gallery", icon: SquaresFourIcon, fg: "#5B21B6", bg: "#F3E8FF" },
  { key: "layouts", label: "Layouts", icon: StackSimpleIcon, fg: "#2D9D78", bg: "#E9F6F1" },
  { key: "mine", label: "My Templates", icon: UserCircleIcon, fg: "#3B5998", bg: "#EEF1F8" },
  { key: "scratch", label: "Create from Scratch", icon: SparkleIcon, fg: "#D2416D", bg: "#FDEEF3" },
];

/**
 * Full-page Template Gallery. Opened from a campaign (`?campaign=`), choosing
 * a template returns to that campaign with it as the content; opened for a new
 * template (`?name=`), the choice opens in the editor to customise and save.
 */
export function TemplateGallery() {
  const router = useRouter();
  const params = useSearchParams();
  const campaignId = params.get("campaign") ?? "";
  const templateName = params.get("name") ?? "";
  const section = (["gallery", "layouts", "mine"].includes(params.get("section") ?? "") ? params.get("section") : "gallery") as Section;
  const category = GALLERY_FILTERS.some((f) => f.key === params.get("category")) ? params.get("category")! : GALLERY_FILTERS[0].key;
  const paramQ = params.get("q") ?? "";
  const [q, setQ] = useState(paramQ);
  // A new search from the header while the gallery is open.
  const [syncedQ, setSyncedQ] = useState(paramQ);
  if (paramQ !== syncedQ) {
    setSyncedQ(paramQ);
    setQ(paramQ);
  }
  const [selected, setSelected] = useState<Pick | null>(null);
  const [previewing, setPreviewing] = useState<Pick | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: campaignData } = useCampaign(campaignId && campaignId !== NEW_CAMPAIGN_ID ? campaignId : "");
  const campaign = campaignId ? campaignData?.campaign : undefined;
  // An unsaved campaign (Create Campaign) has no record yet.
  const campaignName = campaignId === NEW_CAMPAIGN_ID ? "New campaign" : campaign?.name;
  const gallery = useTemplates({ scope: "gallery" });
  const mine = useTemplates({ scope: "mine" });

  const go = (next: { section?: Section; category?: string }) => {
    setSelected(null);
    const href = galleryHref({ campaignId: campaignId || undefined, templateName: templateName || undefined, section: next.section ?? section, category: (next.section ?? section) === "gallery" ? (next.category ?? category) : undefined });
    router.replace(href, { scroll: false });
  };

  const close = () => router.push(campaignId ? campaignHref(campaignId) : TEMPLATES_ROUTE);

  /** Where an edited design is saved: the campaign, or a new / existing template. */
  const targetFor = (p: Pick, origin: "gallery" | "layout" | "scratch"): ContentTarget =>
    campaignId
      ? { kind: "campaign", campaignId, campaignName: campaignName ?? "Campaign" }
      : p.mine && p.templateId
        ? { kind: "template", templateId: p.templateId, name: p.name, category: p.category ?? "newsletter", origin }
        : { kind: "template", name: templateName || (origin === "gallery" ? `My ${p.name}` : ""), category: p.category ?? (p.layout === "promotional" || p.layout === "product-grid" ? "promotional" : p.layout === "newsletter" ? "newsletter" : "announcement"), origin };

  const contentOf = async (p: Pick) => (p.templateId ? copyTemplateContent(p.templateId) : p.content);

  const use = async (p: Pick) => {
    if (!campaignId) return customize(p);
    setBusy(true);
    try {
      returnToCampaign(router.push, campaignId, { content: await contentOf(p), source: p.layout ? `${p.name} layout` : p.name });
    } catch (e) {
      toast.error("Couldn't use this template", { description: (e as Error).message });
      setBusy(false);
    }
  };

  const customize = async (p: Pick) => {
    setBusy(true);
    try {
      startEditing(router.push, { target: targetFor(p, p.layout ? "layout" : "gallery"), content: await contentOf(p), source: p.layout ? `${p.name} layout` : p.name });
    } catch (e) {
      toast.error("Couldn't open this template", { description: (e as Error).message });
      setBusy(false);
    }
  };

  const scratch = () => startEditing(router.push, { target: targetFor({ key: "blank", name: "Blank design", content: blankDesign() }, "scratch"), content: blankDesign(), source: "Blank design" });

  const term = q.trim().toLowerCase();
  const filter = GALLERY_FILTERS.find((f) => f.key === category)!;
  const matches = (t: EmailTemplate) => !term || t.name.toLowerCase().includes(term) || t.description.toLowerCase().includes(term) || categoryLabel(t.category).toLowerCase().includes(term);

  const layouts = useMemo(() => LAYOUTS.map((l) => ({ key: `layout-${l.key}`, name: l.name, content: buildLayout(l.key, idFactory(`lay-${l.key}`)), layout: l.key })), []);
  const src = section === "mine" ? mine.data : gallery.data;
  const items: Pick[] | undefined =
    section === "layouts"
      ? layouts.filter((l) => !term || l.name.toLowerCase().includes(term))
      : src
          ?.filter((t) => (term || section === "mine" ? true : filter.categories.includes(t.category)) && matches(t))
          .map((t) => ({ key: t.id, name: t.name, category: t.category, content: t.content, templateId: t.id, mine: !t.system }));

  const descriptions = useMemo(() => new Map([...(gallery.data ?? []), ...(mine.data ?? [])].map((t) => [t.id, t])), [gallery.data, mine.data]);
  const primaryLabel = campaignId ? (section === "layouts" ? "Edit layout" : "Use template") : section === "mine" ? "Edit template" : "Customize template";

  return (
    <div className="flex flex-1 flex-col p-3 sm:p-4">
      <div className="flex min-h-[calc(100dvh-60px-2rem)] flex-1 flex-col overflow-hidden rounded-xl border border-line bg-white shadow-card lg:min-h-[calc(100dvh-var(--header-h)-2rem)]">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-soft px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <h1 className="text-[16px] leading-6 font-semibold text-ink">Pick a template</h1>
            <p className="truncate text-[12.5px] leading-4 text-ink-muted">
              {campaignId ? (
                <>
                  For campaign <span className="font-medium text-ink-body">{campaignName ?? "…"}</span> — your unsaved campaign changes are kept.
                </>
              ) : templateName ? (
                <>
                  New template <span className="font-medium text-ink-body">{templateName}</span> — pick a starting point to customise.
                </>
              ) : (
                "Browse ready-made designs and layouts, or start from scratch."
              )}
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <MagnifyingGlassIcon size={14} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={section === "layouts" ? "Search layouts" : "Search templates"} aria-label="Search templates" className="h-9 w-full rounded-lg border border-line bg-white pr-3 pl-8.5 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-brand-hover focus:ring-3 focus:ring-brand-10" />
          </div>
          <button type="button" onClick={close} aria-label="Close template gallery" className="inline-flex size-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-brand-depth-10 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-action">
            <XIcon size={18} aria-hidden />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Sections */}
          <nav aria-label="Template sources" className="shrink-0 border-b border-line-soft md:w-[200px] md:border-r md:border-b-0">
            <p className="hidden px-4 pt-4 pb-2 text-[13px] font-medium text-ink md:block">Template Gallery</p>
            <ul className="flex gap-1 overflow-x-auto p-2 scrollbar-none md:block md:space-y-0.5 md:overflow-visible md:pt-0">
              {SECTIONS.map((s, i) => {
                const active = s.key === section;
                return (
                  <li key={s.key} className={cn(s.key === "scratch" && "md:mt-1 md:border-t md:border-dashed md:border-line md:pt-1.5", i === 0 && "")}>
                    <button
                      type="button"
                      aria-current={active ? "page" : undefined}
                      onClick={() => (s.key === "scratch" ? scratch() : go({ section: s.key }))}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-brand-action",
                        active ? "bg-campaign-tint font-medium text-campaign-primary" : "text-ink-body hover:bg-campaign-surface",
                      )}
                    >
                      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ color: s.fg, backgroundColor: s.bg }} aria-hidden>
                        <s.icon size={17} />
                      </span>
                      <span className="flex-1">{s.label}</span>
                      {active && s.key !== "scratch" && <CaretRightIcon size={12} aria-hidden className="hidden md:block" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Categories */}
          {section === "gallery" && (
            <nav aria-label="Filter by category" className="shrink-0 border-b border-line-soft md:w-[190px] md:border-r md:border-b-0">
              <p className="hidden px-4 pt-4 pb-2 text-[12.5px] text-ink-muted md:block">Filter by categories</p>
              <ul className="flex gap-1 overflow-x-auto px-2 py-2 scrollbar-none md:block md:space-y-0.5 md:pt-0">
                {GALLERY_FILTERS.map((f) => {
                  const active = !term && f.key === category;
                  return (
                    <li key={f.key}>
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setQ("");
                          go({ category: f.key });
                        }}
                        className={cn("w-full rounded-lg px-2.5 py-2 text-left text-[13px] whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-brand-action", active ? "bg-[#EEF1F8] font-medium text-ink" : "text-ink-body hover:bg-campaign-surface")}
                      >
                        {f.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}

          {/* Grid */}
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-[#F7F7FA]">
            <div className="flex-1 overflow-y-auto p-3 scrollbar-thin sm:p-4" id="template-grid">
              {term && section === "gallery" && <p className="mb-3 text-[12.5px] text-ink-muted">Searching all categories for “{q}”</p>}
              {!items ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }, (_, i) => (
                    <Skeleton key={i} className="h-[330px] rounded-xl" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <EmptyState
                  icon={NotePencilIcon}
                  title={section === "mine" && !term ? "No saved templates yet" : "No templates match"}
                  hint={section === "mine" && !term ? "Templates you create from Email Templates appear here." : "Try another word or category."}
                  action={section === "mine" && !term ? <PrimaryButton onClick={() => router.push(TEMPLATES_ROUTE)}>Create a template</PrimaryButton> : undefined}
                />
              ) : (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label={section === "layouts" ? "Layouts" : "Templates"}>
                  {items.map((p) => {
                    const on = selected?.key === p.key;
                    const t = p.templateId ? descriptions.get(p.templateId) : undefined;
                    const layout = p.layout ? LAYOUTS.find((l) => l.key === p.layout) : undefined;
                    return (
                      <li key={p.key}>
                        <div
                          className={cn(
                            "group relative overflow-hidden rounded-xl border bg-white transition hover:-translate-y-0.5 hover:shadow-pop",
                            on ? "border-brand ring-2 ring-brand/30" : "border-line hover:border-brand-soft",
                          )}
                        >
                          <button type="button" aria-pressed={on} onClick={() => setSelected(on ? null : p)} onDoubleClick={() => use(p)} className="block w-full text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-action">
                            <EmailThumb content={p.content} className="h-[280px] w-full border-b border-line-soft" />
                            <span className="flex items-center gap-2 px-3.5 py-3">
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13.5px] font-medium text-ink">{p.name}</span>
                                <span className="block truncate text-[12px] text-ink-muted">{layout?.description ?? (t ? (p.mine ? `${categoryLabel(t.category)} · updated ${formatDate(t.updatedAt)}` : categoryLabel(t.category)) : "")}</span>
                              </span>
                              {on && (
                                <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-white" aria-hidden>
                                  <CheckIcon size={12} weight="bold" />
                                </span>
                              )}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewing(p)}
                            aria-label={`Preview ${p.name}`}
                            className="absolute top-2.5 right-2.5 inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/95 px-2.5 text-[12.5px] font-medium text-ink opacity-0 shadow-card transition group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-brand-action"
                          >
                            <EyeIcon size={14} aria-hidden /> Preview
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Selection bar */}
            {selected && (
              <div className="flex flex-wrap items-center gap-2 border-t border-line bg-white px-4 py-3" role="region" aria-label="Selected template">
                <p className="min-w-0 flex-1 truncate text-[13px] text-ink-body">
                  Selected: <span className="font-semibold text-ink">{selected.name}</span>
                </p>
                <OutlineButton icon={EyeIcon} className="h-8" onClick={() => setPreviewing(selected)}>
                  Preview
                </OutlineButton>
                {campaignId && section !== "layouts" && (
                  <OutlineButton icon={PencilSimpleIcon} className="h-8" onClick={() => customize(selected)} disabled={busy}>
                    Customize first
                  </OutlineButton>
                )}
                <PrimaryButton className="h-8" onClick={() => (campaignId && section !== "layouts" ? use(selected) : customize(selected))} disabled={busy}>
                  {busy ? "Opening…" : primaryLabel}
                </PrimaryButton>
              </div>
            )}
          </div>
        </div>
      </div>
      {previewing && <PreviewDialog open onOpenChange={(o) => !o && setPreviewing(null)} content={previewing.content} title={previewing.name} />}
    </div>
  );
}

export function TemplateGalleryFallback() {
  return (
    <div className="p-4">
      <Skeleton className="h-[calc(100dvh-var(--header-h)-2rem)] rounded-xl" />
    </div>
  );
}

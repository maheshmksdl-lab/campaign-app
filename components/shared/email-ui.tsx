"use client";

/**
 * Email content building blocks shared by the campaign editor, the Template
 * Gallery and the content editor: sandboxed previews and thumbnails, the
 * on/off switch and the "Set up and explore" panel.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { renderEmailDocument } from "@/lib/email-render";
import type { EmailContent } from "@/lib/types/templates";
import { cn } from "@/lib/utils";

/** Full-size preview. Scripts never run: the frame is sandboxed without allow-scripts. */
export function EmailFrame({ content, preheader, title, className, width }: { content: EmailContent; preheader?: string; title: string; className?: string; width?: number }) {
  const doc = useMemo(() => renderEmailDocument(content, { preheader }), [content, preheader]);
  return (
    <iframe
      title={title}
      srcDoc={doc}
      sandbox=""
      className={cn("block h-full w-full border-0 bg-white", className)}
      style={width ? { width, maxWidth: "100%", margin: "0 auto" } : undefined}
    />
  );
}

/**
 * A scaled-down, non-interactive preview of the top of an email, sized to its
 * container (600px design width). Rendered lazily, once it scrolls into view.
 */
export function EmailThumb({ content, className, designWidth = 600 }: { content: EmailContent; className?: string; designWidth?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [seen, setSeen] = useState(false);
  const doc = useMemo(() => (seen ? renderEmailDocument(content) : ""), [content, seen]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { rootMargin: "200px" });
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  const scale = size ? size.w / designWidth : 0;
  return (
    <div ref={ref} className={cn("relative overflow-hidden bg-white", className)} aria-hidden>
      {seen && size && scale > 0 && (
        <iframe
          title=""
          srcDoc={doc}
          sandbox=""
          tabIndex={-1}
          loading="lazy"
          className="pointer-events-none absolute top-0 left-0 origin-top-left border-0"
          style={{ width: designWidth, height: size.h / scale, transform: `scale(${scale})` }}
        />
      )}
    </div>
  );
}

/** On / off switch with a visible state label. */
export function Switch({ checked, onChange, label, id, disabled, showState = true }: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string; disabled?: boolean; showState?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-action disabled:opacity-50",
          checked ? "bg-brand" : "bg-[#D7D3E0]",
        )}
      >
        <span className={cn("inline-block size-4 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[18px]" : "translate-x-0.5")} />
      </button>
      {showState && <span className={cn("w-[58px] text-[13.5px]", checked ? "font-medium text-campaign-primary" : "text-ink-body")}>{checked ? "Enabled" : "Disabled"}</span>}
    </span>
  );
}

export interface ExploreItem {
  title: string;
  text: string;
  action: string;
  href?: string;
  onClick?: () => void;
}

/** "Set up and explore" — three short guides below a page's main content. */
export function SetupExplore({ items, className }: { items: ExploreItem[]; className?: string }) {
  return (
    <section aria-labelledby="setup-explore" className={cn("rounded-xl bg-campaign-muted px-5 py-5 sm:px-6", className)}>
      <h2 id="setup-explore" className="text-[14px] leading-5 font-semibold text-ink">
        Set up and explore
      </h2>
      <div className="mt-4 grid gap-5 md:grid-cols-3 md:gap-0 md:divide-x md:divide-line">
        {items.map((it, i) => (
          <div key={it.title} className={cn("flex min-w-0 flex-col md:px-6", i === 0 && "md:pl-0", i === items.length - 1 && "md:pr-0")}>
            <h3 className="text-[13px] leading-5 font-medium text-ink">{it.title}</h3>
            <p className="mt-1.5 flex-1 text-[12.5px] leading-5 text-ink-body">{it.text}</p>
            <ExploreAction item={it} />
          </div>
        ))}
      </div>
    </section>
  );
}

const exploreLink = "mt-3 w-fit rounded text-[13px] font-medium text-campaign-action transition-colors hover:text-campaign-hover hover:underline focus-visible:outline-2 focus-visible:outline-brand-action";

function ExploreAction({ item }: { item: ExploreItem }) {
  if (item.href)
    return (
      <Link href={item.href} className={exploreLink}>
        {item.action}
      </Link>
    );
  return (
    <button type="button" onClick={item.onClick} className={cn(exploreLink, "text-left")}>
      {item.action}
    </button>
  );
}

/** Small round icon tile used in content option buttons. */
export function IconTile({ children, fg, bg, className }: { children: ReactNode; fg: string; bg: string; className?: string }) {
  return (
    <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-md", className)} style={{ color: fg, backgroundColor: bg }} aria-hidden>
      {children}
    </span>
  );
}

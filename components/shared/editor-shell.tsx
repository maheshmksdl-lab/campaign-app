"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Full-page editor frame shared by every builder (segments, forms, workflows,
 * WhatsApp campaigns and templates), matching the Create Campaign page: a
 * sticky white header with back, an editable title, a status pill and
 * actions, over a light lavender workspace.
 */
export function EditorPage({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col bg-[#F7F5FB]">{children}</div>;
}

export function EditorHeader({
  backHref,
  backLabel,
  name,
  onName,
  nameLabel,
  nameError,
  placeholder,
  pill,
  meta,
  actions,
}: {
  backHref: string;
  backLabel: string;
  name: string;
  onName?: (v: string) => void;
  nameLabel: string;
  nameError?: string;
  placeholder?: string;
  pill?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="sticky top-[60px] z-20 border-b border-line bg-white lg:top-[var(--header-h)]">
      <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link href={backHref} aria-label={backLabel} className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-campaign-depth transition-colors hover:bg-campaign-surface hover:text-campaign-action focus-visible:outline-2 focus-visible:outline-brand-action">
            <ArrowLeftIcon size={20} aria-hidden />
          </Link>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
              {onName ? (
                <>
                  <label htmlFor="editor-name" className="sr-only">
                    {nameLabel}
                  </label>
                  <input
                    id="editor-name"
                    value={name}
                    placeholder={placeholder}
                    onChange={(e) => onName(e.target.value)}
                    maxLength={120}
                    size={Math.min(48, Math.max(14, (name || placeholder || "").length + 1))}
                    aria-invalid={nameError ? true : undefined}
                    aria-describedby={nameError ? "editor-name-error" : undefined}
                    className="-mx-2 h-9 w-full max-w-full min-w-0 rounded-lg border border-transparent bg-transparent px-2 text-[18px] sm:w-auto font-semibold text-campaign-depth outline-none transition-colors placeholder:font-normal placeholder:text-ink-faint hover:border-line hover:bg-campaign-surface/60 focus:border-campaign-action focus:bg-white focus:ring-3 focus:ring-brand-10 aria-invalid:border-[#F0A8A4]"
                  />
                </>
              ) : (
                <h1 className="truncate text-[18px] font-semibold text-campaign-depth">{name}</h1>
              )}
              {pill}
              {meta && (
                <>
                  <span className="hidden h-5 w-px bg-line sm:block" aria-hidden />
                  <span className="text-[13.5px] text-ink-body">{meta}</span>
                </>
              )}
            </div>
            {nameError && (
              <p id="editor-name-error" role="alert" className="mt-0.5 text-[12px] font-medium text-[#D92D20]">
                {nameError}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
      </div>
    </div>
  );
}

/** Pill next to an editor title (Draft, Active…). */
export function Pill({ children, fg = "var(--campaign-primary)", bg = "var(--campaign-tint)" }: { children: ReactNode; fg?: string; bg?: string }) {
  return (
    <span className="inline-flex h-7 shrink-0 items-center rounded-md px-2.5 text-[13px] font-medium" style={{ color: fg, backgroundColor: bg }}>
      {children}
    </span>
  );
}

/** Violet primary button used in editor headers (same as Review & Launch). */
export const headerPrimaryClass =
  "inline-flex h-10 items-center gap-2 rounded-lg bg-campaign-action px-5 text-[14px] font-semibold text-white shadow-[0_1px_2px_rgb(61_30_92/0.25)] transition-colors hover:bg-campaign-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-action";

export const headerOutlineClass =
  "inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-4 text-[14px] font-medium text-ink-body transition-colors hover:border-[#D7D1E3] hover:bg-campaign-muted hover:text-ink disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-brand-action";

/** The editor body: two columns (form left, preview / panel right) that stack on small screens. */
export function EditorColumns({ left, right, ratio = "lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]", className }: { left: ReactNode; right: ReactNode; ratio?: string; className?: string }) {
  return (
    <div className={cn("mx-auto grid w-full max-w-[1600px] flex-1 items-start gap-4 px-3 py-4 sm:px-4", ratio, className)}>
      <div className="grid min-w-0 gap-4">{left}</div>
      <div className="grid min-w-0 gap-4 lg:sticky lg:top-[calc(var(--header-h)+88px)]">{right}</div>
    </div>
  );
}

export function EditorShellSkeleton() {
  return (
    <EditorPage>
      <div className="border-b border-line bg-white px-6 py-4" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-7 w-80" />
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-[1.15fr_1fr]">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </EditorPage>
  );
}

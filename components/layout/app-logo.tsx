import Image from "next/image";
import Link from "next/link";
import { HOME_ROUTE } from "@/lib/routes";
import { cn } from "@/lib/utils";

/**
 * Brand assets. Replace the files in public/brand with the official EVOQ
 * Campaigns logo (keep the paths, or update them here) — nothing else changes.
 */
export const LOGO_SRC = "/brand/evoq-campaigns-logo.png";
export const MARK_SRC = "/brand/evoq-campaigns-mark.png";

/** The square mark alone (collapsed sidebar, phone header). */
export function LogoMark({ className }: { className?: string }) {
  return <Image src={MARK_SRC} alt="" width={54} height={54} aria-hidden className={cn("size-9 shrink-0 select-none", className)} draggable={false} unoptimized />;
}

/** Full logo in the sidebar and navigation drawer — links to the Overview. */
export function AppLogo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <Link href={HOME_ROUTE} className={cn("inline-flex shrink-0 items-center rounded-md", className)} aria-label="EVOQ Campaigns — go to Overview">
      {compact ? (
        <LogoMark />
      ) : (
        <Image src={LOGO_SRC} alt="EVOQ Campaigns" width={242} height={54} priority className="h-10 w-auto shrink-0 select-none" draggable={false} unoptimized />
      )}
    </Link>
  );
}

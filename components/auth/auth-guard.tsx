"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/ssr";
import { useHydrated } from "@/hooks/use-hydrated";
import { useSession } from "@/lib/auth";

/**
 * Shows the app only with a mock session; otherwise sends the visitor to
 * /login and brings them back to this page afterwards. Client-side only (see
 * lib/auth) — a convenience for the demo, not a security boundary.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const signedOut = hydrated && !session;

  useEffect(() => {
    if (!signedOut) return;
    const next = `${pathname}${window.location.search}`;
    router.replace(next && next !== "/" ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }, [signedOut, pathname, router]);

  if (!hydrated || !session)
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#F7F5FB]" aria-busy="true">
        <span className="flex items-center gap-2 text-[13px] text-ink-muted">
          <CircleNotchIcon size={18} aria-hidden className="animate-spin text-campaign-action" />
          {hydrated ? "Taking you to sign in…" : "Loading EVOQ Campaigns…"}
        </span>
      </div>
    );
  return <>{children}</>;
}

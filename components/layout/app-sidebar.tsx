"use client";

import { Suspense, type ReactElement } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CaretDownIcon, CrownSimpleIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePlanUsage } from "@/hooks/use-campaigns";
import { formatNumber } from "@/lib/format";
import { PLAN_NAME } from "@/lib/mock-data/campaigns";
import { notInPhase } from "@/lib/phase";
import { cn } from "@/lib/utils";
import { AppLogo } from "./app-logo";
import { activeNav, NAV_GROUPS, navHref, type NavItem } from "./nav-config";
import { useShell } from "./shell-context";

/** Wraps an item in a right-side tooltip on the collapsed rail. */
function SideTip({ show, label, children }: { show: boolean; label: string; children: ReactElement }) {
  if (!show) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function NavRow({ item, active, collapsed, onNavigate }: { item: NavItem; active: boolean; collapsed: boolean; onNavigate?: () => void }) {
  const IconCmp = item.icon;
  const cls = cn(
    "group relative flex items-center rounded-lg text-[14px] leading-5 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-action",
    collapsed ? "mx-auto size-10 justify-center" : "h-10 w-full gap-3 px-3.5",
    active ? "bg-campaign-tint font-medium text-campaign-primary" : "text-ink-body hover:bg-campaign-surface hover:text-ink",
  );
  const body = (
    <>
      <IconCmp size={19} weight={active ? "duotone" : "regular"} aria-hidden className={cn("shrink-0", active ? "text-campaign-action" : "text-ink-muted group-hover:text-ink")} />
      <span className={collapsed ? "sr-only" : "truncate"}>{item.label}</span>
    </>
  );

  if (!item.href) {
    // Later-phase module: visible for the module map, explains itself on click.
    return (
      <SideTip show={collapsed} label={item.label}>
        <button type="button" onClick={() => notInPhase(item.label)} className={cls}>
          {body}
        </button>
      </SideTip>
    );
  }
  return (
    <SideTip show={collapsed} label={item.label}>
      <Link href={navHref(item)} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cls}>
        {body}
      </Link>
    </SideTip>
  );
}

function NavList({ collapsed, onNavigate, type }: { collapsed: boolean; onNavigate?: () => void; type: string }) {
  const pathname = usePathname();
  const current = activeNav(pathname, type);
  return (
    <div className="space-y-1">
      {NAV_GROUPS.map((group, i) => {
        const headingId = group.label ? `nav-group-${i}` : undefined;
        return (
          <div key={group.label ?? i} role="group" aria-labelledby={headingId}>
            {group.label &&
              (collapsed ? (
                <>
                  <span id={headingId} className="sr-only">{group.label}</span>
                  <div aria-hidden className="mx-2 my-2 border-t border-line" />
                </>
              ) : (
                <p id={headingId} className="px-3.5 pt-4 pb-1.5 text-[12px] leading-4 font-medium text-primary">
                  {group.label}
                </p>
              ))}
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li key={item.label}>
                  <NavRow item={item} active={item === current} collapsed={collapsed} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/** The channel filter lives in the URL; reading it needs a Suspense boundary during prerender. */
function NavListWithParams(props: { collapsed: boolean; onNavigate?: () => void }) {
  const params = useSearchParams();
  return <NavList {...props} type={params.get("type") ?? ""} />;
}

function Nav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main navigation" className={cn("flex-1 overflow-x-hidden overflow-y-auto pt-2 pb-3 scrollbar-thin", collapsed ? "px-2" : "px-3")}>
      <Suspense fallback={<NavList collapsed={collapsed} type="" />}>
        <NavListWithParams collapsed={collapsed} onNavigate={onNavigate} />
      </Suspense>
    </nav>
  );
}

/** Plan name, contact usage and the upgrade call to action, as in the design. */
function PlanCard() {
  const { data } = usePlanUsage();
  const used = data ? Math.min(100, (data.contacts / data.limit) * 100) : 0;
  return (
    <div className="rounded-xl border border-line bg-white p-3.5 shadow-card">
      <DropdownMenu>
        <DropdownMenuTrigger className="-m-1 flex w-[calc(100%+8px)] items-center justify-between rounded-lg p-1 text-left transition-colors hover:bg-campaign-surface focus-visible:outline-2 focus-visible:outline-brand-action">
          <span>
            <span className="block text-[12px] leading-4 text-ink-muted">Current Plan</span>
            <span className="block text-[14px] leading-5 font-semibold text-campaign-primary">{PLAN_NAME}</span>
          </span>
          <CaretDownIcon size={14} aria-hidden className="text-ink-muted" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-60 rounded-xl">
          <DropdownMenuLabel className="text-[13px] font-semibold text-ink">{PLAN_NAME} plan</DropdownMenuLabel>
          <div className="space-y-1 px-2 pb-2 text-[12.5px] text-ink-body">
            <p>Up to {data ? formatNumber(data.limit) : "25,000"} contacts</p>
            <p>Email, SMS, automations and journeys</p>
            <p>Renews monthly · demo workspace</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => notInPhase("Billing & plans")}>Compare plans</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="mt-3">
        {data ? (
          <p className="text-[12px] leading-4 text-ink-body tabular-nums">
            <span className="font-medium text-ink">{formatNumber(data.contacts)}</span> / {formatNumber(data.limit)} Contacts
          </p>
        ) : (
          <Skeleton className="h-4 w-36" />
        )}
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-campaign-tint" role="progressbar" aria-label="Contacts used" aria-valuenow={Math.round(used)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-gradient-brand transition-[width] duration-500" style={{ width: `${used}%` }} />
        </div>
      </div>
      <button
        type="button"
        onClick={() => notInPhase("Plan upgrades")}
        className="mt-3.5 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-campaign-tint text-[13px] font-semibold text-campaign-primary transition-colors hover:bg-campaign-soft focus-visible:outline-2 focus-visible:outline-brand-action"
      >
        Upgrade Plan
      </button>
    </div>
  );
}

function CollapsedPlan() {
  return (
    <SideTip show label={`${PLAN_NAME} plan`}>
      <button
        type="button"
        onClick={() => notInPhase("Plan upgrades")}
        aria-label={`${PLAN_NAME} plan — upgrade`}
        className="mx-auto flex size-10 items-center justify-center rounded-lg bg-campaign-tint text-campaign-primary transition-colors hover:bg-campaign-soft focus-visible:outline-2 focus-visible:outline-brand-action"
      >
        <CrownSimpleIcon size={18} weight="duotone" aria-hidden />
      </button>
    </SideTip>
  );
}

/** Desktop: fixed full-height rail that collapses to icons. Phones / tablets: overlay drawer from the header's menu button. */
export function AppSidebar() {
  const { collapsed, drawerOpen, setDrawerOpen } = useShell();
  const close = () => setDrawerOpen(false);

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line bg-sidebar transition-[width] duration-200 select-none lg:flex",
          collapsed ? "w-[var(--sidebar-w-collapsed)]" : "w-[var(--sidebar-w)]",
        )}
      >
        <div className={cn("flex h-[76px] shrink-0 items-center", collapsed ? "justify-center" : "px-6")}>
          <AppLogo compact={collapsed} />
        </div>
        <Nav collapsed={collapsed} />
        <div className={cn("shrink-0 pb-4", collapsed ? "px-2" : "px-3")}>{collapsed ? <CollapsedPlan /> : <PlanCard />}</div>
      </aside>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-[min(280px,85vw)] gap-0 border-none bg-sidebar p-0 shadow-[4px_0_24px_rgba(39,34,56,0.1)] lg:hidden">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">EVOQ Campaigns modules</SheetDescription>
          <div className="flex h-[68px] shrink-0 items-center justify-between px-5">
            <AppLogo />
            <button
              type="button"
              onClick={close}
              aria-label="Close menu"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink transition-colors hover:bg-brand-depth-10 focus-visible:outline-2 focus-visible:outline-brand-action"
            >
              <XIcon size={18} weight="bold" aria-hidden />
            </button>
          </div>
          <Nav collapsed={false} onNavigate={close} />
          <div className="shrink-0 px-3 pb-4">
            <PlanCard />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

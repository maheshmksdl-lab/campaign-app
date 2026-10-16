"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowCounterClockwiseIcon, BellIcon, CaretDownIcon, GearSixIcon, InfoIcon, ListIcon, MagnifyingGlassIcon, PlusIcon, QuestionIcon, SignOutIcon, UserCircleIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CreateCampaignDialog, useCreateDialog } from "@/components/campaigns/campaign-dialogs";
import { ConfirmDialog, primaryButtonClass, StatusBadge, TypeIcon } from "@/components/shared/campaign-ui";
import { useCampaignSearch } from "@/hooks/use-campaigns";
import { useHydrated } from "@/hooks/use-hydrated";
import { useStoredState } from "@/hooks/use-stored-state";
import { resetDemoData } from "@/lib/api/store";
import { initials } from "@/lib/format";
import { CURRENT_USER } from "@/lib/mock-data/campaigns";
import { notInPhase } from "@/lib/phase";
import { CONTACTS_ROUTE, GALLERY_ROUTE, TEMPLATES_ROUTE } from "@/lib/content-session";
import { CAMPAIGNS_ROUTE, campaignHref } from "@/lib/routes";
import { toast } from "sonner";
import { signOut, useSession } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { LogoMark } from "./app-logo";
import { useShell } from "./shell-context";

const toolClass =
  "relative inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-body transition-colors hover:bg-brand-depth-10 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-action data-[state=open]:bg-brand-depth-10";

/** What the header search looks in, by section of the app. */
function searchScope(pathname: string) {
  if (pathname === CONTACTS_ROUTE || pathname.startsWith(`${CONTACTS_ROUTE}/`)) return { key: "contacts", label: "Contacts" } as const;
  if (pathname === TEMPLATES_ROUTE || pathname.startsWith(`${TEMPLATES_ROUTE}/`)) return { key: "templates", label: "Email Templates" } as const;
  return { key: "campaigns", label: "Campaigns" } as const;
}

/**
 * Header search. In Campaigns it searches campaigns (name, subject, audience)
 * with suggestions as you type; Enter opens the list filtered by the text. In
 * Contacts and Email Templates, Enter filters that page. `Ctrl/⌘ K` or `/` focuses it.
 */
function SearchField({ autoFocus, onDone, className }: { autoFocus?: boolean; onDone?: () => void; className?: string }) {
  const router = useRouter();
  const scope = searchScope(usePathname());
  const ref = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const term = value.trim();
  const { data: results } = useCampaignSearch(scope.key === "campaigns" ? term : "");
  const items = term && scope.key === "campaigns" ? (results ?? []) : [];

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !typing)) {
        if (!ref.current || ref.current.offsetParent === null) return;
        e.preventDefault();
        ref.current.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const finish = () => {
    setOpen(false);
    setActiveIdx(-1);
    setValue("");
    ref.current?.blur();
    onDone?.();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (scope.key === "contacts") {
      const p = new URLSearchParams(window.location.search);
      if (term) p.set("q", term);
      else p.delete("q");
      router.push(p.toString() ? `${CONTACTS_ROUTE}?${p}` : CONTACTS_ROUTE);
    } else if (scope.key === "templates") router.push(term ? `${GALLERY_ROUTE}?q=${encodeURIComponent(term)}` : GALLERY_ROUTE);
    else if (activeIdx >= 0 && items[activeIdx]) router.push(campaignHref(items[activeIdx].id));
    else router.push(term ? `${CAMPAIGNS_ROUTE}?q=${encodeURIComponent(term)}` : CAMPAIGNS_ROUTE);
    finish();
  };

  const showList = open && term.length > 0 && scope.key === "campaigns";

  return (
    <form role="search" onSubmit={submit} className={cn("relative", className)}>
      <MagnifyingGlassIcon size={17} aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-muted" />
      <input
        ref={ref}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeIdx >= 0 ? `${listId}-${activeIdx}` : undefined}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          setActiveIdx(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Escape") finish();
          if (e.key === "ArrowDown" && items.length) {
            e.preventDefault();
            setActiveIdx((i) => (i + 1) % items.length);
          }
          if (e.key === "ArrowUp" && items.length) {
            e.preventDefault();
            setActiveIdx((i) => (i <= 0 ? items.length - 1 : i - 1));
          }
        }}
        placeholder={`Search in ${scope.label} ( / )`}
        aria-label={`Search ${scope.label.toLowerCase()}`}
        aria-keyshortcuts="Control+K Meta+K"
        className="h-10 w-full rounded-lg border border-line bg-white pr-14 pl-10 text-[13px] text-ink outline-none placeholder:text-ink-muted transition-colors focus:border-brand-hover focus:ring-3 focus:ring-brand-10 [&::-webkit-search-cancel-button]:hidden"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 items-center rounded border border-line bg-campaign-muted px-1.5 font-sans text-[11px] leading-[18px] text-ink-muted sm:inline-flex" aria-hidden>
        ⌘ K
      </kbd>
      {showList && (
        <div className="absolute inset-x-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-line bg-popover shadow-pop">
          <ul id={listId} role="listbox" aria-label="Matching campaigns" className="max-h-80 overflow-y-auto py-1">
            {items.map((c, i) => (
              <li key={c.id} id={`${listId}-${i}`} role="option" aria-selected={i === activeIdx}>
                <Link
                  href={campaignHref(c.id)}
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={finish}
                  className={cn("flex items-center gap-3 px-3 py-2 text-[13px] text-ink hover:bg-brand-surface", i === activeIdx && "bg-brand-surface")}
                >
                  <TypeIcon type={c.type} size={28} />
                  <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                  <StatusBadge status={c.status} className="px-1.5 text-[11px]" />
                </Link>
              </li>
            ))}
            {results && items.length === 0 && <li className="px-3 py-2.5 text-[13px] text-ink-muted">No campaigns match “{term}”.</li>}
          </ul>
          <p className="border-t border-line-soft bg-campaign-muted px-3 py-2 text-[12px] text-ink-muted">
            Press <kbd className="font-sans font-medium text-ink-body">Enter</kbd> to see all results in Campaigns
          </p>
        </div>
      )}
    </form>
  );
}

const NOTIFICATIONS = [
  { id: "n-sent-1001", href: campaignHref("cmp-1001"), text: "Summer Sale Email finished sending", detail: "Delivery completed on May 15 — open the report" },
  { id: "n-sched-2004", href: campaignHref("cmp-2004"), text: "Summer Sale SMS sends in 2 days", detail: "Tue, May 20 at 10:00 AM · 5,432 phone numbers" },
  { id: "n-paused-1026", href: campaignHref("cmp-1026"), text: "Referral Program Promo is paused", detail: "Resume or reschedule before May 21 to keep the send date" },
];
const NO_IDS: string[] = [];

/** Demo notifications; each opens its campaign. Read state is remembered in this browser. */
function NotificationsMenu() {
  const hydrated = useHydrated();
  const [seenStored, setSeen] = useStoredState<string[]>("evoq-campaigns:notifications-seen", NO_IDS);
  const seen = hydrated ? seenStored : NO_IDS;
  const unread = hydrated ? NOTIFICATIONS.filter((n) => !seen.includes(n.id)).length : 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={unread ? `Notifications (${unread} unread)` : "Notifications"} className={toolClass}>
        <BellIcon size={21} aria-hidden />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-4 rounded-full bg-[#E5484D] px-1 text-[10px] leading-4 font-semibold text-white ring-2 ring-white tabular-nums" aria-hidden>
            {unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(340px,calc(100vw-24px))] rounded-xl p-0">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <DropdownMenuLabel className="p-0 text-[14px] font-semibold text-ink">Notifications</DropdownMenuLabel>
          <button
            type="button"
            disabled={!unread}
            onClick={() => setSeen(NOTIFICATIONS.map((n) => n.id))}
            className="rounded text-[12px] font-medium text-brand hover:text-brand-press disabled:text-ink-faint focus-visible:outline-2 focus-visible:outline-brand-action"
          >
            Mark all as read
          </button>
        </div>
        <DropdownMenuSeparator className="my-0" />
        {NOTIFICATIONS.map((n) => {
          const isNew = !seen.includes(n.id);
          return (
            <DropdownMenuItem key={n.id} asChild className="rounded-none px-4 py-2.5">
              <Link href={n.href} onClick={() => isNew && setSeen([...seen, n.id])} className="flex items-start gap-2.5">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", isNew ? "bg-brand" : "bg-transparent")} aria-label={isNew ? "Unread" : undefined} />
                <span className="flex flex-col gap-0.5">
                  <span className={cn("text-[13px] leading-5 text-ink", isNew && "font-medium")}>{n.text}</span>
                  <span className="text-[12px] leading-4 text-ink-muted">{n.detail}</span>
                </span>
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AccountMenu() {
  const [confirmReset, setConfirmReset] = useState(false);
  const router = useRouter();
  const session = useSession();
  const user = { name: session?.name ?? CURRENT_USER.name, email: session?.email ?? CURRENT_USER.email, org: session?.company || CURRENT_USER.org };
  const reset = () => {
    resetDemoData();
    // A fresh page load clears every cached view at once.
    window.location.reload();
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Account menu for ${user.name}`}
          className="ml-1 inline-flex items-center gap-2.5 rounded-full p-0.5 transition-colors hover:bg-brand-depth-10 focus-visible:outline-2 focus-visible:outline-brand-action sm:rounded-lg sm:py-1 sm:pr-2 sm:pl-1"
        >
          <span className="inline-flex size-9 items-center justify-center rounded-full bg-gradient-brand text-[12.5px] font-semibold text-white" aria-hidden>
            {initials(user.name)}
          </span>
          <span className="hidden text-left xl:block">
            <span className="block text-[13px] leading-4 font-semibold text-ink">{user.name}</span>
            <span className="block text-[12px] leading-4 text-ink-muted">{user.org}</span>
          </span>
          <CaretDownIcon size={14} aria-hidden className="hidden text-ink-muted sm:block" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 rounded-xl">
          <DropdownMenuLabel className="px-2 py-1.5">
            <span className="block text-[14px] font-semibold text-ink">{user.name}</span>
            <span className="block text-[12px] font-normal text-ink-muted">{user.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => notInPhase("Profile settings")}>
            <UserCircleIcon aria-hidden /> My profile
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => notInPhase("Settings")}>
            <GearSixIcon aria-hidden /> Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setConfirmReset(true)}>
            <ArrowCounterClockwiseIcon aria-hidden /> Reset demo data
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              signOut();
              toast.success("Signed out", { description: "Your demo data stays in this browser." });
              router.replace("/login");
            }}
          >
            <SignOutIcon aria-hidden /> Sign out
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <p className="flex gap-2 px-2 py-1.5 text-[12px] leading-4 text-ink-muted">
            <InfoIcon size={14} aria-hidden className="mt-px shrink-0" />
            Frontend demo: sample data, with your changes saved in this browser only. Sign-in is simulated — no password is stored.
          </p>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset demo data?"
        description="Every campaign, contact, list, segment and template change saved in this browser will be removed, and the demo starts again from its sample data. This can't be undone."
        confirmLabel="Reset demo data"
        onConfirm={reset}
      />
    </>
  );
}

/** Opens the same Create Campaign form as the dashboard, from any page. */
function CreateCampaignAction() {
  const router = useRouter();
  const create = useCreateDialog();
  return (
    <>
      <button type="button" onClick={() => create.open("email")} aria-label="Create campaign" className={cn(primaryButtonClass, "px-2.5 sm:px-3.5")}>
        <PlusIcon size={16} weight="bold" aria-hidden />
        <span className="hidden lg:inline">Create Campaign</span>
      </button>
      <CreateCampaignDialog {...create.props} onCreated={(c) => router.push(campaignHref(c.id))} />
    </>
  );
}

/** Help: shortcuts and what this prototype does and doesn't do. */
function HelpMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Help" className={cn(toolClass, "hidden sm:inline-flex")}>
        <QuestionIcon size={21} aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 rounded-xl">
        <DropdownMenuLabel className="text-[14px] font-semibold text-ink">Help</DropdownMenuLabel>
        <div className="space-y-1.5 px-2 pb-2 text-[12.5px] text-ink-body">
          <p className="flex justify-between">
            Search campaigns <kbd className="rounded border border-line px-1.5 font-sans text-[11px] text-ink-muted">Ctrl K</kbd>
          </p>
          <p className="flex justify-between">
            Focus search <kbd className="rounded border border-line px-1.5 font-sans text-[11px] text-ink-muted">/</kbd>
          </p>
        </div>
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-[12px] leading-4 text-ink-muted">
          This is a frontend prototype. Campaigns, contacts and templates you change are saved in this browser only — no email or SMS is ever sent. Reset the demo from the account menu.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppHeader() {
  const { setDrawerOpen, toggleCollapsed, collapsed } = useShell();
  const [mobileSearch, setMobileSearch] = useState(false);

  return (
    <header className="fixed top-0 right-0 left-0 z-30 flex h-[60px] items-center gap-2 border-b border-line bg-white/90 px-3 backdrop-blur sm:gap-3 sm:px-5 lg:left-[var(--sidebar-w)] lg:h-[var(--header-h)] lg:px-6 lg:transition-[left] lg:duration-200 lg:group-data-[sidebar=collapsed]/shell:left-[var(--sidebar-w-collapsed)]">
      {/* Phones / tablets: the menu button opens the navigation drawer */}
      <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Open menu" className={cn(toolClass, "lg:hidden")}>
        <ListIcon size={21} aria-hidden />
      </button>
      {/* Desktop: collapse / expand the sidebar */}
      <button type="button" onClick={toggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} className={cn(toolClass, "hidden lg:inline-flex")}>
        <ListIcon size={21} aria-hidden />
      </button>
      <LogoMark className="size-8 sm:hidden" />

      <SearchField className="mx-auto hidden w-full max-w-[340px] min-w-[200px] flex-1 basis-0 md:block" />
      <div className="flex-1 md:hidden" />

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
        <button type="button" onClick={() => setMobileSearch(true)} aria-label="Search" className={cn(toolClass, "md:hidden")}>
          <MagnifyingGlassIcon size={20} aria-hidden />
        </button>
        <CreateCampaignAction />
        <NotificationsMenu />
        <HelpMenu />
        <AccountMenu />
      </div>

      {/* Phones: search opens as a bar over the header */}
      {mobileSearch && (
        <div className="absolute inset-0 flex items-center gap-2 bg-white px-3 md:hidden">
          <SearchField autoFocus onDone={() => setMobileSearch(false)} className="flex-1" />
          <button type="button" onClick={() => setMobileSearch(false)} aria-label="Close search" className={toolClass}>
            <XIcon size={18} aria-hidden />
          </button>
        </div>
      )}
    </header>
  );
}

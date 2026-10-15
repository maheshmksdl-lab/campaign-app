import type { Icon } from "@phosphor-icons/react";
import {
  AddressBookIcon,
  ChartBarIcon,
  ChatCircleIcon,
  EnvelopeSimpleIcon,
  FlaskIcon,
  GearSixIcon,
  HouseSimpleIcon,
  NotePencilIcon,
  PathIcon,
  PlugsConnectedIcon,
  PaperPlaneTiltIcon,
  TreeStructureIcon,
  UsersFourIcon,
  BrowserIcon,
} from "@phosphor-icons/react/dist/ssr";

/**
 * Sidebar entries, in the order of the design. Only entries with an `href`
 * navigate in this release; `type` entries open the Campaigns list filtered
 * to that channel. The rest are shown for the full module map and explain
 * that they arrive in a later phase (no placeholder pages).
 */
export interface NavItem {
  label: string;
  icon: Icon;
  href?: string;
  /** Campaigns list filtered by channel. */
  type?: "email" | "sms";
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Overview", icon: HouseSimpleIcon, href: "/dashboard" },
  { label: "Campaigns", icon: PaperPlaneTiltIcon, href: "/campaigns" },
  { label: "Email Campaigns", icon: EnvelopeSimpleIcon, href: "/campaigns", type: "email" },
  { label: "SMS Campaigns", icon: ChatCircleIcon, href: "/campaigns", type: "sms" },
  { label: "Contacts", icon: AddressBookIcon },
  { label: "Lists & Segments", icon: UsersFourIcon },
  { label: "Email Templates", icon: NotePencilIcon },
  { label: "Automation", icon: TreeStructureIcon },
  { label: "Customer Journeys", icon: PathIcon },
  { label: "A/B Testing", icon: FlaskIcon },
  { label: "Forms & Signup", icon: BrowserIcon },
  { label: "Reports & Analytics", icon: ChartBarIcon },
  { label: "Integrations", icon: PlugsConnectedIcon },
  { label: "Settings", icon: GearSixIcon },
];

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/** The active entry: a channel entry wins on the plain Campaigns list when its filter is on. */
export function activeNav(pathname: string, type: string): NavItem | null {
  if (pathname === "/campaigns" && (type === "email" || type === "sms")) return NAV_ITEMS.find((i) => i.type === type) ?? null;
  return NAV_ITEMS.find((i) => i.href && !i.type && under(pathname, i.href)) ?? null;
}

export const navHref = (item: NavItem) => (item.type ? `${item.href}?type=${item.type}` : item.href!);

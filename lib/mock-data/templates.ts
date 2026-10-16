/**
 * Seeded email templates: ready-made gallery designs (read-only, shipped with
 * the app) and a few templates the team "made" earlier (My Templates).
 */
import { addDays } from "@/lib/format";
import { buildLayout, button, columns, DEFAULT_STYLE, divider, footer, heading, idFactory, image, paragraph, placeholderImage, social, spacer } from "@/lib/email-blocks";
import type { EmailContent, EmailTemplate, TemplateCategory } from "@/lib/types/templates";
import { DEMO_TODAY } from "./campaigns";

export const TEMPLATE_CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: "newsletter", label: "Newsletter" },
  { value: "promotional", label: "Promotional Offer" },
  { value: "welcome", label: "Welcome Email" },
  { value: "product-update", label: "Product Update" },
  { value: "event", label: "Event Invitation" },
  { value: "announcement", label: "Product Announcement" },
  { value: "onboarding", label: "Customer Onboarding" },
];

export const categoryLabel = (c: TemplateCategory) => TEMPLATE_CATEGORIES.find((x) => x.value === c)?.label ?? c;

const stamp = (daysBefore: number, time = "10:00:00") => `${addDays(DEMO_TODAY, -daysBefore)}T${time}`;

function makeDesign(prefix: string, build: (id: () => string) => Extract<EmailContent, { kind: "design" }>["blocks"], style: Partial<Extract<EmailContent, { kind: "design" }>["style"]> = {}): EmailContent {
  return { kind: "design", style: { ...DEFAULT_STYLE, ...style }, blocks: build(idFactory(prefix)) };
}

const logo = (id: () => string, color = "#5B21B6") => heading(id(), "{{org_name}}", { size: 18, align: "center", color, paddingY: 20 });

/** Seeded so the newest gallery entries carry the newest dates. */
const GALLERY: Omit<EmailTemplate, "createdAt" | "updatedAt">[] = [
  {
    id: "tpl-gallery-newsletter",
    name: "Monthly Newsletter",
    category: "newsletter",
    description: "Masthead, lead story and a two-column roundup.",
    system: true,
    origin: "gallery",
    createdBy: "EVOQ",
    content: makeDesign("gn", (id) => [
      logo(id),
      image(id(), placeholderImage("The Monthly", "#3D1E5C", "#8B5CF6", 600, 220), "The Monthly", { paddingX: 0, paddingY: 0 }),
      heading(id(), "Hi {{first_name}}, here's what's new this month"),
      paragraph(id(), "We've been busy. Here's a short roundup of the launches, stories and tips our readers liked most."),
      button(id(), "Read the full issue", "https://evoq.one/blog", { align: "left" }),
      divider(id()),
      columns(id(), [
        [image(id(), placeholderImage("Story", "#5B21B6", "#A78BFA", 300, 180), "Story image", { paddingX: 0 }), heading(id(), "Customer story", { size: 17, paddingX: 0 }), paragraph(id(), "How one team doubled its email revenue in a quarter.", { size: 14, paddingX: 0 })],
        [image(id(), placeholderImage("Tips", "#7C3AED", "#C4B5FD", 300, 180), "Tips image", { paddingX: 0 }), heading(id(), "Five quick tips", { size: 17, paddingX: 0 }), paragraph(id(), "Small changes that lift open rates straight away.", { size: 14, paddingX: 0 })],
      ]),
      social(id()),
      footer(id()),
    ]),
  },
  {
    id: "tpl-gallery-promo",
    name: "Promotional Offer",
    category: "promotional",
    description: "Bold discount banner with a coupon and product grid.",
    system: true,
    origin: "gallery",
    createdBy: "EVOQ",
    content: makeDesign(
      "gp",
      (id) => [
        logo(id, "#FF7D3D"),
        image(id(), placeholderImage("UP TO 40% OFF", "#FF7D3D", "#E85D87", 600, 260), "Up to 40% off", { paddingX: 0, paddingY: 0 }),
        heading(id(), "{{first_name}}, our biggest sale of the season is on", { align: "center" }),
        paragraph(id(), "Use code SAVE40 at checkout. Ends Sunday at midnight.", { align: "center" }),
        button(id(), "Shop the sale", "https://evoq.one/sale"),
        columns(id(), [
          [image(id(), placeholderImage("Best seller", "#FF7D3D", "#FFB089", 300, 220), "Best seller", { paddingX: 0 }), paragraph(id(), "Best seller — $49", { align: "center", paddingX: 0 })],
          [image(id(), placeholderImage("New in", "#E85D87", "#F6A5BE", 300, 220), "New in", { paddingX: 0 }), paragraph(id(), "New in — $64", { align: "center", paddingX: 0 })],
        ]),
        footer(id()),
      ],
      { buttonColor: "#FF7D3D", linkColor: "#E85D87" },
    ),
  },
  {
    id: "tpl-gallery-welcome",
    name: "Warm Welcome",
    category: "welcome",
    description: "Friendly greeting with three first steps.",
    system: true,
    origin: "gallery",
    createdBy: "EVOQ",
    content: makeDesign("gw", (id) => [
      logo(id),
      image(id(), placeholderImage("Welcome aboard", "#5B21B6", "#8B5CF6", 600, 240), "Welcome aboard", { paddingX: 0, paddingY: 0 }),
      heading(id(), "Welcome, {{first_name}}!", { align: "center" }),
      paragraph(id(), "Thanks for joining {{org_name}}. Here are three quick ways to get started.", { align: "center" }),
      columns(id(), [
        [heading(id(), "1. Set up", { size: 16, paddingX: 0, align: "center" }), paragraph(id(), "Complete your profile in two minutes.", { size: 14, paddingX: 0, align: "center" })],
        [heading(id(), "2. Explore", { size: 16, paddingX: 0, align: "center" }), paragraph(id(), "Browse the guides and templates.", { size: 14, paddingX: 0, align: "center" })],
        [heading(id(), "3. Connect", { size: 16, paddingX: 0, align: "center" }), paragraph(id(), "Join the community and ask anything.", { size: 14, paddingX: 0, align: "center" })],
      ]),
      button(id(), "Get started", "https://evoq.one/start"),
      footer(id()),
    ]),
  },
  {
    id: "tpl-gallery-launch",
    name: "Product Launch",
    category: "announcement",
    description: "Hero image, feature highlights and a demo link.",
    system: true,
    origin: "gallery",
    createdBy: "EVOQ",
    content: makeDesign("gl", (id) => [
      logo(id),
      image(id(), placeholderImage("Introducing Journeys", "#3D1E5C", "#7C3AED", 600, 280), "Introducing Journeys", { paddingX: 0, paddingY: 0 }),
      heading(id(), "Meet the newest addition to {{org_name}}", { align: "center" }),
      paragraph(id(), "Map every step of your customer's path and send the right message at the right moment.", { align: "center" }),
      columns(id(), [
        [image(id(), placeholderImage("Visual", "#5B21B6", "#A78BFA", 300, 200), "Visual builder", { paddingX: 0 }), heading(id(), "Visual builder", { size: 17, paddingX: 0 }), paragraph(id(), "Drag, drop and connect steps.", { size: 14, paddingX: 0 })],
        [image(id(), placeholderImage("Insights", "#7C3AED", "#DDD6FE", 300, 200), "Live insights", { paddingX: 0 }), heading(id(), "Live insights", { size: 17, paddingX: 0 }), paragraph(id(), "See where people drop off.", { size: 14, paddingX: 0 })],
      ]),
      button(id(), "Watch the demo", "https://evoq.one/demo"),
      footer(id()),
    ]),
  },
  {
    id: "tpl-gallery-announcement",
    name: "Simple Announcement",
    category: "product-update",
    description: "Clean, text-first update with one call to action.",
    system: true,
    origin: "gallery",
    createdBy: "EVOQ",
    content: makeDesign("ga", (id) => [
      logo(id),
      heading(id(), "An update for you, {{first_name}}"),
      paragraph(id(), "We've made a few improvements based on your feedback:\n\n• Faster reports that load in under a second\n• Smarter template suggestions\n• A cleaner contacts view"),
      button(id(), "See what's new", "https://evoq.one/whats-new", { align: "left" }),
      spacer(id(), 12),
      footer(id()),
    ]),
  },
  {
    id: "tpl-gallery-event",
    name: "Event Invitation",
    category: "event",
    description: "Date and venue details with an RSVP button.",
    system: true,
    origin: "gallery",
    createdBy: "EVOQ",
    content: makeDesign(
      "ge",
      (id) => [
        logo(id, "#3B5998"),
        image(id(), placeholderImage("You're invited", "#3B5998", "#7C3AED", 600, 240), "You're invited", { paddingX: 0, paddingY: 0 }),
        heading(id(), "Join us live, {{first_name}}", { align: "center" }),
        paragraph(id(), "Email Automation 101 — a 30-minute live session with Q&A.", { align: "center" }),
        columns(id(), [
          [heading(id(), "When", { size: 15, paddingX: 0, align: "center" }), paragraph(id(), "Tuesday, June 3\n10:00 AM PT", { size: 14, paddingX: 0, align: "center" })],
          [heading(id(), "Where", { size: 15, paddingX: 0, align: "center" }), paragraph(id(), "Online\nLink sent after you register", { size: 14, paddingX: 0, align: "center" })],
        ]),
        button(id(), "Save my seat", "https://evoq.one/webinar/register"),
        footer(id()),
      ],
      { buttonColor: "#3B5998", linkColor: "#3B5998" },
    ),
  },
];

const MINE: EmailTemplate[] = [
  {
    id: "tpl-1001",
    name: "Brand Newsletter",
    category: "newsletter",
    description: "Our monthly newsletter layout with brand colours.",
    system: false,
    origin: "layout",
    createdBy: "Priya Sharma",
    createdAt: stamp(64, "11:20:00"),
    updatedAt: stamp(9, "16:05:00"),
    content: buildLayout("newsletter", idFactory("t1001")),
  },
  {
    id: "tpl-1002",
    name: "Summer Sale Promo",
    category: "promotional",
    description: "Used for the Summer Sale email.",
    system: false,
    origin: "gallery",
    createdBy: "Alex John",
    createdAt: stamp(12, "09:40:00"),
    updatedAt: stamp(4, "14:30:00"),
    content: makeDesign(
      "t1002",
      (id) => [
        logo(id, "#FF7D3D"),
        image(id(), placeholderImage("SUMMER SALE", "#FF7D3D", "#7C3AED", 600, 260), "Summer Sale", { paddingX: 0, paddingY: 0 }),
        heading(id(), "☀️ Summer Sale is here — up to 40% off", { align: "center" }),
        paragraph(id(), "Hi {{first_name}}, our biggest sale of the season starts now. Stock up on favourites before they're gone.", { align: "center" }),
        button(id(), "Shop the sale", "https://evoq.one/sale"),
        social(id()),
        footer(id()),
      ],
      { buttonColor: "#FF7D3D" },
    ),
  },
  {
    id: "tpl-1003",
    name: "Webinar Invite (HTML)",
    category: "event",
    description: "Hand-coded invitation used for webinar series.",
    system: false,
    origin: "html",
    createdBy: "Daniel Kim",
    createdAt: stamp(30, "15:10:00"),
    updatedAt: stamp(18, "10:45:00"),
    content: {
      kind: "html",
      html: `<div style="max-width:600px;margin:0 auto;padding:32px 24px;font-family:Arial,Helvetica,sans-serif;color:#272238;background:#ffffff;">
  <p style="margin:0 0 4px;font-size:13px;color:#7C3AED;font-weight:bold;letter-spacing:.04em;">LIVE WEBINAR</p>
  <h1 style="margin:0 0 12px;font-size:26px;line-height:1.25;">Build your first automation in 30 minutes</h1>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hi {{first_name}}, join our product team for a hands-on session. Bring your questions — we'll answer them live.</p>
  <table role="presentation" style="margin:0 0 20px;font-size:14px;"><tr><td style="padding:4px 12px 4px 0;color:#777386;">When</td><td>Tuesday, June 3 · 10:00 AM PT</td></tr><tr><td style="padding:4px 12px 4px 0;color:#777386;">Where</td><td>Online</td></tr></table>
  <a href="https://evoq.one/webinar/register" style="display:inline-block;padding:12px 26px;background:#7C3AED;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;">Register now</a>
  <p style="margin:28px 0 0;font-size:12px;color:#777386;">{{org_name}} · <a href="#" style="color:#7C3AED;">Unsubscribe</a></p>
</div>`,
    },
  },
];

export function seedTemplates(): EmailTemplate[] {
  const gallery = GALLERY.map((t, i) => ({ ...t, createdAt: stamp(200 - i, "09:00:00"), updatedAt: stamp(200 - i, "09:00:00") }));
  return [...MINE, ...gallery];
}

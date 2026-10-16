/**
 * Seeds for WhatsApp, signup forms, workflows and the file library. Audiences
 * point at the seeded lists, people match the demo team, and dates sit around
 * the demo "today" so lists sort and read naturally.
 */
import { addDays } from "@/lib/format";
import { placeholderImage } from "@/lib/email-blocks";
import type { AssetFile, SignupForm, WaCampaign, WaTemplate, Workflow, WorkflowRun } from "@/lib/types/workspace";
import { DEMO_TODAY, rng } from "./campaigns";

const at = (daysBefore: number, time = "10:00:00") => `${addDays(DEMO_TODAY, -daysBefore)}T${time}`;

// ── WhatsApp templates ───────────────────────────────────────────────

export const WA_LANGUAGES = [
  { value: "en_US", label: "English (US)" },
  { value: "en_GB", label: "English (UK)" },
  { value: "es_ES", label: "Spanish" },
  { value: "fr_FR", label: "French" },
  { value: "de_DE", label: "German" },
  { value: "hi_IN", label: "Hindi" },
  { value: "pt_BR", label: "Portuguese (BR)" },
];

export const languageLabel = (code: string) => WA_LANGUAGES.find((l) => l.value === code)?.label ?? code;

export function seedWaTemplates(): WaTemplate[] {
  return [
    { id: "wat-1", name: "summer_sale_offer", category: "marketing", language: "en_US", header: "☀️ Summer Sale", body: "Hi {{first_name}}, our Summer Sale is live! Enjoy up to 40% off everything until Sunday. Use code SUMMER40 at checkout.", footer: "Reply STOP to opt out", buttons: ["Shop now", "Not interested"], status: "approved", createdAt: at(14), updatedAt: at(12) },
    { id: "wat-2", name: "order_shipped", category: "utility", language: "en_US", header: "Your order is on its way", body: "Hi {{first_name}}, good news — your order has shipped and should arrive in 2–3 days.", footer: "{{org_name}}", buttons: ["Track order"], status: "approved", createdAt: at(40), updatedAt: at(40) },
    { id: "wat-3", name: "webinar_reminder", category: "marketing", language: "en_US", body: "Hi {{first_name}}, a reminder that our live webinar starts tomorrow at 10:00 AM PT. Save your seat and bring your questions!", footer: "Reply STOP to opt out", buttons: ["Save my seat"], status: "approved", createdAt: at(9), updatedAt: at(8) },
    { id: "wat-4", name: "loyalty_points", category: "marketing", language: "en_GB", header: "Points waiting", body: "Hi {{first_name}}, you have reward points waiting. Redeem them before the end of the month.", buttons: ["Redeem points"], status: "pending", createdAt: at(1), updatedAt: at(1) },
    { id: "wat-5", name: "verification_code", category: "authentication", language: "en_US", body: "Your {{org_name}} verification code is 482913. It expires in 10 minutes. Don't share it with anyone.", buttons: [], status: "approved", createdAt: at(90), updatedAt: at(90) },
    { id: "wat-6", name: "flash_deal_es", category: "marketing", language: "es_ES", body: "¡Hola {{first_name}}! Oferta relámpago: 30% de descuento solo hoy.", buttons: ["Comprar"], status: "rejected", rejectionReason: "Promotional content needs an opt-out instruction in the footer.", createdAt: at(6), updatedAt: at(5) },
  ];
}

// ── WhatsApp campaigns ───────────────────────────────────────────────

const waResults = (sent: number, deliver: number, read: number, reply: number, click: number) => ({
  sent,
  delivered: Math.round(sent * deliver),
  read: Math.round(sent * deliver * read),
  replied: Math.round(sent * deliver * read * reply),
  clicks: Math.round(sent * deliver * read * click),
  failed: sent - Math.round(sent * deliver),
});

export function seedWaCampaigns(): WaCampaign[] {
  return [
    { id: "wac-1", name: "Summer Sale — WhatsApp", status: "sent", templateId: "wat-1", header: "☀️ Summer Sale", body: "Hi {{first_name}}, our Summer Sale is live! Enjoy up to 40% off everything until Sunday. Use code SUMMER40 at checkout.", footer: "Reply STOP to opt out", buttons: ["Shop now", "Not interested"], audienceIds: ["aud-sms"], audience: "SMS Opt-in", recipients: 5_120, sentAt: at(3, "11:00:00"), createdAt: at(6), updatedAt: at(3, "11:00:00"), ...waResults(5_120, 0.982, 0.86, 0.11, 0.24) },
    { id: "wac-2", name: "Webinar Reminder", status: "sent", templateId: "wat-3", body: "Hi {{first_name}}, a reminder that our live webinar starts tomorrow at 10:00 AM PT. Save your seat and bring your questions!", footer: "Reply STOP to opt out", buttons: ["Save my seat"], audienceIds: ["aud-webinar"], audience: "Webinar Prospects", recipients: 2_310, sentAt: at(2, "09:30:00"), createdAt: at(4), updatedAt: at(2, "09:30:00"), ...waResults(2_310, 0.975, 0.79, 0.06, 0.31) },
    { id: "wac-3", name: "Order Shipping Updates", status: "sending", templateId: "wat-2", header: "Your order is on its way", body: "Hi {{first_name}}, good news — your order has shipped and should arrive in 2–3 days.", footer: "{{org_name}}", buttons: ["Track order"], audienceIds: ["aud-customers"], audience: "Customers", recipients: 1_840, sentAt: at(0, "08:00:00"), createdAt: at(1), updatedAt: at(0, "08:00:00"), ...waResults(1_120, 0.99, 0.72, 0.02, 0.41) },
    { id: "wac-4", name: "Loyalty Points Nudge", status: "scheduled", templateId: "wat-4", header: "Points waiting", body: "Hi {{first_name}}, you have reward points waiting. Redeem them before the end of the month.", buttons: ["Redeem points"], audienceIds: ["aud-loyalty"], audience: "Loyalty Members", recipients: 3_980, scheduledAt: `${addDays(DEMO_TODAY, 3)}T10:00:00`, createdAt: at(1), updatedAt: at(1) },
    { id: "wac-5", name: "VIP Early Access", status: "draft", body: "Hi {{first_name}}, as a VIP you get early access to our new collection — 24 hours before everyone else.", buttons: ["See the collection"], audienceIds: ["aud-vip"], audience: "VIP Customers", recipients: 1_610, createdAt: at(0, "09:15:00"), updatedAt: at(0, "09:15:00") },
  ];
}

// ── Forms ────────────────────────────────────────────────────────────

const f = (id: string, type: SignupForm["fields"][number]["type"], label: string, required = false, extra: Partial<SignupForm["fields"][number]> = {}) => ({ id, type, label, required, ...extra });

export function seedForms(): SignupForm[] {
  return [
    {
      id: "frm-1",
      name: "Newsletter Signup",
      kind: "embedded",
      status: "active",
      fields: [f("f1", "email", "Email address", true, { placeholder: "you@example.com" }), f("f2", "firstName", "First name"), f("f3", "consent", "I agree to receive the monthly newsletter.", true)],
      settings: { title: "Get the monthly newsletter", description: "Tips, launches and stories — once a month, no spam.", submitLabel: "Subscribe", successMessage: "Thanks! Check your inbox to confirm.", listId: "aud-newsletter" },
      submissions: 1_284,
      views: 9_610,
      createdAt: at(120),
      updatedAt: at(10),
    },
    {
      id: "frm-2",
      name: "Webinar Registration",
      kind: "landing",
      status: "active",
      fields: [
        f("f1", "firstName", "First name", true),
        f("f2", "lastName", "Last name", true),
        f("f3", "email", "Work email", true),
        f("f4", "company", "Company"),
        f("f5", "dropdown", "Role", false, { options: ["Marketing", "Sales", "Founder", "Other"] }),
        f("f6", "consent", "Send me the recording and related updates.", true),
      ],
      settings: { title: "Email Automation 101 — live webinar", description: "30 minutes, live Q&A. Tuesday, June 3 at 10:00 AM PT.", submitLabel: "Save my seat", successMessage: "You're registered — see you there!", listId: "aud-webinar" },
      submissions: 612,
      views: 2_480,
      createdAt: at(30),
      updatedAt: at(4),
    },
    {
      id: "frm-3",
      name: "Exit-intent 10% Offer",
      kind: "popup",
      status: "active",
      fields: [f("f1", "email", "Email", true), f("f2", "checkbox", "I'm shopping for a gift")],
      settings: { title: "Wait — take 10% off", description: "Join the list and get a code for your first order.", submitLabel: "Get my code", successMessage: "Your code is WELCOME10.", listId: "aud-customers" },
      submissions: 2_045,
      views: 31_200,
      createdAt: at(75),
      updatedAt: at(22),
    },
    {
      id: "frm-4",
      name: "Product Feedback",
      kind: "embedded",
      status: "draft",
      fields: [f("f1", "email", "Email", true), f("f2", "text", "What should we build next?"), f("f3", "phone", "Phone (optional)")],
      settings: { title: "Help shape the product", description: "Two questions, one minute.", submitLabel: "Send feedback", successMessage: "Thank you — we read every answer." },
      submissions: 0,
      views: 0,
      createdAt: at(2),
      updatedAt: at(2),
    },
    {
      id: "frm-5",
      name: "Spring Contest Entry",
      kind: "landing",
      status: "archived",
      fields: [f("f1", "firstName", "First name", true), f("f2", "email", "Email", true), f("f3", "consent", "I accept the contest rules.", true)],
      settings: { title: "Win a spring makeover", description: "One entry per person.", submitLabel: "Enter now", successMessage: "You're in. Good luck!" },
      submissions: 3_390,
      views: 14_870,
      createdAt: at(80),
      updatedAt: at(45),
    },
  ];
}

// ── Workflows ────────────────────────────────────────────────────────

const PEOPLE = ["maya.patel@brightwave.com", "leo.martin@quartzsoftware.com", "hana.ito@helixbio.com", "arjun.shah@gmail.com", "sofia.rossi@outlook.com", "noah.kim@cedarco.com", "emma.wilson@yahoo.com", "omar.khan@lumenenergy.com"];

function runs(prefix: string, stepLabels: string[], count: number, lastDaysBefore: number): WorkflowRun[] {
  const r = rng(prefix);
  return Array.from({ length: count }, (_, i) => {
    const outcome = (r() < 0.62 ? "completed" : r() < 0.7 ? "in-progress" : "exited") as WorkflowRun["outcome"];
    const h = Math.floor(r() * 9) + 8;
    return {
      id: `${prefix}-r${i + 1}`,
      at: at(lastDaysBefore + Math.floor(i / 2), `${String(h).padStart(2, "0")}:${String(Math.floor(r() * 60)).padStart(2, "0")}:00`),
      contact: PEOPLE[Math.floor(r() * PEOPLE.length)],
      outcome,
      step: outcome === "completed" ? stepLabels[stepLabels.length - 1] : stepLabels[Math.floor(r() * (stepLabels.length - 1))],
    };
  });
}

export function seedWorkflows(): Workflow[] {
  return [
    {
      id: "wf-1",
      name: "Welcome Series",
      description: "Greets new subscribers and introduces the product over a week.",
      status: "active",
      trigger: { type: "list-join", value: "aud-newsletter" },
      steps: [
        { id: "s1", type: "email", subject: "Welcome to {{org_name}} 👋", templateId: "tpl-gallery-welcome" },
        { id: "s2", type: "wait", delay: 2, unit: "days" },
        { id: "s3", type: "condition", condition: "opened" },
        { id: "s4", type: "email", subject: "3 ways to get started", templateId: "tpl-gallery-announcement" },
        { id: "s5", type: "update", action: "add-tag", actionValue: "onboarded" },
        { id: "s6", type: "end" },
      ],
      processed: 1_846,
      lastRunAt: at(0, "10:12:00"),
      runs: runs("wf1", ["Welcome email", "Wait 2 days", "Opened?", "Getting started email", "Tag onboarded", "End"], 14, 0),
      createdAt: at(140),
      updatedAt: at(12),
    },
    {
      id: "wf-2",
      name: "Webinar Follow-up",
      description: "Sends the recording to registrants and nudges those who didn't watch.",
      status: "active",
      trigger: { type: "form-submit", value: "frm-2" },
      steps: [
        { id: "s1", type: "wait", delay: 1, unit: "days" },
        { id: "s2", type: "email", subject: "Your webinar recording", templateId: "tpl-gallery-thank-you-event" },
        { id: "s3", type: "condition", condition: "clicked" },
        { id: "s4", type: "update", action: "add-to-list", actionValue: "aud-webinar" },
        { id: "s5", type: "end" },
      ],
      processed: 604,
      lastRunAt: at(1, "16:40:00"),
      runs: runs("wf2", ["Wait 1 day", "Recording email", "Clicked?", "Add to Webinar Prospects", "End"], 10, 1),
      createdAt: at(30),
      updatedAt: at(4),
    },
    {
      id: "wf-3",
      name: "Win-back Inactive Customers",
      description: "Re-engages customers who haven't opened anything in 90 days.",
      status: "paused",
      trigger: { type: "tag-added", value: "inactive-90" },
      steps: [
        { id: "s1", type: "email", subject: "We miss you, {{first_name}}", templateId: "tpl-gallery-deals-coupon" },
        { id: "s2", type: "wait", delay: 5, unit: "days" },
        { id: "s3", type: "condition", condition: "opened" },
        { id: "s4", type: "update", action: "unsubscribe" },
        { id: "s5", type: "end" },
      ],
      processed: 2_210,
      lastRunAt: at(9, "09:00:00"),
      runs: runs("wf3", ["We miss you email", "Wait 5 days", "Opened?", "Unsubscribe", "End"], 8, 9),
      createdAt: at(60),
      updatedAt: at(9),
    },
    {
      id: "wf-4",
      name: "Birthday Greeting",
      description: "A birthday email with a gift code.",
      status: "draft",
      trigger: { type: "date-field", value: "birthday" },
      steps: [{ id: "s1", type: "email", subject: "Happy birthday, {{first_name}}! 🎁" }, { id: "s2", type: "end" }],
      processed: 0,
      runs: [],
      createdAt: at(1),
      updatedAt: at(1),
    },
  ];
}

// ── Files ────────────────────────────────────────────────────────────

export function seedFiles(): AssetFile[] {
  const img = (id: string, name: string, from: string, to: string, label: string, daysBefore: number, size: number, by = "Alex John"): AssetFile => ({
    id,
    name,
    kind: "image",
    mime: name.endsWith(".png") ? "image/png" : "image/jpeg",
    size,
    uploadedBy: by,
    preview: placeholderImage(label, from, to, 600, 400),
    createdAt: at(daysBefore),
    updatedAt: at(daysBefore),
  });
  const doc = (id: string, name: string, mime: string, size: number, daysBefore: number, by = "Priya Sharma"): AssetFile => ({ id, name, kind: mime.startsWith("application/pdf") || mime.includes("word") || mime.includes("sheet") || mime === "text/csv" ? "document" : "other", mime, size, uploadedBy: by, createdAt: at(daysBefore), updatedAt: at(daysBefore) });
  return [
    img("fil-1", "summer-sale-hero.png", "#FF7D3D", "#E85D87", "Summer Sale", 4, 284_000),
    img("fil-2", "brand-logo-violet.png", "#3D1E5C", "#7C3AED", "EVOQ", 120, 42_000, "Daniel Kim"),
    img("fil-3", "webinar-banner.jpg", "#3B5998", "#7C3AED", "Live webinar", 10, 196_000, "Daniel Kim"),
    img("fil-4", "product-grid-1.jpg", "#2D9D78", "#7DD3B0", "Product", 22, 154_000),
    img("fil-5", "holiday-header.jpg", "#B91C1C", "#14532D", "Holidays", 150, 233_000, "Priya Sharma"),
    img("fil-6", "team-photo.jpg", "#5B21B6", "#C4B5FD", "Our team", 60, 412_000, "Priya Sharma"),
    doc("fil-7", "spring-catalog-2025.pdf", "application/pdf", 2_840_000, 35),
    doc("fil-8", "webinar-slides.pdf", "application/pdf", 5_120_000, 2, "Daniel Kim"),
    doc("fil-9", "price-list.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 88_000, 18),
    doc("fil-10", "contest-rules.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 46_000, 80),
    doc("fil-11", "brand-guidelines.zip", "application/zip", 9_640_000, 200, "Alex John"),
  ];
}

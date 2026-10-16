"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckIcon, CodeIcon, LayoutIcon, SlideshowIcon } from "@phosphor-icons/react/dist/ssr";
import { PageShell, PrimaryButton } from "@/components/shared/campaign-ui";
import { SetupExplore } from "@/components/shared/email-ui";
import { GuideDialog } from "@/components/shared/guide-dialog";
import { STARTER_HTML } from "@/components/campaigns/editor/content-card";
import { useTemplates } from "@/hooks/use-templates";
import { useStoredState } from "@/hooks/use-stored-state";
import { galleryHref } from "@/lib/content-session";
import { notInPhase } from "@/lib/phase";
import { CAMPAIGNS_ROUTE } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { startEditing } from "./start-editing";

type Method = "gallery" | "layout" | "html";

const METHODS: { key: Method; title: string; text: string; icon: ReactNode; fg: string; bg: string }[] = [
  { key: "gallery", title: "Gallery", text: "Choose from pre-designed templates and customize them to fit your brand.", icon: <SlideshowIcon size={20} />, fg: "#5F7A1F", bg: "#EEF5D9" },
  { key: "layout", title: "Layout", text: "Start with a basic structure and build your template your way.", icon: <LayoutIcon size={20} />, fg: "#7C3AED", bg: "#F3E8FF" },
  { key: "html", title: "HTML Editor", text: "Create a template using custom HTML for full control.", icon: <CodeIcon size={20} />, fg: "#E0601F", bg: "#FFF3EC" },
];

/** What was typed here last, so coming back from the gallery keeps it. */
const FORM_KEY = "evoq-campaigns:new-template";
const DEFAULT_FORM = { name: "", method: "layout" as Method };

export function CreateTemplateView() {
  const router = useRouter();
  const [form, setForm] = useStoredState(FORM_KEY, DEFAULT_FORM, "session");
  const [error, setError] = useState("");
  const [guide, setGuide] = useState(false);
  const { data: templates } = useTemplates({});
  const mineCount = templates?.filter((t) => !t.system).length;
  const name = form.name.trim();
  const ready = name.length >= 2;

  const proceed = () => {
    if (name.length < 2) return setError("Enter a template name (at least 2 characters)");
    if (name.length > 80) return setError("Keep the name under 80 characters");
    if (templates?.some((t) => t.name.toLowerCase() === name.toLowerCase())) return setError("A template with this name already exists");
    setError("");
    if (form.method === "gallery") router.push(galleryHref({ templateName: name }));
    else if (form.method === "layout") router.push(galleryHref({ templateName: name, section: "layouts" }));
    else startEditing(router.push, { target: { kind: "template", name, category: "newsletter", origin: "html" }, content: { kind: "html", html: STARTER_HTML }, source: "Custom HTML" });
  };

  return (
    <PageShell className="flex flex-1 flex-col">
      <div className="grid flex-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h1 className="text-[18px] leading-7 font-semibold text-ink">Create an email template</h1>
            <Link href={galleryHref({ section: "mine" })} className="rounded text-[13px] font-medium text-brand hover:text-brand-press focus-visible:outline-2 focus-visible:outline-brand-action">
              My templates{mineCount !== undefined ? ` (${mineCount})` : ""}
            </Link>
          </div>
          <p className="mt-1 text-[13.5px] leading-5 text-ink-muted">Design reusable email templates to create campaigns faster and stay consistent.</p>

          <form
            className="mt-7"
            onSubmit={(e) => {
              e.preventDefault();
              proceed();
            }}
            noValidate
          >
            <label htmlFor="template-name" className="text-field-label text-ink-body">
              Template Name<span className="ml-0.5 text-[#DC2626]" aria-hidden>*</span>
            </label>
            <input
              id="template-name"
              value={form.name}
              onChange={(e) => {
                setError("");
                setForm({ ...form, name: e.target.value });
              }}
              placeholder="e.g., Promotional Offer"
              maxLength={80}
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "template-name-error" : undefined}
              className="mt-1.5 block h-9 w-full max-w-[354px] rounded-md border border-line bg-white px-3 text-[13px] text-ink outline-none placeholder:text-ink-faint hover:border-[#D7D1E3] focus:border-brand-hover focus:ring-3 focus:ring-brand-10 aria-invalid:border-[#DC2626]"
            />
            {error && (
              <p id="template-name-error" role="alert" className="mt-1.5 text-[12px] font-medium text-[#DC2626]">
                {error}
              </p>
            )}

            <fieldset className="mt-6">
              <legend className="text-[13px] text-ink-body">Start with a template or from scratch</legend>
              <div className="mt-3 grid max-w-[680px] gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Starting point">
                {METHODS.map((m) => {
                  const on = form.method === m.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setForm({ ...form, method: m.key })}
                      className={cn(
                        "relative flex min-h-[134px] flex-col items-start rounded-xl border bg-white p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-action",
                        on ? "border-[#8E86E8] shadow-[0_0_0_1px_#8E86E8]" : "border-line hover:border-brand-soft hover:shadow-card",
                      )}
                    >
                      {on && (
                        <span className="absolute top-2.5 right-2.5 inline-flex size-[18px] items-center justify-center rounded-full bg-campaign-action text-white" aria-hidden>
                          <CheckIcon size={11} weight="bold" />
                        </span>
                      )}
                      <span className="inline-flex size-9 items-center justify-center rounded-lg" style={{ color: m.fg, backgroundColor: m.bg }} aria-hidden>
                        {m.icon}
                      </span>
                      <span className="mt-auto pt-6 text-[13.5px] font-medium text-ink">{m.title}</span>
                      <span className="mt-1 text-[12.5px] leading-[18px] text-ink-body">{m.text}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <PrimaryButton type="submit" className={cn("mt-6 h-8 bg-campaign-action px-4 hover:bg-campaign-hover", !ready && "opacity-50")} aria-disabled={!ready}>
              Continue
            </PrimaryButton>
          </form>
        </div>
        <TemplateIllustration className="hidden lg:block" />
      </div>

      <SetupExplore
        className="mt-12"
        items={[
          { title: "Beginner's Guide", text: "Learn how to design email templates that are consistent and effective.", action: "View Guide", onClick: () => setGuide(true) },
          { title: "Domain Verification", text: "Authenticate your domain to improve deliverability and build trust with your recipients.", action: "Setup Domain", onClick: () => notInPhase("Domain verification") },
          { title: "Email Campaigns", text: "Use your templates to create and send email campaigns.", action: "Create Campaign", href: `${CAMPAIGNS_ROUTE}?type=email` },
        ]}
      />
      <GuideDialog
        open={guide}
        onOpenChange={setGuide}
        title="Designing email templates"
        intro="A good template makes every campaign faster to build and easier to recognise."
        steps={[
          { title: "Pick a starting point", text: "Customise a ready-made design from the Gallery, build on a Layout, or write your own HTML." },
          { title: "Set your brand style once", text: "Fonts, colours, button style and content width apply to the whole email." },
          { title: "Personalise with merge tags", text: "Use {{first_name}} and other fields; previews show sample values." },
          { title: "Use it in campaigns", text: "In a campaign's Content section, open the Gallery and pick it from My Templates." },
        ]}
      />
    </PageShell>
  );
}

/** Decorative illustration (inline SVG, Campaigns palette). */
function TemplateIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 380 300" role="img" aria-label="Illustration of a person designing an email" className={className}>
      <defs>
        <linearGradient id="ti-card" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F3F1F8" />
        </linearGradient>
      </defs>
      <rect x="172" y="38" width="170" height="238" rx="16" fill="url(#ti-card)" stroke="#272238" strokeWidth="2" transform="rotate(8 257 157)" />
      <g transform="rotate(8 257 157)">
        <rect x="200" y="72" width="70" height="12" rx="6" fill="#272238" />
        <rect x="200" y="96" width="110" height="64" rx="8" fill="#DDD6FE" stroke="#272238" strokeWidth="1.5" />
        <path d="M212 150l22-24 16 16 12-10 18 18z" fill="#FF7D3D" />
        <circle cx="290" cy="112" r="7" fill="#FFFFFF" />
        <rect x="200" y="172" width="110" height="7" rx="3.5" fill="#D9D5E3" />
        <rect x="200" y="186" width="84" height="7" rx="3.5" fill="#D9D5E3" />
        <rect x="222" y="210" width="66" height="20" rx="10" fill="#FFFFFF" stroke="#272238" strokeWidth="1.5" />
        <path d="M188 120l-8 10 8 10" fill="none" stroke="#272238" strokeWidth="2" strokeLinecap="round" />
        <path d="M326 120l8 10-8 10" fill="none" stroke="#272238" strokeWidth="2" strokeLinecap="round" />
      </g>
      <g>
        <rect x="70" y="40" width="40" height="40" rx="9" fill="#8E86E8" stroke="#272238" strokeWidth="2" transform="rotate(-12 90 60)" />
        <path d="M84 56l6-8 6 8-6 8z" fill="#FFFFFF" />
        <rect x="248" y="6" width="38" height="38" rx="8" fill="#FFB089" stroke="#272238" strokeWidth="2" transform="rotate(10 267 25)" />
        <text x="256" y="33" fontFamily="Georgia, serif" fontSize="18" fontWeight="700" fill="#272238" transform="rotate(10 267 25)">
          Tt
        </text>
        <rect x="26" y="112" width="36" height="36" rx="8" fill="#FF9F43" stroke="#272238" strokeWidth="2" transform="rotate(-18 44 130)" />
        <rect x="33" y="122" width="22" height="16" rx="3" fill="#FFFFFF" transform="rotate(-18 44 130)" />
        <rect x="40" y="190" width="34" height="34" rx="8" fill="#5B5BD6" stroke="#272238" strokeWidth="2" />
        <path d="M52 200l12 7-12 7z" fill="#FFFFFF" />
      </g>
      <g stroke="#272238" strokeWidth="2" fill="none" strokeLinecap="round">
        <path d="M110 72c20 8 38 22 46 40" strokeDasharray="4 5" />
        <path d="M62 136c22-2 44 2 64 16" strokeDasharray="4 5" />
      </g>
      <g>
        <circle cx="150" cy="112" r="17" fill="#272238" />
        <circle cx="150" cy="121" r="13" fill="#F6D3BD" stroke="#272238" strokeWidth="1.5" />
        <path d="M132 150c4-10 14-15 22-15s18 6 21 16l8 60h-58z" fill="#FFFFFF" stroke="#272238" strokeWidth="2" />
        <path d="M168 154c14 4 24-6 32-14" fill="none" stroke="#272238" strokeWidth="2" strokeLinecap="round" />
        <path d="M128 210l-6 66M176 210l8 66" stroke="#272238" strokeWidth="2" strokeLinecap="round" />
        <path d="M118 276h18M180 276h18" stroke="#272238" strokeWidth="3" strokeLinecap="round" />
      </g>
      <path d="M300 280c6-16 18-24 30-24-4 12-14 20-30 24z" fill="none" stroke="#272238" strokeWidth="1.5" />
    </svg>
  );
}

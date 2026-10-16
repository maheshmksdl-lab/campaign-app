import { ChartLineUpIcon, EnvelopeOpenIcon, PaperPlaneTiltIcon, UsersThreeIcon } from "@phosphor-icons/react/dist/ssr";

/**
 * Sign-in screens: no sidebar or header. A light form column and, on wide
 * screens, a quiet product panel on a pale lavender gradient.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh bg-[#FBFAFE] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <main id="main" className="flex items-center justify-center px-4 py-10 sm:px-6">
        {children}
      </main>
      <aside aria-hidden className="relative hidden overflow-hidden border-l border-line bg-gradient-soft lg:flex lg:items-center lg:justify-center">
        <div className="pointer-events-none absolute -top-24 -right-20 size-80 rounded-full bg-campaign-soft/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 size-72 rounded-full bg-[#FFD9C7]/50 blur-3xl" />
        <div className="relative w-full max-w-[420px] px-10">
          <p className="text-[12px] font-semibold tracking-[0.08em] text-campaign-action uppercase">EVOQ Campaigns</p>
          <p className="mt-2 text-[24px] leading-8 font-semibold text-campaign-depth">Email, SMS and WhatsApp campaigns your audience looks forward to.</p>
          <div className="mt-8 space-y-3">
            {[
              { icon: PaperPlaneTiltIcon, label: "Summer Sale Email", value: "11,604 delivered", note: "sent to Engaged Subscribers", fg: "var(--ch-email-fg)", bg: "var(--ch-email-bg)" },
              { icon: EnvelopeOpenIcon, label: "Open rate", value: "49.2%", note: "+6.8 pts vs account average", fg: "var(--campaign-action)", bg: "var(--campaign-tint)" },
              { icon: UsersThreeIcon, label: "Audience", value: "12,458 contacts", note: "in 9 lists and 6 segments", fg: "var(--ch-journey-fg)", bg: "var(--ch-journey-bg)" },
              { icon: ChartLineUpIcon, label: "Conversions", value: "+18% this month", note: "from automated workflows", fg: "var(--ch-sms-fg)", bg: "var(--ch-sms-bg)" },
            ].map(({ icon: IconCmp, label, value, note, fg, bg }) => (
              <div key={label} className="flex items-center gap-3 rounded-xl border border-white/80 bg-white/90 px-4 py-3 shadow-card">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ color: fg, backgroundColor: bg }}>
                  <IconCmp size={19} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[12px] leading-4 text-ink-muted">{label}</span>
                  <span className="block text-[14px] leading-5 font-semibold text-ink">{value}</span>
                  <span className="block text-[12px] leading-4 text-ink-muted">{note}</span>
                </span>
              </div>
            ))}
          </div>
          <p className="mt-6 text-[12px] leading-4 text-ink-muted">Illustration of the demo workspace.</p>
        </div>
      </aside>
    </div>
  );
}

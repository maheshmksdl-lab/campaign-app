/**
 * The larger ready-made gallery (Welcome, Thank you, Seasons, Deals, Holidays…).
 * Every design is built from the same blocks as the editor, with inline SVG
 * artwork, so previews render without any external image.
 */
import { button, columns, DEFAULT_STYLE, divider, footer, heading, idFactory, image, paragraph, placeholderImage, social, spacer } from "@/lib/email-blocks";
import type { EmailContent, EmailStyle, EmailTemplate } from "@/lib/types/templates";

type Gallery = Omit<EmailTemplate, "createdAt" | "updatedAt">;
type Blocks = Extract<EmailContent, { kind: "design" }>["blocks"];

const design = (prefix: string, build: (id: () => string) => Blocks, style: Partial<EmailStyle> = {}): EmailContent => ({ kind: "design", style: { ...DEFAULT_STYLE, ...style }, blocks: build(idFactory(prefix)) });

const ready = (id: string, name: string, category: EmailTemplate["category"], description: string, content: EmailContent): Gallery => ({
  id: `tpl-gallery-${id}`,
  name,
  category,
  description,
  system: true,
  origin: "gallery",
  createdBy: "EVOQ",
  content,
});

/** Brand bar: org name on a coloured band. */
const bar = (id: () => string, bg: string, color = "#FFFFFF") => heading(id(), "{{org_name}}", { size: 16, align: "center", color, background: bg, paddingY: 18 });

export const GALLERY_EXTRA: Gallery[] = [
  // ── Welcome ────────────────────────────────────────────────────────
  ready(
    "welcome-health",
    "Welcome Health",
    "welcome",
    "Bold pink welcome for clinics and wellness brands.",
    design(
      "wh",
      (id) => [
        bar(id, "#3B0F24", "#F9A8C7"),
        heading(id(), "WELCOME!", { size: 44, align: "center", color: "#FFFFFF", background: "#EC7BA6", paddingY: 28 }),
        paragraph(id(), "Welcome to {{org_name}}! Your personalized health journey starts now with our expert consultants.", { align: "center", color: "#FFFFFF", background: "#EC7BA6", paddingY: 4 }),
        button(id(), "LEARN MORE", "https://evoq.one/health", { background: "#EC7BA6", color: "#111111", textColor: "#FFFFFF", paddingY: 18 }),
        image(id(), placeholderImage("☺", "#F5B5CD", "#EC7BA6", 600, 260), "Smiling card", { paddingX: 0, paddingY: 0 }),
        heading(id(), "The {{org_name}} approach", { size: 18, align: "center", color: "#FFFFFF", background: "#5A2140", paddingY: 18 }),
        columns(
          id(),
          [
            [paragraph(id(), "Care plans", { align: "center", color: "#F9D3E2", size: 13, paddingX: 0 })],
            [paragraph(id(), "Expert doctors", { align: "center", color: "#F9D3E2", size: 13, paddingX: 0 })],
            [paragraph(id(), "Online visits", { align: "center", color: "#F9D3E2", size: 13, paddingX: 0 })],
          ],
          { background: "#5A2140", paddingY: 8 },
        ),
        footer(id(), { background: "#3B0F24" }),
      ],
      { background: "#3B0F24", contentBackground: "#5A2140", textColor: "#FFFFFF", buttonColor: "#111111", radius: 4 },
    ),
  ),
  ready(
    "welcome-travel",
    "Welcome Travel",
    "welcome",
    "Script headline, offer banner and a traveller review.",
    design(
      "wt",
      (id) => [
        bar(id, "#1F8A70"),
        heading(id(), "Welcome", { size: 46, align: "center", color: "#FFFFFF", background: "#2D9D78", paddingY: 22 }),
        paragraph(id(), "Create memories that last a lifetime!", { align: "center", color: "#E6F6F0", background: "#2D9D78", paddingY: 0 }),
        image(id(), placeholderImage("▲ ▲ ▲", "#2D9D78", "#A7E3CF", 600, 120), "Mountains", { paddingX: 0, paddingY: 0, background: "#2D9D78" }),
        paragraph(id(), "UNLOCK YOUR DREAM VACATION!", { align: "center", size: 13, color: "#1F8A70", paddingY: 14 }),
        heading(id(), "UP TO 25% OFF", { size: 34, align: "center", color: "#16624F", paddingY: 0 }),
        paragraph(id(), "on all hotel bookings with us*", { align: "center", size: 13 }),
        button(id(), "BOOK NOW", "https://evoq.one/travel"),
        heading(id(), "FROM A TRAVELER'S DIARY", { size: 15, align: "center", color: "#FFFFFF", background: "#16624F", paddingY: 18 }),
        paragraph(id(), "★★★★★\n\n“Planning a trip can feel overwhelming, but {{org_name}} made it a breeze! The coupons helped me stick to my budget.”", {
          align: "center",
          color: "#E6F6F0",
          background: "#16624F",
          size: 13,
        }),
        footer(id()),
      ],
      { buttonColor: "#111111", linkColor: "#1F8A70", radius: 2 },
    ),
  ),
  ready(
    "twinkle",
    "Twinkle",
    "welcome",
    "Product-led welcome with stats and a portrait hero.",
    design(
      "tw",
      (id) => [
        heading(id(), "LOGO", { size: 14, align: "center", paddingY: 20 }),
        heading(id(), "Connect Your Amazing Products and Services to the Right Audience", { size: 28, align: "center", paddingY: 4 }),
        paragraph(id(), "Keep track of your customers effortlessly without the hassle of complicated invoicing tools and applications.", { align: "center", size: 14, color: "#5D5970" }),
        button(id(), "Explore", "https://evoq.one/explore"),
        image(id(), placeholderImage("Say hello 👋", "#2B6E66", "#7CC4B8", 600, 300), "Smiling customer", { paddingX: 0, paddingY: 0 }),
        columns(id(), [
          [heading(id(), "120+", { size: 22, align: "center", paddingX: 0, color: "#D9542C" }), paragraph(id(), "Total sent", { size: 12, align: "center", paddingX: 0 })],
          [heading(id(), "98%", { size: 22, align: "center", paddingX: 0, color: "#D9542C" }), paragraph(id(), "Delivered", { size: 12, align: "center", paddingX: 0 })],
          [heading(id(), "4.9★", { size: 22, align: "center", paddingX: 0, color: "#D9542C" }), paragraph(id(), "Rating", { size: 12, align: "center", paddingX: 0 })],
        ]),
        footer(id()),
      ],
      { buttonColor: "#D9542C", linkColor: "#D9542C", radius: 4 },
    ),
  ),
  ready(
    "welcome-heart",
    "Make Every Beat Count",
    "welcome",
    "Warm red welcome for health and fitness programs.",
    design(
      "wb",
      (id) => [
        heading(id(), "♥ logo.", { size: 15, align: "center", color: "#FFFFFF", background: "#C81E45", paddingY: 18 }),
        paragraph(id(), "WELCOMING HAPPY HEARTS!", { size: 12, color: "#C81E45", paddingY: 18 }),
        heading(id(), "Make every beat Count!", { size: 32, color: "#272238", paddingY: 0 }),
        button(id(), "Learn More", "https://evoq.one/heart", { align: "left" }),
        image(id(), placeholderImage("❤", "#FCE7EC", "#F7B5C4", 600, 220), "Heart", { paddingX: 0, paddingY: 0 }),
        heading(id(), "We help you keep your Heart healthy?", { size: 20, align: "center", color: "#FFFFFF", background: "#A3153A", paddingY: 20 }),
        paragraph(id(), "We're dedicated to partnering with you on your journey to optimal heart health — from preventive screenings to personal coaching.", { align: "center", size: 13, color: "#FBD5DF", background: "#A3153A" }),
        footer(id()),
      ],
      { background: "#C81E45", buttonColor: "#C81E45", linkColor: "#C81E45", radius: 4 },
    ),
  ),
  ready(
    "welcome-simple",
    "Welcome",
    "welcome",
    "Soft, illustrated welcome with a single message.",
    design(
      "ws",
      (id) => [
        heading(id(), "LOGO", { size: 14, align: "center", paddingY: 20 }),
        heading(id(), "Welcome", { size: 34, align: "center", paddingY: 4 }),
        paragraph(id(), "We think this is the beginning of something special.", { align: "center", color: "#5D5970" }),
        image(id(), placeholderImage("✦ Hello! ✦", "#E9E4FB", "#C9BEF3", 600, 260), "Illustration", { paddingX: 24 }),
        paragraph(id(), "Hi {{first_name}}, thanks for signing up. Over the next few days we'll share tips to help you get the most out of {{org_name}}.", { align: "center" }),
        button(id(), "Get started", "https://evoq.one/start"),
        footer(id()),
      ],
      { background: "#F6F1EC", contentBackground: "#FBF7F3" },
    ),
  ),
  ready(
    "welcome-tribe",
    "Welcome to Our Tribe",
    "onboarding",
    "Community welcome with a member photo strip.",
    design(
      "wtr",
      (id) => [
        heading(id(), "LOGO", { size: 14, align: "center", color: "#FFFFFF", paddingY: 20 }),
        heading(id(), "Welcome to our tribe!", { size: 30, align: "center", color: "#FFFFFF", paddingY: 4 }),
        paragraph(id(), "Today, our mission to impart knowledge and create a community of enlightened thinkers has taken a big step forward now that you're here.", { align: "center", color: "#F3D9E6", size: 14 }),
        button(id(), "Explore", "https://evoq.one/community", { color: "#E8C547", textColor: "#3A1029" }),
        columns(
          id(),
          [
            [image(id(), placeholderImage("☺", "#F4A261", "#E76F51", 200, 200), "Member", { paddingX: 0 })],
            [image(id(), placeholderImage("☺", "#2A9D8F", "#8AB17D", 200, 200), "Member", { paddingX: 0 })],
            [image(id(), placeholderImage("☺", "#E9C46A", "#F4A261", 200, 200), "Member", { paddingX: 0 })],
          ],
          { gap: 6, paddingX: 0, paddingY: 0 },
        ),
        footer(id(), { background: "#5E1B44" }),
      ],
      { background: "#3A1029", contentBackground: "#8A2858", textColor: "#FFFFFF", radius: 4 },
    ),
  ),

  // ── Thank you ──────────────────────────────────────────────────────
  ready(
    "thank-you-order",
    "Thanks for Your Order",
    "thank-you",
    "Order confirmation with a next-purchase coupon.",
    design(
      "to",
      (id) => [
        bar(id, "#2D9D78"),
        image(id(), placeholderImage("Thank you! ✓", "#2D9D78", "#7DD3B0", 600, 220), "Thank you", { paddingX: 0, paddingY: 0 }),
        heading(id(), "Your order is on its way, {{first_name}}", { align: "center" }),
        paragraph(id(), "We're packing it with care. You'll get a tracking link as soon as it ships.", { align: "center" }),
        divider(id()),
        paragraph(id(), "A little thank-you: use THANKS10 for 10% off your next order.", { align: "center", color: "#1F8A66", background: "#E9F6F1", paddingY: 16 }),
        button(id(), "Track my order", "https://evoq.one/orders"),
        footer(id()),
      ],
      { buttonColor: "#2D9D78", linkColor: "#1F8A66" },
    ),
  ),
  ready(
    "thank-you-event",
    "Thanks for Joining",
    "thank-you",
    "Post-event thank-you with the recording and slides.",
    design(
      "te",
      (id) => [
        bar(id, "#5B21B6"),
        heading(id(), "Thank you for joining us!", { size: 30, align: "center", color: "#FFFFFF", background: "#7C3AED", paddingY: 30 }),
        paragraph(id(), "Hi {{first_name}}, it was great to have you. Here's everything from the session.", { align: "center" }),
        columns(id(), [
          [image(id(), placeholderImage("▶ Recording", "#5B21B6", "#A78BFA", 300, 180), "Recording", { paddingX: 0 }), button(id(), "Watch", "https://evoq.one/recording", { paddingX: 0, fullWidth: true })],
          [image(id(), placeholderImage("Slides", "#3D1E5C", "#7C3AED", 300, 180), "Slides", { paddingX: 0 }), button(id(), "Download", "https://evoq.one/slides", { paddingX: 0, fullWidth: true })],
        ]),
        social(id()),
        footer(id()),
      ],
    ),
  ),

  // ── Newsletters ────────────────────────────────────────────────────
  ready(
    "newsletter-digest",
    "Weekly Digest",
    "newsletter",
    "Three short stories with read-more links.",
    design(
      "nd",
      (id) => [
        bar(id, "#3B5998"),
        heading(id(), "This week at {{org_name}}", { size: 24 }),
        paragraph(id(), "Five-minute read · Issue #20", { size: 12, color: "#777386", paddingY: 0 }),
        divider(id()),
        ...[
          ["Subject lines that get opened", "#3B5998", "#8BA3D6"],
          ["Designing for dark mode", "#5B21B6", "#A78BFA"],
          ["What we shipped this week", "#2D9D78", "#7DD3B0"],
        ].flatMap(([t, a, b]) => [
          columns(id(), [
            [image(id(), placeholderImage("Story", a, b, 260, 170), t, { paddingX: 0 })],
            [heading(id(), t, { size: 17, paddingX: 0 }), paragraph(id(), "A quick summary of the story and why it matters to you.", { size: 13, paddingX: 0 }), button(id(), "Read more", "https://evoq.one/blog", { align: "left", paddingX: 0, paddingY: 4 })],
          ]),
        ]),
        footer(id()),
      ],
      { buttonColor: "#3B5998", linkColor: "#3B5998" },
    ),
  ),

  // ── Events ─────────────────────────────────────────────────────────
  ready(
    "event-conference",
    "Conference Announcement",
    "event",
    "Speaker line-up with an early-bird ticket offer.",
    design(
      "ec",
      (id) => [
        heading(id(), "EVOQ SUMMIT 2025", { size: 13, align: "center", color: "#FFB089", background: "#1E1B3A", paddingY: 18 }),
        heading(id(), "Two days. 30 speakers. One big idea.", { size: 30, align: "center", color: "#FFFFFF", background: "#1E1B3A", paddingY: 10 }),
        paragraph(id(), "June 12–13 · San Francisco & online", { align: "center", color: "#C9C3E6", background: "#1E1B3A", paddingY: 4 }),
        button(id(), "Get early-bird tickets", "https://evoq.one/summit", { background: "#1E1B3A", paddingY: 24 }),
        heading(id(), "Featured speakers", { size: 18, align: "center" }),
        columns(id(), [
          [image(id(), placeholderImage("☺", "#FF7D3D", "#FFB089", 200, 200), "Speaker", { paddingX: 0 }), paragraph(id(), "Maya Patel\nCMO, Brightwave", { size: 12, align: "center", paddingX: 0 })],
          [image(id(), placeholderImage("☺", "#7C3AED", "#C4B5FD", 200, 200), "Speaker", { paddingX: 0 }), paragraph(id(), "Leo Martin\nFounder, Quartz", { size: 12, align: "center", paddingX: 0 })],
          [image(id(), placeholderImage("☺", "#3B5998", "#8BA3D6", 200, 200), "Speaker", { paddingX: 0 }), paragraph(id(), "Hana Ito\nVP Growth, Helix", { size: 12, align: "center", paddingX: 0 })],
        ]),
        footer(id()),
      ],
      { buttonColor: "#FF7D3D", linkColor: "#FF7D3D" },
    ),
  ),

  // ── Sales and promotions ───────────────────────────────────────────
  ready(
    "sales-flash",
    "Flash Sale",
    "promotional",
    "Countdown-style flash sale with a single big button.",
    design(
      "sf",
      (id) => [
        bar(id, "#E85D87"),
        heading(id(), "FLASH SALE ⚡", { size: 40, align: "center", color: "#FFFFFF", background: "#FF7D3D", paddingY: 28 }),
        paragraph(id(), "6 hours only · 30% off everything", { align: "center", color: "#FFFFFF", background: "#FF7D3D", paddingY: 0 }),
        spacer(id(), 20),
        heading(id(), "05 : 59 : 42", { size: 30, align: "center", color: "#E85D87" }),
        paragraph(id(), "Hours · Minutes · Seconds", { size: 12, align: "center", color: "#777386", paddingY: 0 }),
        button(id(), "Shop the flash sale", "https://evoq.one/flash", { fullWidth: true, paddingX: 48 }),
        footer(id()),
      ],
      { buttonColor: "#E85D87", linkColor: "#E85D87" },
    ),
  ),

  // ── Seasons ────────────────────────────────────────────────────────
  ready(
    "season-summer",
    "Hello Summer",
    "seasonal",
    "Sunny seasonal collection with product picks.",
    design(
      "ss",
      (id) => [
        bar(id, "#F59E0B"),
        image(id(), placeholderImage("☀ Hello Summer", "#FBBF24", "#FF7D3D", 600, 260), "Hello summer", { paddingX: 0, paddingY: 0 }),
        heading(id(), "Sun's out, {{first_name}}!", { align: "center" }),
        paragraph(id(), "Fresh picks for long days — light layers, bright colours and everything for the beach.", { align: "center" }),
        columns(id(), [
          [image(id(), placeholderImage("Hats", "#FBBF24", "#FDE68A", 200, 200), "Hats", { paddingX: 0 }), paragraph(id(), "Hats · $24", { size: 13, align: "center", paddingX: 0 })],
          [image(id(), placeholderImage("Shades", "#FF7D3D", "#FFB089", 200, 200), "Shades", { paddingX: 0 }), paragraph(id(), "Shades · $39", { size: 13, align: "center", paddingX: 0 })],
          [image(id(), placeholderImage("Towels", "#2D9D78", "#7DD3B0", 200, 200), "Towels", { paddingX: 0 }), paragraph(id(), "Towels · $19", { size: 13, align: "center", paddingX: 0 })],
        ]),
        button(id(), "Shop summer", "https://evoq.one/summer"),
        footer(id()),
      ],
      { background: "#FFF8E6", buttonColor: "#F59E0B", linkColor: "#B45309" },
    ),
  ),
  ready(
    "season-autumn",
    "Autumn Collection",
    "seasonal",
    "Warm, earthy tones for a new-season launch.",
    design(
      "sa",
      (id) => [
        heading(id(), "{{org_name}}", { size: 16, align: "center", color: "#7C2D12", paddingY: 18 }),
        image(id(), placeholderImage("Autumn / Fall", "#9A3412", "#F59E0B", 600, 280), "Autumn collection", { paddingX: 0, paddingY: 0 }),
        heading(id(), "Cosy season is here", { align: "center", color: "#7C2D12" }),
        paragraph(id(), "Knits, boots and warm drinks — our autumn collection is ready when you are.", { align: "center" }),
        button(id(), "Discover the collection", "https://evoq.one/autumn"),
        footer(id(), { background: "#FBEDE2" }),
      ],
      { background: "#FBEDE2", buttonColor: "#9A3412", linkColor: "#9A3412" },
    ),
  ),

  // ── Deals and offers ───────────────────────────────────────────────
  ready(
    "deals-coupon",
    "Exclusive Coupon",
    "deals",
    "A coupon code front and centre with an expiry date.",
    design(
      "dc",
      (id) => [
        bar(id, "#5B21B6"),
        heading(id(), "A gift just for you, {{first_name}}", { align: "center" }),
        paragraph(id(), "Here's an exclusive code for being one of our best customers.", { align: "center" }),
        heading(id(), "VIP25", { size: 40, align: "center", color: "#5B21B6", background: "#F3E8FF", paddingY: 24 }),
        paragraph(id(), "25% off sitewide · Expires May 31", { size: 13, align: "center", color: "#777386" }),
        button(id(), "Redeem now", "https://evoq.one/vip"),
        footer(id()),
      ],
    ),
  ),
  ready(
    "deals-bogo",
    "Buy One, Get One",
    "deals",
    "Two-product offer with side-by-side cards.",
    design(
      "db",
      (id) => [
        bar(id, "#E85D87"),
        heading(id(), "BUY 1 GET 1 FREE", { size: 32, align: "center", color: "#E85D87", paddingY: 24 }),
        paragraph(id(), "On all bestsellers this weekend. No code needed.", { align: "center" }),
        columns(id(), [
          [image(id(), placeholderImage("Buy one", "#E85D87", "#F6A5BE", 300, 220), "Buy one", { paddingX: 0 }), button(id(), "Shop", "https://evoq.one/bogo", { paddingX: 0, fullWidth: true })],
          [image(id(), placeholderImage("Get one FREE", "#7C3AED", "#C4B5FD", 300, 220), "Get one free", { paddingX: 0 }), button(id(), "Shop", "https://evoq.one/bogo", { paddingX: 0, fullWidth: true })],
        ]),
        footer(id()),
      ],
      { buttonColor: "#E85D87", linkColor: "#E85D87" },
    ),
  ),

  // ── Holidays ───────────────────────────────────────────────────────
  ready(
    "holiday-festive",
    "Happy Holidays",
    "holiday",
    "Festive greeting with a gift guide button.",
    design(
      "hf",
      (id) => [
        heading(id(), "{{org_name}}", { size: 15, align: "center", color: "#FDE68A", background: "#14532D", paddingY: 18 }),
        image(id(), placeholderImage("❄ Happy Holidays ❄", "#B91C1C", "#14532D", 600, 260), "Happy holidays", { paddingX: 0, paddingY: 0 }),
        heading(id(), "Warm wishes from all of us", { align: "center", color: "#14532D" }),
        paragraph(id(), "Thank you for a wonderful year, {{first_name}}. Our holiday gift guide has something for everyone on your list.", { align: "center" }),
        button(id(), "Open the gift guide", "https://evoq.one/gifts"),
        footer(id()),
      ],
      { background: "#FEF2F2", buttonColor: "#B91C1C", linkColor: "#B91C1C" },
    ),
  ),
  ready(
    "holiday-new-year",
    "New Year Countdown",
    "holiday",
    "Midnight-blue and gold New Year message.",
    design(
      "hn",
      (id) => [
        heading(id(), "{{org_name}}", { size: 15, align: "center", color: "#FCD34D", paddingY: 20 }),
        heading(id(), "Here's to 2026 ✨", { size: 36, align: "center", color: "#FFFFFF", paddingY: 18 }),
        paragraph(id(), "Thank you for being part of our story this year. We can't wait to show you what's next.", { align: "center", color: "#C7D2FE" }),
        button(id(), "See our year in review", "https://evoq.one/2025", { color: "#FCD34D", textColor: "#1E1B4B" }),
        footer(id(), { background: "#14123A" }),
      ],
      { background: "#0F0D2E", contentBackground: "#1E1B4B", textColor: "#FFFFFF", radius: 6 },
    ),
  ),
];

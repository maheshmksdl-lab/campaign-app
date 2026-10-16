/**
 * Building blocks for designed emails: the default style, a factory for each
 * block type, the starting layouts and placeholder artwork. Used by the
 * template seeds, the template editor and campaign content alike.
 */
import type { Align, BlockType, ButtonBlock, ColumnItem, ColumnsBlock, DividerBlock, EmailBlock, EmailContent, EmailLayout, EmailStyle, FooterBlock, HeadingBlock, ImageBlock, LayoutKey, SocialBlock, SpacerBlock, TextBlock } from "@/lib/types/templates";

export const FONT_OPTIONS = [
  { value: "Arial, Helvetica, sans-serif", label: "Arial" },
  { value: "'Helvetica Neue', Helvetica, Arial, sans-serif", label: "Helvetica" },
  { value: "Verdana, Geneva, sans-serif", label: "Verdana" },
  { value: "'Trebuchet MS', Tahoma, sans-serif", label: "Trebuchet" },
  { value: "Georgia, 'Times New Roman', serif", label: "Georgia" },
  { value: "'Courier New', Courier, monospace", label: "Courier" },
] as const;

/** Campaigns palette defaults. */
export const DEFAULT_STYLE: EmailStyle = {
  background: "#F8F8FC",
  contentBackground: "#FFFFFF",
  contentWidth: 600,
  fontFamily: FONT_OPTIONS[0].value,
  textColor: "#272238",
  linkColor: "#7C3AED",
  buttonColor: "#7C3AED",
  buttonTextColor: "#FFFFFF",
  radius: 8,
  blockSpacing: 0,
};

export const BLOCK_LABEL: Record<BlockType, string> = {
  heading: "Heading",
  text: "Paragraph",
  image: "Image",
  button: "Button",
  divider: "Divider",
  spacer: "Spacer",
  columns: "Columns",
  social: "Social links",
  footer: "Footer",
};

// ── Ids ──────────────────────────────────────────────────────────────

let seq = 0;
/** Unique block id for blocks made while editing. */
export const newBlockId = () => `b-${Date.now().toString(36)}-${(++seq).toString(36)}`;

/** Deterministic ids for seeded content. */
export function idFactory(prefix: string) {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

type IdFn = () => string;

// ── Placeholder artwork ──────────────────────────────────────────────

/** A small inline SVG image (no external requests), as a data URI. */
export function placeholderImage(label: string, from = "#5B21B6", to = "#8B5CF6", w = 600, h = 260): string {
  const safe = label.replace(/[<>&"']/g, "");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#g)"/>` +
    `<circle cx="${w * 0.82}" cy="${h * 0.22}" r="${h * 0.32}" fill="#fff" fill-opacity=".08"/>` +
    `<circle cx="${w * 0.12}" cy="${h * 0.9}" r="${h * 0.28}" fill="#fff" fill-opacity=".08"/>` +
    `<text x="50%" y="50%" fill="#fff" font-family="Arial, sans-serif" font-size="${Math.round(h / 8)}" font-weight="700" text-anchor="middle" dominant-baseline="middle">${safe}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ── Block factories ──────────────────────────────────────────────────

const box = (id: string, paddingY = 12, paddingX = 32) => ({ id, paddingY, paddingX });

export const heading = (id: string, text: string, o: Partial<HeadingBlock> = {}): HeadingBlock => ({ ...box(id, 16), type: "heading", text, size: 26, align: "left", ...o });
export const paragraph = (id: string, text: string, o: Partial<TextBlock> = {}): TextBlock => ({ ...box(id, 8), type: "text", text, size: 15, align: "left", ...o });
export const image = (id: string, src: string, alt: string, o: Partial<ImageBlock> = {}): ImageBlock => ({ ...box(id, 8), type: "image", src, alt, width: 100, align: "center", ...o });
export const button = (id: string, label: string, href: string, o: Partial<ButtonBlock> = {}): ButtonBlock => ({ ...box(id, 16), type: "button", label, href, align: "center", fullWidth: false, ...o });
export const divider = (id: string, o: Partial<DividerBlock> = {}): DividerBlock => ({ ...box(id, 12), type: "divider", thickness: 1, color: "#EAE6F1", ...o });
export const spacer = (id: string, height = 24): SpacerBlock => ({ ...box(id, 0, 0), type: "spacer", height });
export const columns = (id: string, cols: ColumnItem[][], o: Partial<ColumnsBlock> = {}): ColumnsBlock => ({ ...box(id, 12, 24), type: "columns", columns: cols, gap: 16, ...o });
export const social = (id: string, align: Align = "center"): SocialBlock => ({
  ...box(id, 16),
  type: "social",
  align,
  links: [
    { network: "facebook", url: "https://facebook.com/evoq" },
    { network: "instagram", url: "https://instagram.com/evoq" },
    { network: "linkedin", url: "https://linkedin.com/company/evoq" },
    { network: "x", url: "https://x.com/evoq" },
  ],
});
export const footer = (id: string, o: Partial<FooterBlock> = {}): FooterBlock => ({
  ...box(id, 24),
  type: "footer",
  text: "You're receiving this email because you subscribed to updates from {{org_name}}.",
  address: "Evoq Solutions · 500 Market Street, Suite 300 · San Francisco, CA 94105",
  showUnsubscribe: true,
  align: "center",
  background: "#F8F8FC",
  ...o,
});

/** A new block of any type with sensible starting content (editor "Add block"). */
export function createBlock(type: BlockType, id: string = newBlockId()): EmailBlock {
  switch (type) {
    case "heading":
      return heading(id, "Add a heading");
    case "text":
      return paragraph(id, "Write something your readers will care about. Use {{first_name}} to greet each contact by name.");
    case "image":
      return image(id, placeholderImage("Your image"), "Image description");
    case "button":
      return button(id, "Learn more", "https://evoq.one");
    case "divider":
      return divider(id);
    case "spacer":
      return spacer(id);
    case "columns":
      return columns(id, [
        [heading(`${id}-a1`, "Column one", { size: 18, paddingX: 0 }), paragraph(`${id}-a2`, "Short supporting text.", { paddingX: 0 })],
        [heading(`${id}-b1`, "Column two", { size: 18, paddingX: 0 }), paragraph(`${id}-b2`, "Short supporting text.", { paddingX: 0 })],
      ]);
    case "social":
      return social(id);
    case "footer":
      return footer(id);
  }
}

/** Three-column variant of the columns block. */
export function createThreeColumns(id: string = newBlockId()): ColumnsBlock {
  const col = (k: string, n: number) => [image(`${id}-${k}1`, placeholderImage(`Item ${n}`, "#3D1E5C", "#7C3AED", 300, 220), `Item ${n}`, { paddingX: 0 }), heading(`${id}-${k}2`, `Item ${n}`, { size: 16, paddingX: 0, paddingY: 6 }), paragraph(`${id}-${k}3`, "A line about this item.", { size: 13, paddingX: 0, paddingY: 4 })];
  return columns(id, [col("a", 1), col("b", 2), col("c", 3)], { gap: 12 });
}

/** Fresh ids for every block, nested ones included (used when copying content). */
export function reassignIds(blocks: EmailBlock[], next: IdFn = newBlockId): EmailBlock[] {
  return blocks.map((b) => (b.type === "columns" ? { ...b, id: next(), columns: b.columns.map((col) => col.map((x) => ({ ...x, id: next() }))) } : { ...b, id: next() }));
}

// ── Layouts ──────────────────────────────────────────────────────────

export const LAYOUTS: EmailLayout[] = [
  { key: "single-column", name: "Single column", description: "Header image, headline, text and a button." },
  { key: "two-column", name: "Two columns", description: "A headline above two side-by-side sections." },
  { key: "three-column", name: "Three columns", description: "Three short features or products in a row." },
  { key: "header-content", name: "Header and content", description: "A coloured header band above a letter-style message." },
  { key: "image-text", name: "Image and text", description: "Image on the left, text on the right." },
  { key: "text-image", name: "Text and image", description: "Text on the left, image on the right." },
  { key: "product-grid", name: "Product grid", description: "Two rows of products with prices and buttons." },
  { key: "promotional", name: "Promotional", description: "Sale banner, coupon code and featured products." },
  { key: "newsletter", name: "Newsletter", description: "Masthead, lead story and a list of short articles." },
];

const logoBar = (id: IdFn) => heading(id(), "{{org_name}}", { size: 18, align: "center", color: "#5B21B6", paddingY: 20 });

/** Build a layout's starting content with new block ids. */
export function buildLayout(key: LayoutKey, id: IdFn = newBlockId): EmailContent {
  const blocks: EmailBlock[] = [logoBar(id)];
  const product = (n: number, price: string): ColumnItem[] => [
    image(id(), placeholderImage(`Product ${n}`, "#3D1E5C", "#7C3AED", 300, 240), `Product ${n}`, { paddingX: 0 }),
    heading(id(), `Product name ${n}`, { size: 16, paddingX: 0, paddingY: 6 }),
    paragraph(id(), price, { size: 14, paddingX: 0, paddingY: 2, color: "#5B21B6" }),
    button(id(), "Shop now", "https://evoq.one/shop", { paddingX: 0, paddingY: 8, fullWidth: true }),
  ];
  switch (key) {
    case "single-column":
      blocks.push(
        image(id(), placeholderImage("Hero image"), "Hero image", { paddingX: 0, paddingY: 0 }),
        heading(id(), "Your headline goes here"),
        paragraph(id(), "Hi {{first_name}},\n\nIntroduce your message in a sentence or two. Keep it short and lead to one clear action."),
        button(id(), "Call to action", "https://evoq.one"),
      );
      break;
    case "two-column":
      blocks.push(
        heading(id(), "Two things worth knowing", { align: "center" }),
        columns(id(), [
          [image(id(), placeholderImage("Left", "#5B21B6", "#8B5CF6", 300, 200), "Left image", { paddingX: 0 }), heading(id(), "First topic", { size: 18, paddingX: 0 }), paragraph(id(), "A short description of the first topic.", { paddingX: 0 })],
          [image(id(), placeholderImage("Right", "#3D1E5C", "#7C3AED", 300, 200), "Right image", { paddingX: 0 }), heading(id(), "Second topic", { size: 18, paddingX: 0 }), paragraph(id(), "A short description of the second topic.", { paddingX: 0 })],
        ]),
      );
      break;
    case "three-column":
      blocks.push(heading(id(), "Three highlights", { align: "center" }), createThreeColumns(id()));
      break;
    case "image-text":
    case "text-image": {
      const img: ColumnItem[] = [image(id(), placeholderImage("Image", "#5B21B6", "#8B5CF6", 300, 260), "Feature image", { paddingX: 0 })];
      const txt: ColumnItem[] = [heading(id(), "Feature headline", { size: 20, paddingX: 0 }), paragraph(id(), "Explain the feature and why it matters to {{first_name}}.", { paddingX: 0 }), button(id(), "Find out more", "https://evoq.one", { align: "left", paddingX: 0 })];
      blocks.push(columns(id(), key === "image-text" ? [img, txt] : [txt, img]));
      break;
    }
    case "product-grid":
      blocks.push(
        heading(id(), "Picked for you", { align: "center" }),
        columns(id(), [product(1, "$49.00"), product(2, "$64.00")]),
        columns(id(), [product(3, "$29.00"), product(4, "$89.00")]),
      );
      break;
    case "header-content":
      blocks.push(
        heading(id(), "A clear headline for your message", { size: 28, align: "center", color: "#FFFFFF", background: "#5B21B6", paddingY: 36 }),
        heading(id(), "Hi {{first_name}},", { size: 18 }),
        paragraph(id(), "Use this space for the main message. A header band sets the tone, and the content below reads like a letter.\n\nAdd a second paragraph for details, then finish with one clear action."),
        button(id(), "Call to action", "https://evoq.one", { align: "left" }),
      );
      break;
    case "promotional":
      blocks.push(
        image(id(), placeholderImage("BIG SALE", "#FF7D3D", "#E85D87", 600, 240), "Sale banner", { paddingX: 0, paddingY: 0 }),
        heading(id(), "Up to 40% off, this week only", { align: "center" }),
        paragraph(id(), "Use the code below at checkout.", { align: "center", paddingY: 0 }),
        heading(id(), "SAVE40", { size: 30, align: "center", color: "#E0601F", background: "#FFF3EC", paddingY: 18 }),
        button(id(), "Shop now", "https://evoq.one/sale"),
        columns(id(), [product(1, "$39.00"), product(2, "$59.00")]),
      );
      break;
    case "newsletter":
      blocks.push(
        image(id(), placeholderImage("This month", "#3D1E5C", "#8B5CF6", 600, 220), "Newsletter masthead", { paddingX: 0, paddingY: 0 }),
        heading(id(), "The lead story"),
        paragraph(id(), "Open with the most important news of the month, then point readers to the full article."),
        button(id(), "Read the story", "https://evoq.one/blog", { align: "left" }),
        divider(id()),
        heading(id(), "Also this month", { size: 18 }),
        columns(id(), [
          [heading(id(), "Short article", { size: 16, paddingX: 0 }), paragraph(id(), "Two lines about a smaller piece of news.", { size: 14, paddingX: 0 })],
          [heading(id(), "Another update", { size: 16, paddingX: 0 }), paragraph(id(), "Two lines about another update.", { size: 14, paddingX: 0 })],
        ]),
      );
      break;
  }
  blocks.push(social(id()), footer(id()));
  return { kind: "design", style: { ...DEFAULT_STYLE }, blocks };
}

/** An empty design canvas ("From scratch"). */
export function blankDesign(id: IdFn = newBlockId): EmailContent {
  return { kind: "design", style: { ...DEFAULT_STYLE }, blocks: [heading(id(), "Start designing your email"), paragraph(id(), "Add blocks from the Elements panel."), footer(id())] };
}

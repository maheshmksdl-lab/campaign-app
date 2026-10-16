/**
 * Email templates. Designed content is stored as structured blocks plus a
 * style object (never only as an HTML string), so the editor can reopen it
 * and campaigns can copy it. HTML and plain-text content are kept as typed.
 */

export type Align = "left" | "center" | "right";

/** Spacing and background every block shares. */
interface BlockBox {
  id: string;
  paddingY: number;
  paddingX: number;
  /** Block background; empty = transparent. */
  background?: string;
}

export interface HeadingBlock extends BlockBox {
  type: "heading";
  text: string;
  size: number;
  color?: string;
  align: Align;
}

export interface TextBlock extends BlockBox {
  type: "text";
  /** Plain text; blank lines start a new paragraph. Merge tags allowed. */
  text: string;
  size: number;
  color?: string;
  align: Align;
}

export interface ImageBlock extends BlockBox {
  type: "image";
  /** http(s) URL or a data:image URI chosen from this computer. */
  src: string;
  alt: string;
  /** % of the content width. */
  width: number;
  href?: string;
  align: Align;
}

export interface ButtonBlock extends BlockBox {
  type: "button";
  label: string;
  href: string;
  align: Align;
  /** Empty = the style's button colours. */
  color?: string;
  textColor?: string;
  fullWidth: boolean;
}

export interface DividerBlock extends BlockBox {
  type: "divider";
  color?: string;
  thickness: number;
}

export interface SpacerBlock extends BlockBox {
  type: "spacer";
  height: number;
}

export type SocialNetwork = "facebook" | "instagram" | "linkedin" | "x" | "youtube";

export interface SocialBlock extends BlockBox {
  type: "social";
  align: Align;
  links: { network: SocialNetwork; url: string }[];
}

export interface FooterBlock extends BlockBox {
  type: "footer";
  text: string;
  address: string;
  showUnsubscribe: boolean;
  align: Align;
}

/** Blocks that can sit inside a column. */
export type ColumnItem = HeadingBlock | TextBlock | ImageBlock | ButtonBlock | DividerBlock | SpacerBlock;

export interface ColumnsBlock extends BlockBox {
  type: "columns";
  /** Two or three columns, each a stack of simple blocks. */
  columns: ColumnItem[][];
  gap: number;
}

export type EmailBlock = ColumnItem | ColumnsBlock | SocialBlock | FooterBlock;
export type BlockType = EmailBlock["type"];

export interface EmailStyle {
  /** Around the email. */
  background: string;
  /** Behind the content column. */
  contentBackground: string;
  /** px */
  contentWidth: number;
  fontFamily: string;
  textColor: string;
  linkColor: string;
  buttonColor: string;
  buttonTextColor: string;
  /** Corner radius for buttons and the content card, px. */
  radius: number;
  /** Extra space between blocks, px. */
  blockSpacing: number;
}

export type EmailContent =
  | { kind: "design"; style: EmailStyle; blocks: EmailBlock[] }
  | { kind: "html"; html: string }
  | { kind: "text"; text: string };

export type TemplateCategory = "newsletter" | "promotional" | "welcome" | "product-update" | "event" | "announcement" | "onboarding" | "thank-you" | "seasonal" | "deals" | "holiday";

/** How a template was started. */
export type TemplateOrigin = "gallery" | "layout" | "html" | "scratch" | "import";

export interface EmailTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  /** Ready-made gallery templates ship with the app and can't be changed or deleted. */
  system: boolean;
  origin: TemplateOrigin;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  content: EmailContent;
}

export interface TemplateInput {
  name: string;
  category: TemplateCategory;
  description?: string;
  origin: TemplateOrigin;
  content: EmailContent;
}

export interface TemplateEdit {
  name?: string;
  category?: TemplateCategory;
  description?: string;
  content?: EmailContent;
}

export type LayoutKey = "single-column" | "two-column" | "three-column" | "header-content" | "image-text" | "text-image" | "product-grid" | "promotional" | "newsletter";

/** A structured starting point (not stored; built fresh each time). */
export interface EmailLayout {
  key: LayoutKey;
  name: string;
  description: string;
}

export interface TemplateQuery {
  search?: string;
  /** "mine" = templates people made; "gallery" = ready-made ones. */
  scope?: "all" | "mine" | "gallery";
  category?: TemplateCategory;
}

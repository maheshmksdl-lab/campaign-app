/**
 * WhatsApp campaigns and templates, signup forms, workflows and the file
 * library. Every record shares the same base so one mock CRUD layer serves
 * them all. Dates are local datetimes (YYYY-MM-DDTHH:mm:ss).
 */

export interface BaseRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

// ── WhatsApp ─────────────────────────────────────────────────────────

export type WaStatus = "draft" | "scheduled" | "sending" | "sent" | "paused";

export interface WaCampaign extends BaseRecord {
  status: WaStatus;
  /** Approved template the message is based on (WhatsApp requires one for marketing). */
  templateId?: string;
  header?: string;
  body: string;
  footer?: string;
  /** Quick-reply / call-to-action button labels. */
  buttons: string[];
  audienceIds: string[];
  audience: string;
  recipients: number;
  scheduledAt?: string;
  sentAt?: string;
  // Results once sent.
  sent?: number;
  delivered?: number;
  read?: number;
  replied?: number;
  clicks?: number;
  failed?: number;
}

export type WaTemplateCategory = "marketing" | "utility" | "authentication";
export type WaTemplateStatus = "draft" | "pending" | "approved" | "rejected";

export interface WaTemplate extends BaseRecord {
  category: WaTemplateCategory;
  /** BCP 47 code, e.g. en_US. */
  language: string;
  header?: string;
  body: string;
  footer?: string;
  buttons: string[];
  status: WaTemplateStatus;
  /** Mock reviewer note for rejected templates. */
  rejectionReason?: string;
}

// ── Signup forms ─────────────────────────────────────────────────────

export type FormFieldType = "firstName" | "lastName" | "email" | "phone" | "company" | "text" | "dropdown" | "checkbox" | "consent";

export interface FormFieldDef {
  id: string;
  type: FormFieldType;
  label: string;
  required: boolean;
  placeholder?: string;
  /** Dropdown choices. */
  options?: string[];
}

export type FormKind = "embedded" | "popup" | "landing";
export type FormStatus = "draft" | "active" | "archived";

export interface SignupForm extends BaseRecord {
  kind: FormKind;
  status: FormStatus;
  fields: FormFieldDef[];
  settings: {
    title: string;
    description: string;
    submitLabel: string;
    successMessage: string;
    /** Contacts who submit are added to this list. */
    listId?: string;
  };
  submissions: number;
  views: number;
}

// ── Workflows ────────────────────────────────────────────────────────

export type TriggerType = "list-join" | "form-submit" | "tag-added" | "date-field" | "manual";
export type StepType = "email" | "wait" | "condition" | "update" | "end";

export interface WorkflowStep {
  id: string;
  type: StepType;
  /** Send email */
  subject?: string;
  templateId?: string;
  /** Wait */
  delay?: number;
  unit?: "hours" | "days";
  /** Condition: continue only when the contact … */
  condition?: "opened" | "clicked" | "has-tag" | "in-list";
  conditionValue?: string;
  /** Update contact */
  action?: "add-tag" | "remove-tag" | "add-to-list" | "unsubscribe";
  actionValue?: string;
}

export type WorkflowStatus = "draft" | "active" | "paused";

export interface WorkflowRun {
  id: string;
  at: string;
  contact: string;
  outcome: "completed" | "in-progress" | "exited";
  /** Step the contact is on or left at. */
  step: string;
}

export interface Workflow extends BaseRecord {
  description: string;
  status: WorkflowStatus;
  trigger: { type: TriggerType; value?: string };
  steps: WorkflowStep[];
  /** Contacts that entered so far. */
  processed: number;
  lastRunAt?: string;
  runs: WorkflowRun[];
}

// ── Files ────────────────────────────────────────────────────────────

export type FileKind = "image" | "document" | "other";

export interface AssetFile extends BaseRecord {
  kind: FileKind;
  mime: string;
  /** bytes */
  size: number;
  uploadedBy: string;
  /** Inline preview for images (data URI), kept only for small files. */
  preview?: string;
}

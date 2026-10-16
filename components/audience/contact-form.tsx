"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { fieldClass, FormField } from "@/components/shared/campaign-ui";
import { Switch } from "@/components/shared/email-ui";
import { SESSION_NOTE } from "@/components/shared/form-kit";
import { SidePanel } from "@/components/shared/side-panel";
import { useCreateContact, useLists, useUpdateContact } from "@/hooks/use-audience";
import { ApiError } from "@/lib/api/errors";
import { COUNTRY_OPTIONS, isValidEmail } from "@/lib/audience";
import type { Contact, ContactInput } from "@/lib/types/audience";

type Errors = Partial<Record<"email" | "firstName" | "phone" | "mobile", string>>;

const PHONE_RE = /^\+?[\d\s().-]{7,20}$/;

/** Add / Edit Contact, as a side panel over the Contacts page or a contact's profile. */
export function ContactFormPanel({ contact, open, onOpenChange, onSaved }: { contact?: Contact | null; open: boolean; onOpenChange: (o: boolean) => void; onSaved?: (c: Contact) => void }) {
  return open ? <ContactForm key={contact?.id ?? "new"} contact={contact ?? null} onOpenChange={onOpenChange} onSaved={onSaved} /> : null;
}

function ContactForm({ contact: c, onOpenChange, onSaved }: { contact: Contact | null; onOpenChange: (o: boolean) => void; onSaved?: (c: Contact) => void }) {
  const [v, setV] = useState<ContactInput>({
    email: c?.email ?? "",
    firstName: c?.firstName ?? "",
    lastName: c?.lastName ?? "",
    phone: c?.phone ?? "",
    mobile: c?.mobile ?? "",
    company: c?.company ?? "",
    country: c?.country ?? "",
    tags: c?.tags ?? [],
    listIds: c?.listIds ?? [],
    subscription: c?.subscription ?? "subscribed",
    suppressed: !!c?.suppression,
    excluded: c?.excluded ?? false,
  });
  const [tags, setTags] = useState(c?.tags.join(", ") ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const { data: lists } = useLists();
  const create = useCreateContact();
  const update = useUpdateContact();
  const set = <K extends keyof ContactInput>(k: K, val: ContactInput[K]) => {
    setV({ ...v, [k]: val });
    if (k in errors) setErrors({ ...errors, [k]: undefined });
  };
  const systemSuppressed = !!c?.suppression && c.suppression.reason !== "manual";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Errors = {};
    if (!v.email.trim()) errs.email = "Enter an email address";
    else if (!isValidEmail(v.email)) errs.email = "Enter a valid email address";
    if (v.firstName.length > 60) errs.firstName = "Keep the first name under 60 characters";
    if (v.mobile && !PHONE_RE.test(v.mobile)) errs.mobile = "Enter a valid mobile number";
    if (v.phone && !PHONE_RE.test(v.phone)) errs.phone = "Enter a valid phone number";
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) {
      document.getElementById(`ct-${Object.keys(errs).find((k) => errs[k as keyof Errors])}`)?.focus();
      return;
    }
    const input = { ...v, tags: tags.split(",").map((t) => t.trim()).filter(Boolean) };
    try {
      const saved = c ? await update.mutateAsync({ id: c.id, input }) : await create.mutateAsync(input);
      toast.success(c ? "Contact updated" : "Contact added", { description: `${saved.email} · ${SESSION_NOTE}` });
      onOpenChange(false);
      onSaved?.(saved);
    } catch (err) {
      if (err instanceof ApiError && err.field === "email") setErrors({ email: err.message });
      else toast.error("Couldn't save the contact", { description: (err as Error).message });
    }
  };

  const input = (id: keyof ContactInput, label: string, props: { type?: string; placeholder?: string; required?: boolean; error?: string; autoFocus?: boolean } = {}) => (
    <FormField label={label} htmlFor={`ct-${id}`} error={props.error} required={props.required}>
      <input
        id={`ct-${id}`}
        type={props.type ?? "text"}
        value={String(v[id] ?? "")}
        onChange={(e) => set(id, e.target.value as never)}
        placeholder={props.placeholder}
        aria-invalid={props.error ? true : undefined}
        autoFocus={props.autoFocus}
        className={fieldClass}
      />
    </FormField>
  );

  return (
    <SidePanel open onOpenChange={onOpenChange} title={c ? "Edit contact" : "Add contact"} description={c ? c.email : "Add one person by hand. To add many, import a CSV."} onSubmit={submit} submitLabel={c ? "Save contact" : "Add contact"} saving={create.isPending || update.isPending} note="Saved in this browser only." wide>
      {input("email", "Email address", { type: "email", placeholder: "name@company.com", required: true, error: errors.email, autoFocus: !c })}
      <div className="grid gap-4 sm:grid-cols-2">
        {input("firstName", "First name", { error: errors.firstName })}
        {input("lastName", "Last name")}
        {input("mobile", "Mobile", { type: "tel", placeholder: "+1 415 555 0134", error: errors.mobile })}
        {input("phone", "Phone", { type: "tel", error: errors.phone })}
        {input("company", "Company")}
        <FormField label="Country" htmlFor="ct-country">
          <select id="ct-country" value={v.country ?? ""} onChange={(e) => set("country", e.target.value)} className={fieldClass}>
            <option value="">Not set</option>
            {COUNTRY_OPTIONS.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <FormField label="Tags" htmlFor="ct-tags" hint="Separate tags with commas.">
        <input id="ct-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="newsletter, vip" className={fieldClass} />
      </FormField>
      <fieldset className="grid gap-1.5">
        <legend className="mb-1 text-field-label text-ink-body">Lists</legend>
        <div className="grid max-h-44 gap-0.5 overflow-y-auto rounded-lg border border-line p-1.5 scrollbar-thin sm:grid-cols-2">
          {(lists ?? []).map((l) => (
            <label key={l.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-ink hover:bg-campaign-surface">
              <Checkbox checked={v.listIds.includes(l.id)} onCheckedChange={(on) => set("listIds", on === true ? [...v.listIds, l.id] : v.listIds.filter((x) => x !== l.id))} />
              <span className="truncate">{l.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 rounded-xl border border-line bg-campaign-surface/60 p-4">
        <p className="text-[13px] font-medium text-campaign-depth">Status</p>
        <Row label="Subscribed to marketing email" hint="Unsubscribed contacts never receive campaigns.">
          <Switch checked={v.subscription === "subscribed"} onChange={(on) => set("subscription", on ? "subscribed" : "unsubscribed")} label="Subscribed" showState={false} />
        </Row>
        <Row label="Suppressed" hint={systemSuppressed ? "Suppressed by the system after a bounce or complaint — this can't be switched off." : "Blocks sending to this address."}>
          <Switch checked={v.suppressed} onChange={(on) => set("suppressed", on)} label="Suppressed" showState={false} disabled={systemSuppressed} />
        </Row>
        <Row label="Excluded from campaigns" hint="Stays subscribed, but is left out of every campaign.">
          <Switch checked={v.excluded} onChange={(on) => set("excluded", on)} label="Excluded" showState={false} />
        </Row>
      </div>
    </SidePanel>
  );
}

function Row({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[13px] text-ink">{label}</p>
        <p className="text-[12px] leading-4 text-ink-muted">{hint}</p>
      </div>
      {children}
    </div>
  );
}

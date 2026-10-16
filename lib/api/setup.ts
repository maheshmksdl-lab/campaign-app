/**
 * Getting Started progress, worked out from what has actually been done in
 * this browser (activity after the demo began), so the checklist ticks itself
 * off as people use the app. Sender verification is simulated and recorded
 * as a preference.
 */
import { DEMO_NOW } from "@/lib/mock-data/campaigns";
import { activity, contacts, delay, lists, segments, templates, workspace } from "./store";

export type SetupStepKey = "sender" | "contacts" | "audience" | "template" | "campaign" | "launch" | "form";

export interface SetupProgress {
  done: Record<SetupStepKey, boolean>;
  counts: { contacts: number; lists: number; segments: number; templates: number; forms: number; workflows: number };
}

export async function getSetupProgress(senderVerified: boolean): Promise<SetupProgress> {
  await delay(60);
  const mine = activity().filter((a) => a.at > DEMO_NOW);
  const has = (test: (a: (typeof mine)[number]) => boolean) => mine.some(test);
  return {
    done: {
      sender: senderVerified,
      contacts: has((a) => a.kind === "contacts"),
      audience: has((a) => (a.kind === "list" || a.kind === "segment") && /created/i.test(a.detail)),
      template: has((a) => a.kind === "template" && !/deleted/i.test(a.detail)),
      campaign: has((a) => (a.kind === "email" || a.kind === "sms" || a.kind === "whatsapp") && /created/i.test(a.detail)),
      launch: has((a) => /^(re)?scheduled/i.test(a.detail)),
      form: has((a) => a.kind === "form" && /created|duplicated/i.test(a.detail)),
    },
    counts: {
      contacts: contacts().length,
      lists: lists().length,
      segments: segments().length,
      templates: templates().filter((t) => !t.system).length,
      forms: workspace("forms").length,
      workflows: workspace("workflows").length,
    },
  };
}

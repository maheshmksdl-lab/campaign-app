import { toast } from "sonner";

/**
 * This release ships Overview, Campaigns, Contacts and Email Templates. Entries for
 * later modules stay visible (as in the design) and explain themselves
 * instead of opening a page that doesn't exist.
 */
export function notInPhase(feature: string) {
  toast.info(`${feature} isn't available yet`, { id: "not-in-phase", description: "This release covers Overview, Campaigns, Contacts and Email Templates." });
}

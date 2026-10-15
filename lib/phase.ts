import { toast } from "sonner";

/**
 * Phase 1 ships Overview, Campaigns and Campaign Details only. Entries for
 * later modules stay visible (as in the design) and explain themselves
 * instead of opening a page that doesn't exist.
 */
export function notInPhase(feature: string) {
  toast.info(`${feature} isn't available yet`, { id: "not-in-phase", description: "This release covers Overview, Campaigns and Campaign Details." });
}

/**
 * The single in-memory demo store behind the mock API. Seeded on first use
 * from the fixed demo data; lives in this browser tab and resets on reload.
 */
import { addMinutes } from "@/lib/format";
import { DEMO_NOW, seedActivity, seedCampaigns } from "@/lib/mock-data/campaigns";
import type { ActivityEntry, Campaign } from "@/lib/types/campaigns";

let campaignStore: Campaign[] | null = null;
let activityStore: ActivityEntry[] | null = null;
let sessionStart = 0;

export const campaigns = () => (campaignStore ??= seedCampaigns());
export const activity = () => (activityStore ??= seedActivity());

export const replaceCampaigns = (next: Campaign[]) => {
  campaignStore = next;
};

/**
 * The demo clock: the fixed demo "now" plus the real time spent in this tab,
 * so new actions read "Just now" next to the seeded "2m ago" entries.
 */
export function demoNow(): string {
  if (!sessionStart) sessionStart = Date.now();
  return addMinutes(DEMO_NOW, Math.floor((Date.now() - sessionStart) / 60_000));
}

/** Simulated network latency. */
export const delay = (ms = 100 + Math.random() * 160) => new Promise((r) => setTimeout(r, ms));
export const clone = <T>(v: T): T => structuredClone(v);

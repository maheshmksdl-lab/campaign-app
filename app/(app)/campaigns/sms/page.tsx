import { Suspense } from "react";
import type { Metadata } from "next";
import { CampaignsView, CampaignsViewFallback } from "@/components/campaigns/campaigns-view";

export const metadata: Metadata = { title: "SMS Campaigns" };

export default function Page() {
  return (
    // The list reads its state from the URL, so it renders on the client inside Suspense.
    <Suspense fallback={<CampaignsViewFallback channel="sms" />}>
      <CampaignsView channel="sms" />
    </Suspense>
  );
}

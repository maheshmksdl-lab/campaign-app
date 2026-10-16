/** Where the app opens. */
export const HOME_ROUTE = "/dashboard";
export const CAMPAIGNS_ROUTE = "/campaigns";

export const campaignHref = (id: string) => `${CAMPAIGNS_ROUTE}/${encodeURIComponent(id)}`;

/** The full-page editor for a campaign that isn't saved yet (Create Campaign). */
export const NEW_CAMPAIGN_ID = "new";
export const newCampaignHref = (type: "email" | "sms" = "email") => `${campaignHref(NEW_CAMPAIGN_ID)}${type === "sms" ? "?type=sms" : ""}`;

// The Campaigns list state (tab, search, filters, page…) last shown, so "Back to Campaigns" returns to it.
let campaignsListHref = CAMPAIGNS_ROUTE;
export const getCampaignsListHref = () => campaignsListHref;
export const setCampaignsListHref = (href: string) => {
  campaignsListHref = href;
};

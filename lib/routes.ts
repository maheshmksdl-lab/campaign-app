/** Where the app opens. */
export const HOME_ROUTE = "/dashboard";
export const CAMPAIGNS_ROUTE = "/campaigns";

export const campaignHref = (id: string) => `${CAMPAIGNS_ROUTE}/${encodeURIComponent(id)}`;

// The Campaigns list state (tab, search, filters, page…) last shown, so "Back to Campaigns" returns to it.
let campaignsListHref = CAMPAIGNS_ROUTE;
export const getCampaignsListHref = () => campaignsListHref;
export const setCampaignsListHref = (href: string) => {
  campaignsListHref = href;
};

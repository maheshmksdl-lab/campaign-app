import { writeStored } from "@/hooks/use-stored-state";
import { CONTENT_EDITOR_ROUTE, CONTENT_SESSION_KEY, pendingKey, type ContentSession, type PendingContent } from "@/lib/content-session";
import { campaignHref } from "@/lib/routes";

type Push = (href: string) => void;

/** Open the content editor on this content; it saves back to `session.target`. */
export function startEditing(push: Push, session: ContentSession) {
  writeStored(CONTENT_SESSION_KEY, session, "session");
  push(CONTENT_EDITOR_ROUTE);
}

/** Hand content to a campaign's editor and go back to it (applied to its unsaved draft). */
export function returnToCampaign(push: Push, campaignId: string, pending: PendingContent) {
  writeStored(pendingKey(campaignId), pending, "session");
  push(campaignHref(campaignId));
}

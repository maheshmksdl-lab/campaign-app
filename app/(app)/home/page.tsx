import { redirect } from "next/navigation";
import { HOME_ROUTE } from "@/lib/routes";

/** Home is the Overview dashboard. */
export default function HomePage() {
  redirect(HOME_ROUTE);
}

import { Suspense } from "react";
import type { Metadata } from "next";
import { ForgotPasswordView } from "@/components/auth/forgot-password-view";

export const metadata: Metadata = { title: "Forgot password" };

export default function Page() {
  return (
    // Reads ?next= / ?email= from the URL on the client.
    <Suspense fallback={null}>
      <ForgotPasswordView />
    </Suspense>
  );
}

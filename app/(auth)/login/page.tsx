import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginView } from "@/components/auth/login-view";

export const metadata: Metadata = { title: "Sign in" };

export default function Page() {
  return (
    // Reads ?next= / ?email= from the URL on the client.
    <Suspense fallback={null}>
      <LoginView />
    </Suspense>
  );
}

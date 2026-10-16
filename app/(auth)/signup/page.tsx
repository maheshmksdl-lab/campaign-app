import { Suspense } from "react";
import type { Metadata } from "next";
import { SignupView } from "@/components/auth/signup-view";

export const metadata: Metadata = { title: "Create your account" };

export default function Page() {
  return (
    // Reads ?next= / ?email= from the URL on the client.
    <Suspense fallback={null}>
      <SignupView />
    </Suspense>
  );
}

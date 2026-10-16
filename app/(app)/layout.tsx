import { AuthGuard } from "@/components/auth/auth-guard";
import { AppChrome } from "@/components/layout/app-chrome";

/** Every Campaigns module page: sidebar, header and content column, behind the mock sign-in. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AuthGuard>
      <AppChrome>{children}</AppChrome>
    </AuthGuard>
  );
}

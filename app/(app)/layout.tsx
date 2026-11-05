import type { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { requireSignedIn } from "@/lib/auth/require-user";
import { isAdminClerkId } from "@/lib/auth/admin";
import { VaultProvider } from "@/components/vault/vault-provider";
import { ToastProvider } from "@/components/ui/toast";
import { AppShell } from "@/components/layout/app-shell";

// Shared by every signed-in page. The VaultProvider lives here so the
// unlocked vault survives navigation between dashboard, shares and settings.
export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireSignedIn();
  // Decided on the server so ordinary users never poll the admin endpoint.
  const { userId } = await auth();
  const isAdmin = isAdminClerkId(userId);
  return (
    <ToastProvider>
      <VaultProvider>
        <AppShell isAdmin={isAdmin}>{children}</AppShell>
      </VaultProvider>
    </ToastProvider>
  );
}

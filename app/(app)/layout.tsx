import type { ReactNode } from "react";
import { requireSignedIn } from "@/lib/auth/require-user";
import { VaultProvider } from "@/components/vault/vault-provider";
import { ToastProvider } from "@/components/ui/toast";
import { AppShell } from "@/components/layout/app-shell";

// Shared by every signed-in page. The VaultProvider lives here so the
// unlocked vault survives navigation between dashboard, shares and settings.
export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireSignedIn();
  return (
    <ToastProvider>
      <VaultProvider>
        <AppShell>{children}</AppShell>
      </VaultProvider>
    </ToastProvider>
  );
}

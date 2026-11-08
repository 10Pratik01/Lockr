import type { Metadata } from "next";
import { requireSignedIn } from "@/lib/auth/require-user";
import { VaultGate } from "@/components/vault/vault-gate";
import { SharesList } from "@/components/share/shares-list";

export const metadata: Metadata = { title: "Shares · Lockr" };

// Behind the vault gate because credential names are encrypted -- they can
// only be shown once the vault is unlocked.
export default async function SharesPage() {
  await requireSignedIn();
  return (
    <VaultGate>
      <SharesList />
    </VaultGate>
  );
}

import type { Metadata } from "next";
import { requireSignedIn } from "@/lib/auth/require-user";
import { VaultGate } from "@/components/vault/vault-gate";
import { Dashboard } from "@/components/vault/dashboard";

export const metadata: Metadata = { title: "Vault · Lockr" };

export default async function DashboardPage() {
  await requireSignedIn();
  return (
    <VaultGate>
      <Dashboard />
    </VaultGate>
  );
}

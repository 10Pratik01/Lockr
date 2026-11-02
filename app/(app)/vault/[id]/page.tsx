import type { Metadata } from "next";
import { requireSignedIn } from "@/lib/auth/require-user";
import { VaultGate } from "@/components/vault/vault-gate";
import { CredentialDetails } from "@/components/vault/credential-details";

export const metadata: Metadata = { title: "Credential · Privault" };

export default async function CredentialPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSignedIn();
  const { id } = await params;
  return (
    <VaultGate>
      <CredentialDetails id={id} />
    </VaultGate>
  );
}

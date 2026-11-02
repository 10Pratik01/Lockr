// The decrypted shape of a vault credential. The server only ever stores
// this as one AES-GCM ciphertext (Credential.encryptedData), so this schema
// is enforced client-side, before encrypting and after decrypting.
import { z } from "zod";
import { decrypt, encrypt } from "@/lib/crypto/encryption";

// Only http(s) -- a stored "javascript:" or "data:" URL would turn the
// "Open website" button into an XSS vector.
export const safeUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    if (value === "") return true;
    try {
      const { protocol } = new URL(value);
      return protocol === "https:" || protocol === "http:";
    } catch {
      return false;
    }
  }, "Enter a valid http(s) URL");

export const credentialSchema = z.object({
  site: z.string().trim().min(1, "Website name is required").max(200),
  url: safeUrlSchema,
  username: z.string().max(500),
  password: z.string().min(1, "Password is required").max(1000),
  notes: z.string().max(5000),
});

export type CredentialData = z.infer<typeof credentialSchema>;

export interface StoredCredential {
  id: string;
  encryptedData: string;
  iv: string;
  createdAt: string;
  updatedAt: string;
}

export interface DecryptedCredential extends CredentialData {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export async function encryptCredential(data: CredentialData, dek: CryptoKey) {
  const parsed = credentialSchema.parse(data);
  const { ciphertext, iv } = await encrypt(JSON.stringify(parsed), dek);
  return { encryptedData: ciphertext, iv };
}

export async function decryptCredential(
  stored: StoredCredential,
  dek: CryptoKey
): Promise<DecryptedCredential> {
  const plaintext = await decrypt({ ciphertext: stored.encryptedData, iv: stored.iv }, dek);
  const data = credentialSchema.parse(JSON.parse(plaintext));
  return { ...data, id: stored.id, createdAt: stored.createdAt, updatedAt: stored.updatedAt };
}

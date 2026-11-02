import { z } from "zod";
import { DEFAULT_KDF_PARAMS } from "@/lib/crypto/key-derivation";
 
// The server never sees plaintext, so these are opaque base64 blobs --
// validation here is about shape and abuse-prevention, not content.
export const credentialInputSchema = z.object({
  // Generous cap for a JSON blob of {site, url, username, password, notes}
  // plus AES-GCM's base64 overhead.
  encryptedData: z.string().min(1).max(20_000),
  // Base64 of a 12-byte GCM IV is ~16 chars; capped generously above that.
  iv: z.string().min(1).max(64),
});
 
export type CredentialInput = z.infer<typeof credentialInputSchema>;

const base64 = (max: number) =>
  z.string().min(1).max(max).regex(/^[A-Za-z0-9+/]+={0,2}$/);

// The KDF runs in the browser, so the server can't force strong params --
// but it can refuse to store weak ones. Floors are the OWASP minimums we
// default to; ceilings stop a client from storing params so expensive that
// unlocking would hang every future session.
export const vaultKeySchema = z.object({
  kdfSalt: base64(64),
  kdfMemoryCost: z.number().int().min(DEFAULT_KDF_PARAMS.memoryCost).max(1_048_576),
  kdfTimeCost: z.number().int().min(DEFAULT_KDF_PARAMS.timeCost).max(20),
  kdfParallelism: z.number().int().min(1).max(8),
  // Base64 of a 32-byte DEK + 16-byte GCM tag is 64 chars.
  wrappedVaultKey: base64(128),
  wrappedVaultKeyIv: base64(64),
});

export type VaultKeyInput = z.infer<typeof vaultKeySchema>;

// A passphrase change must name the wrapped key it is replacing, so a
// stale tab (or a buggy client) can't overwrite a key it never unwrapped.
export const vaultKeyChangeSchema = vaultKeySchema.extend({
  previousWrappedVaultKey: base64(128),
});

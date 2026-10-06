import { z } from "zod";
 
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
 
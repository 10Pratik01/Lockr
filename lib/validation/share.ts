import { z } from "zod";
import { DESTROY_ON_OPEN_MAX_MINUTES, SHARE_EXPIRY_MINUTES } from "@/lib/share/constants";

const base64 = (max: number) =>
  z.string().min(1).max(max).regex(/^[A-Za-z0-9+/]+={0,2}$/);

const id = z.string().min(1).max(64);

export const shareCreateSchema = z.object({
  credentialId: id,
  expiresInMinutes: z.number().int(),
  // Delete the share the moment it is opened (see /api/share/verify).
  destroyOnOpen: z.boolean().default(false),
  // Ciphertext produced in the browser by lib/share/crypto.ts.
  encryptedPayload: base64(10_000),
  payloadIv: base64(64),
  payloadSalt: base64(64),
}).refine(
  // Only two shapes are valid: a timed share with one of the preset
  // expiries, or a destroy-on-open share with the fixed 24h hard cap.
  (d) =>
    d.destroyOnOpen
      ? d.expiresInMinutes === DESTROY_ON_OPEN_MAX_MINUTES
      : (SHARE_EXPIRY_MINUTES as readonly number[]).includes(d.expiresInMinutes),
  { path: ["expiresInMinutes"] }
);

export const shareVerifySchema = z.object({
  // 32 random bytes, base64url, no padding = 43 chars.
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  otp: z.string().regex(/^\d{6}$/),
});

export const shareRevokeSchema = z.object({ id });

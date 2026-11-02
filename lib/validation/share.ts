import { z } from "zod";
import { SHARE_EXPIRY_MINUTES } from "@/lib/share/constants";

const base64 = (max: number) =>
  z.string().min(1).max(max).regex(/^[A-Za-z0-9+/]+={0,2}$/);

const id = z.string().min(1).max(64);

export const shareCreateSchema = z.object({
  credentialId: id,
  expiresInMinutes: z
    .number()
    .int()
    .refine((m) => (SHARE_EXPIRY_MINUTES as readonly number[]).includes(m)),
  // Ciphertext produced in the browser by lib/share/crypto.ts.
  encryptedPayload: base64(10_000),
  payloadIv: base64(64),
  payloadSalt: base64(64),
});

export const shareVerifySchema = z.object({
  // 32 random bytes, base64url, no padding = 43 chars.
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  otp: z.string().regex(/^\d{6}$/),
});

export const shareRevokeSchema = z.object({ id });

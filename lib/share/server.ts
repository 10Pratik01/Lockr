// Server-only share verifiers. Imports node:crypto, so never import this
// from a client component.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export { MAX_OTP_ATTEMPTS } from "./constants";

/**
 * The token carries 256 bits of entropy, so a plain SHA-256 is enough to
 * make the stored value useless for building a working link -- no slow
 * KDF needed (that's for low-entropy secrets like passphrases).
 */
export function hashShareToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function otpPepper(): Buffer {
  const pepper = process.env.SHARE_OTP_PEPPER;
  if (!pepper || pepper.length < 32) {
    throw new Error("SHARE_OTP_PEPPER must be set (at least 32 characters)");
  }
  return Buffer.from(pepper, "utf8");
}

/**
 * A 6-digit OTP has only 10^6 values, so any unkeyed hash of it can be
 * brute-forced offline in milliseconds from a DB dump. Keying the HMAC
 * with a server-only pepper means the stored verifier is useless without
 * the deployment secret. Binding the token hash stops one share's
 * verifier from being replayed against another.
 */
export function createOtpVerifier(tokenHash: string, otp: string): string {
  return createHmac("sha256", otpPepper()).update(`${tokenHash}:${otp}`, "utf8").digest("hex");
}

export function verifyOtp(tokenHash: string, otp: string, verifier: string): boolean {
  const expected = Buffer.from(createOtpVerifier(tokenHash, otp), "hex");
  const actual = Buffer.from(verifier, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

import { beforeAll, describe, expect, it } from "vitest";
import { openSharePayload, sealSharePayload } from "@/lib/share/crypto";
import { createOtpVerifier, hashShareToken, verifyOtp } from "@/lib/share/server";
import { generateShareToken } from "@/lib/crypto/random";

const payload = { site: "GitHub", url: "https://github.com", username: "me", password: "s3cret!" };

beforeAll(() => {
  process.env.SHARE_OTP_PEPPER = "test-pepper-test-pepper-test-pepper-0123";
});

describe("share payload encryption", () => {
  it("round-trips with the link key", async () => {
    const sealed = await sealSharePayload(payload);
    expect(sealed.encryptedPayload).not.toContain("s3cret");
    expect(await openSharePayload(sealed.linkKey, sealed)).toEqual(payload);
  });

  it("cannot be opened with a different link key", async () => {
    const a = await sealSharePayload(payload);
    const b = await sealSharePayload(payload);
    await expect(openSharePayload(b.linkKey, a)).rejects.toThrow();
  });
});

describe("share verifiers", () => {
  it("token hash is deterministic and not the token", () => {
    const token = generateShareToken();
    expect(hashShareToken(token)).toBe(hashShareToken(token));
    expect(hashShareToken(token)).not.toContain(token);
  });

  it("verifies only the right OTP for the right share", () => {
    const tokenHash = hashShareToken(generateShareToken());
    const verifier = createOtpVerifier(tokenHash, "123456");
    expect(verifier).not.toContain("123456");
    expect(verifyOtp(tokenHash, "123456", verifier)).toBe(true);
    expect(verifyOtp(tokenHash, "123457", verifier)).toBe(false);
    expect(verifyOtp(hashShareToken(generateShareToken()), "123456", verifier)).toBe(false);
  });

  it("refuses to run without a strong pepper", () => {
    const saved = process.env.SHARE_OTP_PEPPER;
    process.env.SHARE_OTP_PEPPER = "short";
    expect(() => createOtpVerifier("x", "123456")).toThrow();
    process.env.SHARE_OTP_PEPPER = saved;
  });
});

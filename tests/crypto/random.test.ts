import { describe, expect, it } from "vitest";
import { generateOtp, generateShareToken, randomInt } from "@/lib/crypto/random";
import { fromBase64Url } from "@/lib/share/crypto";

describe("secure random", () => {
  it("share tokens are 256-bit, URL-safe and unique", () => {
    const tokens = new Set(Array.from({ length: 200 }, generateShareToken));
    expect(tokens.size).toBe(200);
    for (const t of tokens) {
      expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(fromBase64Url(t).length).toBe(32);
    }
  });

  it("OTPs are 6 digits, zero-padded", () => {
    for (let i = 0; i < 500; i++) expect(generateOtp()).toMatch(/^\d{6}$/);
  });

  it("randomInt stays in range and covers it", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const n = randomInt(7);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
      seen.add(n);
    }
    expect(seen.size).toBe(7);
  });

  it("randomInt rejects invalid bounds", () => {
    expect(() => randomInt(0)).toThrow(RangeError);
    expect(() => randomInt(1.5)).toThrow(RangeError);
  });
});

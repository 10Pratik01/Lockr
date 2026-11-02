import { describe, expect, it } from "vitest";
import { CHARSETS, DEFAULT_PASSWORD_OPTIONS, generatePassword } from "@/lib/crypto/password";

describe("password generator", () => {
  it("honours length and includes every selected class", () => {
    for (let i = 0; i < 100; i++) {
      const pw = generatePassword(DEFAULT_PASSWORD_OPTIONS);
      expect(pw).toHaveLength(20);
      for (const set of Object.values(CHARSETS)) {
        expect([...pw].some((c) => set.includes(c))).toBe(true);
      }
    }
  });

  it("only uses selected classes", () => {
    const pw = generatePassword({ length: 64, uppercase: false, lowercase: false, numbers: true, symbols: false });
    expect(pw).toMatch(/^\d{64}$/);
  });

  it("rejects no classes and out-of-range lengths", () => {
    const none = { length: 20, uppercase: false, lowercase: false, numbers: false, symbols: false };
    expect(() => generatePassword(none)).toThrow();
    expect(() => generatePassword({ ...DEFAULT_PASSWORD_OPTIONS, length: 4 })).toThrow(RangeError);
    expect(() => generatePassword({ ...DEFAULT_PASSWORD_OPTIONS, length: 129 })).toThrow(RangeError);
  });
});

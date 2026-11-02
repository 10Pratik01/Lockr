import { describe, expect, it } from "vitest";
import { decrypt, encrypt, generateAesKey, unwrapKey, wrapKey } from "@/lib/crypto/encryption";

describe("AES-256-GCM", () => {
  it("round-trips plaintext", async () => {
    const key = await generateAesKey();
    const sealed = await encrypt("hunter2 🔐", key);
    expect(sealed.ciphertext).not.toContain("hunter2");
    expect(await decrypt(sealed, key)).toBe("hunter2 🔐");
  });

  it("uses a fresh IV every time", async () => {
    const key = await generateAesKey();
    const a = await encrypt("same", key);
    const b = await encrypt("same", key);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("rejects the wrong key", async () => {
    const sealed = await encrypt("secret", await generateAesKey());
    await expect(decrypt(sealed, await generateAesKey())).rejects.toThrow();
  });

  it("rejects tampered ciphertext", async () => {
    const key = await generateAesKey();
    const sealed = await encrypt("secret", key);
    const bytes = Buffer.from(sealed.ciphertext, "base64");
    bytes[0] ^= 1;
    await expect(decrypt({ ...sealed, ciphertext: bytes.toString("base64") }, key)).rejects.toThrow();
  });

  it("wraps and unwraps a DEK", async () => {
    const dek = await generateAesKey();
    const kek = await generateAesKey();
    const wrapped = await wrapKey(dek, kek);
    const unwrapped = await unwrapKey(wrapped, kek);
    const sealed = await encrypt("data", dek);
    expect(await decrypt(sealed, unwrapped)).toBe("data");
    await expect(unwrapKey(wrapped, await generateAesKey())).rejects.toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { createVaultKey, rewrapVaultKey, unlockVaultKey } from "@/lib/vault/keys";
import { decryptCredential, encryptCredential } from "@/lib/vault/credential";
import { vaultKeySchema } from "@/lib/validation/vault";

const credential = {
  site: "GitHub",
  url: "https://github.com",
  username: "user@example.com",
  password: "correct horse battery staple",
  notes: "",
};

describe("vault key lifecycle", () => {
  it("setup → unlock → decrypt, and the record passes server validation", async () => {
    const { record, dek } = await createVaultKey("a long vault passphrase");
    expect(vaultKeySchema.safeParse(record).success).toBe(true);

    const enc = await encryptCredential(credential, dek);
    const unlocked = await unlockVaultKey("a long vault passphrase", record);
    const dec = await decryptCredential({ id: "1", createdAt: "", updatedAt: "", ...enc }, unlocked);
    expect(dec.password).toBe(credential.password);
  });

  it("rejects the wrong passphrase", async () => {
    const { record } = await createVaultKey("a long vault passphrase");
    await expect(unlockVaultKey("wrong passphrase!!", record)).rejects.toThrow();
  });

  it("passphrase change keeps existing credentials readable", async () => {
    const { record, dek } = await createVaultKey("old passphrase here");
    const enc = await encryptCredential(credential, dek);

    const next = await rewrapVaultKey(dek, "brand new passphrase");
    expect(next.kdfSalt).not.toBe(record.kdfSalt);
    await expect(unlockVaultKey("old passphrase here", next)).rejects.toThrow();

    const unlocked = await unlockVaultKey("brand new passphrase", next);
    const dec = await decryptCredential({ id: "1", createdAt: "", updatedAt: "", ...enc }, unlocked);
    expect(dec.username).toBe(credential.username);
  });

  it("refuses to encrypt a javascript: URL", async () => {
    const { dek } = await createVaultKey("a long vault passphrase");
    await expect(encryptCredential({ ...credential, url: "javascript:alert(1)" }, dek)).rejects.toThrow();
  });
});

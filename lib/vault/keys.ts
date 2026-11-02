// Client-side vault key lifecycle: setup, unlock, passphrase change.
// The passphrase, KEK and unwrapped DEK exist only in browser memory.
import { generateAesKey, importAesKey, unwrapKey, wrapKey } from "@/lib/crypto/encryption";
import {
  DEFAULT_KDF_PARAMS,
  deriveKeyFromPassphrase,
  generateVaultSalt,
  type KdfParams,
} from "@/lib/crypto/key-derivation";
import { fromBase64, toBase64 } from "@/lib/crypto/random";
import type { VaultKeyInput } from "@/lib/validation/vault";

export const MIN_PASSPHRASE_LENGTH = 12;

async function deriveKek(passphrase: string, salt: Uint8Array, params: KdfParams) {
  const raw = await deriveKeyFromPassphrase(passphrase, salt, params);
  try {
    return await importAesKey(raw);
  } finally {
    raw.fill(0); // best effort -- JS gives no guarantee about other copies
  }
}

async function wrapUnderPassphrase(dek: CryptoKey, passphrase: string): Promise<VaultKeyInput> {
  const salt = generateVaultSalt();
  const params = DEFAULT_KDF_PARAMS;
  const kek = await deriveKek(passphrase, salt, params);
  const wrapped = await wrapKey(dek, kek);
  return {
    kdfSalt: toBase64(salt),
    kdfMemoryCost: params.memoryCost,
    kdfTimeCost: params.timeCost,
    kdfParallelism: params.parallelism,
    wrappedVaultKey: wrapped.ciphertext,
    wrappedVaultKeyIv: wrapped.iv,
  };
}

/** New vault: random DEK, wrapped under a KEK derived from the passphrase. */
export async function createVaultKey(passphrase: string) {
  const dek = await generateAesKey();
  const record = await wrapUnderPassphrase(dek, passphrase);
  return { record, dek };
}

/**
 * Throws if the passphrase is wrong -- AES-GCM authentication fails on
 * unwrap, so no separate passphrase hash needs to be stored anywhere.
 */
export async function unlockVaultKey(passphrase: string, vault: VaultKeyInput): Promise<CryptoKey> {
  const kek = await deriveKek(passphrase, fromBase64(vault.kdfSalt), {
    memoryCost: vault.kdfMemoryCost,
    timeCost: vault.kdfTimeCost,
    parallelism: vault.kdfParallelism,
  });
  return unwrapKey({ ciphertext: vault.wrappedVaultKey, iv: vault.wrappedVaultKeyIv }, kek);
}

/**
 * Re-wraps the existing DEK under a new passphrase, then proves the new
 * record round-trips to the same key before anything is sent to the
 * server -- a bad re-wrap would otherwise lock the user out of every credential.
 */
export async function rewrapVaultKey(dek: CryptoKey, newPassphrase: string): Promise<VaultKeyInput> {
  const record = await wrapUnderPassphrase(dek, newPassphrase);
  const check = await unlockVaultKey(newPassphrase, record);
  const [a, b] = await Promise.all([
    globalThis.crypto.subtle.exportKey("raw", dek),
    globalThis.crypto.subtle.exportKey("raw", check),
  ]);
  const same =
    a.byteLength === b.byteLength &&
    new Uint8Array(a).every((byte, i) => byte === new Uint8Array(b)[i]);
  if (!same) throw new Error("Re-wrapped vault key failed verification");
  return record;
}

/** Imports raw DEK bytes; exported for tests. */
export const importVaultKey = (raw: Uint8Array) => importAesKey(raw, true);

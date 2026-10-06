// Argon2id key derivation. Runs identically in the browser and in Node via
// hash-wasm's WebAssembly implementation -- no native bindings required,
// which matters because this must run client-side to unlock the vault.
import { argon2id } from "hash-wasm";
import { randomBytes } from "./random";

// OWASP Password Storage Cheat Sheet minimum recommendation (checked 2026):
// Argon2id, m=19456 KiB (19 MiB), t=2 iterations, p=1 parallelism.
// https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
export const DEFAULT_KDF_PARAMS: KdfParams = {
  memoryCost: 19456, // KiB
  timeCost: 2,
  parallelism: 1,
};

export interface KdfParams {
  memoryCost: number;
  timeCost: number;
  parallelism: number;
}

/** A fresh 16-byte salt for a new vault. Store this -- it's needed to re-derive the same key later. */
export function generateVaultSalt(): Uint8Array {
  return randomBytes(16);
}

/**
 * Derives a 256-bit key-encryption key (KEK) from the vault passphrase.
 * The same salt + params must be supplied every time the same vault is
 * unlocked -- both live on the Vault record. The passphrase and the
 * derived key are never sent to the server or stored anywhere.
 */
export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
  params: KdfParams = DEFAULT_KDF_PARAMS
): Promise<Uint8Array> {
  const hash = await argon2id({
    password: passphrase,
    salt,
    parallelism: params.parallelism,
    iterations: params.timeCost,
    memorySize: params.memoryCost,
    hashLength: 32, // 256-bit key, matches AES-256-GCM
    outputType: "binary",
  });
  return new Uint8Array(hash as unknown as ArrayBuffer);
}
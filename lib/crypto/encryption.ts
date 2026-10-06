// AES-256-GCM via the native Web Crypto SubtleCrypto API -- the only
// primitive used for vault credentials, wrapped keys, and share payloads.
import { randomBytes, toBase64, fromBase64 } from "./random";

const AES_KEY_LENGTH = 256;
const GCM_IV_LENGTH = 12; // 96 bits -- the size AES-GCM is designed for

export interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string; // base64
}

function getSubtle(): SubtleCrypto {
  if (typeof globalThis.crypto?.subtle === "undefined") {
    throw new Error("SubtleCrypto is not available in this runtime");
  }
  return globalThis.crypto.subtle;
}

/** Generates a random AES-256 data-encryption key (e.g. a vault's DEK). */
export async function generateAesKey(): Promise<CryptoKey> {
  return getSubtle().generateKey(
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    true, // extractable -- needed so it can later be wrapped/exported
    ["encrypt", "decrypt"]
  );
}

export async function importAesKey(rawKey: Uint8Array, extractable = false): Promise<CryptoKey> {
  return getSubtle().importKey("raw", rawKey as BufferSource, { name: "AES-GCM" }, extractable, [
    "encrypt",
    "decrypt",
  ]);
}

export async function exportAesKey(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await getSubtle().exportKey("raw", key));
}

async function encryptBytes(plaintext: Uint8Array, key: CryptoKey): Promise<EncryptedPayload> {
  // A fresh random IV per call is what makes reusing one key across many
  // encryptions safe -- the chance of a 96-bit random value repeating is
  // negligible even after billions of calls under the same key.
  const iv = randomBytes(GCM_IV_LENGTH);
  const ciphertext = await getSubtle().encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    plaintext as BufferSource
  );
  return { ciphertext: toBase64(new Uint8Array(ciphertext)), iv: toBase64(iv) };
}

async function decryptBytes(payload: EncryptedPayload, key: CryptoKey): Promise<Uint8Array> {
  const iv = fromBase64(payload.iv);
  const ciphertext = fromBase64(payload.ciphertext);
  // AES-GCM authenticates as it decrypts -- a tampered ciphertext or wrong
  // key throws here rather than silently returning garbage plaintext.
  const plaintext = await getSubtle().decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    ciphertext as BufferSource
  );
  return new Uint8Array(plaintext);
}

/** Encrypts a UTF-8 string -- e.g. a JSON-serialized credential -- under the given key. */
export async function encrypt(plaintext: string, key: CryptoKey): Promise<EncryptedPayload> {
  return encryptBytes(new TextEncoder().encode(plaintext), key);
}

export async function decrypt(payload: EncryptedPayload, key: CryptoKey): Promise<string> {
  return new TextDecoder().decode(await decryptBytes(payload, key));
}

/**
 * Envelope encryption: wraps a vault's data-encryption key (DEK) under a
 * key-encryption key (KEK) derived from the passphrase. Only this wrapped
 * value is ever stored server-side (Vault.wrappedVaultKey / wrappedVaultKeyIv).
 * Changing the passphrase means unwrapping with the old KEK and re-wrapping
 * with the new one -- no credential ever needs to be touched.
 */
export async function wrapKey(dek: CryptoKey, kek: CryptoKey): Promise<EncryptedPayload> {
  return encryptBytes(await exportAesKey(dek), kek);
}

export async function unwrapKey(wrapped: EncryptedPayload, kek: CryptoKey): Promise<CryptoKey> {
  return importAesKey(await decryptBytes(wrapped, kek), true);
}
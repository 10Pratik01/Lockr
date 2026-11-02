// Client-side share payload encryption.
//
// Design: the share link is /share/<token>#<linkKey>.
//   - token (path) is what the server looks the share up by; it stores
//     only its hash.
//   - linkKey (URL fragment) never reaches the server -- browsers don't send
//     fragments in requests. The payload key is HKDF(linkKey, payloadSalt).
//   - The OTP is a separate, server-enforced gate (attempt limit, expiry,
//     one-time consume) and is never part of the encryption key.
// So a database dump, or the server itself, holds only ciphertext it cannot
// open, and the recipient needs both the full link and the OTP.
import { decrypt, encrypt, type EncryptedPayload } from "@/lib/crypto/encryption";
import { fromBase64, randomBytes, toBase64, toBase64Url } from "@/lib/crypto/random";

const HKDF_INFO = new TextEncoder().encode("privault-share-payload-v1");

export interface SharePayload {
  site: string;
  url: string;
  username: string;
  password: string;
}

export function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  return fromBase64(padded + "=".repeat((4 - (padded.length % 4)) % 4));
}

async function derivePayloadKey(linkKey: Uint8Array, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = globalThis.crypto.subtle;
  const ikm = await subtle.importKey("raw", linkKey as BufferSource, "HKDF", false, ["deriveKey"]);
  return subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: HKDF_INFO as BufferSource },
    ikm,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export interface SealedShare {
  linkKey: string; // base64url -- goes in the URL fragment only
  encryptedPayload: string;
  payloadIv: string;
  payloadSalt: string;
}

export async function sealSharePayload(payload: SharePayload): Promise<SealedShare> {
  const linkKey = randomBytes(32);
  const salt = randomBytes(16);
  const key = await derivePayloadKey(linkKey, salt);
  const sealed = await encrypt(JSON.stringify(payload), key);
  return {
    linkKey: toBase64Url(linkKey),
    encryptedPayload: sealed.ciphertext,
    payloadIv: sealed.iv,
    payloadSalt: toBase64(salt),
  };
}

export async function openSharePayload(
  linkKey: string,
  sealed: { encryptedPayload: string; payloadIv: string; payloadSalt: string }
): Promise<SharePayload> {
  const key = await derivePayloadKey(fromBase64Url(linkKey), fromBase64(sealed.payloadSalt));
  const payload: EncryptedPayload = { ciphertext: sealed.encryptedPayload, iv: sealed.payloadIv };
  return JSON.parse(await decrypt(payload, key)) as SharePayload;
}

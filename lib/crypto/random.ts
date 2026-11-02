// Cryptographically secure randomness only -- never Math.random() for anything here.

function getCrypto(): Crypto {
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    return globalThis.crypto;
  }
  throw new Error(
    "Web Crypto API is not available in this runtime (need Node 20+, a browser, or the edge runtime)"
  );
}

/** Raw cryptographically secure random bytes. */
export function randomBytes(length: number): Uint8Array {
  return getCrypto().getRandomValues(new Uint8Array(length));
}

export function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

export function fromBase64(value: string): Uint8Array {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(value, "base64"));
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

/** URL-safe base64, no padding -- safe to drop straight into a URL path segment. */
export function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * A share URL token: 256 bits of entropy. Only its hash is ever stored
 * (see lib/share/server.ts `hashShareToken`) -- this raw value goes
 * straight into the share link and nowhere else, including logs.
 */
export function generateShareToken(): string {
  return toBase64Url(randomBytes(32));
}

/**
 * A uniform integer in [0, max), rejection-sampled so there is no modulo
 * bias (a plain `% max` makes low values slightly more likely whenever
 * 2^32 isn't a multiple of max).
 */
export function randomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0 || max > 0x100000000) {
    throw new RangeError("max must be an integer in (0, 2^32]");
  }
  const limit = Math.floor(0x100000000 / max) * max;
  let value: number;
  do {
    value = getCrypto().getRandomValues(new Uint32Array(1))[0];
  } while (value >= limit);
  return value % max;
}

/** A numeric OTP where every digit combination is equally likely. */
export function generateOtp(digits = 6): string {
  return randomInt(10 ** digits).toString().padStart(digits, "0");
}

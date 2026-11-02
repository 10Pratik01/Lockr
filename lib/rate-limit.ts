// Fixed-window rate limiting backed by Postgres (serverless instances share
// no memory, so an in-process counter would be per-instance and useless).
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export interface RateLimitRule {
  bucket: string;
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMITS = {
  // Per IP. Per-share OTP attempts are capped separately (MAX_OTP_ATTEMPTS);
  // this stops one client from sweeping across many shares.
  shareVerify: { bucket: "share-verify", limit: 20, windowSeconds: 600 },
  shareCreate: { bucket: "share-create", limit: 30, windowSeconds: 3600 },
  vaultKeyWrite: { bucket: "vault-key", limit: 10, windowSeconds: 3600 },
  credentialWrite: { bucket: "credential-write", limit: 120, windowSeconds: 60 },
} satisfies Record<string, RateLimitRule>;

/** Best-effort client IP. On Vercel, x-forwarded-for is set by the platform. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

let warnedUnavailable = false;

/**
 * Returns true if the request is within the limit. One atomic upsert per
 * call: the window resets in the same statement that increments it, so
 * concurrent requests can't race past the limit.
 *
 * Fails open if the table is missing or the DB errors -- rate limiting is
 * abuse protection layered on top of the real controls (auth, ownership,
 * per-share attempt caps), and shouldn't take the app down.
 */
export async function checkRateLimit(rule: RateLimitRule, identifier: string): Promise<boolean> {
  const key = `${rule.bucket}:${createHash("sha256").update(identifier).digest("hex")}`;
  try {
    const rows = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimit" ("key", "count", "windowStart")
      VALUES (${key}, 1, now())
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${rule.windowSeconds})
          THEN 1 ELSE "RateLimit"."count" + 1 END,
        "windowStart" = CASE
          WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${rule.windowSeconds})
          THEN now() ELSE "RateLimit"."windowStart" END
      RETURNING "count"`;

    // Occasional cleanup of stale windows (~1% of calls), so the table stays
    // small. Math.random is fine here: this is load sampling, not a secret.
    if (Math.random() < 0.01) {
      await db.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 86_400_000) } } });
    }
    return Number(rows[0]?.count ?? 0) <= rule.limit;
  } catch {
    if (!warnedUnavailable) {
      warnedUnavailable = true;
      console.warn("Rate limiting unavailable (has the RateLimit migration been applied?)");
    }
    return true;
  }
}

export const tooManyRequests = (rule: RateLimitRule) =>
  NextResponse.json(
    { error: "Too many requests. Try again later." },
    { status: 429, headers: { "Retry-After": String(rule.windowSeconds) } }
  );

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { shareVerifySchema } from "@/lib/validation/share";
import { hashShareToken, MAX_OTP_ATTEMPTS, verifyOtp } from "@/lib/share/server";
import { checkRateLimit, clientIp, RATE_LIMITS, tooManyRequests } from "@/lib/rate-limit";

// Public endpoint -- the recipient has no account. Possession of the token
// plus the OTP is the authorization.

// One message for missing / expired / used / revoked / locked, so the
// response never tells an attacker which state a share is in.
const gone = () =>
  NextResponse.json({ error: "Share expired or already used" }, { status: 410 });

export async function POST(request: Request) {
  if (!(await checkRateLimit(RATE_LIMITS.shareVerify, clientIp(request)))) {
    return tooManyRequests(RATE_LIMITS.shareVerify);
  }

  const body = await request.json().catch(() => null);
  const parsed = shareVerifySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const tokenHash = hashShareToken(parsed.data.token);
  const now = new Date();
  const usable = { usedAt: null, revokedAt: null, expiresAt: { gt: now } };

  const share = await db.share.findFirst({
    where: { tokenHash, ...usable },
    select: { id: true, otpVerifier: true, encryptedPayload: true, payloadIv: true, payloadSalt: true },
  });
  if (!share) return gone();

  // Reserve an attempt *before* checking the OTP. The increment is
  // conditional on the counter, so even a burst of parallel guesses can
  // never get more than MAX_OTP_ATTEMPTS OTP comparisons in total.
  const reserved = await db.share.updateMany({
    where: { id: share.id, ...usable, failedAttempts: { lt: MAX_OTP_ATTEMPTS } },
    data: { failedAttempts: { increment: 1 } },
  });
  if (reserved.count === 0) return gone();

  if (!verifyOtp(tokenHash, parsed.data.otp, share.otpVerifier)) {
    const after = await db.share.findUnique({ where: { id: share.id }, select: { failedAttempts: true } });
    const remaining = Math.max(0, MAX_OTP_ATTEMPTS - (after?.failedAttempts ?? MAX_OTP_ATTEMPTS));
    if (remaining === 0) {
      // Invalidated: wipe the ciphertext so nothing redeemable is left.
      await db.share.update({ where: { id: share.id }, data: { encryptedPayload: "" } });
      return gone();
    }
    return NextResponse.json({ error: "Incorrect code", remainingAttempts: remaining }, { status: 401 });
  }

  // Atomic one-time consume: of any concurrent correct requests, exactly
  // one sees count === 1. The ciphertext is wiped in the same statement.
  const consumed = await db.share.updateMany({
    where: { id: share.id, ...usable },
    data: { usedAt: now, encryptedPayload: "", failedAttempts: { decrement: 1 } },
  });
  if (consumed.count === 0) return gone();

  // Still ciphertext -- only the recipient's link fragment can decrypt it.
  return NextResponse.json({
    payload: {
      encryptedPayload: share.encryptedPayload,
      payloadIv: share.payloadIv,
      payloadSalt: share.payloadSalt,
    },
  });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { readJson } from "@/lib/read-json";
import { getCurrentUser } from "@/lib/auth/current-user";
import { shareCreateSchema } from "@/lib/validation/share";
import { generateOtp, generateShareToken } from "@/lib/crypto/random";
import { createOtpVerifier, hashShareToken } from "@/lib/share/server";
import { checkRateLimit, RATE_LIMITS, tooManyRequests } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await checkRateLimit(RATE_LIMITS.shareCreate, user.id))) {
    return tooManyRequests(RATE_LIMITS.shareCreate);
  }

  const body = await readJson(request);
  const parsed = shareCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { credentialId, expiresInMinutes, destroyOnOpen, encryptedPayload, payloadIv, payloadSalt } = parsed.data;

  // Can only share your own credential -- same not-found for missing and
  // not-yours so ids can't be probed.
  const credential = await db.credential.findFirst({
    where: { id: credentialId, userId: user.id },
    select: { id: true },
  });
  if (!credential) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Token and OTP are generated server-side so a client can't pick weak
  // ones. Only their verifiers are stored; the raw values are returned
  // exactly once, in this response, and never logged.
  const token = generateShareToken();
  const otp = generateOtp();
  const tokenHash = hashShareToken(token);
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60_000);

  const share = await db.share.create({
    data: {
      credentialId,
      userId: user.id,
      tokenHash,
      otpVerifier: createOtpVerifier(tokenHash, otp),
      encryptedPayload,
      payloadIv,
      payloadSalt,
      destroyOnOpen,
      expiresAt,
    },
    select: { id: true, expiresAt: true },
  });

  // Opportunistic cleanup: drop ciphertext from this user's dead shares so
  // it doesn't sit in the database after it can no longer be redeemed.
  await db.share.updateMany({
    where: { userId: user.id, expiresAt: { lt: new Date() }, encryptedPayload: { not: "" } },
    data: { encryptedPayload: "" },
  });

  await logAudit(user.id, "share.create", {
    targetId: share.id,
    detail: destroyOnOpen ? "destroy on open" : `expires in ${expiresInMinutes} min`,
  });
  return NextResponse.json({ share: { ...share, token, otp } }, { status: 201 });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { checkRateLimit, RATE_LIMITS, tooManyRequests } from "@/lib/rate-limit";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await checkRateLimit(RATE_LIMITS.read, user.id))) return tooManyRequests(RATE_LIMITS.read);

  // Status metadata only -- never verifiers or ciphertext. The credential
  // name is encrypted, so the client maps credentialId to a decrypted name.
  const shares = await db.share.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      credentialId: true,
      destroyOnOpen: true,
      expiresAt: true,
      usedAt: true,
      revokedAt: true,
      failedAttempts: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ shares });
}

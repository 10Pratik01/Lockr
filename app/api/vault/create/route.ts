import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { credentialInputSchema } from "@/lib/validation/vault";
import { checkRateLimit, RATE_LIMITS, tooManyRequests } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await checkRateLimit(RATE_LIMITS.credentialWrite, user.id))) {
    return tooManyRequests(RATE_LIMITS.credentialWrite);
  }

  const body = await request.json().catch(() => null);
  const parsed = credentialInputSchema.safeParse(body);
  if (!parsed.success) {
    // Generic message -- never echo back which field or why, per the
    // "no sensitive info in errors" rule; details go to server logs only,
    // and even there, never the payload itself.
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const credential = await db.credential.create({
    data: {
      userId: user.id,
      encryptedData: parsed.data.encryptedData,
      iv: parsed.data.iv,
    },
    select: { id: true, encryptedData: true, iv: true, createdAt: true, updatedAt: true },
  });

  await logAudit(user.id, "credential.create", { targetId: credential.id });
  return NextResponse.json({ credential }, { status: 201 });
}
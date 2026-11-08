import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { readJson } from "@/lib/read-json";
import { getCurrentUser } from "@/lib/auth/current-user";
import { credentialInputSchema, MAX_CREDENTIALS } from "@/lib/validation/vault";
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

  const body = await readJson(request);
  const parsed = credentialInputSchema.safeParse(body);
  if (!parsed.success) {
    // Generic message -- never echo back which field or why, per the
    // "no sensitive info in errors" rule; details go to server logs only,
    // and even there, never the payload itself.
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if ((await db.credential.count({ where: { userId: user.id } })) >= MAX_CREDENTIALS) {
    return NextResponse.json({ error: "Credential limit reached" }, { status: 409 });
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
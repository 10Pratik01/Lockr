import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { readJson } from "@/lib/read-json";
import { getCurrentUser } from "@/lib/auth/current-user";
import { shareRevokeSchema } from "@/lib/validation/share";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await readJson(request);
  const parsed = shareRevokeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  // Ownership and "still active" in one atomic WHERE; the ciphertext is
  // wiped in the same write.
  const { count } = await db.share.updateMany({
    where: { id: parsed.data.id, userId: user.id, usedAt: null, revokedAt: null },
    data: { revokedAt: new Date(), encryptedPayload: "" },
  });

  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await logAudit(user.id, "share.revoke", { targetId: parsed.data.id });
  return NextResponse.json({ success: true });
}

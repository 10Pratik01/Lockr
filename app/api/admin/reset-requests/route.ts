import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth/admin";
import { resetDecisionSchema, RESET_APPROVAL_HOURS } from "@/lib/validation/admin";
import { checkRateLimit, RATE_LIMITS, tooManyRequests } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

// Admin decision on a pending reset request. 404 (not 403) for non-admins
// so the endpoint's existence isn't confirmed.
export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await checkRateLimit(RATE_LIMITS.adminAction, admin.id))) return tooManyRequests(RATE_LIMITS.adminAction);

  const body = await request.json().catch(() => null);
  const parsed = resetDecisionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { id, decision } = parsed.data;

  const target = await db.passphraseResetRequest.findFirst({ where: { id }, select: { userId: true } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date();
  // Only a still-PENDING request can be decided, atomically -- two admins
  // clicking at once yields one winner.
  const { count } = await db.passphraseResetRequest.updateMany({
    where: { id, status: "PENDING" },
    data:
      decision === "approve"
        ? { status: "APPROVED", decidedAt: now, decidedBy: admin.id, expiresAt: new Date(now.getTime() + RESET_APPROVAL_HOURS * 3_600_000) }
        : { status: "DENIED", decidedAt: now, decidedBy: admin.id },
  });
  if (count === 0) return NextResponse.json({ error: "Request is no longer pending" }, { status: 409 });

  await logAudit(target.userId, decision === "approve" ? "reset.approve" : "reset.deny", {
    actorId: admin.id,
    targetId: id,
  });
  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { readJson } from "@/lib/read-json";
import { getCurrentUser } from "@/lib/auth/current-user";
import { clientAuditSchema } from "@/lib/validation/admin";
import { checkRateLimit, RATE_LIMITS, tooManyRequests } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

// Events only the browser can see (unlock, lock, reveal, copy). The action
// is an allowlist, and a credential id is only kept if it is the caller's.
// These are client-reported, so they're a convenience trail -- the server-side
// events (writes, shares, resets) are the authoritative record.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await checkRateLimit(RATE_LIMITS.auditEvent, user.id))) return tooManyRequests(RATE_LIMITS.auditEvent);

  const body = await readJson(request);
  const parsed = clientAuditSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  let targetId: string | undefined;
  if (parsed.data.targetId) {
    const owned = await db.credential.findFirst({
      where: { id: parsed.data.targetId, userId: user.id },
      select: { id: true },
    });
    targetId = owned?.id;
  }
  await logAudit(user.id, parsed.data.action, { targetId });
  return NextResponse.json({ success: true }, { status: 201 });
}

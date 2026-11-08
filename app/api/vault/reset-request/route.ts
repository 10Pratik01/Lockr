import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { readJson } from "@/lib/read-json";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resetRequestSchema } from "@/lib/validation/admin";
import { checkRateLimit, RATE_LIMITS, tooManyRequests } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const SELECT = { id: true, status: true, createdAt: true, decidedAt: true, expiresAt: true } as const;

// The user's most recent request, so Settings / the unlock screen can show
// "waiting for admin" or "approved -- reset now". An approval past its expiry
// is reported as expired rather than usable.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!(await checkRateLimit(RATE_LIMITS.read, user.id))) return tooManyRequests(RATE_LIMITS.read);
  const rows = await db.passphraseResetRequest.findMany({
    where: { userId: user.id },
    select: SELECT,
    orderBy: { createdAt: "desc" },
    take: 1,
  });
  const latest = rows[0] ?? null;
  const expired = latest?.status === "APPROVED" && latest.expiresAt && latest.expiresAt < new Date();
  return NextResponse.json({ request: latest ? { ...latest, status: expired ? "EXPIRED" : latest.status } : null });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!(await checkRateLimit(RATE_LIMITS.resetRequest, user.id))) return tooManyRequests(RATE_LIMITS.resetRequest);

  const body = ((await readJson(request)) ?? {});
  const parsed = resetRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  // One open request at a time: refuse while a PENDING or still-valid
  // APPROVED one exists, so the admin queue can't be flooded.
  const open = await db.passphraseResetRequest.findFirst({
    where: { userId: user.id, status: "PENDING" },
    select: { id: true },
  });
  const approved = await db.passphraseResetRequest.findFirst({
    where: { userId: user.id, status: "APPROVED", expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  if (open || approved) return NextResponse.json({ error: "You already have an open request" }, { status: 409 });

  // The pre-checks above give a friendly 409, but two simultaneous requests can
  // both pass them. A partial unique index (one PENDING row per user, see the
  // migration) makes the database the real gate; the loser gets the same 409.
  let created;
  try {
    created = await db.passphraseResetRequest.create({
      data: { userId: user.id, reason: parsed.data.reason || null },
      select: SELECT,
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "You already have an open request" }, { status: 409 });
    }
    throw err;
  }
  await logAudit(user.id, "reset.request", { targetId: created.id });
  return NextResponse.json({ request: created }, { status: 201 });
}

// Withdraw a still-pending request (e.g. the user remembered).
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { count } = await db.passphraseResetRequest.updateMany({
    where: { userId: user.id, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await logAudit(user.id, "reset.cancel");
  return NextResponse.json({ success: true });
}

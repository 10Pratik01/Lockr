import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { credentialInputSchema } from "@/lib/validation/vault";
import { checkRateLimit, RATE_LIMITS, tooManyRequests } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Factories, not shared constants -- a Response body can only be read
// once, so each request needs its own instance.
const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });
const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await params;

  // Ownership is part of the WHERE clause, not a separate check --
  // a wrong id and someone else's id both come back as the identical
  // "Not found" below, so neither response leaks which case occurred.
  const credential = await db.credential.findFirst({
    where: { id, userId: user.id },
    select: { id: true, encryptedData: true, iv: true, createdAt: true, updatedAt: true },
  });

  if (!credential) return notFound();
  return NextResponse.json({ credential });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!(await checkRateLimit(RATE_LIMITS.credentialWrite, user.id))) {
    return tooManyRequests(RATE_LIMITS.credentialWrite);
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = credentialInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // updateMany with { id, userId } in the same WHERE makes the ownership
  // check and the write a single atomic operation -- there's no gap
  // between "check ownership" and "apply the update" for a race to land in.
  const { count } = await db.credential.updateMany({
    where: { id, userId: user.id },
    data: { encryptedData: parsed.data.encryptedData, iv: parsed.data.iv },
  });

  if (count === 0) return notFound();
  await logAudit(user.id, "credential.update", { targetId: id });

  const credential = await db.credential.findFirst({
    where: { id, userId: user.id },
    select: { id: true, encryptedData: true, iv: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json({ credential });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!(await checkRateLimit(RATE_LIMITS.credentialWrite, user.id))) {
    return tooManyRequests(RATE_LIMITS.credentialWrite);
  }

  const { id } = await params;

  const { count } = await db.credential.deleteMany({
    where: { id, userId: user.id },
  });

  if (count === 0) return notFound();
  await logAudit(user.id, "credential.delete", { targetId: id });
  return NextResponse.json({ success: true });
}
import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { credentialInputSchema } from "@/lib/validation/vault";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const NOT_FOUND = NextResponse.json({ error: "Not found" }, { status: 404 });
const UNAUTHORIZED = NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return UNAUTHORIZED;

  const { id } = await params;

  // Ownership is part of the WHERE clause, not a separate check --
  // a wrong id and someone else's id both come back as the identical
  // "Not found" below, so neither response leaks which case occurred.
  const credential = await db.credential.findFirst({
    where: { id, userId: user.id },
    select: { id: true, encryptedData: true, iv: true, createdAt: true, updatedAt: true },
  });

  if (!credential) return NOT_FOUND;
  return NextResponse.json({ credential });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return UNAUTHORIZED;

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

  if (count === 0) return NOT_FOUND;

  const credential = await db.credential.findFirst({
    where: { id, userId: user.id },
    select: { id: true, encryptedData: true, iv: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json({ credential });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return UNAUTHORIZED;

  const { id } = await params;

  const { count } = await db.credential.deleteMany({
    where: { id, userId: user.id },
  });

  if (count === 0) return NOT_FOUND;
  return NextResponse.json({ success: true });
}
import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const credentials = await db.credential.findMany({
    where: { userId: user.id }, // scoped to this user -- never a client-supplied filter
    orderBy: { createdAt: "desc" },
    select: { id: true, encryptedData: true, iv: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json({ credentials });
}
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { isAdminClerkId } from "@/lib/auth/admin";

// Polled by the nav bar to show the admin a "requests waiting" badge.
// Always 200 so ordinary users don't generate console errors; they just
// get isAdmin:false and no data.
export async function GET() {
  const { userId, isAuthenticated } = await auth();
  if (!isAuthenticated || !isAdminClerkId(userId)) return NextResponse.json({ isAdmin: false, pending: 0 });
  const pending = await db.passphraseResetRequest.count({ where: { status: "PENDING" } });
  return NextResponse.json({ isAdmin: true, pending });
}

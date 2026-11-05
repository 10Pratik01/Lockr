import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import type { User } from "../../generated/prisma/client";

/** Admins are listed by Clerk user id in env. Unset/empty => nobody (fails closed). */
export function isAdminClerkId(clerkUserId: string | null | undefined): boolean {
  if (!clerkUserId) return false;
  return (process.env.ADMIN_CLERK_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .includes(clerkUserId);
}

/** API guard: the signed-in admin's User row, or null for everyone else. */
export async function getAdminUser(): Promise<User | null> {
  const { userId: clerkUserId, isAuthenticated } = await auth();
  if (!isAuthenticated || !isAdminClerkId(clerkUserId)) return null;
  return db.user.upsert({ where: { clerkUserId: clerkUserId! }, update: {}, create: { clerkUserId: clerkUserId! } });
}

/** Page guard: non-admins get a 404 so /admin's existence isn't advertised. */
export async function requireAdminPage(): Promise<void> {
  const { userId, isAuthenticated, redirectToSignIn } = await auth();
  if (!isAuthenticated) redirectToSignIn();
  if (!isAdminClerkId(userId)) notFound();
}

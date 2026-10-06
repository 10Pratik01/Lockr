import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import type { User } from "../../generated/prisma/client";
 
/**
 * Resolves the authenticated Clerk session to our application's User row,
 * creating it on first sight (lazy provisioning -- a Clerk webhook on
 * `user.created` is a fine upgrade later, this just avoids requiring one
 * before the vault works at all).
 *
 * Every API route calls this instead of ever trusting a client-supplied
 * user id -- see Coding Rule #9: never trust a client-provided user id.
 */
export async function getCurrentUser(): Promise<User | null> {
  const { userId: clerkUserId, isAuthenticated } = await auth();
 
  if (!isAuthenticated || !clerkUserId) {
    return null;
  }
 
  return db.user.upsert({
    where: { clerkUserId },
    update: {},
    create: { clerkUserId },
  });
}
 

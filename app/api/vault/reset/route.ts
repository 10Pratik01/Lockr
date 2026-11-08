import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { readJson } from "@/lib/read-json";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resetExecuteSchema } from "@/lib/validation/admin";
import { checkRateLimit, RATE_LIMITS, tooManyRequests } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

// Executes an admin-approved reset. The vault is zero-knowledge: the old
// passphrase can't be recovered or replaced, because it wraps the key that
// encrypts every credential. The only thing an approval can authorise is
// wiping the vault key AND the credentials it protected (shares cascade),
// after which the user sets up a fresh vault with a new passphrase.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await checkRateLimit(RATE_LIMITS.resetExecute, user.id))) return tooManyRequests(RATE_LIMITS.resetExecute);

  const body = await readJson(request);
  if (!resetExecuteSchema.safeParse(body).success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // One transaction: the approval is consumed (atomically, single-use --
  // ownership, status and expiry are all in the WHERE, so a replay or a second
  // tab finds nothing) AND the data is wiped, or none of it happens. A failure
  // half-way can't leave a spent approval next to an untouched or half-wiped vault.
  const wiped = await db.$transaction(async (tx) => {
    const consumed = await tx.passphraseResetRequest.updateMany({
      where: { userId: user.id, status: "APPROVED", expiresAt: { gt: new Date() } },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    if (consumed.count === 0) return null;
    const creds = await tx.credential.deleteMany({ where: { userId: user.id } });
    await tx.vault.deleteMany({ where: { userId: user.id } });
    return creds.count;
  });
  if (wiped === null) return NextResponse.json({ error: "No approved reset request" }, { status: 403 });

  await logAudit(user.id, "vault.reset", { detail: `${wiped} credentials wiped` });
  return NextResponse.json({ success: true });
}

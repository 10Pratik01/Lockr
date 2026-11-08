// Append-only activity trail. Records WHAT happened and to WHICH record --
// never secrets, ciphertext, passphrases or raw IPs.
import { db } from "@/lib/prisma";
import { randomInt } from "@/lib/crypto/random";
import type { AuditAction } from "@/lib/audit-actions";

interface AuditOptions {
  actorId?: string;
  targetId?: string;
  detail?: string;
}

// Rows older than this are deleted. Without a limit the table only grows.
const RETENTION_DAYS = 90;

/**
 * Best-effort: a failing audit write must never break the user's action, so
 * errors are swallowed (logged without payload). Awaited by callers because a
 * fire-and-forget promise can be dropped when a serverless response returns.
 */
export async function logAudit(userId: string, action: AuditAction, opts: AuditOptions = {}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId,
        action,
        actorId: opts.actorId && opts.actorId !== userId ? opts.actorId : null,
        targetId: opts.targetId ?? null,
        detail: opts.detail?.slice(0, 200) ?? null,
      },
      select: { id: true },
    });
    // Occasional cleanup (~1% of writes) keeps the table bounded without a cron
    // job.
    if (randomInt(100) === 0) {
      await db.auditLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - RETENTION_DAYS * 86_400_000) } } });
    }
  } catch {
    console.warn("Audit log write failed (has the AuditLog migration been applied?)");
  }
}

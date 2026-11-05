-- CreateEnum
CREATE TYPE "ResetStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "PassphraseResetRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ResetStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "expiresAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PassphraseResetRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PassphraseResetRequest_status_createdAt_idx" ON "PassphraseResetRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PassphraseResetRequest_userId_createdAt_idx" ON "PassphraseResetRequest"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "PassphraseResetRequest" ADD CONSTRAINT "PassphraseResetRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- At most one PENDING reset request per user (Prisma can't express a partial
-- unique index in schema.prisma, so it lives only here). Closes the
-- check-then-insert race when a request is submitted twice at once.
CREATE UNIQUE INDEX "PassphraseResetRequest_one_pending_per_user" ON "PassphraseResetRequest"("userId") WHERE "status" = 'PENDING';

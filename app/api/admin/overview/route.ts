import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth/admin";
import { AUDIT_ACTIONS } from "@/lib/audit-actions";

const USERS_PAGE_SIZE = 50;
const CLERK_BATCH = 100;

// Everything the /admin page shows. No ciphertext, wrapped keys or share
// material is selected -- admins see accounts and activity, never secrets.
export async function GET(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(request.url);
  const userFilter = url.searchParams.get("user")?.slice(0, 64) || undefined;
  const actionFilter = url.searchParams.get("action") ?? undefined;
  const validAction = actionFilter && actionFilter in AUDIT_ACTIONS ? actionFilter : undefined;
  const page = Math.max(0, Math.min(10_000, Number(url.searchParams.get("usersPage")) || 0));

  const [users, usersTotal, requests, logs] = await Promise.all([
    db.user.findMany({
      select: { id: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      skip: page * USERS_PAGE_SIZE,
      take: USERS_PAGE_SIZE,
    }),
    db.user.count(),
    db.passphraseResetRequest.findMany({
      select: { id: true, userId: true, status: true, reason: true, createdAt: true, decidedAt: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.auditLog.findMany({
      where: { ...(userFilter && { userId: userFilter }), ...(validAction && { action: validAction }) },
      select: { id: true, userId: true, actorId: true, action: true, detail: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  // Per-user counts for the visible page only, done in the database.
  const pageIds = users.map((u) => u.id);
  const [credCounts, shareCounts, vaults] = await Promise.all([
    db.credential.groupBy({ by: ["userId"], where: { userId: { in: pageIds } }, _count: { _all: true } }),
    db.share.groupBy({ by: ["userId"], where: { userId: { in: pageIds } }, _count: { _all: true } }),
    db.vault.findMany({ where: { userId: { in: pageIds } }, select: { userId: true } }),
  ]);
  const credCount = new Map(credCounts.map((r) => [r.userId, r._count._all]));
  const shareCount = new Map(shareCounts.map((r) => [r.userId, r._count._all]));
  const hasVault = new Set(vaults.map((v) => v.userId));

  // Names for every account that appears anywhere on the page -- users, request
  // owners, log subjects, admin actors, the active filter -- not just the
  // first page of users.
  const wanted = new Set<string>(pageIds);
  requests.forEach((r) => wanted.add(r.userId));
  logs.forEach((l) => {
    wanted.add(l.userId);
    if (l.actorId) wanted.add(l.actorId);
  });
  if (userFilter) wanted.add(userFilter);
  const accounts = await db.user.findMany({
    where: { id: { in: [...wanted] } },
    select: { id: true, clerkUserId: true },
  });

  // Friendly labels from Clerk in batches; fall back to the raw id if Clerk is unreachable.
  const clerkLabel = new Map<string, string>();
  try {
    const clerk = await clerkClient();
    const chunks: string[][] = [];
    for (let i = 0; i < accounts.length; i += CLERK_BATCH) {
      chunks.push(accounts.slice(i, i + CLERK_BATCH).map((a) => a.clerkUserId));
    }
    const results = await Promise.all(chunks.map((ids) => clerk.users.getUserList({ userId: ids, limit: CLERK_BATCH })));
    for (const { data } of results) {
      for (const u of data) {
        clerkLabel.set(
          u.id,
          u.primaryEmailAddress?.emailAddress ?? ([u.firstName, u.lastName].filter(Boolean).join(" ") || u.id)
        );
      }
    }
  } catch {
    // labels fall back to the Clerk id
  }
  const labelOf = new Map(accounts.map((a) => [a.id, clerkLabel.get(a.clerkUserId) ?? a.clerkUserId]));

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      label: labelOf.get(u.id),
      createdAt: u.createdAt,
      hasVault: hasVault.has(u.id),
      credentials: credCount.get(u.id) ?? 0,
      shares: shareCount.get(u.id) ?? 0,
    })),
    usersTotal,
    usersPage: page,
    usersPageSize: USERS_PAGE_SIZE,
    filterLabel: userFilter ? (labelOf.get(userFilter) ?? "Unknown user") : null,
    requests: requests.map((r) => ({ ...r, userLabel: labelOf.get(r.userId) ?? "Deleted user" })),
    logs: logs.map((l) => ({
      ...l,
      label: AUDIT_ACTIONS[l.action as keyof typeof AUDIT_ACTIONS] ?? l.action,
      userLabel: labelOf.get(l.userId) ?? "Deleted user",
      actorLabel: l.actorId ? (labelOf.get(l.actorId) ?? "Admin") : null,
    })),
  });
}

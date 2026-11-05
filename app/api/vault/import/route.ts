import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { credentialImportSchema } from "@/lib/validation/vault";
import { checkRateLimit, RATE_LIMITS, tooManyRequests } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

// Bulk create for CSV import. Each item is already encrypted client-side, so
// this is the same opaque-blob contract as /api/vault/create, just batched.
// createMany is a single statement: a batch lands entirely or not at all.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await checkRateLimit(RATE_LIMITS.credentialImport, user.id))) {
    return tooManyRequests(RATE_LIMITS.credentialImport);
  }

  const body = await request.json().catch(() => null);
  const parsed = credentialImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { count } = await db.credential.createMany({
    data: parsed.data.items.map((item) => ({
      userId: user.id,
      encryptedData: item.encryptedData,
      iv: item.iv,
    })),
  });

  await logAudit(user.id, "credential.import", { detail: `${count} credentials` });
  return NextResponse.json({ imported: count }, { status: 201 });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { readJson } from "@/lib/read-json";
import { getCurrentUser } from "@/lib/auth/current-user";
import { vaultKeyChangeSchema, vaultKeySchema } from "@/lib/validation/vault";
import { checkRateLimit, RATE_LIMITS, tooManyRequests } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const invalid = () => NextResponse.json({ error: "Invalid request" }, { status: 400 });

const VAULT_KEY_SELECT = {
  kdfSalt: true,
  kdfMemoryCost: true,
  kdfTimeCost: true,
  kdfParallelism: true,
  wrappedVaultKey: true,
  wrappedVaultKeyIv: true,
} as const;

// Returns only the wrapped key + KDF params -- useless without the
// passphrase, which never leaves the browser.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!(await checkRateLimit(RATE_LIMITS.read, user.id))) return tooManyRequests(RATE_LIMITS.read);

  const vault = await db.vault.findUnique({
    where: { userId: user.id },
    select: VAULT_KEY_SELECT,
  });

  // "No vault yet" is a normal state for a new account, not an error --
  // 200 with null keeps it out of the browser console as a failed request.
  return NextResponse.json({ vault });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!(await checkRateLimit(RATE_LIMITS.vaultKeyWrite, user.id))) {
    return tooManyRequests(RATE_LIMITS.vaultKeyWrite);
  }

  const body = await readJson(request);
  const parsed = vaultKeySchema.safeParse(body);
  if (!parsed.success) return invalid();

  // createMany + skipDuplicates against the unique userId is a single
  // statement: a second setup (double submit, second tab) is a no-op
  // instead of silently replacing the key every credential depends on.
  const { count } = await db.vault.createMany({
    data: [{ userId: user.id, ...parsed.data }],
    skipDuplicates: true,
  });

  if (count === 0) {
    return NextResponse.json({ error: "Vault already exists" }, { status: 409 });
  }
  await logAudit(user.id, "vault.setup");
  return NextResponse.json({ vault: parsed.data }, { status: 201 });
}

// Passphrase change: the client unwraps the DEK with the old passphrase and
// re-wraps it under a new KEK. Credentials are never touched.
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!(await checkRateLimit(RATE_LIMITS.vaultKeyWrite, user.id))) {
    return tooManyRequests(RATE_LIMITS.vaultKeyWrite);
  }

  const body = await readJson(request);
  const parsed = vaultKeyChangeSchema.safeParse(body);
  if (!parsed.success) return invalid();

  const { previousWrappedVaultKey, ...next } = parsed.data;

  // Compare-and-swap: only replaces the key the client actually unwrapped.
  const { count } = await db.vault.updateMany({
    where: { userId: user.id, wrappedVaultKey: previousWrappedVaultKey },
    data: next,
  });

  if (count === 0) {
    return NextResponse.json({ error: "Vault key has changed; unlock again" }, { status: 409 });
  }
  await logAudit(user.id, "vault.passphrase_changed");
  return NextResponse.json({ vault: next });
}

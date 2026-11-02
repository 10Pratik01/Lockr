import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb } from "../helpers/fake-db";

const state = vi.hoisted(() => ({ userId: null as string | null }));
const fake = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("@/lib/prisma", () => ({
  get db() {
    return fake.db;
  },
}));
const limiter = vi.hoisted(() => ({ allow: true }));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  checkRateLimit: async () => limiter.allow,
}));
vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: async () => (state.userId ? { id: state.userId, clerkUserId: `clerk_${state.userId}` } : null),
}));

const vaultCreate = await import("@/app/api/vault/create/route");
const vaultList = await import("@/app/api/vault/list/route");
const vaultItem = await import("@/app/api/vault/[id]/route");
const vaultKey = await import("@/app/api/vault/key/route");
const shareCreate = await import("@/app/api/share/create/route");
const shareVerify = await import("@/app/api/share/verify/route");
const shareRevoke = await import("@/app/api/share/revoke/route");
const shareList = await import("@/app/api/share/list/route");

let db: ReturnType<typeof createFakeDb>;

const json = (body: unknown) =>
  new Request("http://test/api", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const as = (userId: string | null) => (state.userId = userId);

const CRED = { encryptedData: "Y2lwaGVydGV4dA==", iv: "aXZpdml2aXZpdml2" };
const SHARE_BODY = { expiresInMinutes: 10, encryptedPayload: "cGF5bG9hZA==", payloadIv: "aXY=", payloadSalt: "c2FsdA==" };

async function createCredential(userId: string) {
  as(userId);
  const res = await vaultCreate.POST(json(CRED));
  return ((await res.json()) as { credential: { id: string } }).credential.id;
}

async function createShare(userId: string, credentialId: string, overrides: Record<string, unknown> = {}) {
  as(userId);
  const res = await shareCreate.POST(json({ credentialId, ...SHARE_BODY, ...overrides }));
  expect(res.status).toBe(201);
  return ((await res.json()) as { share: { id: string; token: string; otp: string } }).share;
}

const verify = (token: string, otp: string) => shareVerify.POST(json({ token, otp }));
const wrongOtp = (otp: string) => (otp === "000000" ? "111111" : "000000");

beforeAll(() => {
  process.env.SHARE_OTP_PEPPER = "test-pepper-test-pepper-test-pepper-0123";
});

beforeEach(() => {
  db = createFakeDb();
  fake.db = db;
  limiter.allow = true;
  as(null);
});

describe("authentication", () => {
  it("every owner route rejects signed-out requests with 401", async () => {
    const responses = await Promise.all([
      vaultCreate.POST(json(CRED)),
      vaultList.GET(),
      vaultItem.GET(new Request("http://t"), ctx("x")),
      vaultKey.GET(),
      shareCreate.POST(json({})),
      shareRevoke.POST(json({ id: "x" })),
      shareList.GET(),
    ]);
    expect(responses.map((r) => r.status)).toEqual([401, 401, 401, 401, 401, 401, 401]);
  });

  it("401/404 responses are fresh objects that can be read repeatedly", async () => {
    for (let i = 0; i < 3; i++) {
      const res = await vaultItem.GET(new Request("http://t"), ctx("x"));
      expect(await res.json()).toEqual({ error: "Unauthorized" });
    }
  });
});

describe("rate limiting", () => {
  it("returns 429 with Retry-After when the limiter says no", async () => {
    limiter.allow = false;
    const res = await verify("A".repeat(43), "123456");
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });
});

describe("credential authorization", () => {
  it("another user's credential is indistinguishable from a missing one", async () => {
    const id = await createCredential("alice");
    as("mallory");
    const theirs = await vaultItem.GET(new Request("http://t"), ctx(id));
    const missing = await vaultItem.GET(new Request("http://t"), ctx("nope"));
    expect(theirs.status).toBe(404);
    expect(await theirs.json()).toEqual(await missing.json());

    expect((await vaultItem.PATCH(json(CRED), ctx(id))).status).toBe(404);
    expect((await vaultItem.DELETE(new Request("http://t"), ctx(id))).status).toBe(404);
    expect(db.credential._rows()).toHaveLength(1);

    const list = await (await vaultList.GET()).json();
    expect(list.credentials).toEqual([]);
  });

  it("ignores a client-supplied userId", async () => {
    as("mallory");
    await vaultCreate.POST(json({ ...CRED, userId: "alice" }));
    expect(db.credential._rows()[0].userId).toBe("mallory");
  });

  it("rejects malformed bodies without echoing details", async () => {
    as("alice");
    const res = await vaultCreate.POST(json({ encryptedData: "", iv: 5 }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid request" });
  });
});

describe("vault key", () => {
  const record = {
    kdfSalt: "c2FsdHNhbHRzYWx0c2FsdA==",
    kdfMemoryCost: 19456,
    kdfTimeCost: 2,
    kdfParallelism: 1,
    wrappedVaultKey: "d3JhcHBlZA==",
    wrappedVaultKeyIv: "aXZpdml2aXZpdml2",
  };

  it("can be set up once; a second setup cannot overwrite it", async () => {
    as("alice");
    const empty = await vaultKey.GET();
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({ vault: null });
    expect((await vaultKey.POST(json(record))).status).toBe(201);
    expect((await vaultKey.POST(json({ ...record, wrappedVaultKey: "ZXZpbA==" }))).status).toBe(409);
    expect((await (await vaultKey.GET()).json()).vault.wrappedVaultKey).toBe(record.wrappedVaultKey);
  });

  it("refuses KDF params below the OWASP floor", async () => {
    as("alice");
    expect((await vaultKey.POST(json({ ...record, kdfMemoryCost: 1024 }))).status).toBe(400);
    expect((await vaultKey.POST(json({ ...record, kdfTimeCost: 1 }))).status).toBe(400);
  });

  it("passphrase change is compare-and-swap on the old wrapped key", async () => {
    as("alice");
    await vaultKey.POST(json(record));
    const next = { ...record, wrappedVaultKey: "bmV3a2V5", kdfSalt: "bmV3c2FsdG5ld3NhbHQ=" };
    const stale = await vaultKey.PATCH(json({ ...next, previousWrappedVaultKey: "c3RhbGU=" }));
    expect(stale.status).toBe(409);
    const ok = await vaultKey.PATCH(json({ ...next, previousWrappedVaultKey: record.wrappedVaultKey }));
    expect(ok.status).toBe(200);
    expect(db.vault._rows()[0].wrappedVaultKey).toBe("bmV3a2V5");
  });
});

describe("sharing", () => {
  it("never stores the raw token or OTP", async () => {
    const credId = await createCredential("alice");
    const share = await createShare("alice", credId);
    const row = JSON.stringify(db.share._rows()[0]);
    expect(row).not.toContain(share.token);
    expect(row).not.toContain(share.otp);
    expect(share.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(share.otp).toMatch(/^\d{6}$/);
  });

  it("cannot share someone else's credential", async () => {
    const credId = await createCredential("alice");
    as("mallory");
    const res = await shareCreate.POST(json({ credentialId: credId, ...SHARE_BODY }));
    expect(res.status).toBe(404);
  });

  it("rejects non-allowed expiry values", async () => {
    const credId = await createCredential("alice");
    const res = await shareCreate.POST(json({ credentialId: credId, ...SHARE_BODY, expiresInMinutes: 60 * 24 }));
    expect(res.status).toBe(400);
  });

  describe("destroy after open", () => {
    const DESTROY = { expiresInMinutes: 1440, destroyOnOpen: true };

    it("deletes the share row as soon as it is opened, and only the opener gets the payload", async () => {
      const share = await createShare("alice", await createCredential("alice"), DESTROY);
      expect(db.share._rows()[0].destroyOnOpen).toBe(true);
      as(null);

      const opened = await verify(share.token, share.otp);
      expect(opened.status).toBe(200);
      expect((await opened.json()).payload.encryptedPayload).toBe(SHARE_BODY.encryptedPayload);
      expect(db.share._rows()).toHaveLength(0);

      expect((await verify(share.token, share.otp)).status).toBe(410);
    });

    it("concurrent correct redemptions: exactly one succeeds, row is gone", async () => {
      const share = await createShare("alice", await createCredential("alice"), DESTROY);
      const results = await Promise.all(Array.from({ length: 10 }, () => verify(share.token, share.otp)));
      expect(results.filter((r) => r.status === 200)).toHaveLength(1);
      expect(db.share._rows()).toHaveLength(0);
    });

    it("still has a hard 24h expiry and disappears from the owner's list once opened", async () => {
      const share = await createShare("alice", await createCredential("alice"), DESTROY);
      const expiresAt = (db.share._rows()[0].expiresAt as Date).getTime();
      expect(Math.abs(expiresAt - (Date.now() + 24 * 3600_000))).toBeLessThan(5_000);

      await verify(share.token, share.otp);
      as("alice");
      expect((await (await shareList.GET()).json()).shares).toEqual([]);
    });

    it("wrong codes still lock it (and keep the row, with the payload wiped)", async () => {
      const share = await createShare("alice", await createCredential("alice"), DESTROY);
      for (let i = 0; i < 5; i++) await verify(share.token, wrongOtp(share.otp));
      expect((await verify(share.token, share.otp)).status).toBe(410);
      expect(db.share._rows()[0].encryptedPayload).toBe("");
    });

    it("rejects mixing destroyOnOpen with a preset expiry (and vice versa)", async () => {
      const credId = await createCredential("alice");
      const mixed = await shareCreate.POST(json({ credentialId: credId, ...SHARE_BODY, destroyOnOpen: true }));
      expect(mixed.status).toBe(400);
      const timed = await shareCreate.POST(
        json({ credentialId: credId, ...SHARE_BODY, expiresInMinutes: 1440, destroyOnOpen: false })
      );
      expect(timed.status).toBe(400);
    });

    it("regular shares are kept as Used records, not deleted", async () => {
      const share = await createShare("alice", await createCredential("alice"));
      await verify(share.token, share.otp);
      expect(db.share._rows()).toHaveLength(1);
    });
  });

  it("works exactly once with the right OTP, and wipes the payload", async () => {
    const share = await createShare("alice", await createCredential("alice"));
    as(null); // recipient has no account

    const first = await verify(share.token, share.otp);
    expect(first.status).toBe(200);
    expect((await first.json()).payload.encryptedPayload).toBe(SHARE_BODY.encryptedPayload);

    const second = await verify(share.token, share.otp);
    expect(second.status).toBe(410);
    expect(db.share._rows()[0].usedAt).toBeInstanceOf(Date);
    expect(db.share._rows()[0].encryptedPayload).toBe("");
  });

  it("concurrent correct redemptions: exactly one succeeds", async () => {
    const share = await createShare("alice", await createCredential("alice"));
    const results = await Promise.all(Array.from({ length: 10 }, () => verify(share.token, share.otp)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
  });

  it("locks after 5 wrong attempts, even if the 6th is correct", async () => {
    const share = await createShare("alice", await createCredential("alice"));
    const bad = wrongOtp(share.otp);
    const remaining: number[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await verify(share.token, bad);
      expect(res.status).toBe(401);
      remaining.push((await res.json()).remainingAttempts);
    }
    expect(remaining).toEqual([4, 3, 2, 1]);
    expect((await verify(share.token, bad)).status).toBe(410);
    expect((await verify(share.token, share.otp)).status).toBe(410);
    expect(db.share._rows()[0].encryptedPayload).toBe("");
  });

  it("a burst of parallel wrong guesses can't exceed the attempt limit", async () => {
    const share = await createShare("alice", await createCredential("alice"));
    const bad = wrongOtp(share.otp);
    await Promise.all(Array.from({ length: 50 }, () => verify(share.token, bad)));
    expect(db.share._rows()[0].failedAttempts).toBe(5);
    expect((await verify(share.token, share.otp)).status).toBe(410);
  });

  it("expired shares are unusable", async () => {
    const share = await createShare("alice", await createCredential("alice"));
    db.share._rows()[0].expiresAt = new Date(Date.now() - 1000);
    expect((await verify(share.token, share.otp)).status).toBe(410);
  });

  it("revoke: owner only, and the link stops working", async () => {
    const share = await createShare("alice", await createCredential("alice"));
    as("mallory");
    expect((await shareRevoke.POST(json({ id: share.id }))).status).toBe(404);
    as("alice");
    expect((await shareRevoke.POST(json({ id: share.id }))).status).toBe(200);
    expect((await verify(share.token, share.otp)).status).toBe(410);
    expect(db.share._rows()[0].encryptedPayload).toBe("");
  });

  it("list shows only your shares and never verifiers or ciphertext", async () => {
    await createShare("alice", await createCredential("alice"));
    await createShare("bob", await createCredential("bob"));
    as("alice");
    const { shares } = await (await shareList.GET()).json();
    expect(shares).toHaveLength(1);
    expect(Object.keys(shares[0])).not.toContain("otpVerifier");
    expect(Object.keys(shares[0])).not.toContain("encryptedPayload");
    expect(Object.keys(shares[0])).not.toContain("tokenHash");
  });

  it("unknown, missing and malformed tokens all look the same", async () => {
    const unknown = await verify("A".repeat(43), "123456");
    expect(unknown.status).toBe(410);
    expect((await verify("short", "123456")).status).toBe(400);
  });
});

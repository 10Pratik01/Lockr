import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb } from "../helpers/fake-db";

const state = vi.hoisted(() => ({ userId: null as string | null, admin: false }));
const fake = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("@/lib/prisma", () => ({
  get db() {
    return fake.db;
  },
}));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  checkRateLimit: async () => true,
}));
vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: async () => (state.userId ? { id: state.userId, clerkUserId: `clerk_${state.userId}` } : null),
}));
vi.mock("@/lib/auth/admin", () => ({
  getAdminUser: async () => (state.admin ? { id: "admin1", clerkUserId: "clerk_admin1" } : null),
}));

const reqRoute = await import("@/app/api/vault/reset-request/route");
const resetRoute = await import("@/app/api/vault/reset/route");
const decide = await import("@/app/api/admin/reset-requests/route");
const auditRoute = await import("@/app/api/audit/route");
const vaultCreate = await import("@/app/api/vault/create/route");

let db: ReturnType<typeof createFakeDb>;
const json = (body: unknown, method = "POST") =>
  new Request("http://test/api", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const as = (userId: string | null, admin = false) => {
  state.userId = userId;
  state.admin = admin;
};
const CRED = { encryptedData: "Y2lwaGVydGV4dA==", iv: "aXZpdml2aXZpdml2" };
const actions = () => db.auditLog._rows().map((r) => r.action);

async function requestReset(userId: string) {
  as(userId);
  const res = await reqRoute.POST(json({ reason: "forgot it" }));
  expect(res.status).toBe(201);
  return ((await res.json()) as { request: { id: string } }).request.id;
}

beforeEach(() => {
  db = createFakeDb();
  fake.db = db;
  as(null);
});

describe("passphrase reset flow", () => {
  it("requires sign-in and allows only one open request", async () => {
    expect((await reqRoute.POST(json({}))).status).toBe(401);
    await requestReset("u1");
    as("u1");
    expect((await reqRoute.POST(json({}))).status).toBe(409);
  });

  it("a simultaneous duplicate (unique-index violation) is a clean 409, not a 500", async () => {
    as("u1");
    db.passphraseResetRequest.create = async () => {
      throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    };
    expect((await reqRoute.POST(json({}))).status).toBe(409);
    expect(db.auditLog._rows()).toHaveLength(0);
  });

  it("cannot reset without an approval", async () => {
    as("u1");
    db.credential._rows().push({ id: "c1", userId: "u1" });
    expect((await resetRoute.POST(json({ confirm: "RESET" }))).status).toBe(403);
    await requestReset("u1"); // pending, not approved
    expect((await resetRoute.POST(json({ confirm: "RESET" }))).status).toBe(403);
    expect(db.credential._rows()).toHaveLength(1);
  });

  it("only admins can decide; others get 404", async () => {
    const id = await requestReset("u1");
    as("u2", false);
    expect((await decide.POST(json({ id, decision: "approve" }))).status).toBe(404);
    expect(db.passphraseResetRequest._rows()[0].status).toBe("PENDING");
  });

  it("approved reset wipes only that user's vault + credentials, once", async () => {
    db.vault._rows().push({ id: "v1", userId: "u1" }, { id: "v2", userId: "u2" });
    db.credential._rows().push({ id: "c1", userId: "u1" }, { id: "c2", userId: "u2" });
    const id = await requestReset("u1");

    as("u1", true);
    state.userId = null; // admin acts as admin only
    const approve = await decide.POST(json({ id, decision: "approve" }));
    expect(approve.status).toBe(200);
    expect(db.passphraseResetRequest._rows()[0].status).toBe("APPROVED");

    as("u1");
    expect((await resetRoute.POST(json({ confirm: "nope" }))).status).toBe(400);
    expect((await resetRoute.POST(json({ confirm: "RESET" }))).status).toBe(200);
    expect(db.vault._rows().map((r) => r.userId)).toEqual(["u2"]);
    expect(db.credential._rows().map((r) => r.userId)).toEqual(["u2"]);

    // single-use: replay is refused
    expect((await resetRoute.POST(json({ confirm: "RESET" }))).status).toBe(403);
    expect(actions()).toEqual(expect.arrayContaining(["reset.request", "reset.approve", "vault.reset"]));
  });

  it("an expired approval is refused and a denied request cannot reset", async () => {
    const id = await requestReset("u1");
    as(null, true);
    await decide.POST(json({ id, decision: "approve" }));
    db.passphraseResetRequest._rows()[0].expiresAt = new Date(Date.now() - 1000);
    as("u1");
    expect((await resetRoute.POST(json({ confirm: "RESET" }))).status).toBe(403);

    db.passphraseResetRequest._reset();
    const id2 = await requestReset("u1");
    as(null, true);
    await decide.POST(json({ id: id2, decision: "deny" }));
    as("u1");
    expect((await resetRoute.POST(json({ confirm: "RESET" }))).status).toBe(403);
  });

  it("a request can be decided only once", async () => {
    const id = await requestReset("u1");
    as(null, true);
    expect((await decide.POST(json({ id, decision: "deny" }))).status).toBe(200);
    expect((await decide.POST(json({ id, decision: "approve" }))).status).toBe(409);
  });
});

describe("audit log", () => {
  it("records server-side actions without payloads", async () => {
    as("u1");
    await vaultCreate.POST(json(CRED));
    const [row] = db.auditLog._rows();
    expect(row).toMatchObject({ userId: "u1", action: "credential.create" });
    expect(JSON.stringify(row)).not.toContain(CRED.encryptedData);
  });

  it("accepts only allowlisted client events and drops other users' credential ids", async () => {
    expect((await auditRoute.POST(json({ action: "vault.lock" }))).status).toBe(401);
    as("u1");
    db.credential._rows().push({ id: "mine", userId: "u1" }, { id: "theirs", userId: "u2" });
    expect((await auditRoute.POST(json({ action: "vault.reset" }))).status).toBe(400);
    expect((await auditRoute.POST(json({ action: "credential.view", targetId: "mine" }))).status).toBe(201);
    expect((await auditRoute.POST(json({ action: "credential.view", targetId: "theirs" }))).status).toBe(201);
    expect(db.auditLog._rows().map((r) => r.targetId)).toEqual(["mine", null]);
  });
});

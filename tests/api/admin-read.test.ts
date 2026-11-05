import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb } from "../helpers/fake-db";

// Uses the REAL lib/auth/admin (env allowlist); only Clerk and the DB are faked.
const state = vi.hoisted(() => ({ clerkUserId: null as string | null }));
const fake = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("@/lib/prisma", () => ({
  get db() {
    return fake.db;
  },
}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: state.clerkUserId, isAuthenticated: state.clerkUserId !== null }),
  clerkClient: async () => {
    throw new Error("must not be reached for non-admins");
  },
}));

const overview = await import("@/app/api/admin/overview/route");
const pending = await import("@/app/api/admin/pending/route");

beforeEach(() => {
  process.env.ADMIN_CLERK_USER_IDS = "user_admin, user_other_admin";
  const db = createFakeDb();
  db.passphraseResetRequest._rows().push({ id: "r1", userId: "u1", status: "PENDING" }, { id: "r2", userId: "u2", status: "DENIED" });
  fake.db = db;
  state.clerkUserId = null;
});

describe("admin read endpoints expose nothing to non-admins", () => {
  it("overview: 404 when signed out, for a normal user, and when the allowlist is empty", async () => {
    expect((await overview.GET(new Request("http://t/api/admin/overview"))).status).toBe(404);
    state.clerkUserId = "user_normal";
    expect((await overview.GET(new Request("http://t/api/admin/overview"))).status).toBe(404);
    process.env.ADMIN_CLERK_USER_IDS = "";
    state.clerkUserId = "user_admin";
    expect((await overview.GET(new Request("http://t/api/admin/overview"))).status).toBe(404);
  });

  it("pending: isAdmin:false with no count for non-admins, the real count for admins", async () => {
    expect(await (await pending.GET()).json()).toEqual({ isAdmin: false, pending: 0 });
    state.clerkUserId = "user_normal";
    expect(await (await pending.GET()).json()).toEqual({ isAdmin: false, pending: 0 });
    state.clerkUserId = "user_other_admin";
    expect(await (await pending.GET()).json()).toEqual({ isAdmin: true, pending: 1 });
  });
});

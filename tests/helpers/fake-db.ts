// Minimal in-memory stand-in for the Prisma client, covering exactly the
// query shapes our route handlers use. Each call runs synchronously, like
// a single SQL statement would, so conditional updates are atomic here too.
type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

function matches(row: Row, where: Where = {}): boolean {
  return Object.entries(where).every(([field, cond]) => {
    const value = row[field];
    if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as Record<string, unknown>;
      if ("gt" in c && !((value as Date | number) > (c.gt as Date | number))) return false;
      if ("lt" in c && !((value as Date | number) < (c.lt as Date | number))) return false;
      if ("not" in c && value === c.not) return false;
      return true;
    }
    return value === cond;
  });
}

function apply(row: Row, data: Row) {
  for (const [field, change] of Object.entries(data)) {
    if (change !== null && typeof change === "object" && !(change instanceof Date)) {
      const c = change as { increment?: number; decrement?: number };
      if (c.increment) row[field] = (row[field] as number) + c.increment;
      if (c.decrement) row[field] = (row[field] as number) - c.decrement;
    } else {
      row[field] = change;
    }
  }
  row.updatedAt = new Date();
}

function pick(row: Row, select?: Record<string, boolean>) {
  if (!select) return { ...row };
  return Object.fromEntries(Object.keys(select).map((k) => [k, row[k]]));
}

let seq = 0;

function model(defaults: () => Row, unique: string[] = []) {
  let rows: Row[] = [];
  return {
    _rows: () => rows,
    _reset: () => (rows = []),
    async create({ data, select }: { data: Row; select?: Record<string, boolean> }) {
      const row = { id: `id_${++seq}`, createdAt: new Date(), updatedAt: new Date(), ...defaults(), ...data };
      rows.push(row);
      return pick(row, select);
    },
    async createMany({ data, skipDuplicates }: { data: Row[]; skipDuplicates?: boolean }) {
      let count = 0;
      for (const d of data) {
        if (unique.some((u) => rows.some((r) => r[u] === d[u]))) {
          if (skipDuplicates) continue;
          throw new Error("Unique constraint");
        }
        rows.push({ id: `id_${++seq}`, createdAt: new Date(), updatedAt: new Date(), ...defaults(), ...d });
        count++;
      }
      return { count };
    },
    async findFirst({ where, select }: { where?: Where; select?: Record<string, boolean> }) {
      const row = rows.find((r) => matches(r, where));
      return row ? pick(row, select) : null;
    },
    async findUnique(args: { where?: Where; select?: Record<string, boolean> }) {
      return this.findFirst(args);
    },
    async findMany({
      where,
      select,
      orderBy,
      take,
    }: {
      where?: Where;
      select?: Record<string, boolean>;
      orderBy?: Record<string, "asc" | "desc">;
      take?: number;
    }) {
      let hit = rows.filter((r) => matches(r, where));
      if (orderBy) {
        const [[field, dir]] = Object.entries(orderBy);
        const sign = dir === "desc" ? -1 : 1;
        // Stable: ties (same millisecond) keep insertion order, reversed for desc.
        hit = hit
          .map((r, i) => ({ r, i }))
          .sort((a, b) => sign * (((a.r[field] as Date) > (b.r[field] as Date) ? 1 : (a.r[field] as Date) < (b.r[field] as Date) ? -1 : 0) || a.i - b.i))
          .map(({ r }) => r);
      }
      return hit.slice(0, take).map((r) => pick(r, select));
    },
    async updateMany({ where, data }: { where?: Where; data: Row }) {
      const hit = rows.filter((r) => matches(r, where));
      hit.forEach((r) => apply(r, data));
      return { count: hit.length };
    },
    async update({ where, data }: { where: Where; data: Row }) {
      const row = rows.find((r) => matches(r, where));
      if (!row) throw new Error("Record not found");
      apply(row, data);
      return { ...row };
    },
    async count({ where }: { where?: Where } = {}) {
      return rows.filter((r) => matches(r, where)).length;
    },
    async deleteMany({ where }: { where?: Where }) {
      const before = rows.length;
      rows = rows.filter((r) => !matches(r, where));
      return { count: before - rows.length };
    },
  };
}

export function createFakeDb() {
  const models = {
    vault: model(() => ({}), ["userId"]),
    credential: model(() => ({})),
    passphraseResetRequest: model(() => ({ status: "PENDING", reason: null, decidedAt: null, decidedBy: null, expiresAt: null, completedAt: null })),
    auditLog: model(() => ({})),
    share: model(() => ({ usedAt: null, revokedAt: null, failedAttempts: 0, destroyOnOpen: false }), ["tokenHash"]),
  };
  return {
    ...models,
    // No real rollback: the fake runs the callback against the same tables.
    async $transaction<T>(fn: (tx: typeof models) => Promise<T>): Promise<T> {
      return fn(models);
    },
  };
}

export type FakeDb = ReturnType<typeof createFakeDb>;

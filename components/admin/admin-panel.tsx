"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, ErrorText } from "@/components/ui/primitives";
import { Close } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";
import { AUDIT_ACTIONS } from "@/lib/audit-actions";

interface Overview {
  usersTotal: number;
  usersPage: number;
  usersPageSize: number;
  filterLabel: string | null;
  users: { id: string; label: string; createdAt: string; hasVault: boolean; credentials: number; shares: number }[];
  requests: {
    id: string;
    userId: string;
    userLabel: string;
    status: string;
    reason: string | null;
    createdAt: string;
    decidedAt: string | null;
    expiresAt: string | null;
  }[];
  logs: {
    id: string;
    userId: string;
    userLabel: string;
    actorLabel: string | null;
    label: string;
    action: string;
    detail: string | null;
    createdAt: string;
  }[];
}

const fmt = (d: string) => new Date(d).toLocaleString();

export function AdminPanel() {
  const toast = useToast();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [usersPage, setUsersPage] = useState(0);
  const [busyId, setBusyId] = useState("");

  const load = useCallback(() => {
    const qs = new URLSearchParams();
    if (userFilter) qs.set("user", userFilter);
    if (actionFilter) qs.set("action", actionFilter);
    qs.set("usersPage", String(usersPage));
    api<Overview>(`/api/admin/overview?${qs}`)
      .then((d) => {
        setData(d);
        setError("");
      })
      .catch(() => setError("Couldn’t load admin data."));
  }, [userFilter, actionFilter, usersPage]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  async function decide(id: string, decision: "approve" | "deny") {
    setBusyId(id);
    try {
      await api("/api/admin/reset-requests", { method: "POST", body: { id, decision } });
      toast(decision === "approve" ? "Reset approved (valid 24h)" : "Request denied");
      load();
    } catch {
      toast("That request was already handled", "error");
      load();
    } finally {
      setBusyId("");
    }
  }

  const pending = data?.requests.filter((r) => r.status === "PENDING") ?? [];
  const history = data?.requests.filter((r) => r.status !== "PENDING") ?? [];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Admin</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Accounts, passphrase reset requests and activity. You can see who did what — never anyone’s passwords.
        </p>
      </div>
      <ErrorText>{error}</ErrorText>

      <section className="space-y-3" aria-labelledby="req-h">
        <h2 id="req-h" className="font-display text-xl font-medium">
          Reset requests {pending.length > 0 && <span className="text-red-600">({pending.length} waiting)</span>}
        </h2>
        <p className="text-sm text-zinc-500">
          Approving lets that user <strong>wipe their vault</strong> and set a new passphrase. Their old data can’t be
          recovered by anyone. Approve only if you’ve confirmed it’s really them.
        </p>
        {!data && <p className="text-sm text-zinc-500">Loading…</p>}
        {data && pending.length === 0 && (
          <Card>
            <p className="text-sm text-zinc-500">No requests waiting.</p>
          </Card>
        )}
        {data && pending.length > 0 && (
          <ul className="space-y-3">
            {pending.map((r) => (
              <li key={r.id}>
                <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.userLabel}</p>
                    <p className="text-sm text-zinc-500">Requested {fmt(r.createdAt)}</p>
                    {r.reason && <p className="mt-1 text-sm break-words">“{r.reason}”</p>}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="ghost" disabled={busyId === r.id} onClick={() => decide(r.id, "deny")}>
                      Deny
                    </Button>
                    <Button disabled={busyId === r.id} onClick={() => decide(r.id, "approve")}>
                      Approve
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
        {history.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-zinc-500">Past requests ({history.length})</summary>
            <ul className="mt-2 space-y-1">
              {history.map((r) => (
                <li key={r.id} className="text-zinc-600 dark:text-zinc-400">
                  {r.userLabel} — <strong>{r.status.toLowerCase()}</strong> · {fmt(r.decidedAt ?? r.createdAt)}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="users-h">
        <h2 id="users-h" className="font-display text-xl font-medium">
          Users {data && <span className="text-zinc-500">({data.usersTotal})</span>}
        </h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="bg-zinc-100 text-xs text-zinc-500 uppercase dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2 font-medium">Account</th>
                <th className="px-3 py-2 font-medium">Joined</th>
                <th className="px-3 py-2 font-medium">Vault</th>
                <th className="px-3 py-2 font-medium">Credentials</th>
                <th className="px-3 py-2 font-medium">Shares</th>
              </tr>
            </thead>
            <tbody>
              {data?.users.map((u) => (
                <tr key={u.id} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="max-w-56 truncate px-3 py-2">
                    <button
                      type="button"
                      className="cursor-pointer text-left hover:underline"
                      onClick={() => setUserFilter(u.id)}
                      title="Filter activity to this user"
                    >
                      {u.label}
                    </button>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{u.hasVault ? "Yes" : "No"}</td>
                  <td className="px-3 py-2">{u.credentials}</td>
                  <td className="px-3 py-2">{u.shares}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && data.usersTotal > data.usersPageSize && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Button size="sm" variant="secondary" disabled={usersPage === 0} onClick={() => setUsersPage((p) => p - 1)}>
              Previous
            </Button>
            <span>
              Page {usersPage + 1} of {Math.ceil(data.usersTotal / data.usersPageSize)}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={(usersPage + 1) * data.usersPageSize >= data.usersTotal}
              onClick={() => setUsersPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="log-h">
        <h2 id="log-h" className="font-display text-xl font-medium">
          Activity log
        </h2>
        <div className="flex flex-wrap gap-2">
          {userFilter && (
            <button
              type="button"
              onClick={() => setUserFilter("")}
              className="inline-flex h-10 max-w-full cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 px-3 text-sm dark:border-zinc-700"
              aria-label="Clear user filter"
            >
              <span className="truncate">User: {data?.filterLabel ?? "…"}</span>
              <Close width={14} height={14} />
            </button>
          )}
          <select
            aria-label="Filter by action"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="h-10 max-w-full rounded-lg border border-zinc-300 bg-l-card px-3 text-sm dark:border-zinc-700"
          >
            <option value="">All actions</option>
            {Object.entries(AUDIT_ACTIONS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
          {data?.logs.length === 0 && <li className="px-3 py-4 text-zinc-500">No activity matches.</li>}
          {data?.logs.map((l) => (
            <li key={l.id} className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:items-baseline sm:gap-3">
              <time className="shrink-0 text-xs text-zinc-500 sm:w-44">{fmt(l.createdAt)}</time>
              <span className="min-w-0 flex-1 break-words">
                <strong className="font-medium">{l.userLabel}</strong> — {l.label}
                {l.detail ? ` (${l.detail})` : ""}
                {l.actorLabel ? ` · by ${l.actorLabel}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

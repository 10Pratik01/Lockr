"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { MAX_OTP_ATTEMPTS } from "@/lib/share/constants";
import { useVault } from "@/components/vault/vault-provider";
import { Button, Card, ErrorText } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { ListSkeleton } from "@/components/ui/skeleton";

interface ShareRow {
  id: string;
  credentialId: string;
  destroyOnOpen: boolean;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  failedAttempts: number;
  createdAt: string;
}

type Status = "Active" | "Used" | "Expired" | "Revoked" | "Locked";

function statusOf(s: ShareRow, now: number): Status {
  if (s.revokedAt) return "Revoked";
  if (s.usedAt) return "Used";
  if (s.failedAttempts >= MAX_OTP_ATTEMPTS) return "Locked";
  if (new Date(s.expiresAt).getTime() <= now) return "Expired";
  return "Active";
}

const BADGE: Record<Status, string> = {
  Active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  Used: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  Expired: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  Revoked: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  Locked: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
};

export function SharesList() {
  const { credentials } = useVault();
  const toast = useToast();
  const [shares, setShares] = useState<ShareRow[] | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  // Bumped after a revoke to re-fetch the list.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    api<{ shares: ShareRow[] }>("/api/share/list")
      .then(({ shares }) => setShares(shares))
      .catch(() => setError("Couldn't load shares."));
  }, [version]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  async function revoke(id: string) {
    try {
      await api("/api/share/revoke", { method: "POST", body: { id } });
      toast("Share revoked");
      setVersion((v) => v + 1);
    } catch {
      toast("Couldn't revoke share", "error");
    }
  }

  const names = new Map(credentials.map((c) => [c.id, c.site]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Shares</h1>
        <p className="text-sm text-zinc-500">One-time links you&apos;ve created. Active links can be revoked.</p>
      </div>
      <ErrorText>{error}</ErrorText>
      {shares === null ? (
        <ListSkeleton rows={3} />
      ) : shares.length === 0 ? (
        <Card className="py-12 text-center text-sm text-zinc-500">No shares yet. Use “Share” on a credential.</Card>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-3">
          {shares.map((s, idx) => {
            const status = statusOf(s, now);
            return (
              <li key={s.id} className="enter min-w-0" style={{ "--i": Math.min(idx, 10) } as React.CSSProperties}>
                <Card className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{names.get(s.credentialId) ?? "Deleted credential"}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[status]}`}>{status}</span>
                    </div>
                    <p className="text-xs text-zinc-500">
                      Created {new Date(s.createdAt).toLocaleString()} ·{" "}
                      {status === "Used" && s.usedAt
                        ? `opened ${new Date(s.usedAt).toLocaleString()}`
                        : `expires ${new Date(s.expiresAt).toLocaleString()}`}
                      {s.destroyOnOpen && status === "Active" && " · deleted when opened"}
                      {s.failedAttempts > 0 && status !== "Used" && ` · ${s.failedAttempts} failed attempt(s)`}
                    </p>
                  </div>
                  {status === "Active" && (
                    <Button size="sm" variant="danger" onClick={() => revoke(s.id)}>
                      Revoke Share
                    </Button>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { MAX_OTP_ATTEMPTS } from "@/lib/share/constants";
import { useVault } from "@/components/vault/vault-provider";
import { Card } from "@/components/ui/primitives";
import { Skeleton } from "@/components/ui/skeleton";

interface ShareRow {
  id: string;
  credentialId: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  failedAttempts: number;
  createdAt: string;
}

interface Event {
  at: Date;
  text: string;
  warn?: boolean;
}

// Derived from share records -- the security-relevant events that happen
// while you're away (a link opened, codes guessed wrong). Sign-ins and
// sessions are shown by the account panel below.
function toEvents(shares: ShareRow[], name: (id: string) => string): Event[] {
  return shares
    .flatMap((s) => {
      const n = name(s.credentialId);
      const events: Event[] = [{ at: new Date(s.createdAt), text: `Share link created for ${n}` }];
      if (s.usedAt) events.push({ at: new Date(s.usedAt), text: `Share link for ${n} was opened` });
      if (s.revokedAt) events.push({ at: new Date(s.revokedAt), text: `Share link for ${n} revoked` });
      if (s.failedAttempts >= MAX_OTP_ATTEMPTS && !s.usedAt) {
        events.push({ at: new Date(s.expiresAt), text: `Share link for ${n} locked after ${MAX_OTP_ATTEMPTS} wrong codes`, warn: true });
      } else if (s.failedAttempts > 0 && !s.usedAt) {
        events.push({ at: new Date(s.createdAt), text: `${s.failedAttempts} wrong code attempt(s) on ${n}`, warn: true });
      }
      return events;
    })
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 15);
}

export function RecentActivity() {
  const { credentials } = useVault();
  const [shares, setShares] = useState<ShareRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api<{ shares: ShareRow[] }>("/api/share/list")
      .then(({ shares }) => setShares(shares))
      .catch(() => setFailed(true));
  }, []);

  const names = new Map(credentials.map((c) => [c.id, c.site]));
  const events = shares ? toEvents(shares, (id) => names.get(id) ?? "a credential") : [];

  return (
    <Card>
      <h3 className="font-medium">Recent activity</h3>
      {failed ? (
        <p className="mt-2 text-sm text-red-600">Couldn&apos;t load activity.</p>
      ) : shares === null ? (
        <div className="mt-3 space-y-3" role="status" aria-label="Loading activity">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : events.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">No sharing activity yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
          {events.map((e, i) => (
            <li key={i} className="flex justify-between gap-4 py-2">
              <span className={e.warn ? "text-amber-700 dark:text-amber-300" : ""}>{e.text}</span>
              <time className="shrink-0 text-xs text-zinc-500" dateTime={e.at.toISOString()}>
                {e.at.toLocaleString()}
              </time>
            </li>
          ))}
        </ul>
      )}
      {credentials.length === 0 && shares && shares.length > 0 && (
        <p className="mt-2 text-xs text-zinc-500">Unlock your vault to see credential names.</p>
      )}
    </Card>
  );
}

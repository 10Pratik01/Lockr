"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";

/**
 * Polls the admin queue and raises a toast when a new reset request arrives.
 * `enabled` comes from the server layout, so non-admins make no requests at all
 * (the endpoint still re-checks admin on every call).
 */
export function useAdminPending(enabled: boolean) {
  const toast = useToast();
  const [pending, setPending] = useState(0);
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let stop = false;
    const tick = () =>
      api<{ isAdmin: boolean; pending: number }>("/api/admin/pending")
        .then((next) => {
          if (stop) return;
          if (!next.isAdmin) return;
          if (last.current !== null && next.pending > last.current) {
            toast("New passphrase reset request waiting in Admin", "info");
          }
          last.current = next.pending;
          setPending(next.pending);
        })
        .catch(() => {});
    tick();
    const t = setInterval(tick, 30_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [enabled, toast]);

  return pending;
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useVault } from "./vault-provider";
import { Button, ErrorText, Input, Label } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api-client";

type Status = "PENDING" | "APPROVED" | "DENIED" | "COMPLETED" | "CANCELLED" | "EXPIRED";
interface ResetRequestState {
  id: string;
  status: Status;
  createdAt: string;
  expiresAt: string | null;
}

/**
 * "I forgot my vault passphrase" flow. The vault is zero-knowledge, so an
 * admin cannot recover or change the passphrase for you: approval only
 * lets you wipe the vault and start a new one. The copy says so plainly.
 */
export function ResetRequest() {
  const { resetVault } = useVault();
  const toast = useToast();
  const [request, setRequest] = useState<ResetRequestState | null | undefined>(undefined);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ request: ResetRequestState | null }>("/api/vault/reset-request")
      .then(({ request }) => setRequest(request))
      .catch(() => setRequest(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // While waiting on the admin, check for a decision every 15s.
  const waiting = request?.status === "PENDING";
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [waiting, load]);

  async function act(fn: () => Promise<unknown>, fail: string) {
    setError("");
    setBusy(true);
    try {
      await fn();
      load();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : fail);
    } finally {
      setBusy(false);
    }
  }

  if (request === undefined) return <p className="text-sm text-zinc-500">Checking reset status…</p>;

  if (request?.status === "PENDING") {
    return (
      <div className="space-y-3">
        <p role="status" className="rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Waiting for an admin to approve your request (sent {new Date(request.createdAt).toLocaleString()}). This page
          updates on its own.
        </p>
        <ErrorText>{error}</ErrorText>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => act(() => api("/api/vault/reset-request", { method: "DELETE" }), "Couldn’t cancel")}>
          Cancel request
        </Button>
      </div>
    );
  }

  if (request?.status === "APPROVED") {
    return (
      <div className="space-y-3">
        <p role="status" className="rounded-lg bg-red-50 px-3.5 py-3 text-sm leading-relaxed text-red-800 dark:bg-red-950 dark:text-red-300">
          <strong>Approved.</strong> Resetting <strong>permanently deletes every credential and share</strong> in this
          vault — they can’t be decrypted without the old passphrase, and nobody, including the admin, can recover them.
          You’ll then choose a new passphrase. Valid until {request.expiresAt ? new Date(request.expiresAt).toLocaleString() : "—"}.
        </p>
        <div className="max-w-xs">
          <Label htmlFor="reset-confirm">Type RESET to confirm</Label>
          <Input id="reset-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        </div>
        <ErrorText>{error}</ErrorText>
        <Button
          variant="danger"
          disabled={busy || confirm !== "RESET"}
          onClick={() =>
            act(async () => {
              await resetVault();
              toast("Vault reset. Choose a new passphrase.");
            }, "Reset failed")
          }
        >
          {busy ? "Resetting…" : "Wipe vault and set a new passphrase"}
        </Button>
      </div>
    );
  }

  const note =
    request?.status === "DENIED"
      ? "Your last request was denied by an admin."
      : request?.status === "EXPIRED"
        ? "Your last approval expired. You can send a new request."
        : null;

  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        Forgot your vault passphrase? An admin has to approve a reset. Because Privault never sees your passphrase, a
        reset can’t restore your data: it <strong>erases the vault</strong> and lets you start a new one.
      </p>
      {note && <p className="text-sm text-amber-700 dark:text-amber-300">{note}</p>}
      <div className="max-w-sm">
        <Label htmlFor="reset-reason">Note for the admin (optional)</Label>
        <Input id="reset-reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
      </div>
      <ErrorText>{error}</ErrorText>
      <Button
        variant="secondary"
        disabled={busy}
        onClick={() => act(() => api("/api/vault/reset-request", { method: "POST", body: { reason } }), "Couldn’t send request")}
      >
        Request passphrase reset
      </Button>
    </div>
  );
}

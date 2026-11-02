"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useVault } from "./vault-provider";
import { Button, Card, ErrorText, Input, Label } from "@/components/ui/primitives";
import { MIN_PASSPHRASE_LENGTH } from "@/lib/vault/keys";

/** Renders children only while the vault is unlocked. */
export function VaultGate({ children }: { children: ReactNode }) {
  const { status } = useVault();

  if (status === "loading") {
    return <p className="py-24 text-center text-sm text-zinc-500">Loading vault…</p>;
  }
  if (status === "error") {
    return (
      <Centered>
        <Card>
          <ErrorText>Couldn&apos;t load your vault. Check your connection and refresh.</ErrorText>
        </Card>
      </Centered>
    );
  }
  if (status === "no-vault") return <SetupForm />;
  if (status === "locked") return <UnlockForm />;
  return <>{children}</>;
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-md py-16">{children}</div>;
}

function LockIcon() {
  return (
    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 text-2xl dark:bg-violet-950">
      🔒
    </div>
  );
}

function SetupForm() {
  const { setup } = useVault();
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
      return setError(`Use at least ${MIN_PASSPHRASE_LENGTH} characters.`);
    }
    if (passphrase !== confirm) return setError("Passphrases don't match.");
    setBusy(true);
    try {
      await setup(passphrase);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
      setBusy(false);
    }
  }

  return (
    <Centered>
      <Card className="p-8">
        <LockIcon />
        <h1 className="text-center text-xl font-semibold">Create your vault passphrase</h1>
        <p className="mt-2 text-center text-sm text-zinc-500">
          This is separate from your account password. It encrypts your vault on this device —
          Privault never sees it and <strong>cannot recover it</strong> if you forget it.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="passphrase">Vault passphrase</Label>
            <Input
              id="passphrase"
              type="password"
              autoComplete="new-password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="confirm">Confirm vault passphrase</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Creating vault…" : "Create vault"}
          </Button>
        </form>
      </Card>
    </Centered>
  );
}

function UnlockForm() {
  const { unlock } = useVault();
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await unlock(passphrase);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unlock failed");
      setBusy(false);
    }
  }

  return (
    <Centered>
      <Card className="p-8">
        <LockIcon />
        <h1 className="text-center text-xl font-semibold">Vault Locked</h1>
        <p className="mt-2 text-center text-sm text-zinc-500">Enter your vault passphrase to unlock.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="unlock-passphrase">Vault passphrase</Label>
            <Input
              id="unlock-passphrase"
              type="password"
              autoComplete="current-password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoFocus
            />
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full" disabled={busy || !passphrase}>
            {busy ? "Unlocking…" : "Unlock Vault"}
          </Button>
        </form>
      </Card>
    </Centered>
  );
}

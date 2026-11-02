"use client";

import { useState, type FormEvent } from "react";
import { UserProfile } from "@clerk/nextjs";
import { AUTO_LOCK_OPTIONS, useVault } from "./vault-provider";
import { Button, Card, ErrorText, Input, Label } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { MIN_PASSPHRASE_LENGTH } from "@/lib/vault/keys";
import { RecentActivity } from "@/components/share/recent-activity";

export function Settings() {
  const { status } = useVault();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Vault</h2>
        <AutoLockSetting />
        {status !== "no-vault" && status !== "loading" && <ChangePassphrase />}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Security</h2>
        <RecentActivity />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Authentication</h2>
        <p className="text-sm text-zinc-500">
          Email, password, passkeys and active sessions are managed by your account provider. Passkeys
          use your device&apos;s biometrics locally — fingerprint data never reaches Privault.
        </p>
        <UserProfile routing="hash" />
      </section>
    </div>
  );
}

function AutoLockSetting() {
  const { autoLockMinutes, setAutoLockMinutes } = useVault();
  return (
    <Card>
      <Label htmlFor="auto-lock">Auto-lock after inactivity</Label>
      <select
        id="auto-lock"
        value={autoLockMinutes}
        onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
        className="h-10 w-full max-w-xs rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        {AUTO_LOCK_OPTIONS.map((m) => (
          <option key={m} value={m}>
            {m === 0 ? "Never" : `${m} minutes`}
          </option>
        ))}
      </select>
      <p className="mt-2 text-xs text-zinc-500">Saved on this device.</p>
    </Card>
  );
}

function ChangePassphrase() {
  const { changePassphrase } = useVault();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (next.length < MIN_PASSPHRASE_LENGTH) return setError(`Use at least ${MIN_PASSPHRASE_LENGTH} characters.`);
    if (next !== confirm) return setError("New passphrases don't match.");
    if (next === current) return setError("New passphrase must be different.");
    setBusy(true);
    try {
      await changePassphrase(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      toast("Vault passphrase changed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Change failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h3 className="font-medium">Change vault passphrase</h3>
      <p className="mt-1 text-sm text-zinc-500">
        Your vault key is re-wrapped under the new passphrase; existing credentials stay readable.
      </p>
      <form onSubmit={onSubmit} className="mt-4 max-w-sm space-y-3">
        <div>
          <Label htmlFor="current-pp">Current passphrase</Label>
          <Input id="current-pp" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="new-pp">New passphrase</Label>
          <Input id="new-pp" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="confirm-pp">Confirm new passphrase</Label>
          <Input id="confirm-pp" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={busy || !current || !next}>
          {busy ? "Re-encrypting key…" : "Change passphrase"}
        </Button>
      </form>
    </Card>
  );
}

"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useVault } from "./vault-provider";
import { Button, Card, ErrorText, Input, Label } from "@/components/ui/primitives";
import { Eye, EyeOff, LockMark } from "@/components/ui/icons";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { ResetRequest } from "./reset-request";
import { MIN_PASSPHRASE_LENGTH } from "@/lib/vault/keys";

/** Renders children only while the vault is unlocked. */
export function VaultGate({ children }: { children: ReactNode }) {
  const { status } = useVault();

  if (status === "loading") {
    return <DashboardSkeleton />;
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

function LockIcon({ open = false }: { open?: boolean }) {
  return (
    <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-zinc-200 text-l-cipher dark:bg-zinc-800">
      <LockMark width={26} height={26} open={open} />
    </div>
  );
}

/** Passphrase input with a show/hide toggle. */
function PassphraseField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  autoFocus?: boolean;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          className="pr-11"
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? "Hide passphrase" : "Show passphrase"}
          aria-pressed={shown}
          className="absolute top-1/2 right-1.5 inline-flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          {shown ? <EyeOff /> : <Eye />}
        </button>
      </div>
    </div>
  );
}

/** Indeterminate bar for the Argon2id derivation, which takes a moment on purpose. */
function Deriving({ text }: { text: string }) {
  return (
    <div role="status" className="space-y-2">
      <div className="progress-bar relative h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" />
      <p className="text-xs text-zinc-500">{text}</p>
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
      <Card className="enter p-8">
        <LockIcon />
        <h1 className="text-center font-display text-2xl font-medium">Choose your vault passphrase</h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-zinc-500">
          It encrypts your vault on this device and is separate from your account password.
        </p>
        <p className="mt-4 rounded-lg bg-red-50 px-3.5 py-3 text-sm leading-relaxed text-red-800 dark:bg-red-950 dark:text-red-400">
          Privault never sees this passphrase, so it <strong>cannot be recovered</strong>. If you forget it, the
          vault stays locked for good.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <PassphraseField
            id="passphrase"
            label="Vault passphrase"
            value={passphrase}
            onChange={setPassphrase}
            autoComplete="new-password"
            autoFocus
          />
          <PassphraseField
            id="confirm"
            label="Confirm vault passphrase"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
          />
          <ErrorText>{error}</ErrorText>
          {busy && <Deriving text="Deriving your key. This takes a moment on purpose." />}
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
  const [forgot, setForgot] = useState(false);
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
      <Card className="enter p-8">
        <LockIcon open={busy} />
        <h1 className="text-center font-display text-2xl font-medium">Your vault is locked</h1>
        <p className="mt-2 text-center text-sm text-zinc-500">Enter your vault passphrase to open it.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <PassphraseField
            id="unlock-passphrase"
            label="Vault passphrase"
            value={passphrase}
            onChange={setPassphrase}
            autoComplete="current-password"
            autoFocus
          />
          <ErrorText>{error}</ErrorText>
          {busy && <Deriving text="Deriving your key…" />}
          <Button type="submit" className="w-full" disabled={busy || !passphrase}>
            {busy ? "Unlocking…" : "Unlock vault"}
          </Button>
        </form>
        <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          {forgot ? (
            <ResetRequest />
          ) : (
            <button type="button" onClick={() => setForgot(true)} className="cursor-pointer text-sm text-zinc-500 underline-offset-2 hover:underline">
              Forgot your passphrase?
            </button>
          )}
        </div>
      </Card>
    </Centered>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { credentialSchema, type CredentialData, type DecryptedCredential } from "@/lib/vault/credential";
import { Button, ErrorText, Input, Label } from "@/components/ui/primitives";
import { Eye, EyeOff, Refresh } from "@/components/ui/icons";
import { PasswordGenerator } from "./password-generator";
import { useVault } from "./vault-provider";
import { useToast } from "@/components/ui/toast";

const EMPTY: CredentialData = { site: "", url: "", username: "", password: "", notes: "" };

export function CredentialForm({
  existing,
  onDone,
}: {
  existing?: DecryptedCredential;
  onDone: () => void;
}) {
  const { save } = useVault();
  const toast = useToast();
  const [data, setData] = useState<CredentialData>(
    existing
      ? { site: existing.site, url: existing.url, username: existing.username, password: existing.password, notes: existing.notes }
      : EMPTY
  );
  const [showPassword, setShowPassword] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (field: keyof CredentialData) => (value: string) => setData((d) => ({ ...d, [field]: value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const parsed = credentialSchema.safeParse(data);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the form");
    setBusy(true);
    try {
      await save(parsed.data, existing?.id);
      toast(existing ? "Credential updated" : "Credential saved");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="site">Website name</Label>
        <Input id="site" value={data.site} onChange={(e) => set("site")(e.target.value)} placeholder="GitHub" autoFocus />
      </div>
      <div>
        <Label htmlFor="url">Website URL</Label>
        <Input id="url" type="url" value={data.url} onChange={(e) => set("url")(e.target.value)} placeholder="https://github.com" />
      </div>
      <div>
        <Label htmlFor="username">Username / Email</Label>
        <Input id="username" autoComplete="off" value={data.username} onChange={(e) => set("username")(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={data.password}
            onChange={(e) => set("password")(e.target.value)}
            className="pr-12 font-mono"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute top-1/2 right-1.5 inline-flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <span key={String(showPassword)} className="swap">
              {showPassword ? <EyeOff /> : <Eye />}
            </span>
          </button>
        </div>
        <button
          type="button"
          onClick={() => setShowGenerator((s) => !s)}
          aria-expanded={showGenerator}
          className="mt-2.5 inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-violet-600 hover:underline dark:text-violet-300"
        >
          <Refresh width={15} height={15} />
          {showGenerator ? "Hide generator" : "Generate a strong password"}
        </button>
        {showGenerator && (
          <div className="enter mt-3">
            <PasswordGenerator
              onUse={(pw) => {
                set("password")(pw);
                setShowPassword(true);
              }}
            />
          </div>
        )}
      </div>
      <div>
        <Label htmlFor="notes">Notes (optional)</Label>
        <textarea
          id="notes"
          rows={3}
          value={data.notes}
          onChange={(e) => set("notes")(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-l-card px-3 py-2.5 text-sm transition-shadow focus:border-violet-600 focus:outline-none focus:ring-4 focus:ring-violet-600/15 dark:border-zinc-700"
        />
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Encrypting…" : existing ? "Save changes" : "Save credential"}
        </Button>
      </div>
    </form>
  );
}

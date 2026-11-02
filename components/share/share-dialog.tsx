"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";
import { sealSharePayload } from "@/lib/share/crypto";
import {
  DEFAULT_SHARE_EXPIRY_MINUTES,
  DESTROY_ON_OPEN_MAX_MINUTES,
  SHARE_EXPIRY_MINUTES,
} from "@/lib/share/constants";
import type { DecryptedCredential } from "@/lib/vault/credential";
import { Button, ErrorText, Label } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

interface Created {
  link: string;
  otp: string;
  expiresAt: string;
  destroyOnOpen: boolean;
}

const DESTROY = "destroy";

const expiryLabel = (m: number) => (m === 60 ? "1 hour" : `${m} minutes`);

export function ShareDialogBody({ credential, onDone }: { credential: DecryptedCredential; onDone: () => void }) {
  const toast = useToast();
  const [choice, setChoice] = useState<string>(String(DEFAULT_SHARE_EXPIRY_MINUTES));
  const [created, setCreated] = useState<Created | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    const destroyOnOpen = choice === DESTROY;
    setError("");
    setBusy(true);
    try {
      // Encrypted here, in the browser. The link key goes only into the
      // URL fragment, which browsers never send to the server.
      const sealed = await sealSharePayload({
        site: credential.site,
        url: credential.url,
        username: credential.username,
        password: credential.password,
      });
      const { share } = await api<{ share: { token: string; otp: string; expiresAt: string } }>(
        "/api/share/create",
        {
          method: "POST",
          body: {
            credentialId: credential.id,
            expiresInMinutes: destroyOnOpen ? DESTROY_ON_OPEN_MAX_MINUTES : Number(choice),
            destroyOnOpen,
            encryptedPayload: sealed.encryptedPayload,
            payloadIv: sealed.payloadIv,
            payloadSalt: sealed.payloadSalt,
          },
        }
      );
      setCreated({
        link: `${window.location.origin}/share/${share.token}#${sealed.linkKey}`,
        otp: share.otp,
        expiresAt: share.expiresAt,
        destroyOnOpen,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create share");
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${what} copied`);
    } catch {
      toast("Copy failed", "error");
    }
  }

  if (created) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Send the link and the code <strong>through different channels</strong> (e.g. link by email, code by
          text).{" "}
          {created.destroyOnOpen ? (
            <>
              The share is <strong>deleted the moment it&apos;s opened</strong> with the code. If nobody opens it, it
              expires on {new Date(created.expiresAt).toLocaleString()}.
            </>
          ) : (
            <>The link works once and expires at {new Date(created.expiresAt).toLocaleTimeString()}.</>
          )}
        </p>
        <div>
          <Label>Share link</Label>
          <div className="flex gap-2">
            <code className="flex-1 truncate rounded-lg bg-zinc-100 px-3 py-2.5 text-xs dark:bg-zinc-800">
              {created.link}
            </code>
            <Button variant="secondary" onClick={() => copy(created.link, "Link")}>
              Copy
            </Button>
          </div>
        </div>
        <div>
          <Label>One-time code</Label>
          <div className="flex gap-2">
            <code className="flex-1 rounded-lg bg-zinc-100 px-3 py-2 text-center font-mono text-2xl tracking-[0.4em] dark:bg-zinc-800">
              {created.otp}
            </code>
            <Button variant="secondary" onClick={() => copy(created.otp, "Code")}>
              Copy
            </Button>
          </div>
        </div>
        <p className="text-xs text-zinc-500">This code won&apos;t be shown again.</p>
        <div className="flex justify-end">
          <Button onClick={onDone}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Share <strong>{credential.site}</strong> through a one-time link protected by a separate code.
      </p>
      <div>
        <Label htmlFor="expiry">Expires after</Label>
        <select
          id="expiry"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {SHARE_EXPIRY_MINUTES.map((m) => (
            <option key={m} value={m}>
              {expiryLabel(m)}
            </option>
          ))}
          <option value={DESTROY}>Destroy after open (deleted as soon as it&apos;s opened)</option>
        </select>
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={create} disabled={busy}>
          {busy ? "Generating…" : "Generate secure share"}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api-client";
import { openSharePayload, type SharePayload } from "@/lib/share/crypto";
import { copySecret } from "@/lib/clipboard";
import { Button, Card, ErrorText, Input, Label } from "@/components/ui/primitives";
import { Check, LockMark } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";

type State = { kind: "enter" } | { kind: "gone" } | { kind: "revealed"; payload: SharePayload };

const LINK_KEY = /^[A-Za-z0-9_-]{43}$/;

// The decryption key is in the URL #fragment, which the browser never sends
// to the server. It's captured once per token (the fragment is stripped from
// the address bar right after), so re-renders keep seeing the same value.
let captured: { token: string; key: string | null } | null = null;

function readLinkKey(token: string): string | null {
  if (captured?.token !== token) {
    const hash = window.location.hash.slice(1);
    captured = { token, key: LINK_KEY.test(hash) ? hash : null };
  }
  return captured.key;
}

const noSubscribe = () => () => {};

export function ShareRedeem({ token }: Readonly<{ token: string }>) {
  // undefined during server render / before hydration, null if missing.
  const linkKey = useSyncExternalStore(noSubscribe, () => readLinkKey(token), () => undefined);
  const usedRef = useRef(false);
  const [state, setState] = useState<State>({ kind: "enter" });
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Strip the key from the address bar and history so it doesn't linger
    // on screen or in back-navigation.
    if (linkKey) window.history.replaceState(null, "", window.location.pathname);
  }, [linkKey]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!linkKey || usedRef.current) return;
    setError("");
    setBusy(true);
    let sealed: { encryptedPayload: string; payloadIv: string; payloadSalt: string };
    try {
      ({ payload: sealed } = await api<{ payload: typeof sealed }>("/api/share/verify", {
        method: "POST",
        body: { token, otp },
      }));
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && err.status === 401) {
        const left = Number(err.body.remainingAttempts);
        setError(`Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.`);
        setOtp("");
      } else if (err instanceof ApiError && (err.status === 410 || err.status === 400)) {
        setState({ kind: "gone" });
      } else {
        setError("Couldn't reach the server. Try again.");
      }
      return;
    }

    try {
      usedRef.current = true;
      const opened = await openSharePayload(linkKey, sealed);
      setState({ kind: "revealed", payload: opened });
    } catch {
      // The OTP was accepted (so the share is now consumed) but the link
      // key can't open the payload: the link was altered or truncated.
      setError("This link appears to be incomplete or altered.");
      setState({ kind: "gone" });
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string, label: string) {
    try {
      await copySecret(value);
      setCopied((c) => (c.includes(label) ? c : [...c, label]));
    } catch {
      setError("Copy failed — select and copy manually.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <Card className="enter p-8">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-zinc-200 text-l-cipher dark:bg-zinc-800">
          <LockMark width={26} height={26} />
        </div>

        {state.kind === "enter" && linkKey === undefined && (
          <output className="block space-y-3" aria-label="Loading">
            <Skeleton className="mx-auto h-5 w-2/3" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </output>
        )}

        {state.kind === "enter" && linkKey && (
          <>
            <h1 className="text-center text-xl font-semibold">Secure Share</h1>
            <p className="mt-2 text-center text-sm text-zinc-500">
              This credential was securely shared with you. Enter the one-time code you received separately.
            </p>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="otp">One-time code</Label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
                  autoFocus
                />
              </div>
              <ErrorText>{error}</ErrorText>
              <Button type="submit" className="w-full" disabled={busy || otp.length !== 6}>
                {busy ? "Verifying…" : "Verify"}
              </Button>
            </form>
            <p className="mt-4 text-center text-xs text-zinc-500">This link can only be used once.</p>
          </>
        )}

        {state.kind === "enter" && linkKey === null && (
          <>
            <h1 className="text-center text-xl font-semibold">Incomplete link</h1>
            <p className="mt-2 text-center text-sm text-zinc-500">
              This share link is missing its key. Ask the sender to copy the full link.
            </p>
          </>
        )}

        {state.kind === "gone" && (
          <>
            <h1 className="text-center text-xl font-semibold">Share unavailable</h1>
            <p className="mt-2 text-center text-sm text-zinc-500">
              {error || "This share has expired, was already used, or was revoked."}
            </p>
          </>
        )}

        {state.kind === "revealed" && (
          <>
            <h1 className="text-center text-xl font-semibold text-l-cipher">Credential Shared Successfully</h1>
            <dl className="mt-6 space-y-4 text-sm">
              <Field label="Website">{state.payload.url || state.payload.site}</Field>
              {state.payload.username && <Field label="Username">{state.payload.username}</Field>}
              <Field label="Password">
                <span className="font-mono">{showPassword ? state.payload.password : "••••••••••••"}</span>
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="ml-2 cursor-pointer text-xs text-violet-600 hover:underline"
                >
                  {showPassword ? "Hide" : "Reveal"}
                </button>
              </Field>
            </dl>
            <div className="mt-6 flex flex-wrap gap-2">
              {state.payload.url && (
                <Button variant="secondary" onClick={() => copy(state.payload.url, "URL")}>
                  Copy URL
                </Button>
              )}
              {state.payload.username && (
                <Button variant="secondary" onClick={() => copy(state.payload.username, "Username")}>
                  Copy username
                </Button>
              )}
              <Button onClick={() => copy(state.payload.password, "Password")}>Copy password</Button>
            </div>
            {copied.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-l-cipher">
                {copied.map((c) => (
                  <li key={c} className="enter flex items-center gap-1.5">
                    <Check width={15} height={15} />
                    {c} copied to clipboard
                  </li>
                ))}
              </ul>
            )}
            <ErrorText>{error}</ErrorText>
            <p className="mt-6 rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              This share has now been consumed. Save the credential before leaving this page — the link won&apos;t
              work again.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}

function Field({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-0.5 break-all">{children}</dd>
    </div>
  );
}

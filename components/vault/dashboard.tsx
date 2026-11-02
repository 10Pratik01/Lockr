"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useVault } from "./vault-provider";
import { CredentialForm } from "./credential-form";
import { ShareDialogBody } from "@/components/share/share-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Button, Card, Input } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { copySecret, CLIPBOARD_CLEAR_SECONDS } from "@/lib/clipboard";
import type { DecryptedCredential } from "@/lib/vault/credential";

type Modal =
  | { kind: "create" }
  | { kind: "edit"; credential: DecryptedCredential }
  | { kind: "share"; credential: DecryptedCredential }
  | { kind: "delete"; credential: DecryptedCredential }
  | null;

function hostOf(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function Dashboard() {
  const { credentials, unreadable, remove } = useVault();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [deleting, setDeleting] = useState(false);

  // Search runs over decrypted data in memory -- the server only has ciphertext.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return credentials;
    return credentials.filter((c) =>
      [c.site, c.url, c.username].some((field) => field.toLowerCase().includes(q))
    );
  }, [credentials, query]);

  async function confirmDelete(credential: DecryptedCredential) {
    setDeleting(true);
    try {
      await remove(credential.id);
      toast("Credential deleted");
      setModal(null);
    } catch {
      toast("Delete failed", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Welcome back</h1>
          <p className="text-sm text-zinc-500">
            {credentials.length} credential{credentials.length === 1 ? "" : "s"} in your vault
          </p>
        </div>
        <Button onClick={() => setModal({ kind: "create" })}>+ Add Credential</Button>
      </div>

      <Input
        type="search"
        placeholder="Search passwords…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search credentials"
      />

      {unreadable > 0 && (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {unreadable} credential{unreadable === 1 ? "" : "s"} couldn&apos;t be decrypted and {unreadable === 1 ? "is" : "are"} hidden.
        </p>
      )}

      {credentials.length === 0 ? (
        <Card className="py-16 text-center">
          <p className="text-4xl">🗝️</p>
          <h2 className="mt-3 font-semibold">Your vault is empty</h2>
          <p className="mt-1 text-sm text-zinc-500">Add your first credential — it&apos;s encrypted before it leaves this device.</p>
          <Button className="mt-5" onClick={() => setModal({ kind: "create" })}>
            + Add Credential
          </Button>
        </Card>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">No credentials match “{query}”.</p>
      ) : (
        <ul className="grid gap-3">
          {filtered.map((c) => (
            <CredentialRow
              key={c.id}
              credential={c}
              onCopy={async (value, what) => {
                try {
                  await copySecret(value);
                  toast(what === "Password" ? `Password copied — clears in ${CLIPBOARD_CLEAR_SECONDS}s` : `${what} copied`);
                } catch {
                  toast("Copy failed", "error");
                }
              }}
              onEdit={() => setModal({ kind: "edit", credential: c })}
              onShare={() => setModal({ kind: "share", credential: c })}
              onDelete={() => setModal({ kind: "delete", credential: c })}
            />
          ))}
        </ul>
      )}

      <Dialog
        open={modal?.kind === "create" || modal?.kind === "edit"}
        onClose={() => setModal(null)}
        title={modal?.kind === "edit" ? "Edit credential" : "Add credential"}
      >
        {(modal?.kind === "create" || modal?.kind === "edit") && (
          <CredentialForm
            key={modal.kind === "edit" ? modal.credential.id : "new"}
            existing={modal.kind === "edit" ? modal.credential : undefined}
            onDone={() => setModal(null)}
          />
        )}
      </Dialog>

      <Dialog open={modal?.kind === "share"} onClose={() => setModal(null)} title="Secure share">
        {modal?.kind === "share" && <ShareDialogBody credential={modal.credential} onDone={() => setModal(null)} />}
      </Dialog>

      <Dialog open={modal?.kind === "delete"} onClose={() => setModal(null)} title="Delete credential?">
        {modal?.kind === "delete" && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              <strong>{modal.credential.site}</strong> and any active shares of it will be permanently deleted.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setModal(null)}>
                Cancel
              </Button>
              <Button variant="danger" disabled={deleting} onClick={() => confirmDelete(modal.credential)}>
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function CredentialRow({
  credential: c,
  onCopy,
  onEdit,
  onShare,
  onDelete,
}: {
  credential: DecryptedCredential;
  onCopy: (value: string, what: string) => void;
  onEdit: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const host = hostOf(c.url);

  return (
    <li>
      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-sm font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
              {c.site.charAt(0).toUpperCase()}
            </span>
            <h3 className="truncate font-medium">
              <Link href={`/vault/${encodeURIComponent(c.id)}`} className="hover:underline">
                {c.site}
              </Link>
            </h3>
          </div>
          {host && <p className="truncate text-xs text-zinc-500">{host}</p>}
          {c.username && <p className="truncate text-sm text-zinc-700 dark:text-zinc-300">{c.username}</p>}
          <p className="truncate font-mono text-sm text-zinc-500">{revealed ? c.password : "••••••••••••"}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setRevealed((r) => !r)}>
            {revealed ? "Hide" : "Reveal"}
          </Button>
          {c.username && (
            <Button size="sm" variant="secondary" onClick={() => onCopy(c.username, "Username")}>
              Copy user
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => onCopy(c.password, "Password")}>
            Copy password
          </Button>
          {c.url && (
            // http(s)-only is enforced by the credential schema; noopener
            // stops the opened site from reaching back into this tab.
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center rounded-lg border border-zinc-300 px-3 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Open
            </a>
          )}
          <Button size="sm" variant="secondary" onClick={onShare}>
            Share
          </Button>
          <Button size="sm" variant="ghost" onClick={onEdit}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="text-red-600 dark:text-red-400">
            Delete
          </Button>
        </div>
      </Card>
    </li>
  );
}

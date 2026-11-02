"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useVault } from "./vault-provider";
import { CredentialForm } from "./credential-form";
import { ShareDialogBody } from "@/components/share/share-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Button, Input } from "@/components/ui/primitives";
import { Check, Copy, Eye, EyeOff, External, LockMark, Pencil, Plus, Search, Share, Trash } from "@/components/ui/icons";
import { Menu } from "@/components/ui/menu";
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
          <h1 className="font-display text-3xl font-medium tracking-tight">Your vault</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {credentials.length} credential{credentials.length === 1 ? "" : "s"} in your vault
          </p>
        </div>
        <Button onClick={() => setModal({ kind: "create" })}>
          <Plus width={16} height={16} />
          Add credential
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-zinc-500" />
        <Input
          type="search"
          placeholder="Search by site, URL or username"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search credentials"
          className="pl-10"
        />
      </div>

      {unreadable > 0 && (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {unreadable} credential{unreadable === 1 ? "" : "s"} couldn&apos;t be decrypted and {unreadable === 1 ? "is" : "are"} hidden.
        </p>
      )}

      {credentials.length === 0 ? (
        <div className="enter rounded-2xl border border-dashed border-zinc-300 px-6 py-20 text-center dark:border-zinc-700">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-zinc-200 text-l-cipher dark:bg-zinc-800">
            <LockMark width={26} height={26} />
          </span>
          <h2 className="mt-5 font-display text-2xl font-medium">Nothing in the vault yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">
            Add your first login. It is encrypted in this browser before anything is sent, so only you can read it.
          </p>
          <Button className="mt-6" onClick={() => setModal({ kind: "create" })}>
            <Plus width={16} height={16} />
            Add your first credential
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">No credentials match “{query}”.</p>
      ) : (
        <ul className="grid gap-3">
          {filtered.map((c, i) => (
            <CredentialRow
              key={c.id}
              index={i}
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
  index,
  onCopy,
  onEdit,
  onShare,
  onDelete,
}: {
  credential: DecryptedCredential;
  index: number;
  onCopy: (value: string, what: string) => void;
  onEdit: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const host = hostOf(c.url);

  function copyPassword() {
    onCopy(c.password, "Password");
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <li className="enter" style={{ "--i": Math.min(index, 10) } as React.CSSProperties}>
      <div className="group flex items-center gap-3 rounded-xl border border-zinc-200 bg-l-card p-3.5 transition-[border-color,transform] duration-200 hover:border-zinc-400 sm:p-4 dark:border-zinc-800 dark:hover:border-zinc-600">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-200 font-display text-lg text-l-cipher dark:bg-zinc-800">
          {c.site.charAt(0).toUpperCase()}
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium">
            <Link href={`/vault/${encodeURIComponent(c.id)}`} className="hover:underline">
              {c.site}
            </Link>
          </h3>
          <p className="truncate text-sm text-zinc-500">
            {[c.username, host].filter(Boolean).join(" · ") || "No username"}
          </p>
          <p
            className={`mt-1 truncate font-mono text-[13px] transition-colors ${
              revealed ? "text-l-fg" : "text-zinc-500"
            }`}
          >
            {revealed ? c.password : "••••••••••••"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            aria-label={revealed ? `Hide password for ${c.site}` : `Reveal password for ${c.site}`}
            aria-pressed={revealed}
            className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <span key={String(revealed)} className="swap">
              {revealed ? <EyeOff /> : <Eye />}
            </span>
          </button>
          <Button size="sm" onClick={copyPassword} aria-label={`Copy password for ${c.site}`} className="hidden sm:inline-flex">
            <span key={String(copied)} className="swap inline-flex">
              {copied ? <Check width={15} height={15} /> : <Copy width={15} height={15} />}
            </span>
            {copied ? "Copied" : "Copy password"}
          </Button>
          <button
            type="button"
            onClick={copyPassword}
            aria-label={`Copy password for ${c.site}`}
            className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full bg-l-fg text-l-bg sm:hidden"
          >
            {copied ? <Check /> : <Copy />}
          </button>
          <Menu
            label={`More actions for ${c.site}`}
            items={[
              ...(c.username
                ? [{ label: "Copy username", icon: <Copy width={16} height={16} />, onSelect: () => onCopy(c.username, "Username") }]
                : []),
              // http(s)-only is enforced by the credential schema; noopener
              // stops the opened site from reaching back into this tab.
              ...(c.url ? [{ label: "Open site", icon: <External width={16} height={16} />, href: c.url }] : []),
              { label: "Share once", icon: <Share width={16} height={16} />, onSelect: onShare },
              { label: "Edit", icon: <Pencil width={16} height={16} />, onSelect: onEdit },
              { label: "Delete", icon: <Trash width={16} height={16} />, onSelect: onDelete, danger: true },
            ]}
          />
        </div>
      </div>
    </li>
  );
}

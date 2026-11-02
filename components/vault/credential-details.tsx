"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useVault } from "./vault-provider";
import { CredentialForm } from "./credential-form";
import { ShareDialogBody } from "@/components/share/share-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Button, Card } from "@/components/ui/primitives";
import { ArrowLeft, Check, Copy, Eye, EyeOff, External, Pencil, Share, Trash } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { copySecret, CLIPBOARD_CLEAR_SECONDS } from "@/lib/clipboard";

export function CredentialDetails({ id }: { id: string }) {
  const { credentials, remove } = useVault();
  const toast = useToast();
  const router = useRouter();
  const [revealed, setRevealed] = useState(false);
  const [modal, setModal] = useState<"edit" | "share" | "delete" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const credential = credentials.find((c) => c.id === id);

  if (!credential) {
    return (
      <Card className="py-12 text-center">
        <p className="font-medium">Credential not found</p>
        <Link href="/dashboard" className="mt-3 inline-flex items-center gap-1.5 text-sm text-violet-600 hover:underline">
          <ArrowLeft width={15} height={15} />
          Back to vault
        </Link>
      </Card>
    );
  }

  async function copy(value: string, what: string) {
    try {
      await copySecret(value);
      toast(what === "Password" ? `Password copied — clears in ${CLIPBOARD_CLEAR_SECONDS}s` : `${what} copied`);
    } catch {
      toast("Copy failed", "error");
    }
  }

  async function onDelete() {
    setDeleting(true);
    try {
      await remove(id);
      toast("Credential deleted");
      router.push("/dashboard");
    } catch {
      toast("Delete failed", "error");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-l-fg">
        <ArrowLeft width={15} height={15} />
        Back to vault
      </Link>
      <Card className="enter p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-display text-3xl font-medium tracking-tight">{credential.site}</h1>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setModal("share")}>
              <Share width={15} height={15} />
              Share once
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setModal("edit")}>
              <Pencil width={15} height={15} />
              Edit
            </Button>
            <Button size="sm" variant="danger" onClick={() => setModal("delete")}>
              <Trash width={15} height={15} />
              Delete
            </Button>
          </div>
        </div>

        <dl className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <Row label="Website URL">
            {credential.url ? (
              <a href={credential.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-violet-600 hover:underline dark:text-violet-300">
                {credential.url}
                <External width={14} height={14} className="shrink-0" />
              </a>
            ) : (
              <span className="text-zinc-400">—</span>
            )}
          </Row>
          <Row label="Username / Email">
            <span>{credential.username || <span className="text-zinc-400">—</span>}</span>
            {credential.username && <CopyButton onClick={() => copy(credential.username, "Username")} label="Copy username" />}
          </Row>
          <Row label="Password">
            <span className="font-mono">{revealed ? credential.password : "••••••••••••"}</span>
            <IconButton
              label={revealed ? "Hide password" : "Reveal password"}
              onClick={() => setRevealed((r) => !r)}
              swapKey={String(revealed)}
            >
              {revealed ? <EyeOff width={16} height={16} /> : <Eye width={16} height={16} />}
            </IconButton>
            <CopyButton onClick={() => copy(credential.password, "Password")} label="Copy password" />
          </Row>
          <Row label="Last updated">
            {new Date(credential.updatedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
          </Row>
          {credential.notes && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-zinc-500">Notes</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm">{credential.notes}</dd>
            </div>
          )}
        </dl>
      </Card>

      <Dialog open={modal === "edit"} onClose={() => setModal(null)} title="Edit credential">
        {modal === "edit" && <CredentialForm existing={credential} onDone={() => setModal(null)} />}
      </Dialog>
      <Dialog open={modal === "share"} onClose={() => setModal(null)} title="Secure share">
        {modal === "share" && <ShareDialogBody credential={credential} onDone={() => setModal(null)} />}
      </Dialog>
      <Dialog open={modal === "delete"} onClose={() => setModal(null)} title="Delete credential?">
        {modal === "delete" && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              <strong>{credential.site}</strong> and any active shares of it will be permanently deleted.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setModal(null)}>
                Cancel
              </Button>
              <Button variant="danger" disabled={deleting} onClick={onDelete}>
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-zinc-500">{label}</dt>
      <dd className="mt-1 flex flex-wrap items-center break-all text-sm">{children}</dd>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  swapKey,
  children,
}: {
  label: string;
  onClick: () => void;
  swapKey: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="ml-1 inline-flex size-9 cursor-pointer items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      <span key={swapKey} className="swap">
        {children}
      </span>
    </button>
  );
}

function CopyButton({ onClick, label }: { onClick: () => void; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <IconButton
      label={label}
      swapKey={String(done)}
      onClick={() => {
        onClick();
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
    >
      {done ? <Check width={16} height={16} /> : <Copy width={16} height={16} />}
    </IconButton>
  );
}

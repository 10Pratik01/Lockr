"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useVault } from "./vault-provider";
import { CredentialForm } from "./credential-form";
import { ShareDialogBody } from "@/components/share/share-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Button, Card } from "@/components/ui/primitives";
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
        <Link href="/dashboard" className="mt-3 inline-block text-sm text-violet-600 hover:underline">
          ← Back to vault
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
      <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
        ← Back to vault
      </Link>
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold">{credential.site}</h1>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setModal("share")}>
              Share
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setModal("edit")}>
              Edit
            </Button>
            <Button size="sm" variant="danger" onClick={() => setModal("delete")}>
              Delete
            </Button>
          </div>
        </div>

        <dl className="mt-6 grid gap-5 sm:grid-cols-2">
          <Row label="Website URL">
            {credential.url ? (
              <a href={credential.url} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">
                {credential.url}
              </a>
            ) : (
              <span className="text-zinc-400">—</span>
            )}
          </Row>
          <Row label="Username / Email">
            <span>{credential.username || <span className="text-zinc-400">—</span>}</span>
            {credential.username && <CopyLink onClick={() => copy(credential.username, "Username")} />}
          </Row>
          <Row label="Password">
            <span className="font-mono">{revealed ? credential.password : "••••••••••••"}</span>
            <button
              type="button"
              onClick={() => setRevealed((r) => !r)}
              className="ml-2 cursor-pointer text-xs text-violet-600 hover:underline"
            >
              {revealed ? "Hide" : "Reveal"}
            </button>
            <CopyLink onClick={() => copy(credential.password, "Password")} />
          </Row>
          <Row label="Last updated">{new Date(credential.updatedAt).toLocaleString()}</Row>
          {credential.notes && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Notes</dt>
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
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-1 flex flex-wrap items-center break-all text-sm">{children}</dd>
    </div>
  );
}

function CopyLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="ml-2 cursor-pointer text-xs text-violet-600 hover:underline">
      Copy
    </button>
  );
}

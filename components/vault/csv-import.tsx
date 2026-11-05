"use client";

import { useRef, useState } from "react";
import { useVault } from "./vault-provider";
import { Button, ErrorText } from "@/components/ui/primitives";
import { Upload } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { MAX_IMPORT_BYTES, parseImport, type ImportRow } from "@/lib/vault/csv";

/**
 * CSV import (Chrome / Brave "Export passwords"). The file is read and parsed
 * in this tab and every row is encrypted with the vault key before upload --
 * the server never sees the CSV or any plaintext.
 */
export function CsvImport({ onDone }: { onDone: () => void }) {
  const { credentials, importCredentials } = useVault();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<number | null>(null);

  const ready = rows?.filter((r) => r.status === "ready") ?? [];
  const duplicates = rows?.filter((r) => r.status === "duplicate").length ?? 0;
  const invalid = rows?.filter((r) => r.status === "invalid") ?? [];
  const busy = progress !== null;

  async function onFile(file: File | undefined) {
    setError("");
    setRows(null);
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setError("That file is too large (2 MB limit).");
      return;
    }
    setFileName(file.name);
    const result = parseImport(await file.text(), credentials);
    if (result.fileError) setError(result.fileError);
    else setRows(result.rows);
  }

  async function run() {
    setError("");
    setProgress(0);
    try {
      const count = await importCredentials(
        ready.flatMap((r) => (r.data ? [r.data] : [])),
        setProgress
      );
      toast(`Imported ${count} credential${count === 1 ? "" : "s"}`);
      onDone();
    } catch {
      setError("Import stopped part-way. Rows already uploaded are in your vault; re-run to add the rest (duplicates are skipped).");
      setProgress(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        In Chrome or Brave open <strong>Password Manager → Settings → Export passwords</strong>, then choose the
        file here. Rows are encrypted in this browser; the CSV itself is never uploaded.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        aria-label="Choose CSV file"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <Button variant="secondary" className="w-full" disabled={busy} onClick={() => inputRef.current?.click()}>
        <Upload width={16} height={16} />
        {fileName || "Choose CSV file"}
      </Button>

      <ErrorText>{error}</ErrorText>

      {rows && (
        <div className="space-y-3">
          <dl className="grid grid-cols-3 gap-2 text-center text-sm">
            <Stat label="To import" value={ready.length} />
            <Stat label="Duplicates" value={duplicates} />
            <Stat label="Invalid" value={invalid.length} />
          </dl>

          {(invalid.length > 0 || ready.some((r) => r.message)) && (
            <ul className="max-h-36 space-y-1 overflow-y-auto rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              {[...invalid, ...ready.filter((r) => r.message)].map((r) => (
                <li key={r.line}>
                  Line {r.line}: {r.message}
                  {r.status === "invalid" ? " — skipped" : ""}
                </li>
              ))}
            </ul>
          )}

          <p className="text-xs text-zinc-500">
            Duplicates (same site, username and password already in your vault) are skipped. Delete the CSV from
            your device afterwards: it holds every password in plain text.
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={busy} onClick={onDone}>
              Cancel
            </Button>
            <Button disabled={busy || ready.length === 0} onClick={run}>
              {busy ? `Importing… ${progress}/${ready.length}` : `Import ${ready.length} credential${ready.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 py-2 dark:border-zinc-800">
      <dd className="font-display text-2xl">{value}</dd>
      <dt className="text-xs text-zinc-500">{label}</dt>
    </div>
  );
}

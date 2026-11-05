// Parses password-manager CSV exports (Chrome, Brave, Edge, Firefox, ...) into
// credential candidates. Runs entirely in the browser: the plaintext never
// leaves the page, and each row is encrypted with the vault key before upload.
import { credentialSchema, type CredentialData } from "@/lib/vault/credential";

// Abuse / memory guards. A real export is a few hundred rows.
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 2000;

/** RFC 4180 parser: quoted fields, "" escapes, CRLF/LF, newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // strip BOM
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === "") {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop fully blank lines.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

type Field = keyof CredentialData;

// Header aliases across browsers/managers, compared lowercase.
const HEADER_ALIASES: Record<Field, string[]> = {
  site: ["name", "title", "site", "website name"],
  url: ["url", "website", "web site", "login_uri", "origin", "address"],
  username: ["username", "login", "login_username", "user", "user name", "email"],
  password: ["password", "login_password", "pass"],
  notes: ["note", "notes", "extra", "comments", "comment"],
};

export type ImportStatus = "ready" | "duplicate" | "invalid";

export interface ImportRow {
  /** 1-based line number in the file (header is line 1). */
  line: number;
  status: ImportStatus;
  /** Why the row is invalid, or a non-fatal heads-up on a ready row. */
  message?: string;
  data?: CredentialData;
}

export interface ParsedImport {
  rows: ImportRow[];
  /** Set when the file doesn't look like a password export at all. */
  fileError?: string;
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Identity used to detect rows already in the vault (or repeated in the file). */
export function credentialFingerprint(c: Pick<CredentialData, "site" | "url" | "username" | "password">) {
  const place = hostOf(c.url) || c.site.trim().toLowerCase();
  return JSON.stringify([place, c.username.trim().toLowerCase(), c.password]);
}

export function parseImport(text: string, existing: readonly CredentialData[] = []): ParsedImport {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], fileError: "The file is empty." };

  const header = table[0].map((h) => h.trim().toLowerCase());
  const column = {} as Record<Field, number>;
  for (const field of Object.keys(HEADER_ALIASES) as Field[]) {
    column[field] = header.findIndex((h) => HEADER_ALIASES[field].includes(h));
  }
  if (column.password === -1 || (column.url === -1 && column.site === -1)) {
    return {
      rows: [],
      fileError:
        "This doesn’t look like a password export. Expected a header row such as: name,url,username,password,note.",
    };
  }
  if (table.length - 1 > MAX_IMPORT_ROWS) {
    return { rows: [], fileError: `Too many rows (limit ${MAX_IMPORT_ROWS}). Split the file and import it in parts.` };
  }

  const seen = new Set(existing.map(credentialFingerprint));
  const cell = (r: string[], field: Field) => (column[field] === -1 ? "" : (r[column[field]] ?? ""));

  const rows = table.slice(1).map((r, i): ImportRow => {
    const line = i + 2;
    let url = cell(r, "url").trim();
    let notes = cell(r, "notes");
    let message: string | undefined;

    // Chrome also exports app logins like "android://…" -- keep the data, but
    // never store a non-http(s) URL (the "Open site" button would follow it).
    if (url && !/^https?:\/\//i.test(url)) {
      notes = [notes, `Original URL: ${url}`].filter(Boolean).join("\n");
      url = "";
      message = "URL isn’t http(s); moved to notes";
    }

    const site = cell(r, "site").trim() || hostOf(url);
    const parsed = credentialSchema.safeParse({
      site,
      url,
      username: cell(r, "username"),
      password: cell(r, "password"),
      notes,
    });
    if (!parsed.success) {
      return { line, status: "invalid", message: parsed.error.issues[0]?.message ?? "Invalid row" };
    }

    const fingerprint = credentialFingerprint(parsed.data);
    if (seen.has(fingerprint)) return { line, status: "duplicate", data: parsed.data };
    seen.add(fingerprint);
    return { line, status: "ready", message, data: parsed.data };
  });

  return { rows };
}

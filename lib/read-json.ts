// Parses a JSON body, returning null if it's malformed or over maxBytes.
// shortcut: a chunked body is fully buffered before the length check, so this
// bounds what we process, not what we receive; the host's own limit covers that.
export async function readJson(request: Request, maxBytes = 32_768): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) return null;
  const text = await request.text().catch(() => "");
  if (text.length > maxBytes) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Clipboard helpers. Copied secrets are never logged or sent anywhere.

export const CLIPBOARD_CLEAR_SECONDS = 30;

/**
 * Copies text, then clears the clipboard after a delay -- but only if it
 * still holds what we put there, so we never wipe something the user
 * copied since. Browsers may deny the read; then we leave it alone. OS
 * clipboard history and clipboard managers are outside our control.
 */
export async function copySecret(text: string, clearAfterSeconds = CLIPBOARD_CLEAR_SECONDS) {
  await navigator.clipboard.writeText(text);
  if (clearAfterSeconds <= 0) return;
  setTimeout(async () => {
    try {
      if ((await navigator.clipboard.readText()) === text) await navigator.clipboard.writeText("");
    } catch {
      // Read permission denied or document not focused -- nothing safe to do.
    }
  }, clearAfterSeconds * 1000);
}

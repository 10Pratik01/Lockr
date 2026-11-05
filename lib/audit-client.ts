// Browser -> server activity reports for things only the browser sees
// (unlock, lock, reveal, copy). Fire-and-forget: a failed report must never
// get in the way of what the user is doing.
import { api } from "@/lib/api-client";
import type { CLIENT_AUDIT_ACTIONS } from "@/lib/audit-actions";

export function reportEvent(action: (typeof CLIENT_AUDIT_ACTIONS)[number], targetId?: string) {
  api("/api/audit", { method: "POST", body: { action, targetId } }).catch(() => {});
}

// Pure constants (no server imports) so client components can use them.
export const AUDIT_ACTIONS = {
  "vault.setup": "Created vault",
  "vault.unlock": "Unlocked vault",
  "vault.unlock_failed": "Failed unlock attempt",
  "vault.lock": "Locked vault",
  "vault.passphrase_changed": "Changed vault passphrase",
  "vault.reset": "Reset vault (all credentials wiped)",
  "credential.create": "Added credential",
  "credential.update": "Edited credential",
  "credential.delete": "Deleted credential",
  "credential.import": "Imported credentials from CSV",
  "credential.view": "Viewed credential",
  "credential.copy_password": "Copied password",
  "credential.copy_username": "Copied username",
  "share.create": "Created secure share",
  "share.revoke": "Revoked share",
  "share.opened": "Share was opened by recipient",
  "reset.request": "Requested passphrase reset",
  "reset.cancel": "Cancelled reset request",
  "reset.approve": "Reset request approved by admin",
  "reset.deny": "Reset request denied by admin",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

/** Events the browser may report itself (things the server never sees). */
export const CLIENT_AUDIT_ACTIONS = [
  "vault.unlock",
  "vault.unlock_failed",
  "vault.lock",
  "credential.view",
  "credential.copy_password",
  "credential.copy_username",
] as const satisfies readonly AuditAction[];

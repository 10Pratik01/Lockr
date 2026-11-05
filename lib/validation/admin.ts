import { z } from "zod";
import { CLIENT_AUDIT_ACTIONS } from "@/lib/audit-actions";

export const resetRequestSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

// The user must type RESET: wiping the vault is irreversible.
export const resetExecuteSchema = z.object({ confirm: z.literal("RESET") });

export const resetDecisionSchema = z.object({
  id: z.string().min(1).max(64),
  decision: z.enum(["approve", "deny"]),
});

export const clientAuditSchema = z.object({
  action: z.enum(CLIENT_AUDIT_ACTIONS),
  targetId: z.string().min(1).max(64).optional(),
});

/** How long an admin approval stays usable. */
export const RESET_APPROVAL_HOURS = 24;

// Shared by client and server -- no secrets or Node-only imports here.
export const MAX_OTP_ATTEMPTS = 5;
export const SHARE_EXPIRY_MINUTES = [5, 10, 30, 60] as const;
export const DEFAULT_SHARE_EXPIRY_MINUTES = 10;

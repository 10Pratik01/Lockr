// Shared by client and server -- no secrets or Node-only imports here.
export const MAX_OTP_ATTEMPTS = 5;
export const SHARE_EXPIRY_MINUTES = [5, 10, 30, 60] as const;
export const DEFAULT_SHARE_EXPIRY_MINUTES = 10;

// "Destroy after open" shares have no short timer -- they live until opened,
// but still carry a hard 24h expiry so an unopened share can't linger forever.
export const DESTROY_ON_OPEN_MAX_MINUTES = 24 * 60;

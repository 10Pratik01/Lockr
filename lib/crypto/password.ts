// Secure password generator. Every random choice goes through randomInt,
// which is rejection-sampled from crypto.getRandomValues -- never Math.random().
import { randomInt } from "./random";

export const CHARSETS = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.<>?/~",
} as const;

export type CharsetName = keyof typeof CHARSETS;

export interface PasswordOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
}

export const DEFAULT_PASSWORD_OPTIONS: PasswordOptions = {
  length: 20,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
};

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

export function generatePassword(options: PasswordOptions): string {
  const sets = (Object.keys(CHARSETS) as CharsetName[])
    .filter((name) => options[name])
    .map((name) => CHARSETS[name]);

  if (sets.length === 0) throw new Error("Select at least one character type");
  if (
    !Number.isInteger(options.length) ||
    options.length < Math.max(MIN_PASSWORD_LENGTH, sets.length) ||
    options.length > MAX_PASSWORD_LENGTH
  ) {
    throw new RangeError(`Length must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH}`);
  }

  // One guaranteed character from each selected set, the rest from the
  // union, then a Fisher-Yates shuffle so the guaranteed ones aren't
  // always at the front.
  const pool = sets.join("");
  const chars = sets.map((set) => set[randomInt(set.length)]);
  while (chars.length < options.length) chars.push(pool[randomInt(pool.length)]);

  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

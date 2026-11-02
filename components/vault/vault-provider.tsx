"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { api } from "@/lib/api-client";
import { createVaultKey, rewrapVaultKey, unlockVaultKey } from "@/lib/vault/keys";
import {
  decryptCredential,
  encryptCredential,
  type CredentialData,
  type DecryptedCredential,
  type StoredCredential,
} from "@/lib/vault/credential";
import type { VaultKeyInput } from "@/lib/validation/vault";

export type VaultStatus = "loading" | "no-vault" | "locked" | "unlocked" | "error";

export const AUTO_LOCK_OPTIONS = [5, 10, 15, 30, 0] as const; // 0 = never
const DEFAULT_AUTO_LOCK_MINUTES = 10;
const AUTO_LOCK_STORAGE_KEY = "privault:autoLockMinutes";
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "mousemove", "scroll", "touchstart"] as const;

interface VaultContextValue {
  status: VaultStatus;
  credentials: DecryptedCredential[];
  /** Number of stored credentials that failed to decrypt (corrupt/tampered). */
  unreadable: number;
  autoLockMinutes: number;
  setAutoLockMinutes: (minutes: number) => void;
  setup: (passphrase: string) => Promise<void>;
  unlock: (passphrase: string) => Promise<void>;
  lock: () => void;
  refresh: () => Promise<void>;
  save: (data: CredentialData, id?: string) => Promise<DecryptedCredential>;
  remove: (id: string) => Promise<void>;
  changePassphrase: (current: string, next: string) => Promise<void>;
}

const VaultContext = createContext<VaultContextValue | null>(null);

export function useVault() {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be used inside <VaultProvider>");
  return ctx;
}

const AUTO_LOCK_CHANGED = "privault:auto-lock-changed";
// Fallback when localStorage is unavailable (e.g. blocked in private mode).
let memoryAutoLock: number | null = null;

function readAutoLockPreference(): number {
  if (memoryAutoLock !== null) return memoryAutoLock;
  try {
    const raw = localStorage.getItem(AUTO_LOCK_STORAGE_KEY);
    const stored = Number(raw);
    return raw !== null && (AUTO_LOCK_OPTIONS as readonly number[]).includes(stored)
      ? stored
      : DEFAULT_AUTO_LOCK_MINUTES;
  } catch {
    return DEFAULT_AUTO_LOCK_MINUTES;
  }
}

function subscribeAutoLock(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(AUTO_LOCK_CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(AUTO_LOCK_CHANGED, onChange);
  };
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<VaultStatus>("loading");
  const [record, setRecord] = useState<VaultKeyInput | null>(null);
  const [credentials, setCredentials] = useState<DecryptedCredential[]>([]);
  const [unreadable, setUnreadable] = useState(0);
  const autoLockMinutes = useSyncExternalStore(
    subscribeAutoLock,
    readAutoLockPreference,
    () => DEFAULT_AUTO_LOCK_MINUTES
  );

  // The unwrapped DEK lives only in this ref -- never in React state (which
  // devtools can inspect), never in storage, never sent anywhere.
  const dekRef = useRef<CryptoKey | null>(null);
  const lastActivityRef = useRef(0);

  useEffect(() => {
    api<{ vault: VaultKeyInput | null }>("/api/vault/key")
      .then(({ vault }) => {
        setRecord(vault);
        setStatus(vault ? "locked" : "no-vault");
      })
      .catch(() => setStatus("error"));
  }, []);

  const lock = useCallback(() => {
    dekRef.current = null;
    setCredentials([]);
    setUnreadable(0);
    setStatus((s) => (s === "unlocked" ? "locked" : s));
  }, []);

  const loadCredentials = useCallback(async (dek: CryptoKey) => {
    const { credentials: stored } = await api<{ credentials: StoredCredential[] }>("/api/vault/list");
    const results = await Promise.allSettled(stored.map((c) => decryptCredential(c, dek)));
    setCredentials(results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])));
    setUnreadable(results.filter((r) => r.status === "rejected").length);
  }, []);

  const refresh = useCallback(async () => {
    if (dekRef.current) await loadCredentials(dekRef.current);
  }, [loadCredentials]);

  const enter = useCallback(
    async (dek: CryptoKey) => {
      dekRef.current = dek;
      lastActivityRef.current = Date.now();
      await loadCredentials(dek);
      setStatus("unlocked");
    },
    [loadCredentials]
  );

  const setup = useCallback(
    async (passphrase: string) => {
      const { record: next, dek } = await createVaultKey(passphrase);
      await api("/api/vault/key", { method: "POST", body: next });
      setRecord(next);
      await enter(dek);
    },
    [enter]
  );

  const unlock = useCallback(
    async (passphrase: string) => {
      if (!record) throw new Error("Vault not loaded");
      let dek: CryptoKey;
      try {
        dek = await unlockVaultKey(passphrase, record);
      } catch {
        throw new Error("Incorrect vault passphrase");
      }
      await enter(dek);
    },
    [record, enter]
  );

  const save = useCallback(async (data: CredentialData, id?: string) => {
    const dek = dekRef.current;
    if (!dek) throw new Error("Vault is locked");
    const body = await encryptCredential(data, dek);
    const { credential } = id
      ? await api<{ credential: StoredCredential }>(`/api/vault/${encodeURIComponent(id)}`, { method: "PATCH", body })
      : await api<{ credential: StoredCredential }>("/api/vault/create", { method: "POST", body });
    const decrypted = await decryptCredential(credential, dek);
    setCredentials((list) => [decrypted, ...list.filter((c) => c.id !== decrypted.id)]);
    return decrypted;
  }, []);

  const remove = useCallback(async (id: string) => {
    await api(`/api/vault/${encodeURIComponent(id)}`, { method: "DELETE" });
    setCredentials((list) => list.filter((c) => c.id !== id));
  }, []);

  const changePassphrase = useCallback(async (current: string, next: string) => {
    // Re-fetch so we compare-and-swap against the key actually on the server.
    const { vault } = await api<{ vault: VaultKeyInput | null }>("/api/vault/key");
    if (!vault) throw new Error("Vault not set up");
    let dek: CryptoKey;
    try {
      dek = await unlockVaultKey(current, vault);
    } catch {
      throw new Error("Current vault passphrase is incorrect");
    }
    const rewrapped = await rewrapVaultKey(dek, next);
    await api("/api/vault/key", {
      method: "PATCH",
      body: { ...rewrapped, previousWrappedVaultKey: vault.wrappedVaultKey },
    });
    setRecord(rewrapped);
  }, []);

  const setAutoLockMinutes = useCallback((minutes: number) => {
    try {
      localStorage.setItem(AUTO_LOCK_STORAGE_KEY, String(minutes));
    } catch {
      // Storage unavailable (private mode) -- preference lasts this page session only.
      memoryAutoLock = minutes;
    }
    window.dispatchEvent(new Event(AUTO_LOCK_CHANGED));
  }, []);

  // Auto-lock on inactivity. An interval comparing timestamps (rather than
  // one long setTimeout) also catches time spent with the laptop asleep.
  useEffect(() => {
    if (status !== "unlocked" || autoLockMinutes === 0) return;
    const touch = () => (lastActivityRef.current = Date.now());
    touch();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const timer = setInterval(() => {
      if (Date.now() - lastActivityRef.current > autoLockMinutes * 60_000) lock();
    }, 5_000);
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, touch));
      clearInterval(timer);
    };
  }, [status, autoLockMinutes, lock]);

  const value = useMemo<VaultContextValue>(
    () => ({
      status,
      credentials,
      unreadable,
      autoLockMinutes,
      setAutoLockMinutes,
      setup,
      unlock,
      lock,
      refresh,
      save,
      remove,
      changePassphrase,
    }),
    [status, credentials, unreadable, autoLockMinutes, setAutoLockMinutes, setup, unlock, lock, refresh, save, remove, changePassphrase]
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

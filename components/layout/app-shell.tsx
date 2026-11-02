"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { UserButton } from "@clerk/nextjs";
import { useVault } from "@/components/vault/vault-provider";
import { Button } from "@/components/ui/primitives";
import { LockMark } from "@/components/ui/icons";

const NAV = [
  { href: "/dashboard", label: "Vault" },
  { href: "/shares", label: "Shares" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { status, lock } = useVault();

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-l-bg/85 backdrop-blur dark:border-zinc-800">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-display text-lg tracking-tight">
            <LockMark width={20} height={20} />
            Privault
          </Link>
          <nav className="flex gap-1" aria-label="Main">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                  pathname === item.href
                    ? "bg-zinc-200 font-medium dark:bg-zinc-800"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {status === "unlocked" && (
              <Button size="sm" variant="secondary" onClick={lock}>
                <LockMark width={15} height={15} />
                Lock vault
              </Button>
            )}
            <UserButton />
          </div>
        </div>
      </header>
      <main key={pathname} className="enter mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}

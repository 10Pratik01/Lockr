"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { UserButton } from "@clerk/nextjs";
import { useVault } from "@/components/vault/vault-provider";
import { Button } from "@/components/ui/primitives";
import { LockMark } from "@/components/ui/icons";
import { useAdminPending } from "@/components/admin/use-admin-pending";

const NAV = [
  { href: "/dashboard", label: "Vault" },
  { href: "/shares", label: "Shares" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({ children, isAdmin }: { children: ReactNode; isAdmin: boolean }) {
  const pathname = usePathname();
  const { status, lock } = useVault();
  const pending = useAdminPending(isAdmin);
  const nav = isAdmin ? [...NAV, { href: "/admin", label: "Admin" }] : NAV;

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-l-bg/85 backdrop-blur dark:border-zinc-800">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 sm:h-14 sm:flex-nowrap sm:py-0">
          <Link href="/dashboard" className="flex items-center gap-2 font-display text-lg tracking-tight">
            <LockMark width={20} height={20} />
            Privault
          </Link>
          <nav className="order-last -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:mx-0 sm:w-auto" aria-label="Main">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                className={`rounded-full px-3.5 py-2.5 text-sm whitespace-nowrap transition-colors sm:py-1.5 ${
                  pathname === item.href
                    ? "bg-zinc-200 font-medium dark:bg-zinc-800"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                {item.label}
                {item.href === "/admin" && pending > 0 && (
                  <span aria-label={`${pending} pending requests`} className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-medium text-white">
                    {pending}
                  </span>
                )}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {status === "unlocked" && (
              <Button size="sm" variant="secondary" onClick={lock} aria-label="Lock vault">
                <LockMark width={15} height={15} />
                <span className="hidden sm:inline">Lock vault</span>
              </Button>
            )}
            <UserButton />
          </div>
        </div>
      </header>
      <main key={pathname} className="enter mx-auto w-full max-w-5xl min-w-0 flex-1 px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}

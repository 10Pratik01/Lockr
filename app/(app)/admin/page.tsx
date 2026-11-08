import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/admin";
import { AdminPanel } from "@/components/admin/admin-panel";

export const metadata: Metadata = { title: "Admin · Lockr" };

export default async function AdminPage() {
  await requireAdminPage();
  return <AdminPanel />;
}

import type { Metadata } from "next";
import { requireSignedIn } from "@/lib/auth/require-user";
import { Settings } from "@/components/vault/settings";

export const metadata: Metadata = { title: "Settings · Privault" };

export default async function SettingsPage() {
  await requireSignedIn();
  return <Settings />;
}

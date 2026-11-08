import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShareRedeem } from "@/components/share/share-redeem";

export const metadata: Metadata = {
  title: "Secure Share · Lockr",
  robots: { index: false, follow: false },
};

// Public: the recipient has no account. Nothing about the share is looked
// up or rendered server-side -- the page only collects the OTP.
export default async function SharePage({ params }: Readonly<{ params: Promise<{ token: string }> }>) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) notFound();
  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <ShareRedeem token={token} />
    </div>
  );
}

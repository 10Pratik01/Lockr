import { DashboardSkeleton } from "@/components/ui/skeleton";

// Shown while a signed-in page streams in, before the vault gate takes over.
export default function Loading() {
  return <DashboardSkeleton />;
}

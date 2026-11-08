/** A shimmering placeholder block. Size it with className. */
export function Skeleton({ className = "" }: Readonly<{ className?: string }>) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}

/** Same silhouette as a dashboard credential row, so nothing jumps on load. */
export function CredentialRowSkeleton({ index = 0 }: Readonly<{ index?: number }>) {
  return (
    <div
      className="enter flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      style={{ "--i": index } as React.CSSProperties}
    >
      <Skeleton className="size-10 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="hidden h-9 w-32 rounded-full sm:block" />
      <Skeleton className="size-9 rounded-full" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <output className="block space-y-6" aria-label="Loading your vault">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-10 w-36 rounded-full" />
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="grid gap-3">
        {[0, 1, 2, 3].map((i) => (
          <CredentialRowSkeleton key={i} index={i} />
        ))}
      </div>
    </output>
  );
}

export function DetailsSkeleton() {
  return (
    <output className="block space-y-6" aria-label="Loading credential">
      <Skeleton className="h-4 w-24" />
      <div className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-40 rounded-full" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </output>
  );
}

export function ListSkeleton({ rows = 3 }: Readonly<{ rows?: number }>) {
  return (
    <output className="grid gap-3" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <CredentialRowSkeleton key={i} index={i} />
      ))}
    </output>
  );
}

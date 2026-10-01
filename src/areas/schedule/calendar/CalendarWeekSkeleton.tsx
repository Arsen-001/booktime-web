import { Skeleton } from '@/ui/Skeleton';

/** Скелет недели «Моего календаря»: 7 строк дня (ux-r2 M-6) */
export function CalendarWeekSkeleton() {
  return (
    <div data-skeleton aria-busy="true" className="flex flex-col gap-2">
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="flex min-h-16 items-center gap-3 rounded-xl border border-border bg-surface px-4">
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3.5 w-48" />
          </div>
          <Skeleton className="h-4 w-4" />
        </div>
      ))}
    </div>
  );
}

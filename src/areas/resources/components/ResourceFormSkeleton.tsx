import { Skeleton } from '@/ui/Skeleton';

/** Скелетон формы ресурса той же формы, что и форма: три карточки — основное, услуги, экземпляры */
export function ResourceFormSkeleton({ instances = 1 }: { instances?: number }) {
  const card = 'flex flex-col gap-5 rounded-lg border border-border bg-surface px-4 py-4 sm:px-5 sm:py-5';
  return (
    <div data-skeleton="" className="flex flex-col gap-6" aria-busy="true">
      <div className={card}>
        <Skeleton className="h-5 w-32" />
        <div className="grid gap-5 sm:grid-cols-2">
          <Skeleton className="h-[4.25rem] w-full" />
          <Skeleton className="h-[4.25rem] w-full" />
        </div>
        <Skeleton className="h-[6.5rem] w-full" />
        <Skeleton className="h-[4.25rem] w-full sm:w-1/2" />
      </div>
      <div className={card}>
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
      <div className={card}>
        <Skeleton className="h-5 w-28" />
        {Array.from({ length: Math.max(1, instances) }, (_, i) => (
          <Skeleton key={i} className="h-11 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

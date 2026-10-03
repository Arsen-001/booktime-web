'use client';

/** Статус заказа до данных — та же раскладка: шапка, крупный статус с шагами, что сдали, контакты. */
import { Skeleton, SkeletonText } from '@/ui/Skeleton';

export function PublicOrderSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-4">
      <header className="flex flex-col gap-1 px-1">
        <p className="text-sm font-semibold">
          <SkeletonText width="10ch" />
        </p>
        <h1 className="text-2xl leading-tight font-bold sm:text-3xl">
          <SkeletonText width="11ch" />
        </h1>
      </header>
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
        <div className="flex items-center gap-4">
          <Skeleton variant="circle" className="size-14 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xl leading-tight font-bold sm:text-2xl">
              <SkeletonText width="14ch" />
            </p>
            <p className="mt-1 text-base">
              <SkeletonText width="18ch" />
            </p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <Skeleton variant="circle" className="size-10" />
              <span className="text-sm">
                <SkeletonText width="6ch" />
              </span>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
        <p className="text-[1.0625rem] font-bold">
          <SkeletonText width="9ch" />
        </p>
        <p className="mt-3 text-base">
          <SkeletonText width="24ch" />
        </p>
      </section>
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
        <p className="text-[1.0625rem] font-bold">
          <SkeletonText width="9ch" />
        </p>
        <p className="mt-3 text-base">
          <SkeletonText width="20ch" />
        </p>
        <Skeleton className="mt-4 h-13 w-full rounded-lg" />
      </section>
    </div>
  );
}

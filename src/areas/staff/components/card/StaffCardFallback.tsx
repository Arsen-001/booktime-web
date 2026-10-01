/**
 * Пока грузится код страницы карточки (первый заход) — рамка карточки, а не серый блок на всю страницу (М1):
 * «К сотрудникам», строка заголовка и полоса вкладок тех же размеров, что у готовой карточки.
 */
import { Skeleton } from "@/ui/Skeleton";

export function StaffCardFallback() {
  return (
    <div data-skeleton aria-busy className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
      <Skeleton className="h-8 w-32" />
      <span className="flex items-center gap-3">
        <Skeleton variant="circle" className="size-10" />
        <Skeleton className="h-8 w-56" />
      </span>
      <Skeleton className="h-5 w-72" />
      <Skeleton className="h-11 w-full" />
    </div>
  );
}

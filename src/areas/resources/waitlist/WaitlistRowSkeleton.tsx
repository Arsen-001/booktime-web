import { Clock } from 'lucide-react';
import { Badge } from '@/ui/Badge';
import { SkeletonText } from '@/ui/Skeleton';

/** Заявка до загрузки — та же разметка, что свёрнутая карточка: услуги, когда · мастер, плашка статуса */
export function WaitlistRowSkeleton({ wide }: { wide: boolean }) {
  return (
    <li className="rounded-xl border border-border bg-surface">
      <div className="flex min-h-11 w-full flex-col gap-1.5 px-3.5 py-3 text-left sm:flex-row sm:items-center sm:gap-3">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-fg">
            <SkeletonText width={wide ? '22ch' : '16ch'} />
          </span>
          <span className="flex min-w-0 items-center gap-x-2 text-xs text-muted">
            <span className="flex shrink-0 items-center gap-1.5">
              <Clock aria-hidden className="size-3.5" />
              <SkeletonText width="14ch" />
            </span>
            <SkeletonText width={wide ? '12ch' : '9ch'} />
          </span>
        </span>
        <Badge tone="neutral" variant="soft">
          <SkeletonText width="8ch" />
        </Badge>
      </div>
    </li>
  );
}

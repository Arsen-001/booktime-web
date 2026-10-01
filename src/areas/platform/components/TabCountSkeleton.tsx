'use client';

/**
 * Счётчик вкладки до ответа: та же плашка, внутри полоса шириной в столько цифр, сколько обычно в счётчике
 * (1ch — ширина цифры), — вкладки не сдвигаются, когда приходит число (DESIGN.md «The skeleton IS the page»).
 */
import { Badge } from '@/ui/Badge';
import { SkeletonText } from '@/ui/Skeleton';

export function TabCountSkeleton({ typical }: { typical: number }) {
  return (
    <Badge size="sm" tone="neutral">
      <SkeletonText width={`${String(typical).length}ch`} />
    </Badge>
  );
}

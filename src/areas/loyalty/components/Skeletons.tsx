import { Badge, type BadgeSize } from '@/ui/Badge';
import { SkeletonText } from '@/ui/Skeleton';

/**
 * Скелетоны раздела «Лояльность» — та же разметка, что у содержимого (DESIGN.md «The skeleton IS the page»).
 */

/** Место статуса: та же плашка Badge (высота, скругление, отступы), внутри — полоса текста */
export function BadgeSkeleton({ width = '7ch', size }: { width?: string; size?: BadgeSize }) {
  return (
    <Badge tone="neutral" size={size} aria-hidden>
      <SkeletonText width={width} />
    </Badge>
  );
}

export interface TypeRowSkeletonProps {
  /** Вторая строка под названием (выдано, номинал, «можно в минус») */
  subtitle?: boolean;
  /** Подпись справа («продано 3») — ширина полосы */
  aside?: string;
}

/**
 * Скелетон строки списка типов (карт, сертификатов, абонементов, счетов) — та же разметка, что строка: рамка, отступы,
 * кнопка-ссылка min-h-10 с названием и подписью, подпись справа. Данные пришли — строка не меняет высоту и место.
 */
export function TypeRowSkeleton({ subtitle = true, aside }: TypeRowSkeletonProps) {
  return (
    <li aria-hidden className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
      <span className="min-h-10 min-w-0 flex-1 py-1 text-left">
        <span className="block truncate text-sm font-semibold text-fg">
          <SkeletonText width="18ch" />
        </span>
        {subtitle && (
          <span className="block text-xs text-muted">
            <SkeletonText width="10ch" />
          </span>
        )}
      </span>
      {aside && (
        <span className="text-xs text-muted">
          <SkeletonText width={aside} />
        </span>
      )}
    </li>
  );
}

/** Список скелетонов строк типов — `rows` штук в той же обёртке, что список */
export function TypeListSkeleton({ rows, ...row }: TypeRowSkeletonProps & { rows: number }) {
  return (
    <ul className="flex flex-col gap-2" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <TypeRowSkeleton key={i} {...row} />
      ))}
    </ul>
  );
}

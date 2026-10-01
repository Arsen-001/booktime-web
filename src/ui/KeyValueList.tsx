import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface KeyValueItem {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
}

export interface KeyValueListProps {
  items: KeyValueItem[];
  columns?: 1 | 2;
  /** Плотнее: меньше отступов */
  dense?: boolean;
  className?: string;
}

/** Список «подпись — значение» (карточка клиента, детали записи) */
export function KeyValueList({ items, columns = 1, dense = false, className }: KeyValueListProps) {
  return (
    <dl
      className={cn(
        'grid grid-cols-1',
        columns === 2 && 'sm:grid-cols-2',
        dense ? 'gap-x-6 gap-y-2.5' : 'gap-x-8 gap-y-4',
        className,
      )}
    >
      {items.map((item, i) => (
        <div key={i} className="min-w-0">
          <dt className="text-sm text-muted">{item.label}</dt>
          <dd className="mt-0.5 text-base break-words text-fg">
            {item.value}
            {item.hint && <span className="mt-0.5 block text-sm text-muted">{item.hint}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

'use client';

/**
 * <li> строки каталога с ручкой ⠿ (У10). Отдельно от содержимого строки: контекст dnd-kit меняется часто и
 * перерисовывает этот тонкий слой, а тяжёлые ячейки (memo) остаются как были.
 */
import { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/cn';
import { CATALOG_GRID } from '@/areas/services/catalog/grid';
import { ServiceRowCompact } from '@/areas/services/catalog/ServiceRowCompact';
import { sameRowProps, ServiceRowTable, type ServiceRowProps } from '@/areas/services/catalog/ServiceRowTable';

export interface SortableRowProps {
  id: string;
  /** Ручки нет: поиск/фильтр или нет прав */
  disabled: boolean;
  table: boolean;
  selected: boolean;
  handleLabel: string;
  content: ServiceRowProps;
}

function SortableRowImpl({ id, disabled, table, selected, handleLabel, content }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const handle = disabled ? (
    table ? (
      <span />
    ) : null
  ) : (
    <button
      type="button"
      {...attributes}
      {...listeners}
      aria-label={handleLabel}
      className={cn(
        'flex shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted hover:text-fg active:cursor-grabbing',
        table ? 'size-8 hover:bg-surface-2' : '-mx-1.5 h-11 w-10', // зона нажатия 40px, место в строке — прежние 28px
      )}
    >
      <GripVertical aria-hidden className="size-4" />
    </button>
  );
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-service-row={id}
      className={cn(
        'border-t border-border bg-surface',
        table
          ? cn(
              CATALOG_GRID,
              'min-h-14 px-2 py-1.5 transition-colors duration-150 hover:bg-surface-2/60',
              selected && 'bg-primary-soft/40 hover:bg-primary-soft/50',
            )
          : cn('flex min-h-16 items-center gap-1 py-2 pr-1 pl-1', selected && 'bg-primary-soft/40'),
        isDragging && 'relative z-10 shadow-lg',
      )}
    >
      {handle}
      {table ? <ServiceRowTable {...content} /> : <ServiceRowCompact {...content} />}
    </li>
  );
}

/** memo: при правке одной строки перерисовывается только она — соседи в той же категории остаются как были */
export const SortableRow = memo(
  SortableRowImpl,
  (a, b) =>
    a.id === b.id &&
    a.disabled === b.disabled &&
    a.table === b.table &&
    a.selected === b.selected &&
    a.handleLabel === b.handleLabel &&
    sameRowProps(a.content, b.content),
);

'use client';

import { GripVertical } from 'lucide-react';
import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { IconButton } from '@/ui/IconButton';

export interface DragReorderItem {
  key: string;
  content: ReactNode;
}

/**
 * Список, который можно перетащить пальцем/мышью за ручку (F-03-016: «порядок шагов меняется перетаскиванием»,
 * а не только стрелками). Указатель (pointer events) — работает и на телефоне, без сторонних библиотек
 * (пакеты ставить нельзя). Стрелки вверх/вниз остаются рядом как способ управления с клавиатуры/скринридера —
 * перетаскивание не единственный способ добраться до той же перестановки, оно требуется дополнительно к нему.
 */
export function DragReorderList({
  order,
  items,
  onReorder,
  renderExtra,
  disabled,
}: {
  /** Текущий порядок ключей — компонент управляемый, состояние живёт у вызывающего экрана */
  order: string[];
  items: DragReorderItem[];
  onReorder: (nextKeys: string[]) => void;
  /** Стрелки/доп. контролы конкретного пункта (получают индекс в ТЕКУЩЕМ порядке) */
  renderExtra?: (key: string, index: number) => ReactNode;
  disabled?: boolean;
}) {
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const dragInfo = useRef<{ key: string; pointerId: number } | null>(null);

  const byKey = new Map(items.map((i) => [i.key, i] as const));

  const onPointerDown = (key: string) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    e.preventDefault();
    dragInfo.current = { key, pointerId: e.pointerId };
    setDraggingKey(key);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLUListElement>) => {
    const info = dragInfo.current;
    if (!info || info.pointerId !== e.pointerId) return;
    const container = listRef.current;
    if (!container) return;
    const rows = Array.from(container.querySelectorAll<HTMLLIElement>('[data-drag-row]'));
    const y = e.clientY;
    const fromIndex = order.indexOf(info.key);
    let toIndex = fromIndex;
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (y < mid) {
        toIndex = i;
        break;
      }
      toIndex = i + 1;
    }
    toIndex = Math.max(0, Math.min(order.length - 1, toIndex));
    if (toIndex !== fromIndex) {
      const next = [...order];
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, info.key);
      onReorder(next);
    }
  };

  const endDrag = () => {
    dragInfo.current = null;
    setDraggingKey(null);
  };

  return (
    <ul ref={listRef} className="flex flex-col gap-2" onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
      {order.map((key, i) => {
        const item = byKey.get(key);
        if (!item) return null;
        return (
          <li
            key={key}
            data-drag-row=""
            className={cn(
              'flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-2 py-2 transition-shadow',
              draggingKey === key && 'shadow-lg ring-1 ring-primary/40',
            )}
          >
            {!disabled && (
              <IconButton
                icon={<GripVertical aria-hidden />}
                label="drag"
                hideTip
                size="sm"
                variant="ghost"
                className="cursor-grab touch-none active:cursor-grabbing"
                onPointerDown={onPointerDown(key)}
              />
            )}
            <span className="min-w-0 flex-1 text-sm font-medium text-fg">{item.content}</span>
            {renderExtra?.(key, i)}
          </li>
        );
      })}
    </ul>
  );
}

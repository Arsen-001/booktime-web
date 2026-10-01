'use client';

import { useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import type { Id, ISODate } from '@/domain/core';

export type SelectOp = 'add' | 'remove' | 'toggle';
export interface CellRef {
  staffId: Id;
  date: ISODate;
}

const parse = (key: string): CellRef => {
  const i = key.lastIndexOf('|');
  return { staffId: key.slice(0, i), date: key.slice(i + 1) };
};

const cellKeyOf = (el: Element | null): string | null => (el?.closest('[data-cell]') as HTMLElement | null)?.dataset.cell ?? null;

/**
 * Г4: выбор клеток таблицы графика. Мышью — протягиванием прямоугольника (начали с выбранной — снимаем), Shift-щелчок
 * добавляет диапазон от прошлой клетки. Палец — нажатиями по одной (протягивание пальцем оставлено прокрутке). Все
 * события ловит таблица по data-cell — у клеток нет своих обработчиков (перерисовывается только изменённая).
 */
export function useGridSelection(rowIds: Id[], dates: ISODate[], selected: Set<string>, onSelect: (cells: CellRef[], op: SelectOp) => void) {
  const [drag, setDrag] = useState<{ keys: Set<string>; removing: boolean } | null>(null);
  const anchor = useRef<string | null>(null);
  const last = useRef<string | null>(null);
  const dragging = useRef<{ from: string; to: string; removing: boolean } | null>(null);
  const suppressClick = useRef(false);

  const rect = (a: string, b: string): string[] => {
    const pa = parse(a);
    const pb = parse(b);
    const r1 = rowIds.indexOf(pa.staffId);
    const r2 = rowIds.indexOf(pb.staffId);
    const c1 = dates.indexOf(pa.date);
    const c2 = dates.indexOf(pb.date);
    if (r1 < 0 || r2 < 0 || c1 < 0 || c2 < 0) return [b];
    const out: string[] = [];
    for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++)
      for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) out.push(`${rowIds[r]}|${dates[c]}`);
    return out;
  };

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || e.pointerType === 'touch') return;
    const key = cellKeyOf(e.target as Element);
    if (!key) return;
    if (e.shiftKey && last.current) {
      e.preventDefault();
      suppressClick.current = true;
      onSelect(rect(last.current, key).map(parse), 'add');
      last.current = key;
      return;
    }
    e.preventDefault();
    // Отпустили кнопку за таблицей — событие всё равно придёт сюда
    e.currentTarget.setPointerCapture(e.pointerId);
    const removing = selected.has(key);
    dragging.current = { from: key, to: key, removing };
    anchor.current = key;
    setDrag({ keys: new Set([key]), removing });
  };

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const d = dragging.current;
    if (!d) return;
    const key = cellKeyOf(document.elementFromPoint(e.clientX, e.clientY));
    if (!key || key === d.to) return;
    d.to = key;
    setDrag({ keys: new Set(rect(d.from, key)), removing: d.removing });
  };

  const finish = () => {
    const d = dragging.current;
    if (!d) return;
    dragging.current = null;
    setDrag(null);
    suppressClick.current = true;
    last.current = d.to;
    if (d.from === d.to) onSelect([parse(d.from)], 'toggle');
    else onSelect(rect(d.from, d.to).map(parse), d.removing ? 'remove' : 'add');
  };

  const onClick = (e: MouseEvent<HTMLElement>) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    const key = cellKeyOf(e.target as Element);
    if (!key) return;
    if (e.shiftKey && last.current) onSelect(rect(last.current, key).map(parse), 'add');
    else onSelect([parse(key)], 'toggle');
    last.current = key;
  };

  return {
    drag,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: () => {
        dragging.current = null;
        setDrag(null);
      },
      onClick,
    },
  };
}

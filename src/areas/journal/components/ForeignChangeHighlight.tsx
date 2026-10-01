'use client';

/**
 * Подсветка записи, которую только что изменил ДРУГОЙ человек (⭐ рабочий день №12): коллега перенёс, отменил, отметил
 * приход или принял оплату, клиент записался или отменил онлайн — карточка этой записи несколько секунд мерцает рамкой
 * во всех видах дня (колонки, обзор, лента, список) и на стойке администратора. Свои правки не подсвечиваются.
 *
 * Источник — та же «Лента изменений за день» (listDayFeed, общий кэш с шторкой ленты). Новые строки ленты, которых не было
 * при прошлом чтении, не старше FRESH_MIN минут и сделанные не мной, — подсветка. Первое чтение ничего не подсвечивает.
 *
 * Рисуется одним <style> с селекторами [data-booking="<id>"]: сетку дня не перерисовываем и в карточки ничего не
 * передаём (DESIGN.md → «только то, что изменилось»). Анимируется только opacity псевдоэлемента; при
 * prefers-reduced-motion рамка просто видна, без мерцания.
 */
import { useEffect, useRef } from 'react';
import { listDayFeed } from '@/api/journal-feed';
import { useApiQuery } from '@/api/request';
import { dayFeedKey } from '@/areas/journal/components/DayFeedSheet';
import type { Id } from '@/domain/core';
import { nowYerevan, today } from '@/lib/date';

/** Сколько секунд держать подсветку */
const HOLD_MS = 6500;
/** Строки старше этого — уже не «только что» (открыли журнал через час — прошлое не мигает) */
const FRESH_MIN = 5;
/** Как часто спрашивать ленту, если живые события не пришли (режим api) */
const POLL_MS = 15000;

const CSS_BASE = '@keyframes journal-changed-pulse{0%{opacity:0}20%{opacity:1}75%{opacity:1}100%{opacity:0}}';

function cssFor(ids: Id[]): string {
  const sel = (suffix: string) => ids.map((id) => `[data-booking="${id.replace(/["\\]/g, '')}"]${suffix}`).join(',');
  return [
    CSS_BASE,
    `${sel('::after')}{content:"";position:absolute;inset:0;border-radius:var(--r-md);border:2px solid var(--info);box-shadow:0 0 0 3px var(--info-soft);pointer-events:none;z-index:25;opacity:0;animation:journal-changed-pulse 2.1s ease-in-out 3}`,
    `@media (prefers-reduced-motion: reduce){${sel('::after')}{animation:none;opacity:1}}`,
  ].join('\n');
}

export function ForeignChangeHighlight({
  businessIds,
  onlyStaffId,
  ownStaffId,
  enabled = true,
}: {
  businessIds: Id[];
  onlyStaffId?: Id;
  ownStaffId?: Id;
  enabled?: boolean;
}) {
  const date = today();
  const q = useApiQuery(dayFeedKey(businessIds, date, onlyStaffId), () => listDayFeed({ businessIds, date, onlyStaffId }), {
    enabled: enabled && businessIds.length > 0,
  });
  const refetch = q.refetch;
  const styleRef = useRef<HTMLStyleElement>(null);
  const seenRef = useRef<Set<string> | null>(null);
  const activeRef = useRef(new Map<Id, ReturnType<typeof setTimeout>>());

  // Лента за сегодня — лёгкий опрос: в режиме api живые события приходят не обо всём (оплаты)
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => void refetch(), POLL_MS);
    return () => clearInterval(timer);
  }, [enabled, refetch]);

  useEffect(() => {
    const items = q.data;
    if (!items) return;
    const draw = () => {
      const el = styleRef.current;
      if (!el) return;
      const ids = [...activeRef.current.keys()];
      el.textContent = ids.length ? cssFor(ids) : '';
    };
    // Первое чтение — только запоминаем, что уже было
    if (!seenRef.current) {
      seenRef.current = new Set(items.map((i) => i.id));
      return;
    }
    const seen = seenRef.current;
    const freshFrom = nowYerevan().subtract(FRESH_MIN, 'minute').format('YYYY-MM-DDTHH:mm');
    let changed = false;
    for (const item of items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      if (item.at < freshFrom || (ownStaffId && item.by === ownStaffId)) continue;
      const active = activeRef.current;
      clearTimeout(active.get(item.bookingId));
      active.set(
        item.bookingId,
        setTimeout(() => {
          active.delete(item.bookingId);
          draw();
        }, HOLD_MS),
      );
      changed = true;
    }
    if (changed) draw();
  }, [q.data, ownStaffId]);

  // Уход с экрана — таймеры прочь
  useEffect(() => {
    const active = activeRef.current;
    return () => {
      for (const timer of active.values()) clearTimeout(timer);
      active.clear();
    };
  }, []);

  return <style ref={styleRef} data-journal-changes="" />;
}

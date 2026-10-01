'use client';

/**
 * Журнал на телефоне (DESIGN.md → Journal A2, A2-phone.png): шапка «Сентябрь · салон», полоса недели (кнопки 46×58,
 * текущий день залит primary), жёлтая плашка «N ждут подтверждения · до HH:MM», нижнее меню из 4 пунктов.
 * Сетка на 2 мастера и «+ Запись» у большого пальца — в JournalScreen (DayGrid columnsPerScreen, Fab).
 */
import Link from 'next/link';
import { AlarmClock, Timer, CalendarDays, MoreHorizontal, ChevronRight, Clock, UserSearch, Users, Wallet } from 'lucide-react';
import type { Id, ISODate } from '@/domain/core';
import { getRangeLoad } from '@/api/journal';
import { useApiQuery } from '@/api/request';
import { useCan } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { cn } from '@/lib/cn';
import { addDays, eachDay, today, weekStart } from '@/lib/date';
import { DropdownChevron } from '@/ui/DropdownChevron';
import { IconButton } from '@/ui/IconButton';
import { SkeletonText } from '@/ui/Skeleton';

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export interface PhoneHeaderProps {
  date: ISODate;
  salonName?: string;
  onOpenCalendar: () => void;
  /** Меню каркаса: кнопка теперь в полосе каркаса; проп оставлен для совместимости вызова */
  onOpenMenu?: () => void;
  /** F-01-017: «Клиенты и чат» той же шторкой, что у поиска в ряду управления на десктопе */
  onSearch: () => void;
  /** Название салона ещё грузится — полоса на его месте */
  salonLoading?: boolean;
}

/**
 * Шапка журнала на телефоне под полосой каркаса: месяц (открывает календарь месяца, F-01-187) и салон · «Клиенты и
 * чат» (F-01-017). Полоса каркаса снова стоит на каждой странице (DESIGN.md → Shell, 27.09.2026), поэтому меню и
 * колокольчик (F-01-007) здесь больше не повторяются — на экране их было по два.
 */
export function PhoneHeader({ date, salonName, onOpenCalendar, onSearch, salonLoading }: PhoneHeaderProps) {
  const t = useT('journal');
  const format = useFormat();
  return (
    <div className="flex min-h-14 items-center gap-1 pr-1 pl-4">
      <button
        type="button"
        data-f="F-01-187 F-14-088"
        onClick={onOpenCalendar}
        aria-label={t('board.phone.openCalendar')}
        className="flex min-h-12 min-w-0 flex-1 flex-col items-start justify-center rounded-lg text-left"
      >
        <span className="flex items-center gap-1 text-xl leading-tight font-bold text-fg">
          {capitalize(format.monthName(date))}
          <DropdownChevron />
        </span>
        {salonLoading ? (
          <span className="truncate text-[13px] text-muted">
            <SkeletonText width="16ch" />
          </span>
        ) : (
          salonName && <span className="truncate text-[13px] text-muted">{salonName}</span>
        )}
      </button>
      {/* Меню и колокольчик — в полосе каркаса прямо над этой шапкой (DESIGN.md → Shell), второй раз не рисуем.
          Поиск здесь свой — «Клиенты и чат» (F-01-017), поэтому и значок клиентский, а не вторая лупа. */}
      <IconButton data-f="F-01-017" variant="ghost" icon={<UserSearch aria-hidden />} label={t('board.search')} onClick={onSearch} />
    </div>
  );
}

export interface WeekStripProps {
  date: ISODate;
  onDateChange: (date: ISODate) => void;
  staffIds: Id[];
}

/** Полоса недели: 7 дней, точка — в дне есть записи; выбранный день залит primary */
export function WeekStrip({ date, onDateChange, staffIds }: WeekStripProps) {
  const t = useT('journal');
  const format = useFormat();
  const from = weekStart(date);
  const to = addDays(from, 6);
  const days = eachDay(from, to);
  const weekdays = format.weekdaysShort();
  const loadQuery = useApiQuery(['journal', 'range-load', staffIds.join(','), from, to], () => getRangeLoad(staffIds, from, to), {
    enabled: staffIds.length > 0,
  });
  const now = today();
  return (
    <div role="group" aria-label={t('board.phone.weekStrip')} className="-mx-1 flex justify-between gap-1">
      {days.map((d, i) => {
        const selected = d === date;
        const busy = (loadQuery.data?.[d]?.ratio ?? 0) > 0;
        return (
          <button
            key={d}
            type="button"
            aria-pressed={selected}
            aria-label={format.date(d, 'weekdayLong')}
            onClick={() => onDateChange(d)}
            className={cn(
              'flex h-[58px] w-[46px] flex-col items-center justify-center gap-0.5 rounded-xl transition-colors',
              selected ? 'bg-primary text-primary-contrast' : 'text-fg active:bg-surface-2',
            )}
          >
            <span className={cn('text-xs capitalize', selected ? 'text-primary-contrast/85' : 'text-muted')}>{weekdays[i]}</span>
            <span className={cn('text-xl leading-none font-bold tabular-nums', d === now && !selected && 'text-primary-text')}>
              {Number(d.slice(8, 10))}
            </span>
            <span aria-hidden className={cn('size-1 rounded-full', busy ? (selected ? 'bg-primary-contrast' : 'bg-primary') : 'bg-transparent')} />
          </button>
        );
      })}
    </div>
  );
}

export interface PendingBarProps {
  count: number;
  /** Время первой из ожидающих — «до HH:MM» */
  byTime: string;
  onClick: () => void;
}

/** Жёлтая плашка «N ждут подтверждения · до HH:MM» — открывает «Требует внимания» */
export function PendingBar({ count, byTime, onClick }: PendingBarProps) {
  const t = useT('journal');
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-12 w-full items-center gap-2.5 rounded-xl border border-warning/40 bg-warning-soft px-4 text-left text-warning"
    >
      <Clock aria-hidden className="size-[18px] shrink-0" />
      <span className="flex-1 truncate text-[15px] font-bold">{t('board.phone.pendingBar', { n: count })}</span>
      <span className="shrink-0 text-[13px]">{t('board.phone.pendingBy', { time: byTime })}</span>
      <ChevronRight aria-hidden className="size-4 shrink-0" />
    </button>
  );
}

/** Плашка «ждут подтверждения» при первой загрузке журнала — та же рамка и высота, текст полосами */
export function PendingBarSkeleton() {
  return (
    <span
      aria-hidden
      className="flex min-h-12 w-full items-center gap-2.5 rounded-xl border border-warning/40 bg-warning-soft px-4 text-left text-warning"
    >
      <Clock aria-hidden className="size-[18px] shrink-0" />
      <span className="flex-1 truncate text-[15px] font-bold">
        <SkeletonText width="18ch" />
      </span>
      <span className="shrink-0 text-[13px]">
        <SkeletonText width="7ch" />
      </span>
      <ChevronRight aria-hidden className="size-4 shrink-0" />
    </span>
  );
}

/** ⭐ Телефон: плашка над журналом — «N опаздывают» (красная) или «Визит затянулся?» (жёлтая); открывает шторку «Требует внимания» */
export function AlertBar({ label, tone, onClick }: { label: string; tone: 'danger' | 'warning'; onClick: () => void }) {
  const Icon = tone === 'danger' ? AlarmClock : Timer;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-12 w-full items-center gap-2.5 rounded-xl border px-4 text-left',
        tone === 'danger' ? 'border-danger/40 bg-danger-soft text-danger' : 'border-warning/40 bg-warning-soft text-warning',
      )}
    >
      <Icon aria-hidden className="size-[18px] shrink-0" />
      <span className="flex-1 truncate text-[15px] font-bold">{label}</span>
      <ChevronRight aria-hidden className="size-4 shrink-0" />
    </button>
  );
}

/** Нижнее меню журнала на телефоне: Журнал · Клиенты · Касса · Ещё (у каркаса кабинета своего нижнего меню нет) */
export function JournalBottomNav({ onMore }: { onMore: () => void }) {
  const t = useT('journal');
  const canClients = useCan('clients.view');
  const canCash = useCan('finance.view');
  const item = 'group flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted';
  const pill = 'grid h-8 w-14 place-items-center rounded-full transition-colors [&_svg]:size-[22px]';
  return (
    <nav
      aria-label={t('board.phone.nav.label')}
      data-journal-tabbar=""
      className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface md:hidden"
    >
      <ul className={cn('mx-auto grid max-w-lg', ['grid-cols-2', 'grid-cols-3', 'grid-cols-4'][Number(canClients) + Number(canCash)])}>
        <li>
          <Link href="/biz/journal" aria-current="page" className={cn(item, 'font-semibold text-primary-text')}>
            <span className={cn(pill, 'bg-primary-soft')}>
              <CalendarDays aria-hidden strokeWidth={2.4} />
            </span>
            {t('board.phone.nav.journal')}
          </Link>
        </li>
        {canClients && (<li>
          <Link href="/biz/clients" className={item}>
            <span className={cn(pill, 'group-active:bg-surface-2')}>
              <Users aria-hidden />
            </span>
            {t('board.phone.nav.clients')}
          </Link>
        </li>)}
        {canCash && (<li>
          <Link href="/biz/finance" className={item}>
            <span className={cn(pill, 'group-active:bg-surface-2')}>
              <Wallet aria-hidden />
            </span>
            {t('board.phone.nav.cash')}
          </Link>
        </li>)}
        <li>
          <button type="button" onClick={onMore} className={cn(item, 'w-full')}>
            <span className={cn(pill, 'group-active:bg-surface-2')}>
              <MoreHorizontal aria-hidden />
            </span>
            {t('board.phone.nav.more')}
          </button>
        </li>
      </ul>
    </nav>
  );
}

'use client';

/**
 * Строка записи в шторках рабочего дня: время (и день, если не сегодня), клиент, услуга · мастер; справа — сумма или
 * действия. Нажатие по строке открывает запись (окно записи журнала) — как строки «Требует внимания».
 */
import type { ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import type { ISODateTime, Id, Service, Staff } from '@/domain/core';
import { useTodayYerevan } from '@/areas/journal/lib/lateness';
import { useJournalHourFormat } from '@/areas/journal/lib/useJournalHourFormat';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { SkeletonText } from '@/ui/Skeleton';

export interface WorkdayRowProps {
  start: ISODateTime;
  staffId: Id;
  serviceIds: Id[];
  clientName?: string;
  staff: Staff[];
  services: Service[];
  /** Под именем вместо «услуга · мастер» — своё («Я оплатил») */
  note?: ReactNode;
  /** Метка рядом с именем (причина «не закрыт») */
  badge?: ReactNode;
  /** Справа: сумма, бейдж или кнопки */
  trailing?: ReactNode;
  onOpen: () => void;
}

export function useWorkdayNames(staff: Staff[], services: Service[]) {
  const locale = useLocale();
  return {
    service: (ids: Id[]) => {
      const first = services.find((s) => s.id === ids[0]);
      const name = first ? pickText(first.name, locale) : '';
      return ids.length > 1 && name ? `${name} +${ids.length - 1}` : name;
    },
    master: (id: Id) => staff.find((s) => s.id === id)?.name.split(' ')[0] ?? '',
  };
}

export function WorkdayRow({ start, staffId, serviceIds, clientName, staff, services, note, badge, trailing, onOpen }: WorkdayRowProps) {
  const t = useT('journal');
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  const today = useTodayYerevan();
  const names = useWorkdayNames(staff, services);
  const day = start.slice(0, 10);
  const sub = [names.service(serviceIds), names.master(staffId)].filter(Boolean).join(' · ');
  return (
    <li className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
      <button type="button" onClick={onOpen} className="group flex min-w-[12rem] flex-1 items-center gap-3 rounded-lg text-left">
        <span className="flex w-14 shrink-0 flex-col">
          <b className="text-sm font-bold text-fg tabular-nums">{format.time(start)}</b>
          {day !== today && <span className="text-xs whitespace-nowrap text-muted">{format.date(day, 'dayMonthShort')}</span>}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold text-fg">{clientName || t('block.noClient')}</span>
            {badge}
          </span>
          <span className="truncate text-xs text-muted">{note ?? sub}</span>
        </span>
        {!trailing && <ChevronRight aria-hidden className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />}
      </button>
      {trailing && <div className="flex shrink-0 items-center gap-1.5">{trailing}</div>}
    </li>
  );
}

/** Скелет строки — та же разметка и высота */
export function WorkdayRowSkeleton() {
  return (
    <li className="flex min-h-14 items-center gap-3 py-2.5">
      <span className="flex w-14 shrink-0 flex-col">
        <b className="text-sm font-bold">
          <SkeletonText width="5ch" />
        </b>
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold">
          <SkeletonText width="16ch" />
        </span>
        <span className="text-xs">
          <SkeletonText width="22ch" />
        </span>
      </span>
    </li>
  );
}

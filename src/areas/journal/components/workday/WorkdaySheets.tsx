'use client';

/**
 * Шторки рабочего дня журнала — смонтированы один раз в JournalScreen, открываются событием openWorkdaySheet()
 * (панель «Требует внимания», «⋯ Ещё», сводка дня в шапке) или адресом `?workday=dayClose&date=…` (⭐ уведомление
 * «День закрыт» в колокольчике владельца, 01.10.2026). Сводка и итоги — только с правом journal.stats.
 */
import { useEffect, useEffectEvent, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ISODate, Id, Service, Staff } from '@/domain/core';
import { useCan } from '@/demo/hooks';
import { DayCloseSheet } from './DayCloseSheet';
import { WORKDAY_EVENT, type WorkdayEventDetail, type WorkdaySheetKind } from './events';
import { MorningSummarySheet } from './MorningSummarySheet';
import { UnclosedVisitsSheet } from './UnclosedVisitsSheet';

export function WorkdaySheets({
  businessId,
  date,
  onlyStaffId,
  staff,
  services,
  onOpenBooking,
}: {
  businessId: Id;
  /** День, открытый в журнале — по умолчанию для сводки и итогов */
  date: ISODate;
  onlyStaffId?: Id;
  staff: Staff[];
  services: Service[];
  /** Открыть запись: журнал переходит на её день и открывает окно записи */
  onOpenBooking: (id: Id, date: ISODate) => void;
}) {
  const canStats = useCan('journal.stats');
  const [open, setOpen] = useState<WorkdaySheetKind | null>(null);
  const [day, setDay] = useState<ISODate | undefined>(undefined);
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<WorkdayEventDetail>).detail;
      if (!detail) return;
      setDay(detail.date);
      setOpen(detail.kind);
    };
    window.addEventListener(WORKDAY_EVENT, onOpen);
    return () => window.removeEventListener(WORKDAY_EVENT, onOpen);
  }, []);
  // ?workday=<шторка>&date=<день> — открыть шторку и убрать параметр из адреса (повторное нажатие откроет снова)
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const sheetParam = params.get('workday');
  const urlKind = sheetParam === 'dayClose' || sheetParam === 'morning' || sheetParam === 'unclosed' ? sheetParam : null;
  // Подстройка состояния во время рендера (официальный приём React) — один раз на каждое появление параметра
  const [seenParam, setSeenParam] = useState<string | null>(null);
  if (sheetParam !== seenParam) {
    setSeenParam(sheetParam);
    if (urlKind) {
      setDay(params.get('date') ?? undefined);
      setOpen(urlKind);
    }
  }
  const stripParam = useEffectEvent(() => {
    const next = new URLSearchParams(params.toString());
    next.delete('workday');
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  });
  useEffect(() => {
    if (urlKind) stripParam();
  }, [urlKind]);
  const shownDay = day ?? date;
  const openChange = (kind: WorkdaySheetKind) => (next: boolean) => {
    if (next) return setOpen(kind);
    setOpen(null);
  };
  const openBooking = (id: Id, d: ISODate) => {
    setOpen(null);
    onOpenBooking(id, d);
  };
  return (
    <>
      {canStats && (
        <MorningSummarySheet
          open={open === 'morning'}
          onOpenChange={openChange('morning')}
          businessId={businessId}
          date={shownDay}
          staff={staff}
          services={services}
          onOpenBooking={openBooking}
        />
      )}
      <UnclosedVisitsSheet
        open={open === 'unclosed'}
        onOpenChange={openChange('unclosed')}
        businessId={businessId}
        onlyStaffId={onlyStaffId}
        staff={staff}
        services={services}
        onOpenBooking={openBooking}
      />
      {canStats && (
        <DayCloseSheet
          open={open === 'dayClose'}
          onOpenChange={openChange('dayClose')}
          businessId={businessId}
          date={shownDay}
          staff={staff}
          services={services}
          onOpenBooking={openBooking}
        />
      )}
    </>
  );
}

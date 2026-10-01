'use client';

/**
 * Закрыть визит одним нажатием из списка «Незакрытые визиты» — без окна записи:
 *  · «Пришёл» — смена статуса + последствия прихода (F-01-081), как «Пришёл» в «Списке»; остаток к оплате — строка
 *    сразу становится «Оплатить»;
 *  · «Не пришёл» — с «Отменить» в тосте; полученная предоплата — окно записи (там решают, удержать ли её, F-01-146);
 *  · «Оплатить» — оплата визита через кассу (instantPayBooking → операция в финансах, «Касса за день», Z-отчёт), как
 *    «Оплатить» в «Списке»; запись ещё без отметки — заодно «Пришёл».
 * Строка меняется сразу (оптимистично), до ответа сервера; ошибка — строка вернётся сама.
 */
import { useState } from 'react';
import type { BookingStatus, Id } from '@/domain/core';
import { changeBookingStatus } from '@/api/core';
import { instantPayBooking, syncArrivedConsequences } from '@/api/journal';
import { workdayKeys, type UnclosedVisit } from '@/api/journal-workday';
import { optimistic, useApiMutation } from '@/api/request';
import { openNextVisit } from '@/areas/journal/lib/nextVisit';
import { BEFORE_ARRIVAL_STATUSES } from '@/domain/journalWorkday';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { useToast } from '@/ui/Toast';

type Busy = Record<Id, 'arrive' | 'noShow' | 'pay'>;
type StatusArgs = { id: Id; status: BookingStatus };
type PayArgs = { id: Id; total: number; method: 'cash' | 'card' };

/** Строка после смены статуса: пришёл с остатком — «оплатить», пришёл без долга или «не пришёл» — уходит из списка */
function afterStatus(rows: UnclosedVisit[], a: StatusArgs): UnclosedVisit[] {
  return rows.flatMap((r) => {
    if (r.booking.id !== a.id) return [r];
    const booking = { ...r.booking, status: a.status };
    if (a.status === 'arrived') return r.due > 0 ? [{ ...r, booking, reason: 'payment' as const }] : [];
    if (BEFORE_ARRIVAL_STATUSES.includes(a.status)) return [{ ...r, booking, reason: 'arrival' as const }];
    return [];
  });
}

export function useUnclosedActions(businessId: Id, onOpenBooking: (r: UnclosedVisit) => void) {
  const t = useT('journal');
  const tc = useT('common');
  const toast = useToast();
  const format = useFormat();
  const [busy, setBusy] = useState<Busy>({});
  const key = workdayKeys.unclosed(businessId);
  const setStatus = useApiMutation(({ id, status }: StatusArgs) => changeBookingStatus(id, status, 'business'), {
    optimistic: optimistic<UnclosedVisit[], StatusArgs>(key, afterStatus),
  });
  const pay = useApiMutation(({ id, total, method }: PayArgs) => instantPayBooking(id, total, method), {
    optimistic: optimistic<UnclosedVisit[], PayArgs>(key, (rows, a) => rows.filter((r) => r.booking.id !== a.id)),
  });

  const mark = (id: Id, what: Busy[Id] | null) =>
    setBusy((prev) => {
      const next = { ...prev };
      if (what) next[id] = what;
      else delete next[id];
      return next;
    });

  const name = (r: UnclosedVisit) => r.clientName || t('block.noClient');

  const change = async (r: UnclosedVisit, from: BookingStatus, to: BookingStatus) => {
    await setStatus.mutate({ id: r.booking.id, status: to });
    if (to === 'arrived' || from === 'arrived') await syncArrivedConsequences(r.booking.id, to);
  };

  const run = async (r: UnclosedVisit, what: Busy[Id], fn: () => Promise<void>) => {
    mark(r.booking.id, what);
    try {
      await fn();
    } catch {
      toast.error(tc('states.actionFailed'));
    } finally {
      mark(r.booking.id, null);
    }
  };

  const undo = (r: UnclosedVisit, now: BookingStatus) => ({
    label: t('board.list.undo'),
    onClick: () => void change({ ...r, booking: { ...r.booking, status: now } }, now, r.booking.status).catch(() => toast.error(tc('states.actionFailed'))),
  });

  const arrive = (r: UnclosedVisit) =>
    run(r, 'arrive', async () => {
      await change(r, r.booking.status, 'arrived');
      toast.success(t('board.list.arrivedToast', { name: name(r) }), { action: undo(r, 'arrived') });
    });

  const noShow = (r: UnclosedVisit) => {
    if (r.booking.prepayment?.paid) return onOpenBooking(r);
    return run(r, 'noShow', async () => {
      await change(r, r.booking.status, 'no_show');
      toast.success(t('workday.unclosed.noShowToast', { name: name(r) }), { action: undo(r, 'no_show') });
    });
  };

  const payNow = (r: UnclosedVisit, method: 'cash' | 'card') =>
    run(r, 'pay', async () => {
      await pay.mutate({ id: r.booking.id, total: r.booking.total, method });
      if (BEFORE_ARRIVAL_STATUSES.includes(r.booking.status)) await change(r, r.booking.status, 'arrived');
      const sum = format.money(r.due || r.total);
      toast.success(t('board.list.paidToast', { name: name(r), sum }), {
        ...(r.booking.clientId ? { action: { label: t('board.nextVisit.short'), onClick: () => openNextVisit(r.booking.id) } } : {}),
        durationMs: 8000,
      });
    });

  return { busy, arrive, noShow, payNow };
}

export type UnclosedActions = ReturnType<typeof useUnclosedActions>;

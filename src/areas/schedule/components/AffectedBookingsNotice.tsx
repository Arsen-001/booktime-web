'use client';

import { useState } from 'react';
import { Ban, CalendarSearch, TriangleAlert } from 'lucide-react';
import type { Id } from '@/domain/core';
import { changeBookingStatus, updateBooking } from '@/api/core';
import { getMoveCandidates, type AffectedBooking } from '@/api/schedule';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button, LinkButton } from '@/ui/Button';
import { Select } from '@/ui/Select';
import { useConfirm, useToast } from '@/ui/Toast';

export interface AffectedBookingsNoticeProps {
  bookings: AffectedBooking[];
  /** Г3: запись перенесли или отменили — экран убирает её из списка (пусто — можно сохранить без «всё равно») */
  onResolved?: (bookingId: Id) => void;
}

/**
 * Предупреждение о записях в затронутых днях (F-02-106, Г3): правка графика их не удаляет и не двигает молча. У каждой
 * записи — что с ней сделать: перенести к мастеру, который в это время работает и свободен, отменить с уведомлением
 * клиента или открыть день в журнале. «Сохранить всё равно» оставляет запись — журнал покажет её колонкой с пометкой.
 */
export function AffectedBookingsNotice({ bookings, onResolved }: AffectedBookingsNoticeProps) {
  const t = useT('schedule');
  const format = useFormat();
  const toast = useToast();
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState<Id | null>(null);
  const ids = bookings.map((b) => b.booking.id);
  const candidatesQuery = useApiQuery(['schedule', 'move-candidates', ids.join(',')], () => getMoveCandidates(ids), {
    enabled: Boolean(onResolved) && ids.length > 0,
    keepPrevious: true,
  });
  const move = useApiMutation((p: { booking: AffectedBooking['booking']; staffId: Id }) =>
    updateBooking(p.booking.id, {
      staffId: p.staffId,
      services: p.booking.services.map((s) => (s.staffId === p.booking.staffId ? { ...s, staffId: p.staffId } : s)),
    }),
  );
  const cancel = useApiMutation((id: Id) => changeBookingStatus(id, 'cancelled_by_master'));

  if (bookings.length === 0) return null;

  const doMove = async (a: AffectedBooking, staffId: Id) => {
    const name = candidatesQuery.data?.[a.booking.id]?.find((c) => c.staffId === staffId)?.name ?? '';
    setBusyId(a.booking.id);
    try {
      await move.mutate({ booking: a.booking, staffId });
      toast.success(t('affected.moved', { name }));
      onResolved?.(a.booking.id);
    } catch {
      toast.error(t('affected.failed'));
    } finally {
      setBusyId(null);
    }
  };

  const doCancel = async (a: AffectedBooking) => {
    setBusyId(a.booking.id);
    try {
      await cancel.mutate(a.booking.id);
      toast.success(t('affected.cancelled'));
      onResolved?.(a.booking.id);
    } catch {
      toast.error(t('affected.failed'));
    } finally {
      setBusyId(null);
    }
  };

  // «Со всеми сразу» (решение владельца 01.10.2026, «В отпуске до…»): перенести к мастеру, свободному для КАЖДОЙ записи
  const bulk = Boolean(onResolved) && bookings.length > 1;
  const commonCandidates = bulk
    ? (candidatesQuery.data?.[bookings[0].booking.id] ?? []).filter((c) =>
        bookings.every((a) => candidatesQuery.data?.[a.booking.id]?.some((x) => x.staffId === c.staffId)),
      )
    : [];

  const doMoveAll = async (staffId: Id) => {
    const name = commonCandidates.find((c) => c.staffId === staffId)?.name ?? '';
    const list = [...bookings];
    setBusyId('*');
    let done = 0;
    try {
      for (const a of list) {
        await move.mutate({ booking: a.booking, staffId });
        done += 1;
        onResolved?.(a.booking.id);
      }
      toast.success(t('affected.movedAll', { n: done, name }));
    } catch {
      toast.error(t('affected.failed'));
    } finally {
      setBusyId(null);
    }
  };

  const doCancelAll = async () => {
    const list = [...bookings];
    const ok = await confirm({
      title: t('affected.cancelAllTitle', { n: list.length }),
      description: t('affected.cancelAllText'),
      confirmLabel: t('affected.cancelAll'),
      tone: 'danger',
    });
    if (!ok) return;
    setBusyId('*');
    let done = 0;
    try {
      for (const a of list) {
        await cancel.mutate(a.booking.id);
        done += 1;
        onResolved?.(a.booking.id);
      }
      toast.success(t('affected.cancelledAll', { n: done }));
    } catch {
      toast.error(t('affected.failed'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-warning bg-warning-soft p-3" data-f="F-02-106">
      <div className="flex items-start gap-2">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium text-fg">{t('panel.hasBookingsWarning', { n: bookings.length })}</p>
          {onResolved && <p className="text-sm text-muted">{t('affected.hint')}</p>}
        </div>
      </div>
      {bulk && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('affected.allLabel')}>
          <span className="text-sm font-medium text-fg">{t('affected.allLabel')}:</span>
          <Select
            size="sm"
            className="w-auto min-w-44"
            aria-label={t('affected.moveAll')}
            placeholder={candidatesQuery.isLoading ? t('affected.loading') : commonCandidates.length ? t('affected.moveAll') : t('affected.nobodyFree')}
            value=""
            disabled={commonCandidates.length === 0 || busyId !== null}
            onValueChange={(v) => void doMoveAll(v)}
            options={commonCandidates.map((c) => ({ value: c.staffId, label: c.name }))}
          />
          <Button size="sm" variant="ghost" leftIcon={<Ban aria-hidden />} loading={busyId === '*' && cancel.isPending} disabled={busyId !== null} onClick={() => void doCancelAll()}>
            {t('affected.cancelAll')}
          </Button>
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {bookings.map((a) => {
          const candidates = candidatesQuery.data?.[a.booking.id] ?? [];
          const date = a.booking.start.slice(0, 10);
          const placeholder = candidatesQuery.isLoading
            ? t('affected.loading')
            : candidates.length
              ? t('affected.moveTo')
              : t('affected.nobodyFree');
          return (
            <li key={a.booking.id} className="flex flex-col gap-2 rounded-lg bg-surface p-2.5 text-sm">
              <p className="text-fg">
                <span className="font-medium tabular-nums">{format.dateTime(a.booking.start)}</span>
                {' · '}
                {a.staffName}
                {a.clientName ? ` · ${a.clientName}` : ''}
                {a.booking.seriesId && (
                  <Badge tone="info" size="sm" className="ms-2 align-middle">
                    {t('affected.recurring')}
                  </Badge>
                )}
              </p>
              {onResolved && (
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    size="sm"
                    className="w-auto min-w-44"
                    aria-label={t('affected.moveTo')}
                    placeholder={placeholder}
                    value=""
                    disabled={candidates.length === 0 || busyId === a.booking.id}
                    onValueChange={(v) => void doMove(a, v)}
                    options={candidates.map((c) => ({ value: c.staffId, label: c.name }))}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    leftIcon={<Ban aria-hidden />}
                    loading={cancel.isPending && busyId === a.booking.id}
                    disabled={busyId !== null && busyId !== a.booking.id}
                    onClick={() => void doCancel(a)}
                  >
                    {t('affected.cancel')}
                  </Button>
                  <LinkButton size="sm" variant="ghost" leftIcon={<CalendarSearch aria-hidden />} href={`/biz/journal?date=${date}&booking=${a.booking.id}`}>
                    {t('affected.open')}
                  </LinkButton>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

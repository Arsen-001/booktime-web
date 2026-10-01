'use client';

/**
 * «Закрыть день» поверх кассовой смены финансов (fin-review Ф1, владелец 01.10.2026: смену ведёт администратор):
 * по наличной кассе — открыта ли смена, сколько должно быть в ящике, пересчёт и «Закрыть день» = закрыть смену тем же
 * closeCashShift, что в «Кассовой смене» (расхождение уходит поправкой, Z-отчёт смены). Закрытая в этот день смена —
 * кто и когда закрыл, сколько насчитали, излишек/недостача: итог видит владелец.
 */
import { useState, type ReactNode } from 'react';
import { Lock, LockOpen, Wallet } from 'lucide-react';
import type { ISODate, Id, Staff } from '@/domain/core';
import { closeCashShift, listAccounts, listCashShifts, type CashShiftView } from '@/api/finance';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import { useCan } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { MoneyInput } from '@/ui/MoneyInput';
import { useNavigate } from '@/ui/navigation/useNavigate';
import { SkeletonText } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

export function DayCloseShift({ businessId, date, today, staff }: { businessId: Id; date: ISODate; today: ISODate; staff: Staff[] }) {
  const t = useT('journal');
  const accountsQ = useApiQuery(['journal', 'workday', 'cash-accounts', businessId], () => listAccounts(businessId), { enabled: Boolean(businessId) });
  const cash = (accountsQ.data ?? []).filter((a) => a.kind === 'cash');
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-bold text-fg">{t('workday.dayClose.shift')}</h3>
      {!accountsQ.data ? (
        <div className="rounded-2xl border border-border p-4 text-sm">
          <SkeletonText width="24ch" />
        </div>
      ) : cash.length === 0 ? (
        <p className="rounded-2xl border border-border p-4 text-sm text-muted">{t('workday.dayClose.noCashDesk')}</p>
      ) : (
        cash.map((a) => <ShiftCard key={a.id} businessId={businessId} accountId={a.id} name={cash.length > 1 ? a.name : undefined} date={date} today={today} staff={staff} />)
      )}
    </section>
  );
}

function ShiftCard({ businessId, accountId, name, date, today, staff }: { businessId: Id; accountId: Id; name?: string; date: ISODate; today: ISODate; staff: Staff[] }) {
  const t = useT('journal');
  const format = useFormat();
  const toast = useToast();
  const nav = useNavigate();
  const canShiftRight = useCan('finance.shift');
  const canFinanceEdit = useCan('finance.edit');
  const canShift = canShiftRight || canFinanceEdit;
  const [counted, setCounted] = useState<number | undefined>(undefined);
  const shiftsQ = useApiQuery(['finance', 'cashShifts', businessId, accountId], () => listCashShifts(businessId, accountId), { enabled: Boolean(businessId) });
  const close = useApiMutation((a: { shiftId: Id; amount: number }) => closeCashShift(businessId, a.shiftId, a.amount, t('workday.dayClose.comment')), {
    invalidates: [
      ['finance', 'cashShifts', businessId, accountId],
      ['journal', 'workday'],
    ],
  });
  const views = shiftsQ.data ?? [];
  const open = date === today ? views.find((v) => v.shift.status === 'open') : undefined;
  const closedThatDay = views.find((v) => v.shift.status === 'closed' && v.shift.closedAt?.startsWith(date));
  const who = (id?: string) => staff.find((s) => s.id === id)?.name.split(' ')[0];

  const submit = async (v: CashShiftView) => {
    if (counted === undefined) return;
    try {
      await close.mutate({ shiftId: v.shift.id, amount: counted });
      setCounted(undefined);
      toast.success(t('workday.dayClose.closed'));
    } catch (e) {
      toast.error(e instanceof ApiError && e.code === 'forbidden' ? t('workday.dayClose.forbidden') : t('workday.dayClose.closeFailed'));
    }
  };

  const wrap = (children: ReactNode) => (
    <div data-f="F-07-001" className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      {name && (
        <p className="flex items-center gap-2 text-sm font-semibold text-fg">
          <Wallet aria-hidden className="size-4 text-muted" />
          {name}
        </p>
      )}
      {children}
    </div>
  );

  if (!shiftsQ.data) return wrap(<SkeletonText width="20ch" />);

  if (open) {
    const diff = counted === undefined ? 0 : counted - open.expectedNow;
    return wrap(
      <>
        <p className="flex items-center gap-1.5 text-sm text-success">
          <LockOpen aria-hidden className="size-4" />
          {t('workday.dayClose.shiftOpen', { time: format.time(open.shift.openedAt) })}
        </p>
        <Line label={t('workday.dayClose.expected')} value={format.money(open.expectedNow)} strong />
        {canShift ? (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fg">{t('workday.dayClose.countLabel')}</span>
              <MoneyInput value={counted} onValueChange={setCounted} />
            </label>
            {counted !== undefined && (
              <Line
                label={diff === 0 ? t('workday.dayClose.matches') : diff > 0 ? t('workday.dayClose.surplus') : t('workday.dayClose.shortage')}
                value={format.money(Math.abs(diff))}
                tone={diff < 0 ? 'text-danger' : diff > 0 ? 'text-warning-text' : 'text-success'}
              />
            )}
            <p className="text-xs text-muted">{t('workday.dayClose.closeHint')}</p>
            <Button className="self-start" leftIcon={<Lock aria-hidden />} loading={close.isPending} disabled={counted === undefined} onClick={() => void submit(open)}>
              {t('workday.dayClose.closeDay')}
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted">{t('workday.dayClose.noShiftRight')}</p>
        )}
      </>,
    );
  }

  if (closedThatDay) {
    const d = closedThatDay.discrepancy ?? 0;
    const by = who(closedThatDay.shift.closedBy);
    return wrap(
      <>
        <p className="flex items-center gap-1.5 text-sm text-fg">
          <Lock aria-hidden className="size-4 text-muted" />
          {by
            ? t('workday.dayClose.shiftClosedBy', { time: format.time(closedThatDay.shift.closedAt ?? ''), name: by })
            : t('workday.dayClose.shiftClosed', { time: format.time(closedThatDay.shift.closedAt ?? '') })}
        </p>
        <Line label={t('workday.dayClose.expected')} value={format.money(closedThatDay.shift.expectedAtClose ?? closedThatDay.report.expected)} />
        {closedThatDay.shift.countedCash !== undefined && <Line label={t('workday.dayClose.counted')} value={format.money(closedThatDay.shift.countedCash)} strong />}
        <Line
          label={d === 0 ? t('workday.dayClose.matches') : d > 0 ? t('workday.dayClose.surplus') : t('workday.dayClose.shortage')}
          value={format.money(Math.abs(d))}
          tone={d < 0 ? 'text-danger' : d > 0 ? 'text-warning-text' : 'text-success'}
        />
      </>,
    );
  }

  return wrap(
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="flex items-center gap-1.5 text-sm text-muted">
        <Lock aria-hidden className="size-4" />
        {date === today ? t('workday.dayClose.shiftNone') : t('workday.dayClose.shiftNoneDay')}
      </p>
      {canShift && date === today && (
        <Button size="sm" variant="secondary" onClick={() => nav.go('/biz/finance/shift')}>
          {t('workday.dayClose.openShift')}
        </Button>
      )}
    </div>,
  );
}

function Line({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 text-sm', strong && 'font-semibold')}>
      <span className={strong ? 'text-fg' : 'text-muted'}>{label}</span>
      <span className={cn('tabular-nums', tone ?? 'text-fg')}>{value}</span>
    </div>
  );
}


'use client';

/**
 * «Приложение» → зарплата (F-14-127, F-14-128). Демо-симуляция раздела «Payroll calculation» мобильного
 * приложения для бизнеса: сотрудник видит свой расчёт, владелец/менеджер с полным доступом — любого
 * сотрудника; право «Финансы → Доступ к расчёту ЗП» решает, скрыт ли раздел и есть ли период или только «сегодня».
 */
import { useState } from 'react';
import { Lock, Wallet } from 'lucide-react';
import { getAppPayrollCalculation, getAppPayrollPayouts, listAppStaff, recordPayrollPayout } from '@/api/client';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { useT } from '@/i18n/useT';
import { today } from '@/lib/date';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { DateRangePicker, presetRange } from '@/ui/DateRangePicker';
import type { DateRange } from '@/ui/Calendar';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Modal } from '@/ui/Modal';
import { MoneyInput } from '@/ui/MoneyInput';
import { PageHeader } from '@/ui/PageHeader';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { Tabs } from '@/ui/Tabs';
import { useToast } from '@/ui/Toast';

export function PayrollAppScreen() {
  const t = useT('client');
  const { ready, businessId, staffId } = useCurrent();
  const [tab, setTab] = useState<'calculation' | 'payouts'>('calculation');
  const staffQ = useApiQuery(['app-staff-payroll', businessId], () => listAppStaff(businessId!, false), { enabled: ready && Boolean(businessId) });

  // Права — как в разделе «Зарплата» в вебе (A8, F-14-127): с payroll.manage выбирают любого сотрудника
  // (владелец, владелец сети, админ с галочкой), остальные — только свой расчёт.
  // Свой расчёт — любому сотруднику (как «Моя зарплата» в вебе). Доступ «в приложении» (скрыт/только сегодня)
  // владелец задаёт сотруднику в «Команде».
  const canPickAny = useCan('payroll.manage');
  const [selectedStaffId, setSelectedStaffId] = useState<Id | undefined>(undefined);
  const targetStaffId = canPickAny ? (selectedStaffId ?? staffId) : staffId;

  const myAccess = canPickAny ? undefined : staffQ.data?.find((r) => r.staff.id === staffId)?.access;
  const payrollAccess = myAccess?.payrollAccess ?? 'self';

  const [range, setRange] = useState<DateRange>(presetRange('thisMonth'));
  const currentDayOnly = myAccess?.payrollCurrentDayOnly ?? false;
  const effectiveRange: DateRange = currentDayOnly ? { from: today(), to: today() } : range;

  return (
    <div data-f="F-14-127" className="flex flex-col gap-6">
      <PageHeader title={t('apps.payroll.title')} description={t('apps.payroll.subtitle')} />

      {canPickAny && (
        <FormField label={t('apps.payroll.chooseStaff')}>
          <Select
            options={(staffQ.data ?? []).map((r) => ({ value: r.staff.id, label: r.staff.name }))}
            value={targetStaffId ?? ''}
            onValueChange={(v) => setSelectedStaffId(v || undefined)}
            placeholder={t('apps.payroll.chooseStaff')}
          />
        </FormField>
      )}

      {!targetStaffId ? (
        <EmptyState icon={<Wallet aria-hidden className="size-8 text-muted" />} title={t('apps.payroll.chooseStaff')} />
      ) : payrollAccess === 'none' ? (
        <EmptyState icon={<Lock aria-hidden className="size-8 text-muted" />} title={t('apps.payroll.noAccess')} />
      ) : (
        <div data-f="F-14-128" className="flex flex-col gap-4">
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as typeof tab)}
            items={[
              { value: 'calculation', label: t('apps.payroll.tabCalculation') },
              { value: 'payouts', label: t('apps.payroll.tabPayouts') },
            ]}
          />

          {currentDayOnly ? (
            <p className="text-sm text-muted">{t('apps.payroll.todayOnly')}</p>
          ) : (
            <DateRangePicker value={range} onValueChange={setRange} presets />
          )}

          {tab === 'calculation' ? (
            <CalculationTab businessId={businessId!} staffId={targetStaffId} range={effectiveRange} />
          ) : (
            <PayoutsTab businessId={businessId!} staffId={targetStaffId} range={effectiveRange} />
          )}
        </div>
      )}
    </div>
  );
}

function CalculationTab({ businessId, staffId, range }: { businessId: Id; staffId: Id; range: DateRange }) {
  const t = useT('client');
  const fmt = useClientFormat();
  const from = range.from ?? today();
  const to = range.to ?? from;
  const q = useApiQuery(['payroll-calc', businessId, staffId, from, to], () => getAppPayrollCalculation(businessId, staffId, from, to));

  if (q.isLoading) return <Skeleton lines={3} />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => void q.refetch()} />;
  const d = q.data;
  if (d.servicesCount === 0 && d.productsCount === 0 && d.daysWorked === 0) {
    return <EmptyState icon={<Wallet aria-hidden className="size-8 text-muted" />} title={t('apps.payroll.empty')} />;
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <Card padding="sm" className="flex flex-col gap-1">
        <span className="text-xs text-muted">{t('apps.payroll.daysWorked')}</span>
        <span className="text-lg font-semibold text-fg">{d.daysWorked}</span>
      </Card>
      <Card padding="sm" className="flex flex-col gap-1">
        <span className="text-xs text-muted">{t('apps.payroll.hoursWorked')}</span>
        <span className="text-lg font-semibold text-fg">{d.hoursWorked}</span>
      </Card>
      {/* «Отработано» — по сегодня; график дальше — только подпись (решение 01.10) */}
      {(d.scheduledAheadDays ?? 0) > 0 && (
        <p className="col-span-full -mt-1 text-xs text-muted">
          {t('apps.payroll.scheduledAhead', { days: d.scheduledAheadDays ?? 0, hours: d.scheduledAheadHours ?? 0 })}
        </p>
      )}
      <Card padding="sm" className="flex flex-col gap-1">
        <span className="text-xs text-muted">{t('apps.payroll.servicesProvided')}</span>
        <span className="text-lg font-semibold text-fg">{d.servicesCount}</span>
      </Card>
      <Card padding="sm" className="flex flex-col gap-1">
        <span className="text-xs text-muted">{t('apps.payroll.servicesValue')}</span>
        <span className="text-lg font-semibold text-fg">{fmt.money(d.servicesValue)}</span>
      </Card>
      <Card padding="sm" className="flex flex-col gap-1">
        <span className="text-xs text-muted">{t('apps.payroll.productsSold')}</span>
        <span className="text-lg font-semibold text-fg">{d.productsCount}</span>
      </Card>
      <Card padding="sm" className="flex flex-col gap-1">
        <span className="text-xs text-muted">{t('apps.payroll.productsValue')}</span>
        <span className="text-lg font-semibold text-fg">{fmt.money(d.productsValue)}</span>
      </Card>
      <Card padding="sm" className="col-span-full flex flex-col gap-1 bg-surface-2">
        <span className="text-xs text-muted">{t('apps.payroll.totalEarned')}</span>
        <span className="text-xl font-semibold text-fg">{fmt.money(d.total)}</span>
      </Card>
    </div>
  );
}

function PayoutsTab({ businessId, staffId, range }: { businessId: Id; staffId: Id; range: DateRange }) {
  const t = useT('client');
  const toast = useToast();
  const fmt = useClientFormat();
  const from = range.from ?? today();
  const to = range.to ?? from;
  const q = useApiQuery(['payroll-payouts', businessId, staffId, from, to], () => getAppPayrollPayouts(businessId, staffId, from, to));
  // Отметить выплату — только с payroll.manage (сотрудник видит свои выплаты, но не платит себе сам)
  const canPayOut = useCan('payroll.manage');
  const [payOutOpen, setPayOutOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const payOut = useApiMutation(({ staffId, amount }: { staffId: Id; amount: number }) => recordPayrollPayout(staffId, amount));

  if (q.isLoading) return <Skeleton lines={2} />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => void q.refetch()} />;
  const d = q.data;

  return (
    <div className="flex flex-col gap-3">
      <Card padding="sm" className="flex flex-col gap-1">
        <span className="text-xs text-muted">{t('apps.payroll.earned')}</span>
        <span className="text-lg font-semibold text-fg">{fmt.money(d.earned)}</span>
      </Card>
      <Card padding="sm" className="flex flex-col gap-1">
        <span className="text-xs text-muted">{t('apps.payroll.paid')}</span>
        <span className="text-lg font-semibold text-success">{fmt.money(d.paid)}</span>
      </Card>
      <Card padding="sm" className="flex flex-col gap-1 bg-surface-2">
        <span className="text-xs text-muted">{t('apps.payroll.remaining')}</span>
        <span className="text-xl font-semibold text-fg">{fmt.money(d.remaining)}</span>
      </Card>
      {d.remaining > 0 && canPayOut && (
        <Button variant="secondary" onClick={() => { setAmount(d.remaining); setPayOutOpen(true); }}>
          {t('apps.payroll.payOutCta')}
        </Button>
      )}

      <Modal open={payOutOpen} onOpenChange={setPayOutOpen} title={t('apps.payroll.payOutCta')} size="sm">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">{t('apps.payroll.payOutHint')}</p>
          <FormField label={t('apps.payroll.payOutAmountLabel')}>
            <MoneyInput value={amount} onValueChange={(v) => setAmount(v ?? 0)} />
          </FormField>
          <Button
            loading={payOut.isPending}
            disabled={amount <= 0}
            onClick={() =>
              void payOut
                .mutate({ staffId, amount })
                .then(() => {
                  toast.success(t('apps.payroll.payOutDone'));
                  setPayOutOpen(false);
                  void q.refetch();
                })
            }
          >
            {t('apps.payroll.payOutCta')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

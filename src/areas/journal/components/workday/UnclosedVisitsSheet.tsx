'use client';

/**
 * ⭐ «Незакрытые визиты» (владелец, 01.10.2026 — пункт 6): прошедшие записи, где не отмечено «Пришёл» / «Не пришёл»,
 * и визиты «Пришёл» без оплаты — за последние две недели. Закрыть каждую — одним нажатием в строке, без окна записи;
 * деньги идут через кассу (как «Оплатить» в «Списке»). Мастер без права видеть чужих — только свои визиты.
 */
import { useState } from 'react';
import { CheckCircle2, CreditCard, MoreHorizontal, UserCheck, UserX, Wallet } from 'lucide-react';
import type { Id, Service, Staff } from '@/domain/core';
import { listUnclosedVisits, workdayKeys, type UnclosedVisit } from '@/api/journal-workday';
import { useApiQuery } from '@/api/request';
import { UNCLOSED_DAYS } from '@/domain/journalWorkday';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { DropdownMenu, type DropdownMenuItem } from '@/ui/DropdownMenu';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { usePagedList } from '@/ui/Pagination';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Sheet } from '@/ui/Sheet';
import { WorkdayRow, WorkdayRowSkeleton } from './WorkdayRow';
import { useUnclosedActions, type UnclosedActions } from './useUnclosedActions';

type Filter = 'all' | 'arrival' | 'payment';

/** Список незакрытых — общий ключ для шторки и счётчика в «Требует внимания»; мастеру без чужих — только свои */
export function useUnclosedVisits(businessId: Id, onlyStaffId?: Id, enabled = true) {
  const q = useApiQuery(workdayKeys.unclosed(businessId), () => listUnclosedVisits(businessId), { enabled: enabled && Boolean(businessId) });
  const rows = (q.data ?? []).filter((r) => !onlyStaffId || r.booking.staffId === onlyStaffId);
  return { ...q, rows };
}

export function UnclosedVisitsSheet({
  open,
  onOpenChange,
  businessId,
  onlyStaffId,
  staff,
  services,
  onOpenBooking,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: Id;
  onlyStaffId?: Id;
  staff: Staff[];
  services: Service[];
  onOpenBooking: (id: Id, date: string) => void;
}) {
  const t = useT('journal');
  const [filter, setFilter] = useState<Filter>('all');
  const list = useUnclosedVisits(businessId, onlyStaffId, open);
  const openRow = (r: UnclosedVisit) => onOpenBooking(r.booking.id, r.booking.start.slice(0, 10));
  const actions = useUnclosedActions(businessId, openRow);
  const arrival = list.rows.filter((r) => r.reason === 'arrival').length;
  const payment = list.rows.length - arrival;
  const shown = filter === 'all' ? list.rows : list.rows.filter((r) => r.reason === filter);
  const { pageItems, pager } = usePagedList(shown, { resetKey: filter });

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t('workday.unclosed.title')} description={t('workday.unclosed.subtitle', { n: UNCLOSED_DAYS })} size="lg">
      <div data-f="F-01-077 F-01-141" className="flex flex-col gap-4 pb-2">
        <SegmentedControl
          size="sm"
          aria-label={t('workday.unclosed.filter')}
          value={filter}
          onValueChange={(v) => setFilter(v as Filter)}
          options={[
            { value: 'all', label: t('workday.unclosed.filterAll', { n: list.rows.length }) },
            { value: 'arrival', label: t('workday.unclosed.filterArrival', { n: arrival }) },
            { value: 'payment', label: t('workday.unclosed.filterPayment', { n: payment }) },
          ]}
        />
        {list.isError ? (
          <ErrorState onRetry={() => list.refetch()} />
        ) : list.isLoading ? (
          <ul className="flex flex-col divide-y divide-border">
            {Array.from({ length: 5 }, (_, i) => (
              <WorkdayRowSkeleton key={i} />
            ))}
          </ul>
        ) : shown.length === 0 ? (
          <EmptyState
            compact
            icon={<CheckCircle2 aria-hidden className="size-8 text-success" />}
            title={t('workday.unclosed.emptyTitle')}
            description={t('workday.unclosed.emptyText')}
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {pageItems.map((r) => (
              <UnclosedRow key={r.booking.id} row={r} staff={staff} services={services} actions={actions} onOpen={() => openRow(r)} />
            ))}
          </ul>
        )}
        {pager}
      </div>
    </Sheet>
  );
}

function UnclosedRow({
  row: r,
  staff,
  services,
  actions,
  onOpen,
}: {
  row: UnclosedVisit;
  staff: Staff[];
  services: Service[];
  actions: UnclosedActions;
  onOpen: () => void;
}) {
  const t = useT('journal');
  const format = useFormat();
  const busy = actions.busy[r.booking.id];
  const due = r.due > 0 ? r.due : r.total;
  const canPay = due > 0;
  const name = r.clientName || t('block.noClient');
  const menu: DropdownMenuItem[] = [
    ...(r.reason === 'arrival' && canPay ? [{ id: 'cash', label: t('workday.unclosed.payCash', { sum: format.money(due) }), icon: <Wallet aria-hidden />, onSelect: () => void actions.payNow(r, 'cash') }] : []),
    ...(canPay ? [{ id: 'card', label: t('workday.unclosed.payCard', { sum: format.money(due) }), icon: <CreditCard aria-hidden />, onSelect: () => void actions.payNow(r, 'card') }] : []),
    ...(r.reason === 'payment' ? [{ id: 'noshow', label: t('workday.unclosed.noShow'), icon: <UserX aria-hidden />, onSelect: () => void actions.noShow(r) }] : []),
    { id: 'open', label: t('board.list.open'), onSelect: onOpen },
  ];
  const badge = (
    <Badge size="sm" tone={r.reason === 'arrival' ? 'warning' : 'danger'} className="shrink-0">
      {r.reason === 'arrival' ? t('workday.unclosed.reasonArrival') : t('workday.unclosed.reasonPayment')}
    </Badge>
  );
  return (
    <WorkdayRow
      start={r.booking.start}
      staffId={r.booking.staffId}
      serviceIds={r.booking.services.map((l) => l.serviceId)}
      clientName={r.clientName}
      staff={staff}
      services={services}
      onOpen={onOpen}
      badge={badge}
      trailing={
        <>
          {r.reason === 'arrival' ? (
            <>
              <Button size="sm" variant="outline" leftIcon={<UserCheck aria-hidden />} loading={busy === 'arrive'} disabled={Boolean(busy)} onClick={() => void actions.arrive(r)}>
                {t('workday.unclosed.arrived')}
              </Button>
              <Button size="sm" variant="ghost" leftIcon={<UserX aria-hidden />} loading={busy === 'noShow'} disabled={Boolean(busy)} onClick={() => void actions.noShow(r)}>
                {t('workday.unclosed.noShow')}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" leftIcon={<Wallet aria-hidden />} loading={busy === 'pay'} disabled={Boolean(busy)} onClick={() => void actions.payNow(r, 'cash')}>
              {t('workday.unclosed.pay', { sum: format.money(r.due) })}
            </Button>
          )}
          <DropdownMenu
            label={name}
            items={menu}
            trigger={(p) => <IconButton {...p} size="sm" variant="ghost" icon={<MoreHorizontal aria-hidden />} label={t('workday.unclosed.more', { name })} disabled={Boolean(busy)} />}
          />
        </>
      }
    />
  );
}

'use client';

/**
 * Карточка сотрудника в «Расчёте за период» (F-09-062, F-09-063): вместо таблицы на 10 столбцов —
 * headline-сумма к выплате + раскрывающаяся раскладка. Принадлежит разделу «payroll».
 * Зарплата-ревью: заголовок — «К выплате» с премиями и штрафами (З7), в раскрытии — блоки зарплаты и
 * пояснения (З10), часы подписаны «по графику».
 */
import { memo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ChevronDown } from 'lucide-react';
import type { PeriodRow } from '@/domain/payroll';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { dayjs } from '@/lib/date';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Collapse } from '@/ui/Collapse';
import { KeyValueList } from '@/ui/KeyValueList';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { PayBreakdownList } from '@/areas/payroll/shared/PayBreakdownList';

export interface PeriodStaffCardRow extends PeriodRow {
  staffName: string;
  position?: string;
}

export interface PeriodStaffCardProps {
  row: PeriodStaffCardRow;
  canManage: boolean;
  existingCreatedAt?: string;
  statementHref: string;
  creating: boolean;
  actionDisabled: boolean;
  onCreateSheet: (staffId: string) => void;
}

/** Одна строка «Расчёта за период»: сумма — заголовок карточки, остальное — по раскрытию */
export const PeriodStaffCard = memo(function PeriodStaffCard({
  row,
  canManage,
  existingCreatedAt,
  statementHref,
  creating,
  actionDisabled,
  onCreateSheet,
}: PeriodStaffCardProps) {
  const t = useT('payroll');
  const { money, duration } = useFormat();
  const [open, setOpen] = useState(false);
  const detailsId = `period-details-${row.staffId}`;
  const toPay = row.breakdown?.toPay ?? row.salary;

  return (
    <Card as="li" padding="md" className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar name={row.staffName} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-fg">{row.staffName}</p>
          {row.position && <p className="truncate text-sm text-muted">{row.position}</p>}
        </div>
        <p className="num-lg shrink-0 text-fg">{money(toPay)}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={detailsId}
          className="-ml-1.5 flex min-h-9 items-center gap-1 rounded-md px-1.5 text-left text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          {t('period.columns.servicesCount')}: {row.servicesCount} ·{' '}
          {t('period.hoursBySchedule', { hours: duration(Math.round(row.workHours * 60)) })}
          <ChevronDown aria-hidden className={`size-4 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
        </button>

        {canManage &&
          (existingCreatedAt ? (
            <Link
              href={statementHref}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-primary-text hover:underline"
            >
              <CheckCircle2 aria-hidden className="size-4" />
              {t('period.createdOn', { date: dayjs(existingCreatedAt).format('DD.MM') })}
            </Link>
          ) : (
            <Button size="sm" variant="secondary" loading={creating} disabled={actionDisabled} onClick={() => onCreateSheet(row.staffId)}>
              {t('period.createSheet')}
            </Button>
          ))}
      </div>
      {/* Решение 01.10: «отработано» и оплата за рабочий день — по сегодня; график дальше — только подпись */}
      {(row.scheduledAheadDays ?? 0) > 0 && (
        <p className="-mt-1 text-xs text-muted">
          {t('me.scheduledAhead', { days: row.scheduledAheadDays ?? 0, hours: row.scheduledAheadHours ?? 0 })}
        </p>
      )}

      <Collapse open={open}>
        <div id={detailsId} className="flex flex-col gap-4 border-t border-border pt-3">
          {row.breakdown && <PayBreakdownList breakdown={row.breakdown} />}
          <KeyValueList
            columns={2}
            dense
            items={[
              { label: t('period.columns.servicesAmount'), value: money(row.servicesAmount) },
              { label: t('period.columns.productsAmount'), value: money(row.productsAmount) },
              { label: t('period.columns.totalAmount'), value: money(row.totalAmount) },
              { label: t('period.columns.paidAmount'), value: money(row.paidAmount) },
            ]}
          />
          <p className="text-sm">
            <Link href={statementHref} className="font-medium text-primary-text hover:underline">
              {t('statement.title')}
            </Link>
          </p>
        </div>
      </Collapse>
    </Card>
  );
});

/** Скелетон карточки сотрудника — та же разметка: аватар, имя и должность, сумма, строка «услуги · часы» и кнопка */
export function PeriodStaffCardSkeleton({ canManage }: { canManage: boolean }) {
  const t = useT('payroll');
  return (
    <Card as="li" padding="md" className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Skeleton variant="circle" className="size-10 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-fg">
            <SkeletonText width="16ch" />
          </p>
          <p className="truncate text-sm text-muted">
            <SkeletonText width="10ch" />
          </p>
        </div>
        <p className="num-lg shrink-0 text-fg">
          <SkeletonText width="8ch" />
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <span className="-ml-1.5 flex min-h-9 items-center gap-1 px-1.5 text-sm text-muted">
          <SkeletonText width="24ch" />
          <ChevronDown aria-hidden className="size-4 shrink-0" />
        </span>
        {canManage && (
          <Button size="sm" variant="secondary" disabled>
            {t('period.createSheet')}
          </Button>
        )}
      </div>
    </Card>
  );
}

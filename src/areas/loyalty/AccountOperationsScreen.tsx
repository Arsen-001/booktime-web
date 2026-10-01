'use client';

/**
 * /biz/loyalty/deposits/operations — журнал операций со счетами (F-06-142): открытие, пополнение,
 * списание за период с автором. Выгрузка в Excel.
 * F-06-144: возврат денег со счёта — способ 1 «отменить операцию пополнения» (cancelAccountTopup, только
 * для строк типа «Пополнение») или способ 2 «частичный возврат суммой» (refundAccountAmount).
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, Receipt, Undo2 } from 'lucide-react';
import { cancelAccountTopup, listAccountOperations, refundAccountAmount } from '@/api/loyalty';
import { useApiMutation, useApiQuery } from '@/api/request';
import { BadgeSkeleton } from '@/areas/loyalty/components/Skeletons';
import { useCan, useCurrent } from '@/demo/hooks';
import type { AccountOpType } from '@/domain/loyalty';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { downloadCsv, toCsv } from '@/lib/csv';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { DateRangePicker } from '@/ui/DateRangePicker';
import type { DateRange } from '@/ui/Calendar';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FilterBar } from '@/ui/FilterBar';
import { FormField } from '@/ui/FormField';
import { IconButton } from '@/ui/IconButton';
import { Modal } from '@/ui/Modal';
import { MoneyInput } from '@/ui/MoneyInput';
import { PageHeader } from '@/ui/PageHeader';
import { RadioGroup } from '@/ui/Radio';
import { Select } from '@/ui/Select';
import { SkeletonText } from '@/ui/Skeleton';
import { Table, type TableColumn } from '@/ui/Table';
import { useToast } from '@/ui/Toast';

const OP_TONE = { open: 'neutral', topup: 'success', charge: 'danger' } as const;

export function AccountOperationsScreen() {
  const t = useT('loyalty');
  const toast = useToast();
  const format = useFormat();
  const { ready, businessId, staffId } = useCurrent();
  const canManage = useCan('loyalty.manage');

  const [type, setType] = useState('');
  const [range, setRange] = useState<DateRange | undefined>(undefined);

  const q = useApiQuery(
    ['loyalty', 'accountOperations', businessId, type, range?.from, range?.to],
    () => listAccountOperations(businessId!, { type: (type as AccountOpType) || undefined, dateFrom: range?.from, dateTo: range?.to }),
    { enabled: ready && Boolean(businessId) },
  );

  const [refundRow, setRefundRow] = useState<NonNullable<typeof q.data>[number] | null>(null);
  const [refundMode, setRefundMode] = useState<'full' | 'partial'>('full');
  const [refundValue, setRefundValue] = useState<number | undefined>(undefined);
  const cancelTopup = useApiMutation((row: NonNullable<typeof q.data>[number]) => cancelAccountTopup(businessId!, row.accountId, row.id));
  // Не `refundRow!.accountId`: React Compiler по «!» считает refundRow не-null и выносит чтение поля в рендер.
  const refundAccountId = refundRow?.accountId;
  const refundPartial = useApiMutation((amount: number) => {
    if (!refundAccountId) throw new Error('refund account is not selected');
    return refundAccountAmount(businessId!, refundAccountId, amount, staffId);
  });

  const openRefund = (row: NonNullable<typeof q.data>[number]) => {
    setRefundRow(row);
    setRefundMode(row.type === 'topup' ? 'full' : 'partial');
    setRefundValue(Math.abs(row.amount));
  };

  const submitRefund = async () => {
    if (!refundRow) return;
    try {
      if (refundMode === 'full' && refundRow.type === 'topup') {
        await cancelTopup.mutate(refundRow);
      } else {
        await refundPartial.mutate(refundValue ?? 0);
      }
      toast.success(t('accountOperations.refunded'));
      setRefundRow(null);
      q.refetch();
    } catch {
      toast.error(t('accountOperations.refundFailed'));
    }
  };

  const typeOptions = useMemo(
    () => [
      { value: '', label: t('accountOperations.filters.allTypes') },
      { value: 'open', label: t('accountOperations.types.open') },
      { value: 'topup', label: t('accountOperations.types.topup') },
      { value: 'charge', label: t('accountOperations.types.charge') },
    ],
    [t],
  );

  const columns: TableColumn<NonNullable<typeof q.data>[number]>[] = [
    { id: 'createdAt', header: t('accountOperations.columns.date'), cell: (r) => format.date(r.createdAt, 'short'), mobile: 'meta', width: '8rem', skeletonWidth: '8ch' },
    { id: 'type', header: t('accountOperations.columns.type'), cell: (r) => <Badge tone={OP_TONE[r.type]}>{t(`accountOperations.types.${r.type}`)}</Badge>, mobile: 'badge', width: '10rem', skeleton: <BadgeSkeleton width="9ch" /> },
    {
      id: 'clientPhone',
      header: t('accountOperations.columns.owner'),
      cell: (r) =>
        r.clientId ? (
          <Link href={`/biz/clients/${r.clientId}`} className="inline-flex min-h-10 max-w-full items-center text-primary-text underline decoration-border-strong underline-offset-2">
            <span className="truncate">
              {r.clientName} · {format.phone(r.clientPhone)}
            </span>
          </Link>
        ) : (
          '—'
        ),
      mobile: 'title',
      // Ссылка на клиента высотой 40 px — скелетон той же высоты
      skeleton: (
        <span className="inline-flex min-h-10 items-center">
          <SkeletonText width="26ch" />
        </span>
      ),
    },
    { id: 'amount', header: t('accountOperations.columns.amount'), cell: (r) => (r.amount === 0 ? '—' : format.money(r.amount)), align: 'right', mobile: 'aside', width: '9rem', skeletonWidth: '8ch', className: 'whitespace-nowrap' },
    { id: 'authorName', header: t('accountOperations.columns.author'), cell: (r) => <span className="block max-w-[10rem] truncate">{r.authorName ?? '—'}</span>, mobile: 'hidden', width: '12rem', skeletonWidth: '12ch' },
    ...(canManage
      ? [
          {
            id: 'refund',
            header: '',
            cell: (r: NonNullable<typeof q.data>[number]) =>
              r.type !== 'open' ? (
                <IconButton
                  data-f="F-06-144 F-04-175"
                  size="sm"
                  variant="ghost"
                  icon={<Undo2 aria-hidden />}
                  label={t('accountOperations.refund')}
                  onClick={(e) => {
                    e.stopPropagation();
                    openRefund(r);
                  }}
                />
              ) : null,
            mobile: 'hidden' as const,
            width: '4rem',
            // Место кнопки «Вернуть» — пустое, строка и так высотой с кнопку
            skeleton: <span />,
          },
        ]
      : []),
  ];

  if (q.isError) return <ErrorState onRetry={q.refetch} />;

  const exportExcel = () => {
    const rows = q.data ?? [];
    const csv = toCsv(
      rows.map((r) => [
        format.date(r.createdAt, 'short'),
        t(`accountOperations.types.${r.type}`),
        r.clientId ? `${r.clientName} · ${format.phone(r.clientPhone)}` : '',
        r.amount === 0 ? '' : format.money(r.amount),
        r.authorName ?? '',
      ]),
      [
        t('accountOperations.columns.date'),
        t('accountOperations.columns.type'),
        t('accountOperations.columns.owner'),
        t('accountOperations.columns.amount'),
        t('accountOperations.columns.author'),
      ],
    );
    downloadCsv('account-operations.csv', csv);
    toast.success(t('accountOperations.exported'));
  };
  const hasFilters = Boolean(type) || Boolean(range?.from);
  const reset = () => {
    setType('');
    setRange(undefined);
  };

  return (
    <div data-f="F-06-142" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('accountOperations.title')}
        description={t('accountOperations.subtitle')}
        actions={
          <Button variant="outline" leftIcon={<Download aria-hidden />} onClick={exportExcel}>
            {t('accountOperations.export')}
          </Button>
        }
      />

      <FilterBar
        filters={[
          { id: 'type', label: t('accountOperations.filters.type'), node: <Select options={typeOptions} value={type} onValueChange={setType} /> },
          { id: 'period', label: t('accountOperations.filters.period'), node: <DateRangePicker value={range} onValueChange={setRange} presets /> },
        ]}
        activeCount={hasFilters ? 1 : 0}
        onReset={reset}
      />

      <Table
        columns={columns}
        rows={q.data ?? []}
        rowKey={(r) => r.id}
        loading={q.isLoading}
        loadingRows={10}
        label={t('accountOperations.title')}
        empty={<EmptyState icon={<Receipt aria-hidden />} kind={hasFilters ? 'search' : 'default'} title={hasFilters ? undefined : t('accountOperations.emptyTitle')} onReset={hasFilters ? reset : undefined} />}
      />

      <Modal
        open={Boolean(refundRow)}
        onOpenChange={(open) => !open && setRefundRow(null)}
        title={t('accountOperations.refundTitle')}
        footer={
          <>
            <Button variant="outline" onClick={() => setRefundRow(null)}>
              {t('certificateDetail.cancel2')}
            </Button>
            <Button variant="danger" loading={cancelTopup.isPending || refundPartial.isPending} onClick={submitRefund} disabled={refundMode === 'partial' && !refundValue}>
              {t('accountOperations.refundConfirm')}
            </Button>
          </>
        }
      >
        {refundRow && (
          <div className="flex flex-col gap-4">
            {refundRow.type === 'topup' ? (
              <RadioGroup
                value={refundMode}
                onValueChange={(v) => setRefundMode(v as 'full' | 'partial')}
                options={[
                  { value: 'full', label: t('accountOperations.refundFull') },
                  { value: 'partial', label: t('accountOperations.refundPartialTitle') },
                ]}
              />
            ) : (
              <p className="text-sm text-muted">{t('accountOperations.notTopup')}</p>
            )}
            {(refundMode === 'partial' || refundRow.type !== 'topup') && (
              <FormField label={t('accountOperations.refundAmount')}>
                <MoneyInput value={refundValue} onValueChange={setRefundValue} />
              </FormField>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

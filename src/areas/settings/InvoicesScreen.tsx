'use client';

/**
 * /biz/billing/invoices — «Счета» (F-15-087): выставленные счета (подписка / монеты / реклама), фильтр по назначению.
 */
import { useState } from 'react';
import { Receipt } from 'lucide-react';
import { listInvoices, type InvoicePurpose } from '@/api/settings';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge, type BadgeTone } from '@/ui/Badge';
import { Chip } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FilterBar } from '@/ui/FilterBar';
import { PageHeader } from '@/ui/PageHeader';
import { SkeletonText } from '@/ui/Skeleton';
import { Table, type TableColumn } from '@/ui/Table';

interface InvoiceRow {
  id: string;
  number: string;
  purpose: InvoicePurpose;
  amount: number;
  status: 'paid' | 'unpaid' | 'cancelled';
  date: string;
}

const STATUS_TONE: Record<InvoiceRow['status'], BadgeTone> = { paid: 'success', unpaid: 'warning', cancelled: 'neutral' };
const PURPOSES: InvoicePurpose[] = ['subscription', 'coins', 'ads'];

export function InvoicesScreen() {
  const t = useT('settings');
  const format = useFormat();
  const { businessId, ready } = useCurrent();
  const [purpose, setPurpose] = useState<InvoicePurpose | null>(null);

  const q = useApiQuery(
    ['settings', 'invoices', businessId, purpose],
    () => listInvoices(businessId ?? '', purpose ? { purpose } : undefined),
    { enabled: ready && Boolean(businessId) },
  );

  // Ширина у каждой колонки: колонка не сжимается под полосой скелетона и не растягивается под текстом
  const columns: TableColumn<InvoiceRow>[] = [
    { id: 'number', header: t('invoices.number'), cell: (r) => `№${r.number}`, mobile: 'title', width: '8rem', skeletonWidth: '6ch' },
    {
      id: 'purpose',
      header: t('invoices.purpose'),
      cell: (r) => <span className="block truncate">{t(`invoices.purposeValue.${r.purpose}`)}</span>,
      mobile: 'subtitle',
      width: '12rem',
      skeletonWidth: '9ch',
    },
    { id: 'date', header: t('invoices.date'), cell: (r) => format.date(r.date, 'short'), mobile: 'meta', sortable: true, sortValue: (r) => r.date, width: '9rem', skeletonWidth: '8ch' },
    { id: 'amount', header: t('invoices.amount'), cell: (r) => format.money(r.amount), align: 'right', mobile: 'aside', sortable: true, sortValue: (r) => r.amount, width: '9rem', skeletonWidth: '7ch' },
    {
      id: 'status',
      header: t('invoices.status'),
      cell: (r) => (
        <Badge tone={STATUS_TONE[r.status]} size="sm">
          {t(`invoices.statusValue.${r.status}`)}
        </Badge>
      ),
      // Та же плашка статуса, внутри — полоса
      skeleton: (
        <Badge tone="neutral" size="sm">
          <SkeletonText width="8ch" />
        </Badge>
      ),
      mobile: 'badge',
      width: '9rem',
    },
  ];

  return (
    <div data-f="F-15-087" className="flex flex-col gap-6">
      <PageHeader title={t('invoices.title')} description={t('invoices.description')} back={{ href: '/biz/billing' }} />

      <FilterBar
        activeCount={purpose ? 1 : 0}
        onReset={() => setPurpose(null)}
        filters={[
          {
            id: 'purpose',
            label: t('invoices.purpose'),
            active: purpose !== null,
            chip: purpose ? t(`invoices.purposeValue.${purpose}`) : null,
            onClear: () => setPurpose(null),
            node: (
              <div className="flex flex-wrap gap-2">
                <Chip selected={purpose === null} onClick={() => setPurpose(null)}>
                  {t('invoices.purposeValue.all')}
                </Chip>
                {PURPOSES.map((p) => (
                  <Chip key={p} selected={purpose === p} onClick={() => setPurpose(p)}>
                    {t(`invoices.purposeValue.${p}`)}
                  </Chip>
                ))}
              </div>
            ),
          },
        ]}
      />

      {q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : (
        <Table
          columns={columns}
          rows={q.data ?? []}
          rowKey={(r) => r.id}
          rowHref={(r) => `/biz/billing/invoices/${r.id}`}
          loading={q.isLoading || !ready}
          // В демо у бизнеса — три счёта за подписку и один за монеты
          loadingRows={4}
          empty={
            purpose ? (
              <EmptyState kind="search" onReset={() => setPurpose(null)} />
            ) : (
              <EmptyState icon={<Receipt aria-hidden />} title={t('invoices.emptyTitle')} description={t('invoices.emptyText')} />
            )
          }
        />
      )}
    </div>
  );
}

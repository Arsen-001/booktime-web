'use client';

/**
 * /biz/finance/documents — раздел «Документы» (F-07-024): период, поиск по номеру, вид документа, вид
 * содержимого; клик по дате открывает документ для просмотра и правки (F-07-024, страница документа).
 */
import Link from 'next/link';
import { useState } from 'react';
import { FileText } from 'lucide-react';
import { listDocuments } from '@/api/finance';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { DocumentContentKind, DocumentType, FinanceDocument } from '@/domain/finance';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import type { DateRange } from '@/ui/Calendar';
import { DateRangePicker } from '@/ui/DateRangePicker';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FilterBar } from '@/ui/FilterBar';
import { PageHeader } from '@/ui/PageHeader';
import { Select } from '@/ui/Select';
import { DEFAULT_PAGE_SIZE } from '@/ui/Pagination';
import { SkeletonText } from '@/ui/Skeleton';
import { Table, type TableColumn } from '@/ui/Table';

const DOCUMENT_TYPES: DocumentType[] = ['visit', 'sale', 'supply', 'refund', 'payment', 'other'];
const CONTENT_KINDS: DocumentContentKind[] = ['services', 'goods', 'consumables'];

export function DocumentsScreen() {
  const t = useT('finance');
  const format = useFormat();
  const { ready, businessId } = useCurrent();

  const [range, setRange] = useState<DateRange>({});
  const [search, setSearch] = useState('');
  const [type, setType] = useState<DocumentType | ''>('');
  const [contentKind, setContentKind] = useState<DocumentContentKind | ''>('');

  const q = useApiQuery(
    ['finance', 'documents', businessId, range, search, type, contentKind],
    () =>
      listDocuments(businessId!, {
        dateFrom: range.from ? `${range.from}T00:00` : undefined,
        dateTo: range.to ? `${range.to}T23:59` : undefined,
        search: search || undefined,
        type: type || undefined,
        contentKind: contentKind || undefined,
      }),
    { enabled: ready && Boolean(businessId) },
  );
  if (q.isError) return <ErrorState onRetry={q.refetch} />;

  const activeCount = [range.from, search, type, contentKind].filter(Boolean).length;
  const resetFilters = () => {
    setRange({});
    setSearch('');
    setType('');
    setContentKind('');
  };

  const columns: TableColumn<FinanceDocument>[] = [
    {
      id: 'number',
      header: t('documents.columns.number'),
      cell: (d) => (
        <Link
          href={`/biz/finance/documents/${d.id}`}
          className="inline-flex min-h-10 items-center font-medium text-primary-text underline decoration-border-strong underline-offset-2"
        >
          {d.number}
        </Link>
      ),
      mobile: 'title',
      width: '10rem',
      skeleton: (
        <span className="inline-flex min-h-10 items-center">
          <SkeletonText width="9ch" />
        </span>
      ),
    },
    {
      id: 'date',
      header: t('documents.columns.date'),
      cell: (d) => format.date(d.date, 'short'),
      sortable: true,
      sortValue: (d) => d.date,
      mobile: 'meta',
      width: '9rem',
      skeletonWidth: '9ch',
    },
    {
      id: 'type',
      header: t('documents.columns.type'),
      cell: (d) => (
        <Badge tone="neutral" size="sm">
          {t(`documents.type.${d.type}`)}
        </Badge>
      ),
      mobile: 'badge',
      width: '11rem',
      skeleton: (
        <Badge tone="neutral" size="sm">
          <SkeletonText width="7ch" />
        </Badge>
      ),
    },
    {
      id: 'content',
      header: t('documents.columns.content'),
      cell: (d) =>
        d.contentKind ? (
          <Badge tone="neutral" variant="outline" size="sm">
            {t(`documents.contentKind.${d.contentKind}`)}
          </Badge>
        ) : (
          '—'
        ),
      mobile: 'meta',
      width: '11rem',
      skeleton: (
        <Badge tone="neutral" variant="outline" size="sm">
          <SkeletonText width="7ch" />
        </Badge>
      ),
    },
    {
      id: 'amount',
      header: t('documents.columns.amount'),
      cell: (d) => <span className="font-semibold text-fg">{format.money(d.amount)}</span>,
      align: 'right',
      sortable: true,
      sortValue: (d) => d.amount,
      mobile: 'aside',
      width: '9rem',
      skeletonWidth: '9ch',
    },
    {
      id: 'link',
      header: '',
      cell: (d) =>
        d.refOperationId ? (
          <Link
            href={`/biz/finance/operations/${d.refOperationId}`}
            className="inline-flex min-h-10 items-center text-sm text-primary-text underline decoration-border-strong underline-offset-2"
          >
            {t('documents.openOperation')}
          </Link>
        ) : (
          '—'
        ),
      mobile: 'hidden',
      width: '10rem',
      skeletonWidth: '10ch',
    },
  ];

  return (
    <div data-f="F-07-024 F-08-122" className="flex w-full flex-col gap-6">
      <PageHeader title={t('documents.title')} description={t('documents.subtitle')} />

      <FilterBar
        search={{ value: search, onValueChange: setSearch, debounceMs: 250, placeholder: t('documents.filters.searchPlaceholder') }}
        filters={[
          {
            id: 'period',
            label: t('documents.filters.period'),
            primary: true,
            node: <DateRangePicker value={range} onValueChange={setRange} presets placeholder={t('documents.filters.period')} />,
          },
          {
            id: 'type',
            label: t('documents.filters.type'),
            node: (
              <Select
                options={[
                  { value: '', label: t('documents.filters.allTypes') },
                  ...DOCUMENT_TYPES.map((v) => ({ value: v, label: t(`documents.type.${v}`) })),
                ]}
                value={type}
                onValueChange={(v) => setType(v as DocumentType | '')}
              />
            ),
          },
          {
            id: 'content',
            label: t('documents.filters.content'),
            node: (
              <Select
                options={[
                  { value: '', label: t('documents.filters.allContent') },
                  ...CONTENT_KINDS.map((v) => ({ value: v, label: t(`documents.contentKind.${v}`) })),
                ]}
                value={contentKind}
                onValueChange={(v) => setContentKind(v as DocumentContentKind | '')}
              />
            ),
          },
        ]}
        activeCount={activeCount}
        onReset={resetFilters}
      />

      <Table
        columns={columns}
        rows={q.data ?? []}
        rowKey={(d) => d.id}
        loading={q.isLoading}
        loadingRows={DEFAULT_PAGE_SIZE}
        label={t('documents.title')}
        empty={
          <EmptyState
            kind={activeCount > 0 ? 'search' : 'default'}
            icon={activeCount > 0 ? undefined : <FileText aria-hidden />}
            title={activeCount > 0 ? undefined : t('documents.emptyTitle')}
            onReset={activeCount > 0 ? resetFilters : undefined}
          />
        }
      />
    </div>
  );
}

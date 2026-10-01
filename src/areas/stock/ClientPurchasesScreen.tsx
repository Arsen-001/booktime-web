'use client';

/**
 * /biz/stock/clients — F-08-151: «покупки товаров в карточке клиента» и «в поиске журнала». По ТЗ
 * это правая часть карточки клиента (хозяин `clients`) и панель поиска в журнале (хозяин `journal`) —
 * пары расширения `clientCard`/`stock` в фундаменте ещё нет (просьба — qa/requests/stock.md), поэтому
 * пока это отдельный временный экран в своих путях: поиск клиента → «Продано / Оплачено / Баланс» и
 * история покупок товара (`getClientPurchaseSummary`, @/api/stock).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Receipt, Search } from 'lucide-react';
import { getClientPurchaseSummary, searchClientsForPurchases } from '@/api/stock';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FilterBar } from '@/ui/FilterBar';
import { Modal } from '@/ui/Modal';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { Table, type TableColumn } from '@/ui/Table';
import { ExitHold } from '@/ui/ExitHold';

export function ClientPurchasesScreen() {
  const t = useT('stock');
  const router = useRouter();
  const { ready, businessId } = useCurrent();
  const enabled = ready && Boolean(businessId);
  const [search, setSearch] = useState('');
  const [openClientId, setOpenClientId] = useState<Id | undefined>();

  const q = useApiQuery(
    ['stock', 'clientPurchases', 'search', businessId, search],
    () => searchClientsForPurchases(businessId!, search),
    { enabled },
  );

  if (q.isError) return <ErrorState onRetry={q.refetch} />;

  const rows = q.data ?? [];

  const columns: TableColumn<(typeof rows)[number]>[] = [
    { id: 'name', header: t('clientPurchases.columns.name'), mobile: 'title', cell: (r) => r.name },
    { id: 'phone', header: t('clientPurchases.columns.phone'), mobile: 'subtitle', cell: (r) => r.phone },
    {
      id: 'action',
      header: '',
      mobile: 'aside',
      align: 'right',
      cell: (r) => (
        <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); setOpenClientId(r.id); }}>
          {t('clientPurchases.open')}
        </Button>
      ),
    },
  ];

  return (
    <div data-f="F-08-151" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('clientPurchases.title')}
        description={t('clientPurchases.subtitle')}
        actions={<Button variant="secondary" onClick={() => router.push('/biz/stock/settings')}>{t('clientPurchases.back')}</Button>}
      />

      <FilterBar search={{ value: search, onValueChange: setSearch, placeholder: t('clientPurchases.searchPlaceholder') }} />

      {q.isLoading ? (
        <Skeleton lines={5} />
      ) : rows.length === 0 && !search ? (
        <EmptyState icon={<Search aria-hidden />} title={t('clientPurchases.emptyTitle')} description={t('clientPurchases.emptyText')} />
      ) : (
        <Table
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          label={t('clientPurchases.title')}
          empty={<EmptyState kind="search" icon={<Search aria-hidden />} title={t('clientPurchases.notFoundTitle')} description={t('clientPurchases.notFoundText')} />}
        />
      )}

      <ExitHold value={businessId && openClientId}>
        {(openClientId) => (
        <ClientPurchaseModal
          businessId={businessId!}
          clientId={openClientId}
          clientName={rows.find((r) => r.id === openClientId)?.name ?? ''}
          open={Boolean(openClientId)}
          onOpenChange={(o) => { if (!o) setOpenClientId(undefined); }}
        />
        )}
      </ExitHold>
    </div>
  );
}

function ClientPurchaseModal({
  businessId,
  clientId,
  clientName,
  open,
  onOpenChange,
}: {
  businessId: Id;
  clientId: Id;
  clientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT('stock');
  const format = useFormat();
  const q = useApiQuery(['stock', 'clientPurchases', businessId, clientId], () => getClientPurchaseSummary(businessId, clientId), { enabled: open });

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t('clientPurchases.form.title', { name: clientName })} size="lg">
      {q.isLoading || !q.data ? (
        <Skeleton lines={8} />
      ) : q.data.rows.length === 0 ? (
        <EmptyState icon={<Receipt aria-hidden />} title={t('clientPurchases.form.emptyTitle')} description={t('clientPurchases.form.emptyText')} />
      ) : (
        <div className="flex flex-col gap-5">
          <SectionCard title={t('clientPurchases.form.summaryTitle')}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Stat label={t('clientPurchases.form.totalSold')} value={format.money(q.data.totalSold)} />
              <Stat label={t('clientPurchases.form.totalPaid')} value={format.money(q.data.totalPaid)} />
              <Stat label={t('clientPurchases.form.balance')} value={format.money(q.data.totalSold - q.data.totalPaid)} hint={t('clientPurchases.form.balanceHint')} />
            </div>
          </SectionCard>

          <SectionCard title={t('clientPurchases.form.historyTitle')}>
            <ul className="flex flex-col gap-3">
              {q.data.rows.map((r) => (
                <li key={`${r.docId}-${r.goodName}`} className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-none last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">{r.goodName} × {r.qty}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span>{format.date(r.date, 'long')}</span>
                      {r.standalone && <Badge tone="info">{t('clientPurchases.form.standalone')}</Badge>}
                      {!r.paid && <Badge tone="warning">{t('clientPurchases.form.unpaid')}</Badge>}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-fg">{format.money(r.total)}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-lg font-semibold text-fg" title={hint}>{value}</span>
    </div>
  );
}

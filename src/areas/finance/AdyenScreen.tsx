'use client';

/**
 * /biz/finance/adyen — Adyen: подключение и проверка бизнеса (F-07-135), Adyen Dashboard (F-07-136),
 * возвраты (F-07-137). Единственная платёжная система, которая держит режим «Гарантия картой»
 * (F-07-104 → /biz/finance/policy). Только владелец локации может подключать и возвращать деньги.
 * ⭐ F-00-028: приём денег онлайн отложен — весь блок работает на моках, помечен «демо».
 */
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CreditCard, ShieldCheck } from 'lucide-react';
import { completeAdyenOnboarding, getAdyenConnection, listAdyenTransactions, refundAdyenTransaction, startAdyenOnboarding, type AdyenTransactionFilter } from '@/api/finance';
import { ApiError } from '@/api/request';
import type { AdyenTransaction, AdyenTxnType } from '@/domain/finance';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { nowDateTime } from '@/lib/date';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Input } from '@/ui/Input';
import { PageHeader } from '@/ui/PageHeader';
import { SearchInput } from '@/ui/SearchInput';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { StatCard } from '@/ui/StatCard';
import { Table, type TableColumn } from '@/ui/Table';
import { useConfirm, useToast } from '@/ui/Toast';

const TXN_TYPES: AdyenTxnType[] = ['payment', 'refund', 'transfer', 'chargeback', 'correction', 'atm', 'capital', 'other'];

export function AdyenScreen() {
  const t = useT('finance');
  const toast = useToast();
  const confirm = useConfirm();
  const format = useFormat();
  const { ready, businessId, persona } = useCurrent();
  const isOwner = persona === 'owner' || persona === 'network' || persona === 'individual';

  const connQ = useApiQuery(['finance', 'adyen', businessId], () => getAdyenConnection(businessId!), { enabled: ready && Boolean(businessId) });
  const [filter, setFilter] = useState<AdyenTransactionFilter>({});
  const txnQ = useApiQuery(['finance', 'adyenTxns', businessId, filter], () => listAdyenTransactions(businessId!, filter), { enabled: ready && Boolean(businessId) && connQ.data?.status === 'connected' });

  const startM = useApiMutation((input: { legalEntityName: string; country: string; shopperStatement: string }) => startAdyenOnboarding(businessId!, input));
  const completeM = useApiMutation(() => completeAdyenOnboarding(businessId!));
  const refundM = useApiMutation((id: string) => refundAdyenTransaction(businessId!, id));

  if (connQ.isError) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <PageHeader title={t('adyen.title')} />
        <ErrorState onRetry={() => connQ.refetch()} />
      </div>
    );
  }

  if (!connQ.data) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pb-24">
        <PageHeader title={t('adyen.title')} description={t('adyen.subtitle')} />
        <Skeleton lines={6} />
      </div>
    );
  }

  const conn = connQ.data;

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 pb-6">
      <PageHeader
        title={t('adyen.title')}
        description={t('adyen.subtitle')}
        actions={
          <Link href="/biz/finance/policy">
            <Button size="sm" variant="ghost" leftIcon={<ArrowLeft aria-hidden className="size-4" />}>
              {t('adyen.backToPolicy')}
            </Button>
          </Link>
        }
      />

      {conn.status === 'notConnected' && (
        <div data-f="F-07-135">
          {!isOwner ? (
            <SectionCard title={t('adyen.notConnected')}>
              <p className="text-sm text-danger">{t('adyen.ownerOnly')}</p>
            </SectionCard>
          ) : (
            <OnboardingStartCard
              pending={startM.isPending}
              onStart={async (input) => {
                try {
                  await startM.mutate(input);
                  connQ.refetch();
                } catch {
                  toast.error(t('policy.saveFailed'));
                }
              }}
            />
          )}
        </div>
      )}

      {conn.status === 'onboarding' && (
        <div data-f="F-07-135">
          <SectionCard title={t('adyen.onboardingTitle')} description={t('adyen.onboardingHint')}>
            <div className="flex flex-col gap-4">
              <p className="text-sm">
                {t('adyen.onboardingDeadline')}: <span className="font-medium">{conn.onboardingDeadline ? format.dateTime(conn.onboardingDeadline) : '—'}</span>
              </p>
              {conn.onboardingDeadline && conn.onboardingDeadline < nowDateTime() ? (
                <>
                  <p className="text-sm text-danger">{t('adyen.onboardingExpired')}</p>
                  {isOwner && (
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        await startM.mutate({ legalEntityName: conn.legalEntityName ?? '', country: conn.country ?? 'AM', shopperStatement: conn.shopperStatement ?? '' });
                        connQ.refetch();
                      }}
                    >
                      {t('adyen.onboardingRestart')}
                    </Button>
                  )}
                </>
              ) : (
                isOwner && (
                  <Button
                    loading={completeM.isPending}
                    onClick={async () => {
                      try {
                        await completeM.mutate(undefined);
                        connQ.refetch();
                        toast.success(t('adyen.connectedTitle'));
                      } catch {
                        toast.error(t('policy.saveFailed'));
                      }
                    }}
                  >
                    {t('adyen.onboardingComplete')}
                  </Button>
                )
              )}
            </div>
          </SectionCard>
        </div>
      )}

      {conn.status === 'connected' && (
        <>
          <div data-f="F-07-135">
            <SectionCard title={<span className="flex items-center gap-2 text-success"><ShieldCheck aria-hidden className="size-4" />{t('adyen.connectedTitle')}</span>}>
              <div className="flex flex-col gap-2 text-sm">
                <p className="text-muted">
                  {t('adyen.connectedSince')}: {conn.connectedAt ? format.dateTime(conn.connectedAt) : '—'}
                </p>
                <p>{conn.legalEntityName} · {conn.country}</p>
                {isOwner && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary">
                      {t('adyen.changeRegistration')}
                    </Button>
                    <Button size="sm" variant="secondary">
                      {t('adyen.changeOnboarding')}
                    </Button>
                  </div>
                )}
              </div>
            </SectionCard>
          </div>

          <div data-f="F-07-136">
            <SectionCard title={t('adyen.dashboardTitle')}>
              <div className="flex flex-col gap-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard label={t('adyen.totalIncoming')} value={format.money(sumBy(txnQ.data, (r) => (r.grossAmount > 0 ? r.grossAmount : 0)))} loading={txnQ.isLoading} />
                  <StatCard label={t('adyen.totalOutgoing')} value={format.money(Math.abs(sumBy(txnQ.data, (r) => (r.grossAmount < 0 ? r.grossAmount : 0))))} loading={txnQ.isLoading} />
                  <StatCard label={t('adyen.availableBalance')} value={format.money(sumBy(txnQ.data, (r) => r.netAmount))} loading={txnQ.isLoading} />
                  <StatCard label={t('adyen.periodResult')} value={format.money(sumBy(txnQ.data, (r) => r.netAmount))} loading={txnQ.isLoading} />
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-muted">{t('adyen.filterType')}</span>
                    <Select
                      value={filter.type ?? ''}
                      onValueChange={(v) => setFilter((f) => ({ ...f, type: (v || undefined) as AdyenTxnType | undefined }))}
                      options={[{ value: '', label: '—' }, ...TXN_TYPES.map((tp) => ({ value: tp, label: t(`adyen.type.${tp}`) }))]}
                      className="w-44"
                    />
                  </label>
                  <label className="flex flex-1 min-w-[180px] flex-col gap-1.5">
                    <span className="text-xs text-muted">{t('adyen.filterPsp')}</span>
                    <SearchInput value={filter.pspReference ?? ''} onValueChange={(v) => setFilter((f) => ({ ...f, pspReference: v || undefined }))} placeholder="881…" />
                  </label>
                </div>

                {txnQ.isError ? (
                  <ErrorState onRetry={() => txnQ.refetch()} />
                ) : txnQ.isLoading || !txnQ.data ? (
                  <Skeleton lines={4} />
                ) : txnQ.data.length === 0 ? (
                  <EmptyState compact title={t('adyen.empty')} />
                ) : (
                  <Table<AdyenTransaction>
                    rowKey={(r) => r.id}
                    rows={txnQ.data}
                    columns={buildColumns({ t, format, isOwner, onRefund: (row) => handleRefund(row) })}
                  />
                )}
              </div>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );

  async function handleRefund(row: AdyenTransaction) {
    const ok = await confirm({ title: t('adyen.refundConfirmTitle'), description: t('adyen.refundConfirmText'), tone: 'danger' });
    if (!ok) return;
    try {
      await refundM.mutate(row.id);
      txnQ.refetch();
      toast.success(t('adyen.refundDone'));
    } catch (e) {
      toast.error(e instanceof ApiError && e.code === 'forbidden' ? t('adyen.refundOwnerOnly') : t('adyen.refundFailed'));
    }
  }
}

function sumBy(rows: AdyenTransaction[] | undefined, pick: (r: AdyenTransaction) => number): number {
  return (rows ?? []).reduce((s, r) => s + pick(r), 0);
}

function buildColumns({
  t,
  format,
  isOwner,
  onRefund,
}: {
  t: ReturnType<typeof useT<'finance'>>;
  format: ReturnType<typeof useFormat>;
  isOwner: boolean;
  onRefund: (row: AdyenTransaction) => void;
}): TableColumn<AdyenTransaction>[] {
  return [
    { id: 'date', header: t('adyen.colDate'), cell: (r) => format.dateTime(r.date), mobile: 'title' },
    { id: 'method', header: t('adyen.colMethod'), cell: (r) => r.method },
    { id: 'type', header: t('adyen.colType'), cell: (r) => t(`adyen.type.${r.type}`) },
    { id: 'net', header: t('adyen.colNet'), align: 'right', cell: (r) => <span className={r.netAmount < 0 ? 'text-danger' : ''}>{format.money(r.netAmount)}</span> },
    { id: 'gross', header: t('adyen.colGross'), align: 'right', cell: (r) => <span className={r.grossAmount < 0 ? 'text-danger' : ''}>{format.money(r.grossAmount)}</span> },
    { id: 'psp', header: 'PSP', cell: (r) => <span className="text-xs text-muted">{r.pspReference}</span> },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (r) =>
        r.type === 'payment' && !r.refunded ? (
          isOwner ? (
            <span data-f="F-07-137">
              <Button size="sm" variant="ghost" onClick={() => onRefund(r)}>
                {t('adyen.refund')}
              </Button>
            </span>
          ) : null
        ) : r.refunded ? (
          <Badge tone="neutral">{t('adyen.refunded')}</Badge>
        ) : null,
    },
  ];
}

function OnboardingStartCard({ pending, onStart }: { pending: boolean; onStart: (input: { legalEntityName: string; country: string; shopperStatement: string }) => void }) {
  const t = useT('finance');
  const [legalEntityName, setLegalEntityName] = useState('');
  const [country, setCountry] = useState('AM');
  const [shopperStatement, setShopperStatement] = useState('');

  return (
    <SectionCard title={t('adyen.notConnected')} description={t('adyen.notConnectedHint')} actions={<CreditCard aria-hidden className="size-5 text-muted" />}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('adyen.legalName')}</span>
          <Input value={legalEntityName} onChange={(e) => setLegalEntityName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('adyen.country')}</span>
          <Input value={country} onChange={(e) => setCountry(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('adyen.shopperStatement')}</span>
          <Input value={shopperStatement} onChange={(e) => setShopperStatement(e.target.value)} placeholder="BOOKING*SALON" />
          <span className="text-xs text-muted">{t('adyen.shopperStatementHint')}</span>
        </label>
        <Button
          loading={pending}
          disabled={!legalEntityName.trim()}
          onClick={() => onStart({ legalEntityName: legalEntityName.trim(), country: country.trim() || 'AM', shopperStatement: shopperStatement.trim() })}
        >
          {t('adyen.connectStart')}
        </Button>
      </div>
    </SectionCard>
  );
}

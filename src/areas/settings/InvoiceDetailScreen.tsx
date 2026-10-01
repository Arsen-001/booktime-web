'use client';

/**
 * /biz/billing/invoices/[invoiceId] — счёт / документ об оплате (F-15-073/088, F-00-025).
 * «Открыть чек» (оплаченный → «Документ об оплате», черновой вид до ответа бухгалтера — F-00-025) /
 * «Сформировать счёт» (неоплаченный → печатная форма, F-15-084). Реквизиты и адрес плательщика — снимок
 * с момента выставления (F-15-088).
 */
import { useParams } from 'next/navigation';
import { AlertTriangle, Printer } from 'lucide-react';
import { getInvoice } from '@/api/settings';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge, type BadgeTone } from '@/ui/Badge';
import { ErrorState } from '@/ui/ErrorState';
import { KeyValueList } from '@/ui/KeyValueList';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { SkeletonText } from '@/ui/Skeleton';

const STATUS_TONE: Record<string, BadgeTone> = { paid: 'success', unpaid: 'warning', cancelled: 'neutral' };

export function InvoiceDetailScreen() {
  const t = useT('settings');
  const format = useFormat();
  const params = useParams<{ invoiceId: string }>();
  const { businessId, ready } = useCurrent();

  const q = useApiQuery(['settings', 'invoice', businessId, params.invoiceId], () => getInvoice(businessId ?? '', params.invoiceId), {
    enabled: ready && Boolean(businessId) && Boolean(params.invoiceId),
  });

  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const invoice = q.data;
  const isLoading = !ready || q.isLoading;

  return (
    <div data-f="F-15-073 F-15-088 F-00-025" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader
        title={isLoading ? t('invoiceDetail.title') : t('invoiceDetail.numberTitle', { number: invoice?.number ?? '' })}
        description={t('invoiceDetail.description')}
        back={{ href: '/biz/billing/invoices' }}
      />

      <SectionCard title={t('invoiceDetail.title')}>
        {isLoading || !invoice ? (
          // Тот же счёт: статус и сумма, назначение, дата, период (у счёта за подписку), подписи — полосы на месте значений
          <div aria-busy className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge tone="neutral" size="md">
                <SkeletonText width="9ch" />
              </Badge>
              <span className="nums text-lg font-semibold text-fg">
                <SkeletonText width="8ch" />
              </span>
            </div>
            <KeyValueList
              items={[
                { label: t('invoices.purpose'), value: <SkeletonText width="10ch" /> },
                { label: t('invoices.date'), value: <SkeletonText width="14ch" /> },
                { label: t('invoiceDetail.period'), value: <SkeletonText width="20ch" /> },
              ]}
            />
            <p className="text-xs text-muted">
              <SkeletonText width="40ch" />
            </p>
            <p className="flex items-center gap-2 text-xs text-muted">
              <Printer aria-hidden className="size-3.5 shrink-0" />
              {t('invoiceDetail.printHint')}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge tone={STATUS_TONE[invoice.status]} size="md">{t(`invoices.statusValue.${invoice.status}`)}</Badge>
              <span className="nums text-lg font-semibold text-fg">{format.money(invoice.amount)}</span>
            </div>
            <KeyValueList
              items={[
                { label: t('invoices.purpose'), value: t(`invoices.purposeValue.${invoice.purpose}`) },
                { label: t('invoices.date'), value: format.date(invoice.date, 'long') },
                ...(invoice.periodFrom && invoice.periodTo
                  ? [{ label: t('invoiceDetail.period'), value: `${format.date(invoice.periodFrom, 'short')} — ${format.date(invoice.periodTo, 'short')}` }]
                  : []),
              ]}
            />
            {invoice.payer && (
              <div className="border-t border-border pt-4">
                <h2 className="mb-2 text-sm font-semibold text-fg">{t('invoiceDetail.payerTitle')}</h2>
                <KeyValueList
                  items={[
                    { label: t('invoiceDetail.payerName'), value: invoice.payer.name },
                    { label: t('invoiceDetail.payerAddress'), value: invoice.payer.address || t('invoiceDetail.payerAddressEmpty') },
                    ...(invoice.payer.taxId ? [{ label: t('invoiceDetail.payerTaxId'), value: invoice.payer.taxId }] : []),
                  ]}
                />
              </div>
            )}
            {invoice.status === 'unpaid' && (
              <div className="flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-sm text-warning">
                <AlertTriangle aria-hidden className="size-4 shrink-0" />
                {t('invoiceDetail.unpaidHint')}
              </div>
            )}
            {invoice.status === 'paid' && (
              <p className="text-xs text-muted">{t('invoiceDetail.draftDocNote')}</p>
            )}
            <p className="flex items-center gap-2 text-xs text-muted">
              <Printer aria-hidden className="size-3.5 shrink-0" />
              {t('invoiceDetail.printHint')}
            </p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

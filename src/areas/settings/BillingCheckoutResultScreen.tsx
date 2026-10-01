'use client';

/**
 * /biz/billing/checkout/result — итог оплаты (F-15-083, F-00-025). success → «Открыть документ об оплате»
 * (F-00-025, ведёт на /biz/billing/invoices/[invoiceId]); unpaid → «Счёт выставлен, ждём оплаты» (F-15-084);
 * failed → «Не удалось» с повтором.
 */
import { CheckCircle2, Clock, TriangleAlert } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useT } from '@/i18n/useT';
import { LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';

export function BillingCheckoutResultScreen() {
  const t = useT('settings');
  const searchParams = useSearchParams();
  const status = searchParams.get('status') ?? 'failed';
  const invoiceId = searchParams.get('invoiceId');

  if (status === 'paid') {
    return (
      <div data-f="F-15-083 F-00-025" className="flex flex-col items-center gap-4 py-10 text-center">
        <CheckCircle2 aria-hidden className="size-16 text-success" />
        <h1 className="text-xl font-semibold text-fg">{t('checkoutResult.successTitle')}</h1>
        <p className="max-w-sm text-sm text-muted">{t('checkoutResult.successText')}</p>
        <div className="flex flex-wrap justify-center gap-3">
          {invoiceId && <LinkButton href={`/biz/billing/invoices/${invoiceId}`} variant="primary">{t('checkoutResult.openDocument')}</LinkButton>}
          <LinkButton href="/biz/billing" variant="secondary">{t('checkoutResult.backToBilling')}</LinkButton>
        </div>
      </div>
    );
  }

  if (status === 'unpaid') {
    return (
      <div data-f="F-15-084" className="flex flex-col items-center gap-4 py-10 text-center">
        <Clock aria-hidden className="size-16 text-warning" />
        <h1 className="text-xl font-semibold text-fg">{t('checkoutResult.unpaidTitle')}</h1>
        <p className="max-w-sm text-sm text-muted">{t('checkoutResult.unpaidText')}</p>
        <div className="flex flex-wrap justify-center gap-3">
          {invoiceId && <LinkButton href={`/biz/billing/invoices/${invoiceId}`} variant="primary">{t('checkoutResult.openInvoice')}</LinkButton>}
          <LinkButton href="/biz/billing" variant="secondary">{t('checkoutResult.backToBilling')}</LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <EmptyState icon={<TriangleAlert aria-hidden />} title={t('checkoutResult.failedTitle')} description={t('checkoutResult.failedText')} />
      <div className="flex flex-wrap justify-center gap-3">
        <LinkButton href="/biz/billing/manage" variant="primary">{t('checkoutResult.retry')}</LinkButton>
        <LinkButton href="/biz/billing" variant="ghost">{t('checkoutResult.backToBilling')}</LinkButton>
      </div>
    </div>
  );
}

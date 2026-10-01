'use client';

/**
 * /biz/stock/operations/[docId]/receipt — F-08-072: чек продажи, страница для печати (PDF-пакета нет —
 * системный диалог печати браузера; см. CONVENTIONS §0.3 — window.print() запрещён линтером, зовём глобальный
 * print() без «window.», это тот же вызов).
 */
import { ClipboardX, Printer } from 'lucide-react';
import { getReceiptData } from '@/api/stock';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { Skeleton } from '@/ui/Skeleton';

export function ReceiptScreen({ docId }: { docId: Id }) {
  const t = useT('stock');
  const format = useFormat();
  const { ready, businessId } = useCurrent();
  const q = useApiQuery(['stock', 'receipt', businessId, docId], () => getReceiptData(businessId!, docId), { enabled: ready && Boolean(businessId) });

  if (q.isError) return <ErrorState onRetry={q.refetch} />;
  if (!ready || q.isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
        <Skeleton variant="rect" className="h-10" />
        <Skeleton lines={8} />
      </div>
    );
  }
  const data = q.data;
  if (!data) {
    return <EmptyState icon={<ClipboardX aria-hidden />} title={t('operationDoc.notFound')} description={t('operationDoc.notFoundText')} />;
  }

  return (
    <div data-f="F-08-072" className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 print:max-w-full print:p-0">
      <div className="print:hidden">
        <PageHeader
          title={t('receipt.title')}
          back={{ href: `/biz/stock/operations/${docId}` }}
          actions={
            <Button leftIcon={<Printer className="size-4" aria-hidden />} onClick={() => { if (typeof print === 'function') print(); }}>
              {t('receipt.print')}
            </Button>
          }
        />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 font-mono text-sm text-fg print:border-none print:bg-transparent print:p-0">
        <div className="text-center">
          <p className="text-base font-semibold">{data.businessName}</p>
          <p className="text-xs text-muted">
            {t('receipt.docNumber', { number: data.doc.number })} · {format.dateTime(data.doc.date)}
          </p>
        </div>
        <div className="border-t border-dashed border-border" />
        {(data.clientName || data.clientPhone) && (
          <p className="text-xs text-muted">
            {t('receipt.client')}: {data.clientName} {data.clientPhone ? format.phone(data.clientPhone) : ''}
          </p>
        )}
        {data.staffName && (
          <p className="text-xs text-muted">
            {t('receipt.seller')}: {data.staffName}
          </p>
        )}
        <div className="border-t border-dashed border-border" />
        <ul className="flex flex-col gap-2">
          {data.doc.lineDetails.map((l, i) => (
            <li key={`${l.goodId}-${i}`} className="flex items-center justify-between gap-2">
              <span>
                {l.goodName} × {Math.abs(l.qtySale)}
              </span>
              <span>{format.money(Math.abs(l.costTotal))}</span>
            </li>
          ))}
          {(data.doc.extraLines ?? []).map((e, i) => (
            <li key={`${e.refId}-${i}`} className="flex items-center justify-between gap-2">
              <span>{e.typeName}</span>
              <span>{format.money(e.price)}</span>
            </li>
          ))}
        </ul>
        <div className="border-t border-dashed border-border" />
        <div className="flex items-center justify-between text-base font-semibold">
          <span>{t('receipt.total')}</span>
          <span>{format.money(data.total)}</span>
        </div>
        <p className="text-center text-xs text-muted">{t('receipt.thanks')}</p>
      </div>
    </div>
  );
}

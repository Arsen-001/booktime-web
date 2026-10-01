'use client';

/**
 * /biz/finance/receipt/[bookingId] — нефискальный чек визита (F-07-148): вид и состав — по настройкам чека
 * (F-07-147) и НДС ОАЭ (F-07-158). «Скачать чек» сохраняет файл .html (в браузере нет доступной библиотеки
 * настоящего PDF без npm-пакета — см. assumed в отчёте пачки); печать через системный диалог печати запрещена
 * (CONVENTIONS §0.3), поэтому у нас — скачивание готового к печати файла.
 */
import { Download } from 'lucide-react';
import { getBookingReceiptData, type ReceiptData } from '@/api/finance';
import { useApiQuery } from '@/api/request';
import type { Id } from '@/domain/core';
import type { OrgRequisiteValues } from '@/domain/finance';
import { isArmenianRequisite } from '@/domain/finance';
import { useCurrent } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';

function downloadHtml(filename: string, content: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([content], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function receiptHtml(data: ReceiptData, format: ReturnType<typeof useFormat>, requisiteLabel: (key: keyof OrgRequisiteValues) => string): string {
  const req = Object.entries(data.requisites)
    .filter(([key, on]) => on && isArmenianRequisite(key) && data.orgRequisites[key as keyof typeof data.orgRequisites])
    .map(([key]) => `<div>${requisiteLabel(key as keyof OrgRequisiteValues)}: ${data.orgRequisites[key as keyof typeof data.orgRequisites]}</div>`)
    .join('');
  const lines = data.lines
    .map((l) => `<tr><td>${l.label}</td><td style="text-align:right">${format.money(l.amount)}</td>${l.vat !== undefined ? `<td style="text-align:right">${format.money(l.vat)}</td>` : ''}</tr>`)
    .join('');
  const payments = data.paymentLines.map((p) => `<div>${p.label}: ${p.kind === 'money' ? '' : '-'}${format.money(p.amount)}</div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Чек ${data.docNumber ?? ''}</title>
  <style>body{font-family:sans-serif;max-width:420px;margin:24px auto;padding:16px}table{width:100%;border-collapse:collapse}td{padding:4px 0;border-bottom:1px solid color-mix(in srgb,currentColor 7%,transparent)}h1{font-size:16px}</style>
  </head><body>
  <h1>${data.businessName}</h1>
  ${req}
  <p>${data.docNumber ?? ''} · ${data.date}</p>
  <!-- data-f="F-04-229" --> ${data.clientName ? `<p>${data.clientName} ${data.clientPhone ?? ''} ${data.clientEmail ?? ''}</p>` : ''}
  <table>${lines}</table>
  <p><b>Итого: ${format.money(data.total)}</b></p>
  ${payments}
  ${data.comment ? `<p>${data.comment}</p>` : ''}
  ${data.extraInfoText ? `<p>${data.extraInfoText}</p>` : ''}
  </body></html>`;
}

export interface ReceiptScreenProps {
  bookingId: Id;
}

export function ReceiptScreen({ bookingId }: ReceiptScreenProps) {
  const t = useT('finance');
  const format = useFormat();
  const { ready, businessId } = useCurrent();

  const receiptQ = useApiQuery(['finance', 'receipt', businessId, bookingId], () => getBookingReceiptData(businessId!, bookingId), { enabled: ready && Boolean(businessId) });

  if (receiptQ.isError) return <ErrorState onRetry={receiptQ.refetch} />;
  if (receiptQ.isLoading || !receiptQ.data) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <Skeleton lines={8} />
      </div>
    );
  }

  const data = receiptQ.data;
  const requisiteLabel = (key: keyof OrgRequisiteValues) => t(`settingsPage.requisite.${key}`);
  const shownRequisites = (Object.entries(data.requisites) as [keyof typeof data.orgRequisites, boolean][]).filter(([key, on]) => on && isArmenianRequisite(key) && data.orgRequisites[key]);

  return (
    <div data-f="F-07-148 F-07-150 F-07-169" className="mx-auto flex w-full max-w-md flex-col gap-6">
      <PageHeader back={{ href: '/biz/finance' }} title={t('receipt.title')} />
      <SectionCard title={data.businessName} padding="sm">
        <div className="flex flex-col gap-1 text-sm text-muted">
          {data.docNumber && <p>{t('receipt.docNumber', { number: data.docNumber })}</p>}
          <p>{format.date(data.date, 'short')}, {format.time(data.date)}</p>
          {data.clientName && <p>{data.clientName}{data.clientPhone ? ` · ${data.clientPhone}` : ''}</p>}
        </div>
        {shownRequisites.length > 0 && (
          <div className="mt-2 flex flex-col gap-0.5 text-xs text-muted">
            {shownRequisites.map(([key]) => (
              <p key={key}>{requisiteLabel(key)}: {data.orgRequisites[key]}</p>
            ))}
          </div>
        )}
        <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3">
          {data.lines.map((line, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span>{line.label}</span>
              <span className="tabular-nums">
                {format.money(line.amount)}
                {line.vat !== undefined && <span className="ml-1 text-xs text-muted">({t('receipt.vat', { amount: format.money(line.vat) })})</span>}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-base font-semibold">
          <span>{t('receipt.total')}</span>
          <span className="tabular-nums">{format.money(data.total)}</span>
        </div>
        {data.paymentLines.length > 0 && (
          <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3 text-sm">
            {data.paymentLines.map((p, i) => (
              <div key={i} className={`flex items-center justify-between ${p.kind === 'money' ? 'text-muted' : 'text-danger'}`}>
                <span>{p.label}</span>
                <span className="tabular-nums">{p.kind === 'money' ? '' : '−'}{format.money(p.amount)}</span>
              </div>
            ))}
          </div>
        )}
        {data.comment && <p className="mt-3 text-sm text-muted">{data.comment}</p>}
        {data.extraInfoText && <p className="mt-3 text-xs text-muted">{data.extraInfoText}</p>}
      </SectionCard>
      <Button leftIcon={<Download aria-hidden className="size-4" />} onClick={() => downloadHtml(`receipt-${data.docNumber ?? bookingId}.html`, receiptHtml(data, format, requisiteLabel))}>
        {t('receipt.download')}
      </Button>
    </div>
  );
}

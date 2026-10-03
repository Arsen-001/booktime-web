'use client';

/**
 * /biz/orders/[orderId]/receipt — ⭐ квитанция с QR-кодом (04.10.2026). Листок: бизнес, заказ №, дата приёма, клиент,
 * что сдали, срок, цена / предоплата / осталось и QR на страницу статуса /o/<код> (её и открывает камера клиента).
 * Рядом — отправить ссылку (скопировать, WhatsApp, Telegram) и «Скачать PNG» (на телефоне — системное «Поделиться»).
 * Без печати: квитанцию показывают с экрана или пересылают картинкой.
 */
import { useState } from 'react';
import { Download, PackageX, TriangleAlert } from 'lucide-react';
import { ApiError } from '@/api/request';
import { useT } from '@/i18n/useT';
import { useOrder } from '@/areas/orders/lib/useOrdersData';
import { useOrigin } from '@/areas/orders/lib/useOrigin';
import { qrMatrix } from '@/areas/orders/receipt/qr';
import { ReceiptPaper, ReceiptPaperSkeleton } from '@/areas/orders/receipt/ReceiptPaper';
import { useReceiptModel, type ReceiptModel } from '@/areas/orders/receipt/receiptModel';
import { receiptPng, saveBlob } from '@/areas/orders/receipt/receiptPng';
import { Button, LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { ShareLinkPanel } from '@/ui/ShareLinkPanel';
import { Skeleton } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

export function ReceiptScreen({ orderId }: { orderId: string }) {
  const t = useT('orders');
  const toast = useToast();
  const origin = useOrigin();
  const q = useOrder(orderId);
  const order = q.data;
  const { model, loading } = useReceiptModel(order, origin);
  const [saving, setSaving] = useState(false);

  const back = { href: `/biz/orders/${orderId}`, label: order ? t('number', { number: order.number }) : t('title') };

  if (q.isError) {
    const notFound = q.error instanceof ApiError && q.error.code === 'not_found';
    return notFound ? (
      <EmptyState
        icon={<PackageX aria-hidden />}
        title={t('detail.notFound')}
        description={t('detail.notFoundHint')}
        action={<LinkButton href="/biz/orders">{t('detail.backToList')}</LinkButton>}
      />
    ) : (
      <ErrorState onRetry={q.refetch} />
    );
  }

  async function download(m: ReceiptModel, number: number) {
    setSaving(true);
    try {
      const blob = await receiptPng({
        businessName: m.businessName,
        businessLines: [m.address, m.phone].filter(Boolean),
        title: m.title,
        rows: [
          [t('receipt.accepted'), m.accepted],
          [t('receipt.client'), m.client],
          [t('receipt.due'), m.due],
        ],
        itemsTitle: t('receipt.items'),
        items: m.items,
        money: [
          [t('receipt.price'), m.price, false],
          ...(m.prepaid ? [[t('receipt.prepaid'), m.prepaid, false] as [string, string, boolean]] : []),
          [t('receipt.remaining'), m.remaining, true],
        ],
        qr: qrMatrix(m.url),
        caption: t('receipt.scan'),
        url: m.url,
        fontFamily: getComputedStyle(document.body).fontFamily,
      });
      const how = await saveBlob(blob, `${t('receipt.fileName', { number })}.png`);
      if (how === 'downloaded') toast.success(t('receipt.downloaded'));
    } catch {
      toast.error(t('receipt.downloadFailed'));
    } finally {
      setSaving(false);
    }
  }

  const ready = Boolean(model && order && !loading && origin);

  return (
    <div data-f="orders-receipt-screen" className="flex flex-col gap-6">
      <PageHeader back={back} title={t('receipt.title')} description={t('receipt.subtitle')} />

      {order?.status === 'cancelled' && (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-warning bg-warning-soft px-4 py-3 text-sm text-fg">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t('receipt.cancelled')}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="mx-auto w-full max-w-[26rem]">{ready && model && order ? <ReceiptPaper model={model} number={order.number} /> : <ReceiptPaperSkeleton />}</div>

        <div className="flex min-w-0 flex-col gap-6">
          <Button
            data-f="orders-receipt-png"
            variant="outline"
            size="lg"
            fullWidth
            leftIcon={<Download aria-hidden />}
            loading={saving}
            disabled={!ready}
            onClick={() => model && order && void download(model, order.number)}
            className="lg:w-auto lg:self-start"
          >
            {t('receipt.download')}
          </Button>
          <SectionCard title={t('receipt.share')} description={t('detail.linkHint')}>
            {model && order ? (
              <ShareLinkPanel
                url={model.url}
                message={t('detail.shareMessage', { number: order.number, business: model.businessName, url: model.url })}
                telegramText={t('detail.shareTelegram', { number: order.number, business: model.businessName })}
              />
            ) : (
              <Skeleton variant="rect" className="h-28" />
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

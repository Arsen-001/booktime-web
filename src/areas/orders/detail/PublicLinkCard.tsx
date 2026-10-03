'use client';

import { ReceiptText } from 'lucide-react';
import { type Order } from '@/domain/orders';
import { useT } from '@/i18n/useT';
import { LinkButton } from '@/ui/Button';
import { SectionCard } from '@/ui/SectionCard';
import { ShareLinkPanel } from '@/ui/ShareLinkPanel';

export function PublicLinkCard({ order, url, businessName }: { order: Order; url: string; businessName: string }) {
  const t = useT('orders');
  return (
    <SectionCard
      title={t('detail.link')}
      description={t('detail.linkHint')}
      actions={
        <LinkButton data-f="orders-receipt-open" href={`/biz/orders/${order.id}/receipt`} variant="outline" size="sm" leftIcon={<ReceiptText aria-hidden />}>
          {t('detail.receipt')}
        </LinkButton>
      }
    >
      <ShareLinkPanel
        url={url}
        message={t('detail.shareMessage', { number: order.number, business: businessName, url })}
        telegramText={t('detail.shareTelegram', { number: order.number, business: businessName })}
      />
    </SectionCard>
  );
}

'use client';

import { type Order } from '@/domain/orders';
import { useT } from '@/i18n/useT';
import { SectionCard } from '@/ui/SectionCard';
import { ShareLinkPanel } from '@/ui/ShareLinkPanel';

export function PublicLinkCard({ order, url, businessName }: { order: Order; url: string; businessName: string }) {
  const t = useT('orders');
  return (
    <SectionCard title={t('detail.link')} description={t('detail.linkHint')}>
      <ShareLinkPanel
        url={url}
        message={t('detail.shareMessage', { number: order.number, business: businessName, url })}
        telegramText={t('detail.shareTelegram', { number: order.number, business: businessName })}
      />
    </SectionCard>
  );
}

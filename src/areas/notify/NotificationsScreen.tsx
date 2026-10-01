'use client';

/**
 * /biz/notifications и /biz/notifications/channels(+/email,/sms) — общий каркас раздела: заголовок и
 * баннеры (F-05-001). «Типы уведомлений» и «Каналы отправки» уже отдельные пункты бокового меню
 * (src/areas/notify/nav.ts) — вкладки здесь дублировали ту же навигацию (ux-r5 M1), поэтому каркас
 * больше не рисует свой Tabs.
 */
import type { ReactNode } from 'react';
import { ServiceBanners } from '@/areas/notify/ServiceBanners';
import { useT } from '@/i18n/useT';
import { PageHeader } from '@/ui/PageHeader';

export type NotificationsTab = 'types' | 'channels';

export function NotificationsScreen({ children }: { active?: NotificationsTab; children: ReactNode }) {
  const t = useT('notify');

  return (
    <div data-f="F-05-001" className="flex flex-col gap-6">
      <PageHeader title={t('title')} description={t('subtitle')} />
      <ServiceBanners />
      <div>{children}</div>
    </div>
  );
}

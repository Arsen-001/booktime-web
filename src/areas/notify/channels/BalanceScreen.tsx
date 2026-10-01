'use client';

/**
 * /biz/notifications/channels/balance — раньше здесь продавали баланс на платные WhatsApp/SMS-сообщения
 * клиентам (F-05-115). Снято №11 / В-08 б: клиентские уведомления бесплатны (пуш — главный канал), продажи
 * баланса нет — страница оставлена информационной, чтобы старая прямая ссылка не превращалась в 404.
 */
import { CheckCircle2 } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { EmptyState } from '@/ui/EmptyState';
import { PageHeader } from '@/ui/PageHeader';

export function BalanceScreen() {
  const t = useT('notify');

  return (
    <div data-f="F-05-115" className="flex flex-col gap-6">
      <PageHeader back={{ href: '/biz/notifications/channels', label: t('tabs.channels') }} title={t('balance.title')} description={t('balance.subtitle')} />
      <EmptyState
        icon={<CheckCircle2 aria-hidden />}
        title={t('balance.freeTitle')}
        description={t('balance.freeHint')}
        framed
      />
    </div>
  );
}

'use client';

/**
 * Служебные баннеры раздела (F-05-135): полоса/плашка с текстом, кнопкой действия и сроком — идёт мимо
 * «Типов уведомлений», не видна в журнале отправок и не выключается тумблерами; показывается, пока не
 * закрыта крестиком (не все закрываемы — нулевой баланс держится, пока баланс не пополнят) или пока не
 * прошло условие (7 дней с регистрации). Смонтирован на входе в раздел (NotificationsScreen).
 */
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { X } from 'lucide-react';
import { dismissServiceBanner, listServiceBanners } from '@/api/notify';
import { useApiMutation, useApiQuery } from '@/api/request';
import type { ServiceBannerTone } from '@/domain/notify';
import type { Locale } from '@/i18n/config';
import { useCurrent } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';

const TONE_CLASS: Record<ServiceBannerTone, string> = {
  promo: 'border-accent/30 bg-accent/10',
  warning: 'border-warning/30 bg-warning/10',
  danger: 'border-danger/30 bg-danger/10',
};

export function ServiceBanners() {
  const locale = useLocale() as Locale;
  const format = useFormat();
  const tUi = useT('ui');
  const { ready, businessId } = useCurrent();
  const q = useApiQuery(['notify', 'serviceBanners', businessId], () => listServiceBanners(businessId!), { enabled: ready && !!businessId });
  const dismiss = useApiMutation(dismissServiceBanner);

  if (!ready || q.isLoading || q.isError) return null;
  const banners = q.data ?? [];
  if (banners.length === 0) return null;

  return (
    <div data-f="F-05-135" className="flex flex-col gap-2">
      {banners.map((b) => (
        <div key={b.id} className={`flex flex-col gap-2 rounded-lg border p-3.5 sm:flex-row sm:items-center sm:justify-between ${TONE_CLASS[b.tone]}`}>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-fg">{b.title[locale] ?? b.title.ru}</p>
            <p className="text-sm text-muted">
              {b.text[locale] ?? b.text.ru}
              {b.deadline && <span className="ml-1 font-medium text-fg">{format.date(b.deadline, 'long')}</span>}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link href={b.actionHref}>
              <Button size="sm" variant="outline">
                {b.actionLabel[locale] ?? b.actionLabel.ru}
              </Button>
            </Link>
            {b.dismissible && (
              <IconButton
                icon={<X aria-hidden className="size-4" />}
                variant="ghost"
                size="sm"
                label={tUi('close')}
                onClick={() => dismiss.mutate({ businessId: businessId!, bannerId: b.id })}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

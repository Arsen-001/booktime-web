'use client';

import { useLocale } from 'next-intl';
import { BellRing, X } from 'lucide-react';
import { listMyWaitlist, removeFromWaitlist } from '@/api/client';
import { removeFromList, useApiMutation, useApiQuery } from '@/api/request';
import { clientKeys } from '@/areas/client/ui/clientKeys';
import { useClientFormat } from '@/areas/client/useClientFormat';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Badge } from '@/ui/Badge';
import { IconButton } from '@/ui/IconButton';
import { useToast } from '@/ui/Toast';

/**
 * Мой лист ожидания (F-00-102) — компактными строками над предстоящими записями. Пусто или ошибка — блока нет
 * (ux-r2 №15, №22): человеку, который никуда не встал, эта карточка не нужна.
 */
export function WaitlistStrip({ appUserId }: { appUserId: Id }) {
  const t = useT('client');
  const fmt = useClientFormat();
  const locale = useLocale();
  const toast = useToast();
  const q = useApiQuery(clientKeys.waitlist(appUserId), () => listMyWaitlist(appUserId));
  const remove = useApiMutation((id: Id) => removeFromWaitlist(id, appUserId), { optimistic: removeFromList(clientKeys.waitlist(appUserId), (id: Id) => id) });
  if (!q.data?.length) return null;

  const handleRemove = async (id: Id) => {
    try {
      await remove.mutate(id);
      toast.success(t('bookings.waitlistRemoved'));
    } catch {
      toast.error(t('bookings.waitlistRemoveFailed'));
    }
  };

  return (
    <section data-f="F-00-102" className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-muted">{t('bookings.waitlistTitle')}</h2>
      <ul className="flex flex-col gap-2">
        {q.data.map((e) => (
          <li key={e.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface py-2 pr-2 pl-4">
            <BellRing aria-hidden className="size-4 shrink-0 text-primary-text" />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-sm font-medium text-fg">
                {e.staff.name}
                {e.service ? ` · ${pickText(e.service.name, locale)}` : ''}
              </p>
              <p className="text-sm text-muted">{e.date === 'any' ? t('bookings.waitlistAnyDay') : fmt.relativeDay(e.date)}</p>
              {e.notifiedAt && (
                <Badge tone="success" variant="soft" size="sm" className="mt-1">
                  {t('bookings.waitlistNotified')}
                </Badge>
              )}
            </div>
            <IconButton icon={<X aria-hidden />} label={t('bookings.waitlistRemove')} variant="ghost" onClick={() => void handleRemove(e.id)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

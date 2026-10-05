'use client';

import { Heart } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { isFavorited, toggleFavorite } from '@/api/client-public';
import { optimistic, useApiMutation, useApiQuery } from '@/api/request';
import type { FavoriteTargetType } from '@/domain/client';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { IconButton } from '@/ui/IconButton';
import { useToast } from '@/ui/Toast';

/**
 * ❤ Подписаться/отписаться (F-00-113, F-14-031) — карточка мастера/места. Гостю (нет appUserId) —
 * переход на вход, как и у записи (F-00-031: смотреть можно без входа, действие требует входа).
 */
export function FavoriteButton({
  appUserId,
  targetType,
  targetId,
  className,
}: {
  appUserId: Id | undefined;
  targetType: FavoriteTargetType;
  targetId: Id;
  className?: string;
}) {
  const t = useT('client');
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const key = ['favorite-mine', appUserId ?? '', targetType, targetId] as const;
  const q = useApiQuery(
    key,
    () => isFavorited(appUserId!, targetType, targetId),
    { enabled: Boolean(appUserId) },
  );
  // Сердце закрашивается сразу по нажатию; ошибка — откат и тост
  const toggle = useApiMutation(toggleFavorite, { optimistic: optimistic<boolean, unknown>(key, (on) => !on) });

  const handleClick = async () => {
    if (toggle.isPending) return; // не выключаем кнопку: иначе подсказка над ней пропадает в один кадр
    if (!appUserId) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    try {
      const subscribed = await toggle.mutate({ appUserId, targetType, targetId });
      // Подписка — тост с тем, что это даёт; отписка видна по пустому сердцу (второй тост двигал первый)
      if (subscribed) toast.success(t('favorites.subscribed'));
    } catch {
      toast.error(t('favorites.actionFailed'));
    }
  };

  const active = Boolean(q.data);

  return (
    <IconButton
      data-f="F-00-113 F-14-031"
      icon={<Heart aria-hidden className={cn(active && 'fill-current')} />}
      variant={active ? 'secondary' : 'outline'}
      className={cn(active && 'text-danger', className)}
      // Подпись одна, состояние — aria-pressed: подсказка не перескакивает на другой текст в момент нажатия
      label={t('favorites.subscribeCta')}
      aria-pressed={active}
      onClick={() => void handleClick()}
    />
  );
}

'use client';

import { Bell, Search } from 'lucide-react';
import Link from 'next/link';
import { listNotifications } from '@/api/client-public';
import { useApiQuery } from '@/api/request';
import { clientKeys } from '@/areas/client/ui/clientKeys';
import { useClientSession } from '@/areas/client/ui/useClientSession';
import { useT } from '@/i18n/useT';

/**
 * Поиск на главной — кнопка-поле: ведёт на /search сразу с фокусом (speed-k1 №2: раньше первый тап терялся),
 * справа колокольчик с числом непрочитанного (F-14-010 → F-14-055).
 */
export function HomeSearchBar() {
  const t = useT('client');
  const { ready, appUserId, signedIn } = useClientSession();
  const q = useApiQuery(clientKeys.notifications(appUserId ?? ''), () => listNotifications(appUserId ?? ''), {
    enabled: ready && Boolean(appUserId),
  });
  const unread = q.data?.filter((n) => !n.readAt).length ?? 0;

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/search?focus=1"
        className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-xl border border-border-strong/40 bg-surface px-4 text-base text-muted shadow-xs transition-colors hover:border-border-strong/70 focus-visible:outline-2 focus-visible:outline-focus"
      >
        <Search aria-hidden className="size-5 shrink-0" />
        <span className="truncate">{t('home.searchPlaceholder')}</span>
      </Link>
      {/* Колокольчик — с первого кадра у вошедшего (не появляется после загрузки и не сжимает поиск) */}
      {signedIn && (
        <Link
          data-f="F-14-010"
          href="/notifications"
          aria-label={unread ? t('home.notificationsUnread', { count: unread }) : t('home.notificationsCta')}
          className="relative inline-flex size-12 shrink-0 items-center justify-center rounded-xl border border-border-strong/40 bg-surface text-fg shadow-xs transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus"
        >
          <Bell aria-hidden className="size-5" />
          {unread > 0 && (
            <span
              aria-hidden
              className="absolute -top-1.5 -right-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1 text-xs leading-5 font-semibold text-primary-contrast ring-2 ring-bg"
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Link>
      )}
    </div>
  );
}

'use client';

/** Колонки таблицы «Пользователи» и карточка строки на телефоне (та же разметка у скелетона). */
import { MessageCircle, Send } from 'lucide-react';
import { UserRoleBadges, UserStatusBadge } from '@/areas/platform/users/UserBadges';
import type { PlatformUserRow } from '@/domain/platform/types/users';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Avatar } from '@/ui/Avatar';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import type { TableColumn } from '@/ui/Table';
import { Tooltip } from '@/ui/Tooltip';

/** Буква G вместо логотипа: чужие знаки не рисуем, цвет — из токенов */
function GoogleMark() {
  return (
    <span aria-hidden className="inline-flex size-5 items-center justify-center rounded-full bg-surface-2 text-[11px] leading-none font-bold text-fg">
      G
    </span>
  );
}

export function UserLinks({ row }: { row: Pick<PlatformUserRow, 'telegram' | 'whatsapp' | 'google'> }) {
  const t = useT('platform');
  if (!row.telegram && !row.whatsapp && !row.google) return <span className="text-muted">—</span>;
  return (
    <span className="flex items-center gap-2">
      {row.telegram && (
        <Tooltip content={t('users.telegramShort')}>
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-info-soft text-info" aria-label={t('users.telegramShort')} role="img">
            <Send className="size-3" aria-hidden />
          </span>
        </Tooltip>
      )}
      {row.whatsapp && (
        <Tooltip content={t('users.whatsappShort')}>
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-success-soft text-success" aria-label={t('users.whatsappShort')} role="img">
            <MessageCircle className="size-3" aria-hidden />
          </span>
        </Tooltip>
      )}
      {row.google && (
        <Tooltip content={t('users.googleShort')}>
          <span role="img" aria-label={t('users.googleShort')}>
            <GoogleMark />
          </span>
        </Tooltip>
      )}
    </span>
  );
}

function PersonCell({ row }: { row: PlatformUserRow }) {
  const t = useT('platform');
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar name={row.name} size="sm" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-fg">{row.name}</span>
        <span className="truncate text-sm text-muted">{row.phoneMasked ?? t('users.noPhone')}</span>
      </span>
    </span>
  );
}

const PERSON_SKELETON = (
  <span className="flex min-w-0 items-center gap-3">
    <Skeleton variant="circle" className="size-8 shrink-0" />
    <span className="flex min-w-0 flex-col">
      <span className="truncate font-medium text-fg">
        <SkeletonText width="16ch" />
      </span>
      <span className="truncate text-sm text-muted">
        <SkeletonText width="14ch" />
      </span>
    </span>
  </span>
);

export function useUserColumns(): TableColumn<PlatformUserRow>[] {
  const t = useT('platform');
  const fmt = useFormat();
  return [
    { id: 'person', header: t('users.columns.person'), width: '18rem', skeleton: PERSON_SKELETON, cell: (r) => <PersonCell row={r} /> },
    { id: 'roles', header: t('users.columns.roles'), width: '11rem', skeletonWidth: '10ch', cell: (r) => <UserRoleBadges roles={r.roles} /> },
    {
      id: 'registered',
      header: t('users.columns.registered'),
      width: '8rem',
      sortable: true,
      skeletonWidth: '9ch',
      cell: (r) => <span className="whitespace-nowrap">{fmt.date(r.createdAt, 'short')}</span>,
    },
    {
      id: 'last_login',
      header: t('users.columns.lastLogin'),
      width: '9.5rem',
      sortable: true,
      skeletonWidth: '10ch',
      cell: (r) => (r.lastLoginAt ? <span className="whitespace-nowrap">{fmt.ago(r.lastLoginAt)}</span> : <span className="text-muted">{t('users.never')}</span>),
    },
    { id: 'bookings', header: t('users.columns.bookings'), width: '6.5rem', align: 'right', sortable: true, skeletonWidth: '3ch', cell: (r) => fmt.number(r.bookingsCount) },
    { id: 'links', header: t('users.columns.links'), width: '7rem', skeleton: <span className="text-muted">—</span>, cell: (r) => <UserLinks row={r} /> },
    {
      id: 'status',
      header: <span className="sr-only">{t('users.columns.status')}</span>,
      align: 'right',
      width: '8.5rem',
      skeleton: <></>,
      cell: (r) => <UserStatusBadge status={r.status} />,
    },
  ];
}

/** «Сегодня» → «сегодня» внутри фразы «вход: сегодня» */
function lowerFirst(text: string): string {
  return text ? text.charAt(0).toLocaleLowerCase() + text.slice(1) : text;
}

/** Карточка строки на телефоне: аватар, имя и статус, номер, роль · записи · вход */
export function UserMobileCard({ row }: { row: PlatformUserRow }) {
  const t = useT('platform');
  const fmt = useFormat();
  return (
    <span className="flex min-w-0 flex-1 items-start gap-3">
      <Avatar name={row.name} size="md" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0 truncate font-medium text-fg">{row.name}</span>
          <UserStatusBadge status={row.status} />
        </span>
        <span className="text-sm text-muted">{row.phoneMasked ?? t('users.noPhone')}</span>
        <span className="flex h-6 items-center overflow-hidden">
          <UserRoleBadges roles={row.roles} />
        </span>
        <span className="text-sm text-muted">
          {t('users.bookingsCount', { n: row.bookingsCount })} · {row.lastLoginAt ? t('users.loginAgo', { when: lowerFirst(fmt.ago(row.lastLoginAt)) }) : t('users.never')}
        </span>
      </span>
    </span>
  );
}

export const USER_MOBILE_CARD_SKELETON = (
  <span className="flex min-w-0 flex-1 items-start gap-3">
    <Skeleton variant="circle" className="size-10 shrink-0" />
    <span className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="font-medium text-fg">
        <SkeletonText width="18ch" />
      </span>
      <span className="text-sm text-muted">
        <SkeletonText width="14ch" />
      </span>
      <span className="flex h-6 items-center text-sm text-muted">
        <SkeletonText width="9ch" />
      </span>
      <span className="text-sm text-muted">
        <SkeletonText width="22ch" />
      </span>
    </span>
  </span>
);

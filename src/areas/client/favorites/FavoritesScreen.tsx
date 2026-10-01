'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Heart, Search, Users } from 'lucide-react';
import { listBookedMasters, listFavorites, setFavoriteNewsMuted, toggleFavorite } from '@/api/client';
import { optimistic, useApiMutation, useApiQuery } from '@/api/request';
import type { FavoriteEntry } from '@/api/client';
import { useClientSession } from '@/areas/client/ui/useClientSession';
import type { Id, Staff } from '@/domain/core';
import { useDisplayName } from '@/areas/client/useDisplayName';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { useLocale } from 'next-intl';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { Button, LinkButton } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { usePagedList } from '@/ui/Pagination';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';
import { Switch } from '@/ui/Switch';
import { Tabs } from '@/ui/Tabs';
import { useToast } from '@/ui/Toast';

/** Избранное клиента: «Мои мастера» (F-14-027) + подписки ❤ (F-00-113, F-00-115, F-14-031) */
export function FavoritesScreen() {
  const t = useT('client');
  const { appUserId, signedIn } = useClientSession();
  const [tab, setTab] = useState('subscriptions');

  // Гость — сразу приглашение; вошедший — страница с первого кадра (пока база поднимается, вкладки рисуют скелетоны)
  if (!signedIn) {
    return (
      <EmptyState
        icon={<Heart aria-hidden className="size-8 text-muted" />}
        title={t('favorites.needLoginTitle')}
        description={t('favorites.needLoginHint')}
        action={
          <LinkButton href="/login?next=/favorites">{t('favorites.goLogin')}</LinkButton>
        }
      />
    );
  }

  return (
    <div data-f="F-14-027" className="flex flex-col gap-5">
      <PageHeader title={t('favorites.title')} description={t('favorites.subtitle')} />
      <Tabs
        value={tab}
        onValueChange={setTab}
        items={[
          { value: 'subscriptions', label: t('favorites.tabSubscriptions'), icon: <Heart aria-hidden className="size-4" /> },
          { value: 'myMasters', label: t('favorites.tabMyMasters'), icon: <Users aria-hidden className="size-4" /> },
        ]}
        panels={{
          subscriptions: <SubscriptionsTab appUserId={appUserId} />,
          myMasters: <MyMastersTab appUserId={appUserId} />,
        }}
      />
    </div>
  );
}

function SubscriptionsTab({ appUserId }: { appUserId: Id | undefined }) {
  const t = useT('client');
  const nameOf = useDisplayName();
  const locale = useLocale();
  const toast = useToast();
  const q = useApiQuery(['favorites', appUserId ?? ''], () => listFavorites(appUserId ?? ''), { enabled: Boolean(appUserId) });
  const skeletonCount = useSkeletonCount('favorites-subscriptions', { loading: q.isLoading, count: q.data?.length, fallback: 3, max: 10 });
  // Отписка убирает строку сразу, приглушение новостей переключается сразу — без перечитывания всего списка
  const toggle = useApiMutation(toggleFavorite, {
    optimistic: optimistic<FavoriteEntry[], { targetId: Id }>(['favorites', appUserId ?? ''], (list, a) =>
      list.filter((e) => e.favorite.targetId !== a.targetId),
    ),
  });
  const resubscribe = useApiMutation(toggleFavorite);
  const mute = useApiMutation((input: { id: Id; muted: boolean }) => setFavoriteNewsMuted(input.id, input.muted), {
    optimistic: optimistic<FavoriteEntry[], { id: Id; muted: boolean }>(['favorites', appUserId ?? ''], (list, a) =>
      list.map((e) => (e.favorite.id === a.id ? { ...e, favorite: { ...e.favorite, newsMuted: a.muted } } : e)),
    ),
  });
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(q.data ?? []);

  if (q.isError) return <ErrorState compact onRetry={q.refetch} />;
  if (q.isLoading || !appUserId)
    return (
      <div className="flex flex-col gap-2 pt-3" aria-busy="true">
        {Array.from({ length: skeletonCount }, (_, i) => (
          <SubscriptionCardSkeleton key={i} />
        ))}
      </div>
    );
  if (!q.data?.length)
    return (
      <EmptyState
        compact
        icon={<Heart aria-hidden className="size-8 text-muted" />}
        title={t('favorites.subscriptionsEmptyTitle')}
        description={t('favorites.subscriptionsEmptyHint')}
        action={
          <LinkButton href="/search" leftIcon={<Search aria-hidden />}>
            {t('favorites.findMaster')}
          </LinkButton>
        }
      />
    );

  const handleUnsubscribe = async (targetType: 'staff' | 'business', targetId: Id) => {
    try {
      await toggle.mutate({ appUserId, targetType, targetId });
      toast.show({
        title: t('favorites.unsubscribed'),
        tone: 'success',
        action: {
          label: t('favorites.undo'),
          onClick: () => {
            void resubscribe
              .mutate({ appUserId, targetType, targetId })
              .then(() => toast.success(t('favorites.resubscribed')))
              .catch(() => toast.error(t('favorites.actionFailed')));
          },
        },
      });
    } catch {
      toast.error(t('favorites.actionFailed'));
    }
  };

  const handleMuteChange = async (id: Id, muted: boolean) => {
    try {
      await mute.mutate({ id, muted });
    } catch {
      toast.error(t('favorites.actionFailed'));
    }
  };

  return (
    <>
      <div data-f="F-00-113 F-14-031" className="flex flex-col gap-2 pt-3">
        {pageItems.map((entry) => {
          const name = nameOf(entry.staff ? entry.staff.name : entry.business.name);
          const href = entry.staff ? `/masters/${entry.staff.id}` : `/places/${entry.business.id}`;
          const subtitle = entry.staff
            ? entry.staff.position
              ? pickText(entry.staff.position, locale)
              : nameOf(entry.business.name)
            : undefined;
          return (
            <Card key={entry.favorite.id} padding="sm" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1 focus-visible:outline-2 focus-visible:outline-focus">
                <Avatar
                  name={name}
                  src={entry.staff?.avatarUrl ?? entry.business.logoUrl}
                  colorIndex={entry.staff?.colorIndex}
                  size="md"
                />
                <div className="min-w-0">
                  <p className="truncate font-medium text-fg">{name}</p>
                  {/* Строка подписи есть всегда (у места — пустая): карточки одной высоты, скелетон совпадает */}
                  <p className="truncate text-sm text-muted">{subtitle ?? '\u00a0'}</p>
                  <Badge tone="neutral" variant="soft" className="mt-1">
                    {entry.staff ? t('favorites.kindMaster') : t('favorites.kindPlace')}
                  </Badge>
                </div>
              </Link>
              <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-2">
                <Switch
                  data-f="F-00-115"
                  checked={!entry.favorite.newsMuted}
                  onCheckedChange={(checked) => void handleMuteChange(entry.favorite.id, !checked)}
                  label={t('favorites.newsSwitch')}
                  labelPosition="start"
                  classNames={{ root: 'flex-row-reverse gap-2', label: 'text-xs text-muted' }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void handleUnsubscribe(entry.favorite.targetType, entry.favorite.targetId)}
                >
                  {t('favorites.unsubscribeCta')}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
      {pager}
    </>
  );
}

function MyMastersTab({ appUserId }: { appUserId: Id | undefined }) {
  const t = useT('client');
  const nameOf = useDisplayName();
  const locale = useLocale();
  const q = useApiQuery(['my-masters-full', appUserId ?? ''], () => listBookedMasters(appUserId ?? '', 50), { enabled: Boolean(appUserId) });
  const skeletonCount = useSkeletonCount('favorites-my-masters', { loading: q.isLoading, count: q.data?.length, fallback: 3, max: 10 });
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(q.data ?? []);

  if (q.isError) return <ErrorState compact onRetry={q.refetch} />;
  if (q.isLoading)
    return (
      <ul className="flex flex-col gap-2 pt-3" aria-busy="true">
        {Array.from({ length: skeletonCount }, (_, i) => (
          <li key={i}>
            <Card padding="sm" className="flex items-center gap-3">
              <Skeleton variant="circle" className="inline-flex size-10 shrink-0" />
              <div className="min-w-0">
                <p className="truncate font-medium text-fg">
                  <SkeletonText width="14ch" />
                </p>
                <p className="truncate text-sm text-muted">
                  <SkeletonText width="16ch" />
                </p>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    );
  if (!q.data?.length)
    return (
      <EmptyState
        compact
        icon={<Users aria-hidden className="size-8 text-muted" />}
        title={t('favorites.myMastersEmptyTitle')}
        description={t('favorites.myMastersEmptyHint')}
        action={
          <LinkButton href="/search" leftIcon={<Search aria-hidden />}>
            {t('favorites.findMaster')}
          </LinkButton>
        }
      />
    );

  return (
    <>
      <ul className="flex flex-col gap-2 pt-3">
        {pageItems.map((staff: Staff) => (
          <li key={staff.id}>
            <Card href={`/masters/${staff.id}`} padding="sm" className="flex items-center gap-3">
              <Avatar name={staff.name} src={staff.avatarUrl} colorIndex={staff.colorIndex} size="md" />
              <div className="min-w-0">
                <p className="truncate font-medium text-fg">{nameOf(staff.name)}</p>
                {staff.position && <p className="truncate text-sm text-muted">{pickText(staff.position, locale)}</p>}
              </div>
            </Card>
          </li>
        ))}
      </ul>
      {pager}
    </>
  );
}

/** Скелетон подписки — та же карточка: фото, имя, подпись, метка «Мастер/Место», переключатель «Новости» и «Отписаться» */
function SubscriptionCardSkeleton() {
  const t = useT('client');
  return (
    <Card padding="sm" aria-hidden className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1">
        <Skeleton variant="circle" className="inline-flex size-10 shrink-0" />
        <div className="min-w-0">
          <p className="truncate font-medium text-fg">
            <SkeletonText width="12ch" />
          </p>
          <p className="truncate text-sm text-muted">
            <SkeletonText width="16ch" />
          </p>
          <Badge tone="neutral" variant="soft" className="mt-1">
            <SkeletonText width="6ch" />
          </Badge>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-2">
        <Switch
          checked={false}
          disabled
          onCheckedChange={() => undefined}
          label={t('favorites.newsSwitch')}
          labelPosition="start"
          // Бегунок прячем: включено или нет — узнаем с данными, пусть он появится на месте, а не переедет
          classNames={{ root: 'flex-row-reverse gap-2', label: 'text-xs text-muted', track: 'bg-border [&>span]:hidden' }}
        />
        <Button size="sm" variant="ghost" disabled>
          {t('favorites.unsubscribeCta')}
        </Button>
      </div>
    </Card>
  );
}

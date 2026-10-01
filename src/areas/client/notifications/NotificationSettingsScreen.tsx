'use client';

import { useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { getNewsPushOptOut, listFavorites, setFavoriteNewsMuted, setNewsPushOptOut } from '@/api/client';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Avatar } from '@/ui/Avatar';
import { Button, LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { Switch } from '@/ui/Switch';
import { useToast } from '@/ui/Toast';

/**
 * Настройки уведомлений (F-14-058, F-14-060): переключатель по каждой подписанной компании — тот же
 * newsMuted, что и на /favorites (F-00-115); напоминания о записи им не глушатся.
 */
export function NotificationSettingsScreen() {
  const t = useT('client');
  const { ready, appUserId } = useCurrent();

  if (!ready) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton variant="rect" className="h-10 w-40" />
        <Skeleton variant="rect" className="h-24 rounded-2xl" />
      </div>
    );
  }
  if (!appUserId) {
    return (
      <EmptyState
        icon={<Bell aria-hidden className="size-8 text-muted" />}
        title={t('notifications.needLoginTitle')}
        description={t('notifications.needLoginHint')}
        action={
          <LinkButton href="/login?next=/profile/notifications">{t('notifications.goLogin')}</LinkButton>
        }
      />
    );
  }
  return <NotificationSettingsBody appUserId={appUserId} />;
}

function NotificationSettingsBody({ appUserId }: { appUserId: Id }) {
  const t = useT('client');
  const toast = useToast();
  const q = useApiQuery(['favorites', appUserId], () => listFavorites(appUserId));
  const mute = useApiMutation((input: { id: Id; muted: boolean }) => setFavoriteNewsMuted(input.id, input.muted));
  const newsPushQ = useApiQuery(['news-push-optout', appUserId], () => getNewsPushOptOut(appUserId));
  const setNewsPush = useApiMutation((optOut: boolean) => setNewsPushOptOut(appUserId, optOut));
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );

  const handleSystemSettings = async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  const handleMuteChange = async (id: Id, muted: boolean) => {
    try {
      await mute.mutate({ id, muted });
      void q.refetch();
    } catch {
      toast.error(t('favorites.actionFailed'));
    }
  };

  return (
    <div data-f="F-14-058 F-14-064 F-05-078" className="flex flex-col gap-5 pb-6">
      <PageHeader back={{ href: '/notifications' }} title={t('profile.notifTitle')} description={t('profile.notifSubtitle')} />

      <div data-f="F-14-060">
        <SectionCard title={t('profile.notifSystemTitle')} description={t('profile.notifSystemHint')}>
          {permission === 'unsupported' ? (
            <p className="text-sm text-muted">{t('profile.notifSystemUnsupported')}</p>
          ) : permission === 'granted' ? (
            <p className="flex items-center gap-2 text-sm text-success">
              <Bell aria-hidden className="size-4" />
              {t('profile.notifSystemOn')}
            </p>
          ) : (
            <Button variant="outline" leftIcon={<Bell aria-hidden />} onClick={() => void handleSystemSettings()}>
              {t('profile.notifSystemCta')}
            </Button>
          )}
        </SectionCard>
      </div>

      <div data-f="F-14-136">
        <SectionCard title={t('notifications_settings.productNewsTitle')} description={t('notifications_settings.productNewsHint')}>
          <Switch
            checked={!newsPushQ.data}
            onCheckedChange={(checked) => void setNewsPush.mutate(!checked)}
            label={t('notifications_settings.productNewsTitle')}
            labelPosition="start"
            classNames={{ label: 'sr-only' }}
          />
        </SectionCard>
      </div>

      <div data-f="F-04-216">
      <SectionCard title={t('profile.notifCompaniesTitle')}>
        {q.isError ? (
          <ErrorState compact onRetry={q.refetch} />
        ) : q.isLoading ? (
          <Skeleton variant="rect" className="h-16 rounded-xl" />
        ) : !q.data?.length ? (
          <EmptyState compact icon={<BellOff aria-hidden className="size-8 text-muted" />} title={t('profile.notifCompaniesEmpty')} />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {q.data.map((entry) => {
              const name = entry.staff ? entry.staff.name : entry.business.name;
              return (
                <li key={entry.favorite.id} className="flex items-center gap-3 py-3">
                  <Avatar name={name} src={entry.staff?.avatarUrl ?? entry.business.logoUrl} colorIndex={entry.staff?.colorIndex} size="sm" />
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{name}</p>
                  <Switch
                    checked={!entry.favorite.newsMuted}
                    onCheckedChange={(checked) => void handleMuteChange(entry.favorite.id, !checked)}
                    label={t('favorites.newsSwitch')}
                    labelPosition="start"
                    classNames={{ label: 'text-xs text-muted' }}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
      </div>
      <p className="text-xs text-muted">{t('profile.notifRemindersNote')}</p>
    </div>
  );
}

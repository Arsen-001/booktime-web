'use client';

/**
 * /biz/integrations/developers — F-13-028 регистрация разработчика → F-13-032 «Мои приложения».
 * Кабинет виден только тому, кто его завёл (ownerStaffId) — другой администратор той же локации видит форму
 * регистрации заново, а не чужой список приложений.
 */
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { getDeveloperAccount, listDevApps } from '@/api/integrations';
import { useApiQuery } from '@/api/request';
import { DevAppStatusBadge } from '@/areas/integrations/developers/DevAppStatusBadge';
import { DeveloperRegisterForm } from '@/areas/integrations/developers/DeveloperRegisterForm';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { LinkButton } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { PermissionGate } from '@/ui/PermissionGate';
import { Skeleton } from '@/ui/Skeleton';

export function DeveloperHubScreen() {
  const t = useT('integrations');
  const { ready } = useCurrent();
  const can = useCan('integrations.manage');
  const accountQ = useApiQuery(['integrations', 'developerAccount'], () => getDeveloperAccount(), { enabled: ready && can });
  const appsQ = useApiQuery(['integrations', 'devApps'], () => listDevApps(), { enabled: ready && can && Boolean(accountQ.data) });

  return (
    <PermissionGate permission="integrations.manage" fallback="message">
      <div data-f="F-13-028 F-13-032" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <PageHeader
          title={t('developers.title')}
          description={t('developers.subtitle')}
          meta={
            <Link href="/biz/integrations/developers/help" className="inline-flex min-h-11 items-center text-sm text-primary-text underline decoration-border-strong underline-offset-2">
              {t('developers.helpLink')}
            </Link>
          }
        />

        {!ready || accountQ.isLoading ? (
          // Загрузка — та же форма регистрации (обычно кабинета ещё нет), выключенная: пришёл ответ — ничего не сдвинулось
          <fieldset disabled aria-busy className="min-w-0">
            <DeveloperRegisterForm onRegistered={() => accountQ.refetch()} />
          </fieldset>
        ) : accountQ.isError ? (
          <ErrorState onRetry={() => accountQ.refetch()} />
        ) : !accountQ.data ? (
          <DeveloperRegisterForm onRegistered={() => accountQ.refetch()} />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-fg">{t('developers.myApps')}</h2>
              <LinkButton href="/biz/integrations/developers/apps/new" leftIcon={<Plus aria-hidden />}>
                {t('developers.createApp')}
              </LinkButton>
            </div>

            {appsQ.isLoading ? (
              <Skeleton lines={4} />
            ) : appsQ.isError ? (
              <ErrorState onRetry={() => appsQ.refetch()} />
            ) : !appsQ.data?.length ? (
              <EmptyState
                title={t('developers.noApps')}
                description={t('developers.noAppsHint')}
                action={
                  <LinkButton href="/biz/integrations/developers/apps/new" leftIcon={<Plus aria-hidden />}>
                    {t('developers.createApp')}
                  </LinkButton>
                }
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {appsQ.data.map((app) => (
                  <li key={app.id}>
                    <Link href={`/biz/integrations/developers/apps/${app.id}`} className="block">
                      <Card className="flex items-center justify-between gap-3 transition hover:border-border-strong">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-fg">{app.name}</p>
                          <p className="truncate text-sm text-muted">
                            {app.appCode}
                            {app.isPrivate && ` · ${t('developers.privateBadge')}`}
                          </p>
                        </div>
                        <DevAppStatusBadge status={app.status} />
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </PermissionGate>
  );
}

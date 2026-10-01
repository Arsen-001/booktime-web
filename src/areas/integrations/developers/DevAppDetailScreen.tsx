'use client';

/**
 * /biz/integrations/developers/apps/[devAppId] — карточка приложения разработчика: «Общая информация»,
 * «О приложении», «Настройки для разработки», «Доступ к API» (b02); «Монетизация» и «Публикация» — b05.
 * Отправка на модерацию и демо-решение живут во вкладке «Публикация» — в шапке только статус.
 */
import { useState } from 'react';
import { getDevApp } from '@/api/integrations';
import { useApiQuery } from '@/api/request';
import { ApiAccessTab } from '@/areas/integrations/developers/tabs/ApiAccessTab';
import { AboutTab } from '@/areas/integrations/developers/tabs/AboutTab';
import { DevAppStatusBadge } from '@/areas/integrations/developers/DevAppStatusBadge';
import { DevSettingsTab } from '@/areas/integrations/developers/tabs/DevSettingsTab';
import { GeneralInfoTab } from '@/areas/integrations/developers/tabs/GeneralInfoTab';
import { MonetizationTab } from '@/areas/integrations/developers/tabs/MonetizationTab';
import { PublicationTab } from '@/areas/integrations/developers/tabs/PublicationTab';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { Skeleton } from '@/ui/Skeleton';
import { Tabs } from '@/ui/Tabs';

// QA 30.09: шесть вкладок не влезали в 760 px на десктопе — ширина max-w-5xl, как у «API и вебхуки».
export function DevAppDetailScreen({ devAppId }: { devAppId: string }) {
  const t = useT('integrations');
  const [tab, setTab] = useState('general');
  const appQ = useApiQuery(['integrations', 'devApp', devAppId], () => getDevApp(devAppId));

  if (appQ.isError) return <ErrorState onRetry={() => appQ.refetch()} />;
  if (appQ.isLoading || !appQ.data) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <Skeleton lines={2} />
        <Skeleton lines={8} />
      </div>
    );
  }

  const app = appQ.data;
  const refresh = () => appQ.refetch();

  const tabs = [
    { value: 'general', label: t('developers.app.tabs.general') },
    { value: 'about', label: t('developers.app.tabs.about') },
    { value: 'devSettings', label: t('developers.app.tabs.devSettings') },
    { value: 'apiAccess', label: t('developers.app.tabs.apiAccess') },
    { value: 'monetization', label: t('developers.app.tabs.monetization') },
    { value: 'publication', label: t('developers.app.tabs.publication') },
  ];

  return (
    <div data-f="F-13-032" className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        back={{ href: '/biz/integrations/developers' }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {app.name}
            {app.isPrivate && <Badge tone="neutral">{t('developers.privateBadge')}</Badge>}
          </span>
        }
        description={app.appCode}
        meta={<DevAppStatusBadge status={app.status} />}
      />

      <Tabs items={tabs} value={tab} onValueChange={setTab} />

      {tab === 'general' && <GeneralInfoTab app={app} onChanged={refresh} />}
      {tab === 'about' && <AboutTab app={app} onChanged={refresh} />}
      {tab === 'devSettings' && <DevSettingsTab app={app} onChanged={refresh} />}
      {tab === 'apiAccess' && <ApiAccessTab app={app} onChanged={refresh} />}
      {tab === 'monetization' && <MonetizationTab app={app} onChanged={refresh} />}
      {tab === 'publication' && <PublicationTab app={app} onChanged={refresh} />}
    </div>
  );
}

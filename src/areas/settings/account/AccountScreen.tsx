'use client';

/**
 * /biz/settings/account — «Личный кабинет» (F-15-147): личные настройки человека, а не карточка сотрудника
 * в локации — один аккаунт работает во всех бизнесах, куда человека пригласили (в этом моке — по staffId
 * текущего бизнеса, см. qa/requests/settings.md п. «межбизнесовый аккаунт»). Вкладки — F-15-148…158, F-15-134.
 * Вошедший пользователь и выход видны из ЛЮБОГО экрана уже сегодня (шапка кабинета, `UserMenu` — фундамент);
 * клик «Мой профиль» там пока ведёт на карточку сотрудника, а не сюда — просьба в qa/requests/settings.md.
 */
import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { HelpArticleButton } from '@/areas/settings/HelpArticleButton';
import { PageHeader } from '@/ui/PageHeader';
import { Tabs } from '@/ui/Tabs';
import { EmptyState } from '@/ui/EmptyState';
import { LanguageTab } from '@/areas/settings/account/LanguageTab';
import { ManagementTab } from '@/areas/settings/account/ManagementTab';
import { NotificationsTab } from '@/areas/settings/account/NotificationsTab';
import { PasswordTab } from '@/areas/settings/account/PasswordTab';
import { PhoneTab } from '@/areas/settings/account/PhoneTab';
import { PrivacyTab } from '@/areas/settings/account/PrivacyTab';
import { ProfileTab, ProfileTabSkeleton } from '@/areas/settings/account/ProfileTab';
import { EmailTab } from '@/areas/settings/account/EmailTab';

const TAB_IDS = ['profile', 'language', 'phone', 'email', 'password', 'notifications', 'privacy', 'management'] as const;
type TabId = (typeof TAB_IDS)[number];

function isTabId(value: string | null): value is TabId {
  return value !== null && (TAB_IDS as readonly string[]).includes(value);
}

export function AccountScreen() {
  const t = useT('settings');
  const { ready, staffId } = useCurrent();
  // Н9: вкладка — в адресе (?tab=…): ссылкой можно поделиться, «Назад» браузера возвращает прежнюю вкладку.
  // pushState без запроса к серверу — Next синхронизирует его с useSearchParams.
  const searchParams = useSearchParams();
  const urlTab = searchParams.get('tab');
  const tab: TabId = isTabId(urlTab) ? urlTab : 'profile';
  const selectTab = (value: TabId) => {
    if (value === tab) return;
    window.history.pushState(null, '', value === 'profile' ? window.location.pathname : `?tab=${value}`);
  };
  // М2: открытые вкладки остаются смонтированными (скрыты) — возврат без скелетона, несохранённое не теряется
  const [visited, setVisited] = useState<TabId[]>([tab]);
  if (!visited.includes(tab)) setVisited([...visited, tab]);
  const panel = (id: TabId, node: ReactNode) =>
    visited.includes(id) ? (
      <div key={id} role="tabpanel" hidden={tab !== id}>
        {node}
      </div>
    ) : null;

  return (
    <div data-f="F-15-147 F-15-172 F-10-120 F-10-121 F-10-122 F-10-128" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader
        title={t('account.title')}
        description={t('account.description')}
        back={{ href: '/biz/settings' }}
        actions={
          <span data-f="F-15-171">
            <HelpArticleButton label={t('account.helpArticleLabel')} title={t('account.title')}>
              <p>{t('account.helpArticleBody1')}</p>
              <p>{t('account.helpArticleBody2')}</p>
            </HelpArticleButton>
          </span>
        }
      />

      {ready && !staffId ? (
        <EmptyState title={t('account.title')} description={t('account.description')} />
      ) : (
        <>
          <Tabs
            variant="line"
            value={tab}
            onValueChange={(v) => {
              if (isTabId(v)) selectTab(v);
            }}
            items={[
              { value: 'profile', label: t('account.tabs.profile') },
              { value: 'language', label: t('account.tabs.language') },
              { value: 'phone', label: t('account.tabs.phone') },
              { value: 'email', label: t('account.tabs.email') },
              { value: 'password', label: t('account.tabs.password') },
              { value: 'notifications', label: t('account.tabs.notifications') },
              { value: 'privacy', label: t('account.tabs.privacy') },
              { value: 'management', label: t('account.tabs.management') },
            ]}
          />

          {/* До готовности контекста — вкладка «Профиль» в своём виде (скелетон той же разметки) */}
          {!staffId ? panel('profile', <ProfileTabSkeleton />) : panel('profile', <ProfileTab staffId={staffId} />)}
          {panel('language', <LanguageTab />)}
          {staffId && (
            <>
              {panel('phone', <PhoneTab staffId={staffId} />)}
              {panel('email', <EmailTab staffId={staffId} />)}
              {panel('password', <PasswordTab staffId={staffId} />)}
              {panel('notifications', <NotificationsTab staffId={staffId} />)}
              {panel('privacy', <PrivacyTab staffId={staffId} />)}
              {panel('management', <ManagementTab staffId={staffId} />)}
            </>
          )}
        </>
      )}
    </div>
  );
}

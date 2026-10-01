'use client';

/**
 * /biz/settings — хаб настроек (F-15-097, F-15-098, F-15-120): группы «Компания», «Системные», «Категории»,
 * «Аккаунт», «Подписка и монеты» + разделы (settingsHub).
 * F-15-098: одна настройка — один адрес; хаб только ссылается на экраны, ничего не дублирует.
 * Н7 (настройки-ревью 27.09.2026): вклады разделов — плитки-ссылки (раньше встраивались формами, хаб был
 * 7 724 px); сверху — поиск по настройкам со словами-подсказками («часы работы» → Контакты).
 */
import {
  Building2,
  ChevronRight,
  CreditCard,
  FileText,
  FolderTree,
  Globe,
  History,
  Images,
  LifeBuoy,
  MapPin,
  Languages as LanguagesIcon,
  SearchX,
  Smartphone,
  Sparkles,
  ShieldCheck,
  UserCog,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useCan, useCurrent } from '@/demo/hooks';
import { useExtensions } from '@/extensions/useExtensions';
import { useT } from '@/i18n/useT';
import { useCompanyProfile } from '@/api/settings';
import { HUB_FALLBACK_ICON, HUB_MODULES, hubModuleHref } from '@/areas/settings/hubModules';
import { SettingsHubGroup, type HubTile } from '@/areas/settings/SettingsHubGroup';
import { SubscriptionBanner } from '@/areas/settings/SubscriptionBanner';
import { EmptyState } from '@/ui/EmptyState';
import { PageHeader } from '@/ui/PageHeader';
import { SearchInput } from '@/ui/SearchInput';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';

/** Ключ словаря 'settings' — используем тип параметра useT('settings'), чтобы компилятор проверял ключи */
type SettingsKey = Parameters<ReturnType<typeof useT<'settings'>>>[0];

function normalizeQuery(value: string): string {
  return value.toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

function matches(tile: HubTile, query: string): boolean {
  const haystack = normalizeQuery(`${tile.title} ${tile.description} ${tile.keywords ?? ''}`);
  return query.split(' ').every((word) => haystack.includes(word));
}

export function SettingsHubScreen() {
  const t = useT('settings');
  const tc = useT('common');
  const { businessId, ready } = useCurrent();
  const canBilling = useCan('billing.manage');
  const canSettings = useCan('settings.manage');
  const extensions = useExtensions('settingsHub');
  const profileQ = useCompanyProfile(businessId, { enabled: ready });
  const [query, setQuery] = useState('');
  const profileLoading = !ready || profileQ.isLoading;
  const profileIncomplete = Boolean(profileQ.data && profileQ.data.percent < 100);
  // Плашка «профиль заполнен на N%» — на месте уже до ответа, если была в прошлый раз (в демо профиль не заполнен)
  const showProfileHint = useSkeletonCount('profile-incomplete', { loading: profileLoading, count: profileQ.data ? Number(profileIncomplete) : undefined, fallback: 1 }) > 0;

  const tile = (id: string, href: string, icon: HubTile['icon'], key: string): HubTile => ({
    id,
    href,
    icon,
    title: t(`hub.${key}.title` as SettingsKey),
    description: t(`hub.${key}.description` as SettingsKey),
    keywords: t(`hub.keywords.${key}` as SettingsKey),
  });

  const companyTiles: HubTile[] = [
    tile('brand', '/biz/settings/brand', Building2, 'brand'),
    tile('contacts', '/biz/settings/contacts', MapPin, 'contacts'),
    tile('gallery', '/biz/settings/gallery', Images, 'gallery'),
    tile('legal', '/biz/settings/legal', FileText, 'legal'),
    tile('mobileApp', '/biz/settings/mobile-app', Smartphone, 'mobileApp'),
  ];
  const systemTiles: HubTile[] = [
    tile('system', '/biz/settings/system', Globe, 'system'),
    tile('sphere', '/biz/settings/sphere', Sparkles, 'sphere'),
    tile('categories', '/biz/settings/categories', FolderTree, 'categories'),
    tile('languages', '/biz/settings/languages', LanguagesIcon, 'languages'),
  ];
  // Н8: у «Личного кабинета» больше нет «Скоро» — все вкладки работают
  const accountTiles: HubTile[] = [
    tile('account', '/biz/settings/account', UserCog, 'account'),
    tile('history', '/biz/settings/history', History, 'history'),
  ];
  // F-15-001: «из любого экрана кабинета есть вход в помощь и поддержку» — без permission-гейта
  const helpTiles: HubTile[] = [tile('help', '/biz/settings/help', LifeBuoy, 'help')];
  const billingTiles: HubTile[] = [
    tile('billing', '/biz/billing', CreditCard, 'billing'),
    tile('coins', '/biz/coins', ShieldCheck, 'coins'),
  ];
  const moduleTiles: HubTile[] = extensions.map((entry) => ({
    id: `module-${entry.area}`,
    href: hubModuleHref(entry.area),
    icon: HUB_MODULES[entry.area]?.icon ?? HUB_FALLBACK_ICON,
    title: tc(`ext.settingsHub.${entry.area}` as never),
    description: t(`hub.modules.${entry.area}.description` as SettingsKey),
    keywords: t(`hub.modules.${entry.area}.keywords` as SettingsKey),
  }));

  const groups: { id: string; title: string; tiles: HubTile[] }[] = [
    // F-15-099 (QA 30.09): «Компания» открывается только с settings.manage — мастер и администратор видели плитки,
    // которые вели на «Нет доступа». «Личный кабинет» — свой у каждого сотрудника, он виден всем; журнал изменений
    // настроек компании — только тем, кто их меняет.
    ...(canSettings ? [{ id: 'company', title: t('hub.groupCompany'), tiles: companyTiles }] : []),
    ...(canBilling ? [{ id: 'billing', title: t('hub.groupBilling'), tiles: billingTiles }] : []),
    ...(canSettings ? [{ id: 'system', title: t('hub.groupSystem'), tiles: systemTiles }] : []),
    { id: 'account', title: t('hub.groupAccount'), tiles: canSettings ? accountTiles : accountTiles.filter((x) => x.id === 'account') },
    { id: 'help', title: t('hub.groupHelp'), tiles: helpTiles },
  ];

  const q = normalizeQuery(query);
  const found = q ? [...groups.flatMap((g) => g.tiles), ...moduleTiles].filter((x) => matches(x, q)) : [];

  return (
    <div data-f="F-15-001 F-15-097 F-15-098 F-15-099" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('hub.title')} description={t('hub.description')} />

      <SearchInput
        value={query}
        onValueChange={setQuery}
        placeholder={t('hub.searchPlaceholder')}
        aria-label={t('hub.searchPlaceholder')}
      />

      {q ? (
        found.length ? (
          <SettingsHubGroup title={t('hub.searchResults', { count: found.length })} tiles={found} />
        ) : (
          <EmptyState icon={<SearchX aria-hidden />} title={t('hub.searchEmpty')} description={t('hub.searchEmptyHint')} />
        )
      ) : (
        <>
          <SubscriptionBanner />

          {canSettings && (profileLoading ? showProfileHint : profileIncomplete) && (
            <Link
              href="/biz/onboarding"
              className="flex items-center gap-3 rounded-xl border border-border bg-primary-soft/40 px-4 py-3 text-sm text-fg transition-colors hover:bg-primary-soft/60 sm:px-5"
            >
              <span className="flex-1">
                {profileQ.data ? (
                  t('hub.profileIncomplete', { percent: profileQ.data.percent })
                ) : (
                  // На телефоне фраза в две строки, шире — в одну
                  <>
                    <Skeleton lines={2} className="sm:hidden" />
                    <SkeletonText width="40ch" className="max-sm:hidden" />
                  </>
                )}
              </span>
              <ChevronRight aria-hidden className="size-4 shrink-0" />
            </Link>
          )}

          {groups.map((g) => (
            <SettingsHubGroup key={g.id} title={g.title} tiles={g.tiles} />
          ))}

          {/* Плитки разделов — не данные (вклады раздела), рисуются сразу, в том числе в первом кадре */}
          <SettingsHubGroup dataF="F-15-120" title={t('hub.groupModules')} tiles={moduleTiles} />
        </>
      )}
    </div>
  );
}

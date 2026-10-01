'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { BIZ_NAV, BIZ_NAV_GROUPS, visibleNav } from '@/config/nav';
import { BIZ_PERSONAS } from '@/demo/settings';
import { useDemo, usePermissions } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { LocationSwitcher } from '@/shell/biz/LocationSwitcher';
import { TopSearch } from '@/shell/biz/TopSearch';
import { WorkspaceShell } from '@/shell/workspace/WorkspaceShell';
import { useNetworkAccess } from '@/areas/network/lib/useNetworkAccess';

/** Каркас кабинета бизнеса /biz: меню зависит от персоны, её прав и сферы */
export function BizShell({ children }: { children: ReactNode }) {
  const t = useT('common');
  const { persona, sphere } = useDemo();
  const permissions = usePermissions();
  const pathname = usePathname();
  // 01.10.2026: пользователь сети (без network.manage) видит «Сеть и филиалы», но только разделы своих прав сети
  const networkAccess = useNetworkAccess();
  const items = visibleNav(BIZ_NAV, {
    persona,
    sphere,
    can: (p) => permissions.has(p) || (p === 'network.manage' && networkAccess.member),
    hiddenHrefs: networkAccess.hiddenHrefs,
  });

  // Э5 (clients-review 27.09.2026): анкета/согласие клиента открывается по ссылке, которую мастер отправляет
  // САМОМУ клиенту — тот заполняет её без входа в кабинет, без меню и полос, как публичную страницу.
  // Приглашение в салон (F-00-042) принимает человек, который ещё НЕ сотрудник (членства нет) — страница без меню,
  // иначе на живом сайте он видел бы «нет доступа» вместо кнопки «Принять»
  if (pathname?.startsWith('/biz/clients/consent/') || pathname?.startsWith('/biz/onboarding/invite/')) {
    return <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">{children}</div>;
  }

  return (
    <WorkspaceShell
      kind="biz"
      allowed={BIZ_PERSONAS.includes(persona)}
      items={items}
      groups={BIZ_NAV_GROUPS}
      caption={t('app.bizCabinet')}
      logoHref="/biz"
      topBarStart={
        <>
          <LocationSwitcher className="hidden sm:flex" />
          <TopSearch />
        </>
      }
      drawerTop={<LocationSwitcher className="w-full max-w-none" />}
    >
      {children}
    </WorkspaceShell>
  );
}

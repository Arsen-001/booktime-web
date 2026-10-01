'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { PLATFORM_NAV } from '@/config/nav';
import { useDemo } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { WorkspaceShell } from '@/shell/workspace/WorkspaceShell';

/** Каркас нашей панели /platform — только персона «Наша панель» */
export function PlatformShell({ children }: { children: ReactNode }) {
  const t = useT('common');
  const { persona } = useDemo();
  const pathname = usePathname();
  // Вход команды платформы (PLAN.md Р11) — без каркаса панели: до входа панели не видно
  if (pathname === '/platform/login') return <>{children}</>;
  return (
    <WorkspaceShell
      kind="platform"
      allowed={persona === 'platform'}
      items={PLATFORM_NAV}
      caption={t('app.platformPanel')}
      logoHref="/platform"
      // На телефоне подпись уже под знаком в меню и не влезает (hy) — там её нет; на десктопе помещается целиком
      topBarStart={
        <span className="hidden truncate text-sm font-medium text-muted sm:block">
          {t('app.platformPanel')}
        </span>
      }
    >
      {children}
    </WorkspaceShell>
  );
}

'use client';

/**
 * F-06-003: пункт меню «Лояльность» уже скрыт без права loyalty.manage (BizShell/nav.ts), но экраны
 * раздела открывались по прямому URL и показывали финансовые данные клиентов (балансы депозитов,
 * номера карт, обороты по картам/абонементам/сертификатам) без проверки права на уровне маршрута.
 * Гвардируем сам роут /biz/loyalty/** — используется из src/app/biz/loyalty/layout.tsx.
 */
import type { ReactNode } from 'react';
import { LockKeyhole } from 'lucide-react';
import { useCan } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { EmptyState } from '@/ui/EmptyState';

export function LoyaltyAccessGate({ children }: { children: ReactNode }) {
  const allowed = useCan('loyalty.manage');
  const t = useT('ui');

  if (!allowed) {
    return (
      <div className="grid min-h-[60dvh] place-items-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <EmptyState
            icon={<LockKeyhole aria-hidden className="size-8" />}
            title={t('permission.denied')}
            description={t('permission.deniedHint')}
          />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

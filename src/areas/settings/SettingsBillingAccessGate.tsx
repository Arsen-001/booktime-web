'use client';

/**
 * F-15-069: «Подписка» и «Монеты» несут деньги бизнеса — закрыты по прямому URL без billing.manage,
 * не только скрыты в меню (src/config/nav.ts уже скрывает пункт; здесь — сам маршрут). По образцу
 * src/areas/finance/FinanceAccessGate.tsx.
 */
import type { ReactNode } from 'react';
import { LockKeyhole } from 'lucide-react';
import { useCan } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { EmptyState } from '@/ui/EmptyState';

export function SettingsBillingAccessGate({ children }: { children: ReactNode }) {
  const allowed = useCan('billing.manage');
  const t = useT('ui');

  if (!allowed) {
    return (
      <div data-f="F-15-069" className="grid min-h-[60dvh] place-items-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <EmptyState icon={<LockKeyhole aria-hidden className="size-8" />} title={t('permission.denied')} description={t('permission.deniedHint')} />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

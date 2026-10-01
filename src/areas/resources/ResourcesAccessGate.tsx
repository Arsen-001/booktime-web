'use client';

/**
 * F-16-026: без тонкого права «Ресурсы» пользователь не видит раздел вовсе — закрывает не только пункт
 * меню (src/config/nav.ts уже фильтрует по resources.manage), но и сам маршрут /biz/resources/** по
 * прямому адресу (по образцу FinanceAccessGate). /biz/resources/packages/** — тот же раздел, той же галочкой.
 */
import type { ReactNode } from 'react';
import { LockKeyhole } from 'lucide-react';
import { useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { EmptyState } from '@/ui/EmptyState';
import { useResourcesRights } from '@/areas/resources/lib/rights';

export function ResourcesAccessGate({ children }: { children: ReactNode }) {
  const { ready } = useCurrent();
  const rights = useResourcesRights();
  const t = useT('ui');

  // Пока права читаются — сразу экран (у него свой скелетон той же разметки), а не общие полосы на месте страницы:
  // права по умолчанию открыты, закрытое показываем, только когда оно известно
  if (ready && rights.ready && !rights.viewResources) {
    return (
      <div className="grid min-h-[60dvh] place-items-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <EmptyState icon={<LockKeyhole aria-hidden className="size-8" />} title={t('permission.denied')} description={t('permission.deniedHint')} />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

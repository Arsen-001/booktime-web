'use client';

/**
 * QA 01.10 (решение владельца): форма склада без права — сразу «Нет прав», а не заполненная форма и
 * «Не удалось сохранить» в конце. Тонкие права раздела (useStockPermissions) или общее право ядра.
 */
import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import type { Permission } from '@/config/permissions';
import { usePermissions } from '@/demo/hooks';
import type { StockStaffPermissions } from '@/domain/stock';
import { useT } from '@/i18n/useT';
import { LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { useStockPermissions } from '@/areas/stock/useStockPermissions';

type FineNeed = { [K in keyof StockStaffPermissions]: StockStaffPermissions[K] extends boolean ? K : never }[keyof StockStaffPermissions];

export function StockAccessGate({ need, children }: { need: FineNeed | Permission; children: ReactNode }) {
  const t = useT('stock');
  const fine = useStockPermissions();
  const coarse = usePermissions();
  const allowed = need.includes('.') ? coarse.has(need as Permission) : Boolean(fine[need as FineNeed]);
  if (allowed) return <>{children}</>;
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 py-8">
      <EmptyState
        icon={<Lock aria-hidden />}
        title={t('noAccess.title')}
        description={t('noAccess.text')}
        action={<LinkButton href="/biz/stock" variant="secondary">{t('noAccess.back')}</LinkButton>}
      />
    </div>
  );
}

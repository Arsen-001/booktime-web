'use client';

/**
 * Раздел «Сотрудники» без staff.view закрыт по прямому адресу (пункт меню и так скрыт, src/config/nav.ts) — кроме
 * своей карточки: мастер открывает её из меню пользователя («Мой профиль»). Раньше список, роли и журнал у мастера
 * показывали «Нет прав», но запросы /staff и /positions всё равно уходили — 403 в консоли (проход 17.11, группа 4).
 */
import type { ReactNode } from 'react';
import { LockKeyhole } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { EmptyState } from '@/ui/EmptyState';

export function StaffAccessGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const can = useCan('staff.view');
  const { staffId } = useCurrent();
  const t = useT('ui');
  const ownCard = Boolean(staffId) && pathname === `/biz/staff/${staffId}`;

  if (!can && !ownCard) {
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

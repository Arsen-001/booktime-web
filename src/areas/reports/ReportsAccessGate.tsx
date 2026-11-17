'use client';

/**
 * Раздел «Отчёты» без reports.view закрыт по прямому адресу целиком (как «Финансы» и «Интеграции»): раньше экраны
 * отчётов показывали «Нет прав» через PermissionGate, но их запросы всё равно уходили на сервер — у администратора
 * и мастера 403 в консоли на каждом отчёте (проход 17.11, группа 4). Исключение — «Моя аналитика» (F-12-106):
 * её видит администратор без права на отчёты, экран сам ограничен своими цифрами.
 */
import type { ReactNode } from 'react';
import { LockKeyhole } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useCan } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { EmptyState } from '@/ui/EmptyState';

export function ReportsAccessGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const can = useCan('reports.view');
  const t = useT('ui');
  const own = pathname?.startsWith('/biz/reports/r/myAnalytics') ?? false;

  if (!can && !own) {
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

'use client';

/**
 * Решение владельца 01.10 (QA 30.09): без права integrations.manage раздел закрыт целиком — не только пункт
 * меню (src/config/nav.ts), но и прямые адреса /biz/integrations/** (каталог, «API и вебхуки», «Идентификаторы»
 * с ID бизнеса, филиалов, сотрудников и услуг). Подключается из src/app/biz/integrations/layout.tsx,
 * по образцу NotifyAccessGate / FinanceAccessGate: «Нет прав» + «Назад».
 */
import type { ReactNode } from 'react';
import { LockKeyhole } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCan } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';

export function IntegrationsAccessGate({ children }: { children: ReactNode }) {
  const can = useCan('integrations.manage');
  const t = useT('ui');
  const router = useRouter();

  if (!can) {
    return (
      <div className="grid min-h-[60dvh] place-items-center px-4 py-10" data-f="F-13-023">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <EmptyState
            icon={<LockKeyhole aria-hidden className="size-8" />}
            title={t('permission.denied')}
            description={t('permission.deniedHint')}
            action={
              <Button variant="secondary" onClick={() => router.push('/biz')}>
                {t('pageHeader.back')}
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

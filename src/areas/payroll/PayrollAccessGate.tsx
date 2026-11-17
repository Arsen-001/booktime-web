'use client';

/**
 * Раздел «Зарплата» целиком (схемы, расчёт, ведомость, правила, фонд, настройки, карточка сотрудника) — право
 * payroll.view или payroll.manage, как на сервере. Владелец, 01.10.2026: администратор и мастер без этого права видят
 * только свою зарплату — «Моя зарплата» (/biz/payroll/me) открыта всем. Проход 17.11: по прямому адресу администратор
 * открывал «Схемы», «Правила», «Фонд» — пустые рамки и 403 в консоли. Подключается из src/app/biz/payroll/layout.tsx
 * (по образцу FinanceAccessGate).
 */
import type { ReactNode } from 'react';
import { LockKeyhole } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';

/** Страницы, которые сервер читает только с payroll.manage (в меню у них то же право — nav.ts) */
export const MANAGE_ONLY = ['/biz/payroll/rules', '/biz/payroll/criteria', '/biz/payroll/charts', '/biz/payroll/analytics', '/biz/payroll/setup'];

export function PayrollAccessGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { ready } = useCurrent();
  const view = useCan('payroll.view');
  const manage = useCan('payroll.manage');
  const t = useT('ui');
  const tp = useT('payroll');
  const isMe = pathname === '/biz/payroll/me' || (pathname?.startsWith('/biz/payroll/me/') ?? false);
  // Правила, критерии, схемы расчёта (классика), фонд оплаты труда и быстрая настройка — сервер отдаёт только с
  // payroll.manage: с одним «смотреть» было «Не удалось загрузить» и 403 в консоли (проход 17.11, «только просмотр»)
  const manageOnly = MANAGE_ONLY.some((p) => pathname === p || (pathname?.startsWith(`${p}/`) ?? false));

  if (ready && !isMe && ((!view && !manage) || (manageOnly && !manage))) {
    return (
      <div className="grid min-h-[60dvh] place-items-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <EmptyState
            icon={<LockKeyhole aria-hidden className="size-8" />}
            title={t('permission.denied')}
            description={t('permission.deniedHint')}
            action={
              <LinkButton href="/biz/payroll/me" variant="secondary">
                {tp('nav.me')}
              </LinkButton>
            }
          />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

'use client';

/**
 * F-07-166: право финансов закрывает не только пункт меню (скрыт без finance.view в src/config/nav.ts),
 * но и сам маршрут /biz/finance/** — иначе прямой адрес показывает деньги без права. Подключается из
 * src/app/biz/finance/layout.tsx (по образцу LoyaltyAccessGate).
 * F-07-159: исключение — «Взаиморасчёты» видит и мастер без finance.view (только свои, payroll.view),
 * его список внутри экрана сам сужен до собственного staffId.
 */
import type { ReactNode } from 'react';
import { LockKeyhole } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useCan } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { EmptyState } from '@/ui/EmptyState';

export function FinanceAccessGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const financeView = useCan('finance.view');
  const payrollView = useCan('payroll.view');
  const shiftRight = useCan('finance.shift');
  const isSettlements = pathname?.startsWith('/biz/finance/settlements') ?? false;
  // Владелец, 01.10.2026: «Кассовая смена» — администратору с finance.shift, без остального раздела
  const isShift = pathname?.startsWith('/biz/finance/shift') ?? false;
  const allowed = financeView || (isSettlements && payrollView) || (isShift && shiftRight);
  const t = useT('ui');

  if (!allowed) {
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

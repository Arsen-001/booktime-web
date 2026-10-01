'use client';

/**
 * F-05-001: пункт меню «Уведомления» скрыт у персон без `notify.manage`, но раньше прямой заход по URL
 * (/biz/notifications и все подстраницы) открывал экран всё равно — сама страница право не проверяла.
 * Каждый page.tsx раздела оборачивает свой экран этим гейтом, так что и прямой адрес блокируется.
 *
 * ux-r5 M22: голая плашка «Нет прав» не давала выхода со страницы — заменено на EmptyState с кнопкой
 * выхода на главную, как в LoyaltyAccessGate/FinanceAccessGate.
 */
import type { ReactNode } from 'react';
import { LockKeyhole } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Permission } from '@/config/permissions';
import { useCan } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';

function DeniedState() {
  const t = useT('ui');
  const router = useRouter();
  return (
    <div className="grid min-h-[60dvh] place-items-center px-4 py-10">
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

/**
 * `extra` — вторая, более узкая проверка поверх общего `notify.manage` (F-05-111 `notify.mailings` на
 * страницах рассылок, F-05-112 `notify.log` на журнале отправок): без права раздел виден в меню, но эта
 * страница — нет.
 */
export function NotifyAccessGate({ children, extra }: { children: ReactNode; extra?: Permission }) {
  const canManage = useCan('notify.manage');
  const canExtra = useCan(extra ?? 'notify.manage');
  if (!canManage) return <DeniedState />;
  if (extra && !canExtra) return <DeniedState />;
  // data-f: F-05-110 — без права notify.manage весь раздел выше уже не доходит до этой строки.
  return <div data-f="F-05-110">{children}</div>;
}

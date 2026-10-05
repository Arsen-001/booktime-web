'use client';

/**
 * «Быстрый старт» — настройка компании (чек-лист, мастер из 3 шагов, тур, сферы, калькулятор): только тем, кто
 * меняет настройки компании (settings.manage — владелец, индивидуал, сеть). Мастер и администратор его не видят
 * (решение владельца 01.10.2026). Вход по приглашению открыт всем — туда приходят ещё без прав. Экран
 * «Забыли пароль?» администратора убран 06.10.2026 (F-15-012/013, docs/coverage/2026-10-06.md §4 п. 16): у кого есть
 * телефон — входит кодом, без телефона — новый пароль выдаёт владелец.
 */
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { LockKeyhole } from 'lucide-react';
import { useCan } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { EmptyState } from '@/ui/EmptyState';

const OPEN_PREFIXES = ['/biz/onboarding/invite'];

export function OnboardingAccessGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const allowed = useCan('settings.manage');
  const t = useT('ui');

  if (!allowed && !OPEN_PREFIXES.some((p) => pathname.startsWith(p))) {
    return (
      <div data-f="F-15-099" className="grid min-h-[60dvh] place-items-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <EmptyState icon={<LockKeyhole aria-hidden className="size-8" />} title={t('permission.denied')} description={t('permission.deniedHint')} />
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

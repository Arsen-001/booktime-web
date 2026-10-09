'use client';

import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';

/**
 * Пустой экран гостя (onboarding-k4 №1, F-00-031: смотреть без входа, вход — только при записи): главное действие —
 * «Найти мастера», «Войти» — второстепенной ссылкой для тех, кто уже записывался.
 */
export function GuestGate({ icon, title, description, next }: { icon: ReactNode; title: string; description: string; next: string }) {
  const t = useT('client');
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      action={
        <div className="flex flex-col items-center gap-2">
          <LinkButton href="/search" leftIcon={<Search aria-hidden />}>
            {t('common.findMaster')}
          </LinkButton>
          <LinkButton href={`/login?next=${encodeURIComponent(next)}`} variant="ghost">
            {t('common.loginIfBooked')}
          </LinkButton>
        </div>
      }
    />
  );
}

/**
 * Экран гостя для того, что есть только у вошедшего (сертификаты, абонементы, карты, приглашения): сюда попадают по
 * прямой ссылке, минуя профиль — не «пока пусто», а «войдите», иначе кажется, что купленного нет.
 */
export function LoginGate({ icon, next }: { icon: ReactNode; next: string }) {
  const t = useT('client');
  return (
    <EmptyState
      icon={icon}
      title={t('common.needLoginTitle')}
      description={t('common.needLoginHint')}
      action={<LinkButton href={`/login?next=${encodeURIComponent(next)}`}>{t('common.goLogin')}</LinkButton>}
    />
  );
}

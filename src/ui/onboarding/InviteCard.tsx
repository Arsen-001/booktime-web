import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Avatar } from '@/ui/Avatar';
import { InvitePointList, type InvitePoint } from '@/ui/onboarding/InvitePointList';

export type { InvitePoint };

export interface InviteCardProps {
  /** Кто приглашает: название салона (для аватара-инициалов) */
  fromName: string;
  /** Логотип/фото салона */
  fromImage?: string;
  /** «Салон «Нури» приглашает вас в команду» */
  title: ReactNode;
  /** Кто пригласил и когда: «Пригласила Анна Саргсян · вчера» */
  subtitle?: ReactNode;
  /** Что увидит салон (записи в часы смены, ваши услуги в салоне) */
  shared?: InvitePoint[];
  sharedTitle?: ReactNode;
  /** Что остаётся только вашим (домашние клиенты, личные записи — F-00-044/045) */
  kept?: InvitePoint[];
  keptTitle?: ReactNode;
  /**
   * Кнопки по порядку: «Отказаться» (ghost), затем «Принять» (primary). Десктоп — в ряд, главная справа;
   * телефон — во всю ширину, главная сверху.
   */
  actions: ReactNode;
  /** Мелкая строка под кнопками: «Выйти из салона можно в любой момент» */
  footnote?: ReactNode;
  className?: string;
}

/**
 * Экран-карточка приглашения мастера в салон (F-00-042: мастер входит в салон только с согласия). Первое, что видит
 * мастер салона: кто зовёт, что увидит салон и что останется его. Честно и коротко — это решение, а не формальность.
 */
export function InviteCard({
  fromName,
  fromImage,
  title,
  subtitle,
  shared,
  sharedTitle,
  kept,
  keptTitle,
  actions,
  footnote,
  className,
}: InviteCardProps) {
  return (
    <section
      data-invite-card=""
      className={cn(
        'mx-auto flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-md',
        className,
      )}
    >
      <header className="flex flex-col items-center gap-3 bg-primary-soft/50 px-5 pt-7 pb-5 text-center">
        <Avatar name={fromName} src={fromImage} size="xl" className="shadow-sm ring-4 ring-surface" />
        <h1 className="text-xl leading-snug font-semibold tracking-tight text-balance text-fg sm:text-2xl">{title}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </header>

      {Boolean(shared?.length || kept?.length) && (
        <div className="grid gap-5 px-5 py-5 sm:grid-cols-2 sm:gap-6">
          {shared && shared.length > 0 && <InvitePointList title={sharedTitle} points={shared} tone="primary" />}
          {kept && kept.length > 0 && <InvitePointList title={keptTitle} points={kept} tone="success" />}
        </div>
      )}

      <footer className="flex flex-col gap-3 border-t border-border px-5 py-4">
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end [&>*]:w-full sm:[&>*]:w-auto">
          {actions}
        </div>
        {footnote && <p className="text-center text-sm text-muted sm:text-right">{footnote}</p>}
      </footer>
    </section>
  );
}

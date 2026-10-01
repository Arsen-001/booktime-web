'use client';

import { ArrowRight, CircleCheck, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { IconButton } from '@/ui/IconButton';

export interface NextStepCardProps {
  /** Что только что получилось, по-человечески: «Услуги добавлены — 6 шт.» */
  doneTitle: ReactNode;
  /** Одна фраза, что это дало: «Клиенты уже видят цены и время» */
  doneText?: ReactNode;
  /** Подпись над следующим шагом; по умолчанию — «Далее» из общих слов */
  nextLabel?: ReactNode;
  /** Следующий шаг: «Укажите часы работы» */
  nextTitle: ReactNode;
  /** Зачем он: «Без часов клиенты не увидят свободное время» */
  nextText?: ReactNode;
  /** Одна главная кнопка следующего шага (LinkButton / Button primary) */
  action: ReactNode;
  /** Второстепенное: «Позже», «Добавить ещё услугу» (Button ghost) */
  secondaryAction?: ReactNode;
  /** Крестик: скрыть карточку (раздел сам решает, вернётся ли она) */
  onDismiss?: () => void;
  className?: string;
}

/**
 * «Готово → что дальше». Показывается сразу после того, как человек сделал шаг первой настройки (добавил первые услуги,
 * задал неделю, пригласил мастера), — вместо тупика «Сохранено» ведёт по цепочке быстрого старта (F-15-017…020,
 * F-00-176). Одна главная кнопка — следующий шаг. Не путать с тостом: тост говорит «сохранено», карточка — куда дальше.
 *
 *   {justAdded && <NextStepCard doneTitle={t('next.servicesDone', { n })} nextTitle={t('next.hours')}
 *     nextText={t('next.hoursWhy')} action={<LinkButton href="/biz/schedule">{t('next.hoursCta')}</LinkButton>} />}
 */
export function NextStepCard({
  doneTitle,
  doneText,
  nextLabel,
  nextTitle,
  nextText,
  action,
  secondaryAction,
  onDismiss,
  className,
}: NextStepCardProps) {
  const tu = useT('ui');
  const tc = useT('common');

  return (
    <section
      data-next-step
      role="status"
      className={cn('overflow-hidden rounded-2xl border border-border bg-surface shadow-sm', className)}
    >
      <header className="flex items-start gap-3 border-b border-success/20 bg-success-soft/60 px-4 py-3 sm:px-5">
        <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-success" />
        <div className="min-w-0 flex-1">
          <p className="text-base leading-snug font-semibold text-fg">{doneTitle}</p>
          {doneText && <p className="mt-0.5 text-sm leading-relaxed text-muted">{doneText}</p>}
        </div>
        {onDismiss && (
          <IconButton
            icon={<X aria-hidden />}
            label={tu('close')}
            size="sm"
            onClick={onDismiss}
            className="-mt-1.5 -mr-2 rounded-full text-muted hover:text-fg"
          />
        )}
      </header>
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            aria-hidden
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-text [&_svg]:size-5"
          >
            <ArrowRight />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-sm font-medium text-primary-text">{nextLabel ?? tc('actions.next')}</p>
            <p className="text-base leading-snug font-semibold text-fg sm:text-lg">{nextTitle}</p>
            {nextText && <p className="mt-1 text-sm leading-relaxed text-muted">{nextText}</p>}
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0 sm:flex-row-reverse sm:items-center [&>*]:w-full sm:[&>*]:w-auto">
          {action}
          {secondaryAction}
        </div>
      </div>
    </section>
  );
}

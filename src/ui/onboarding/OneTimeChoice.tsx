'use client';

import { useState, type ReactNode } from 'react';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { ChoiceCard } from '@/ui/ChoiceCard';
import { Modal } from '@/ui/Modal';
import { useOnce, type OnceOptions } from '@/ui/onboarding/onboardingStore';

export interface OneTimeChoiceOption<V extends string = string> {
  value: V;
  /** «Всё свободно — отмечаю занятое» */
  title: ReactNode;
  /** Пример с точки зрения человека: «Клиенты видят все рабочие часы, пока вы не отметите занятое» */
  description?: ReactNode;
  icon?: ReactNode;
}

export interface OneTimeChoiceProps<V extends string = string> {
  /** Выбранное значение; null / undefined — ещё не выбрано: окно откроется само один раз */
  value: V | null | undefined;
  options: OneTimeChoiceOption<V>[];
  /** Сохранить выбор; может вернуть Promise — кнопка «Готово» покрутит loading */
  onChange: (value: V) => void | Promise<unknown>;
  /** Вопрос в окне: «Как вы работаете?» */
  title: ReactNode;
  /** Одна фраза под вопросом: «Это можно поменять в любой момент» */
  description?: ReactNode;
  /** Подпись тихой строки: «Режим календаря» */
  label: ReactNode;
  /** Текст строки, пока не выбрано: «Режим не выбран» */
  emptyText?: ReactNode;
  /**
   * Ключ «спросить один раз»: закрыли окно без выбора — само больше не откроется у этой персоны
   * (например 'schedule.calendarMode'). Без id окно открывается само каждый раз, пока значение пустое.
   */
  id?: string;
  scope?: OnceOptions['scope'];
  /** Условие автопоказа (данные загружены, нет другого окна). По умолчанию true */
  when?: boolean;
  /** Не открывать окно само — только по «Выбрать / Изменить» */
  manual?: boolean;
  confirmLabel?: ReactNode;
  changeLabel?: ReactNode;
  chooseLabel?: ReactNode;
  /** Кнопка «Позже» в окне (без неё закрыть можно крестиком) */
  laterLabel?: ReactNode;
  /** Скрыть тихую строку (окно — всё равно) */
  hideLine?: boolean;
  className?: string;
}

/**
 * «Спросить один раз — дальше тихая строка». Разовый выбор (режим календаря F-00-051/052, «где принимаю», тип бизнеса)
 * не должен навсегда занимать верх экрана двумя огромными кнопками: пока не выбрано — окно с карточками-вариантами
 * (само, один раз), потом — строка «Режим: всё свободно · Изменить», открывающая то же окно.
 */
export function OneTimeChoice<V extends string = string>({
  value,
  options,
  onChange,
  title,
  description,
  label,
  emptyText,
  id,
  scope,
  when = true,
  manual = false,
  confirmLabel,
  changeLabel,
  chooseLabel,
  laterLabel,
  hideLine = false,
  className,
}: OneTimeChoiceProps<V>) {
  const tc = useT('common');
  const once = useOnce(`choice.${id ?? '_'}`, { scope });
  const [manualOpen, setManualOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [draft, setDraft] = useState<V | null>(null);
  const [saving, setSaving] = useState(false);

  const hasValue = value != null && options.some((o) => o.value === value);
  const autoOpen = !manual && when && !hasValue && !dismissed && (!id || (once.ready && !once.seen));
  const open = manualOpen || autoOpen;
  const selected = draft ?? (hasValue ? value : null);
  const current = options.find((o) => o.value === value);

  const close = () => {
    setManualOpen(false);
    setDraft(null);
    if (!hasValue) {
      setDismissed(true);
      if (id) once.markSeen();
    }
  };

  const confirm = async () => {
    if (selected == null) return;
    if (selected === value) {
      close();
      return;
    }
    setSaving(true);
    try {
      await onChange(selected);
      if (id) once.markSeen();
      setManualOpen(false);
      setDraft(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {!hideLine && (
        <div
          data-one-time-choice={id ?? ''}
          className={cn('flex min-h-10 flex-wrap items-center gap-x-2 gap-y-1 text-sm', className)}
        >
          <span className="text-muted">{label}:</span>
          {current?.icon && (
            <span aria-hidden className="inline-flex text-muted [&_svg]:size-4">
              {current.icon}
            </span>
          )}
          <span className={cn('font-medium', current ? 'text-fg' : 'text-muted')}>
            {current ? current.title : (emptyText ?? '—')}
          </span>
          <span aria-hidden className="text-muted">
            ·
          </span>
          <Button variant="link" size="sm" onClick={() => setManualOpen(true)} aria-haspopup="dialog">
            {current ? (changeLabel ?? tc('actions.edit')) : (chooseLabel ?? tc('actions.select'))}
          </Button>
        </div>
      )}

      <Modal
        open={open}
        onOpenChange={(next) => (next ? setManualOpen(true) : close())}
        title={title}
        description={description}
        size="md"
        footer={
          <>
            {laterLabel && !hasValue && (
              <Button variant="ghost" onClick={close}>
                {laterLabel}
              </Button>
            )}
            <Button onClick={confirm} loading={saving} disabled={selected == null}>
              {confirmLabel ?? tc('actions.done')}
            </Button>
          </>
        }
      >
        <div role="radiogroup" aria-label={typeof label === 'string' ? label : undefined} className="flex flex-col gap-3">
          {options.map((option) => (
            <ChoiceCard
              key={option.value}
              icon={option.icon}
              title={option.title}
              description={option.description}
              selected={selected === option.value}
              onClick={() => setDraft(option.value)}
            />
          ))}
        </div>
      </Modal>
    </>
  );
}

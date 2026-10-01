'use client';

import { CircleCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Modal } from '@/ui/Modal';
import { useOnce, type OnceOptions } from '@/ui/onboarding/onboardingStore';

export interface WelcomePoint {
  icon?: ReactNode;
  title: ReactNode;
  text?: ReactNode;
}

export interface WelcomeDialogProps {
  /** Ключ «показать один раз» — окно откроется само при первом входе персоны. Без id — только open/onOpenChange */
  id?: string;
  scope?: OnceOptions['scope'];
  /** Управление снаружи (например, «Показать приветствие ещё раз») */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Не открывать само, пока false (например, пока идёт другой тур) */
  when?: boolean;
  title: ReactNode;
  description?: ReactNode;
  /** Картинка/схема над списком */
  media?: ReactNode;
  /** 2–4 пункта: что здесь можно и что сделать первым */
  points?: WelcomePoint[];
  /** Подпись главной кнопки («Начать настройку», «Показать, что где») */
  primaryLabel: ReactNode;
  onPrimary?: () => void;
  /** Подпись «позже»; по умолчанию «Закрыть» */
  laterLabel?: ReactNode;
}

/**
 * Приветствие при первом входе роли: кто вы здесь, 2–4 пункта и одна главная кнопка (обычно запускает тур
 * или ведёт к чек-листу). Показывается один раз; «позже» тоже запоминается.
 */
export function WelcomeDialog({
  id,
  scope,
  open: openProp,
  onOpenChange,
  when = true,
  title,
  description,
  media,
  points,
  primaryLabel,
  onPrimary,
  laterLabel,
}: WelcomeDialogProps) {
  const tu = useT('ui');
  const once = useOnce(`welcome.${id ?? '_'}`, { scope });
  const [closed, setClosed] = useState(false);
  const open = openProp ?? Boolean(id && when && once.ready && !once.seen && !closed);

  const close = () => {
    if (id) once.markSeen();
    setClosed(true);
    onOpenChange?.(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => (next ? onOpenChange?.(true) : close())}
      title={title}
      description={description}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            {laterLabel ?? tu('close')}
          </Button>
          <Button
            data-autofocus
            onClick={() => {
              close();
              onPrimary?.();
            }}
          >
            {primaryLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 pt-1">
        {media && <div className="overflow-hidden rounded-xl bg-surface-2">{media}</div>}
        {points && points.length > 0 && (
          <ul className="flex flex-col gap-4">
            {points.map((point, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-text [&_svg]:size-5"
                >
                  {point.icon ?? <CircleCheck />}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5 pt-0.5">
                  <span className="text-base leading-snug font-medium text-fg">{point.title}</span>
                  {point.text && <span className="text-sm leading-relaxed text-muted">{point.text}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

'use client';

import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { useOnce, type OnceOptions } from '@/ui/onboarding/onboardingStore';

/** ask — ещё не спрашивали; denied — человек (или браузер) отказал: объясняем, как без этого, и не просим снова */
export type PermissionPrimerState = 'ask' | 'denied';

export interface PermissionPrimerProps {
  /**
   * Ключ «не спрашивать снова»: «Не сейчас» запоминается у персоны (например 'client.geoPrimer').
   * Без id — управляйте показом сами.
   */
  id?: string;
  scope?: OnceOptions['scope'];
  state?: PermissionPrimerState;
  /** Значок (MapPin для места, Bell для уведомлений) */
  icon: ReactNode;
  /** С точки зрения выгоды: «Показать, кто свободен рядом?» */
  title: ReactNode;
  /** Одна фраза: что даст и что мы НЕ делаем («Место нужно только для поиска, мы его не храним») */
  description?: ReactNode;
  /** Подпись главной кнопки — «Разрешить»; по нажатию зовите системный запрос (navigator.geolocation…) */
  allowLabel: ReactNode;
  onAllow: () => void;
  /** Путь без разрешения — «Выбрать район»; обязателен: отказ не должен быть тупиком */
  alternativeLabel: ReactNode;
  onAlternative: () => void;
  /** Идёт системный запрос — главная кнопка крутит loading */
  loading?: boolean;
  /** state="denied": что делать — «Разрешите доступ к месту в настройках браузера или выберите район» */
  deniedText?: ReactNode;
  className?: string;
}

/**
 * Своя карточка ПЕРЕД системным запросом разрешения (место, уведомления). Браузер спрашивает один раз и «в лоб» —
 * без объяснения человек отказывает, и функция («свободно рядом», напоминания) больше не работает. Здесь: выгода,
 * «Разрешить» → системный запрос, и всегда путь без разрешения. Отказ — спокойный текст, не ошибка.
 */
export function PermissionPrimer({
  id,
  scope,
  state = 'ask',
  icon,
  title,
  description,
  allowLabel,
  onAllow,
  alternativeLabel,
  onAlternative,
  loading = false,
  deniedText,
  className,
}: PermissionPrimerProps) {
  const tu = useT('ui');
  const once = useOnce(`hint.${id ?? '_'}`, { scope });
  if (id && (!once.ready || once.seen)) return null;

  const denied = state === 'denied';

  return (
    <section
      data-permission-primer={id}
      aria-label={typeof title === 'string' ? title : undefined}
      className={cn(
        'relative flex flex-col gap-4 overflow-hidden rounded-2xl border p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5',
        denied ? 'border-border bg-surface-2/60' : 'border-primary/20 bg-surface shadow-sm',
        className,
      )}
    >
      {/* Мягкое пятно цвета акцента за значком — карточка читается как приглашение, а не как ошибка */}
      {!denied && (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-10 -left-10 size-40 rounded-full bg-primary-soft opacity-70 blur-2xl"
        />
      )}
      <div className="relative flex items-start gap-4 sm:flex-1">
        <span
          aria-hidden
          className={cn(
            'inline-flex size-12 shrink-0 items-center justify-center rounded-2xl [&_svg]:size-6',
            denied ? 'bg-surface-3 text-muted' : 'bg-primary text-primary-contrast shadow-sm',
          )}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="text-base leading-snug font-semibold text-fg sm:text-lg">{title}</h2>
          {(denied ? deniedText : description) && (
            <p className="mt-1 text-sm leading-relaxed text-muted sm:text-base">{denied ? deniedText : description}</p>
          )}
        </div>
        {id && (
          <IconButton
            icon={<X aria-hidden />}
            label={tu('close')}
            size="sm"
            onClick={once.markSeen}
            className="-mt-1.5 -mr-2 rounded-full text-muted hover:text-fg sm:hidden"
          />
        )}
      </div>
      <div className="relative flex flex-col gap-2 sm:shrink-0 sm:flex-row-reverse sm:items-center">
        {denied ? (
          <Button variant="outline" onClick={onAlternative}>
            {alternativeLabel}
          </Button>
        ) : (
          <>
            <Button onClick={onAllow} loading={loading} leftIcon={icon}>
              {allowLabel}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (id) once.markSeen();
                onAlternative();
              }}
            >
              {alternativeLabel}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}

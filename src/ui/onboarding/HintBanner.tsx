'use client';

import { Lightbulb, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { IconButton } from '@/ui/IconButton';
import { useOnce, type OnceOptions } from '@/ui/onboarding/onboardingStore';

export type HintTone = 'primary' | 'info' | 'success' | 'warning';

const TONE: Record<HintTone, { box: string; icon: string }> = {
  primary: {
    box: 'border-primary/20 bg-primary-soft/60',
    icon: 'bg-surface text-primary-text',
  },
  info: { box: 'border-info/20 bg-info-soft/70', icon: 'bg-surface text-info' },
  success: {
    box: 'border-success/20 bg-success-soft/70',
    icon: 'bg-surface text-success',
  },
  warning: {
    box: 'border-warning/25 bg-warning-soft/70',
    icon: 'bg-surface text-warning',
  },
};

export interface HintBannerProps {
  /**
   * Ключ «показать один раз»: закрытый крестиком баннер больше не появится у этой персоны
   * (например 'online.linkIsYours'). Без id баннер управляется снаружи через onDismiss.
   */
  id?: string;
  scope?: OnceOptions['scope'];
  title: ReactNode;
  /** Одна-две фразы: зачем и что дальше */
  children?: ReactNode;
  icon?: ReactNode;
  tone?: HintTone;
  /** Кнопка или ссылка действия (Button size="sm" / LinkButton) */
  action?: ReactNode;
  /** Можно закрыть крестиком (по умолчанию да) */
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Подсказка в потоке страницы: мягкий цветной блок со значком, заголовком, фразой и действием.
 * Для «ваша ссылка — только ваша», «окна на неделю не открыты», «профиль не виден в каталоге — осталось 2 шага».
 * Не больше одной на экран; на телефоне действие уходит под текст на всю ширину.
 */
export function HintBanner({
  id,
  scope,
  title,
  children,
  icon,
  tone = 'primary',
  action,
  dismissible = true,
  onDismiss,
  className,
}: HintBannerProps) {
  const t = useT('ui');
  const once = useOnce(`hint.${id ?? '_'}`, { scope });
  if (id && (!once.ready || once.seen)) return null;

  const dismiss = () => {
    if (id) once.markSeen();
    onDismiss?.();
  };

  return (
    <aside
      data-hint={id}
      className={cn(
        'flex items-start gap-3 rounded-xl border p-4 sm:gap-4 sm:p-5',
        TONE[tone].box,
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-flex size-10 shrink-0 items-center justify-center rounded-full shadow-xs [&_svg]:size-5',
          TONE[tone].icon,
        )}
      >
        {icon ?? <Lightbulb />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1 pt-0.5 sm:pt-0">
          <p className="text-base leading-snug font-semibold text-fg">{title}</p>
          {children && <div className="mt-1 text-sm leading-relaxed text-muted sm:text-base">{children}</div>}
        </div>
        {action && <div className="flex w-full shrink-0 sm:w-auto [&>*]:w-full sm:[&>*]:w-auto">{action}</div>}
      </div>
      {dismissible && (
        <IconButton
          icon={<X aria-hidden />}
          label={t('close')}
          size="sm"
          onClick={dismiss}
          className="-mt-1.5 -mr-2 rounded-full text-muted hover:bg-surface/70 hover:text-fg"
        />
      )}
    </aside>
  );
}

import { Eye, EyeOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type PreviewBannerTone = 'ready' | 'notReady';

const TONE: Record<PreviewBannerTone, { box: string; icon: string }> = {
  ready: { box: 'border-success/25 bg-success-soft', icon: 'bg-success text-primary-contrast' },
  notReady: { box: 'border-warning/30 bg-warning-soft', icon: 'bg-surface text-warning' },
};

export interface PreviewBannerProps {
  /**
   * ready — клиенты уже могут записаться по этой ссылке; notReady — страница ещё не опубликована
   * (нет услуг, часов или фото): владелец видит, что будет, а клиент — «скоро откроется»
   */
  tone: PreviewBannerTone;
  /** «Так вашу страницу видят клиенты» / «Клиенты пока не могут записаться» */
  title: ReactNode;
  /** Одна фраза: «Осталось: услуги и часы работы» */
  description?: ReactNode;
  /** Одна кнопка: «Закончить настройку» → /biz/onboarding или «Вернуться в кабинет» */
  action?: ReactNode;
  /** Прилипает к верху страницы при прокрутке (по умолчанию да) */
  sticky?: boolean;
  className?: string;
}

/**
 * Полоса «Так видят клиенты» над своей публичной страницей: владелец или мастер открыл СВОЮ ссылку
 * (/b/<slug>) и должен сразу понять, работает ли она (F-00-006 «ваша ссылка — только ваша», F-00-072). Показывать
 * только сотрудникам этого бизнеса, клиенту — никогда. Черновик бизнеса — не «Страница не найдена», а эта полоса
 * с tone="notReady" и путём «Закончить настройку».
 */
export function PreviewBanner({ tone, title, description, action, sticky = true, className }: PreviewBannerProps) {
  return (
    <aside
      data-preview-banner={tone}
      className={cn(
        'z-20 flex flex-col gap-3 rounded-2xl border p-3.5 shadow-sm sm:flex-row sm:items-center sm:gap-4 sm:p-4',
        TONE[tone].box,
        sticky && 'sticky top-[calc(env(safe-area-inset-top)+0.5rem)]',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          aria-hidden
          className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-full [&_svg]:size-5', TONE[tone].icon)}
        >
          {tone === 'ready' ? <Eye /> : <EyeOff />}
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-base leading-snug font-semibold text-fg">{title}</p>
          {description && <p className="mt-0.5 text-sm leading-relaxed text-muted">{description}</p>}
        </div>
      </div>
      {action && <div className="flex w-full shrink-0 sm:w-auto [&>*]:w-full sm:[&>*]:w-auto">{action}</div>}
    </aside>
  );
}

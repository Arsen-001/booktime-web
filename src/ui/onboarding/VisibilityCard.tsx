import { ChevronRight, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface VisibilityGap {
  id: string;
  /** Чего не хватает, с точки зрения человека: «Нет свободных окон на неделю» */
  title: ReactNode;
  /** Куда идти, чтобы исправить */
  href?: string;
  onClick?: () => void;
  /** Подпись действия справа («Открыть окна»); без неё — стрелка */
  actionLabel?: ReactNode;
}

export interface VisibilityCardProps {
  /** Виден ли профиль клиентам в каталоге (из правила ядра staffClientVisibility / isStaffInCatalog) */
  visible: boolean;
  /** «Вас видно в каталоге» / «Пока вас не видно в каталоге» */
  title: ReactNode;
  /** Одна фраза: visible — что это значит; нет — «Клиенты по вашей ссылке записываются, а в поиске вас нет» */
  description?: ReactNode;
  /** Чего не хватает (только когда не виден); каждый пункт ведёт на экран, где это исправить */
  gaps?: VisibilityGap[];
  /** Справа в шапке — ссылка «Посмотреть, как видят клиенты» */
  action?: ReactNode;
  className?: string;
}

/**
 * «Видно ли меня в каталоге» (F-00-072: пустые профили в каталоге не показываем). Владелец и мастер должны понять
 * это за 3 секунды: зелёная плашка «вас видно» или спокойная карточка «пока не видно» со списком того, чего не хватает,
 * — каждый пункт ведёт исправлять. Причины берите из ядра (`staffClientVisibility(...).reasons`), не считайте сами.
 */
export function VisibilityCard({ visible, title, description, gaps = [], action, className }: VisibilityCardProps) {
  const open = !visible && gaps.length > 0;

  return (
    <section
      data-visibility={visible ? 'visible' : 'hidden'}
      className={cn(
        'overflow-hidden rounded-2xl border',
        visible ? 'border-success/25 bg-success-soft/60' : 'border-border bg-surface shadow-xs',
        className,
      )}
    >
      <header className="flex items-start gap-3 p-4 sm:gap-4 sm:p-5">
        <span
          aria-hidden
          className={cn(
            'relative inline-flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-5',
            visible ? 'bg-success text-primary-contrast' : 'bg-warning-soft text-warning',
          )}
        >
          {visible ? <Eye /> : <EyeOff />}
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="text-base leading-snug font-semibold text-fg sm:text-lg">{title}</h2>
          {description && <p className="mt-1 text-sm leading-relaxed text-muted sm:text-base">{description}</p>}
        </div>
        {action && <div className="hidden shrink-0 self-center sm:block">{action}</div>}
      </header>

      {open && (
        <ul className="flex flex-col border-t border-border">
          {gaps.map((gap) => {
            const row = (
              <>
                <span aria-hidden className="size-2 shrink-0 rounded-full bg-warning" />
                <span className="min-w-0 flex-1 text-base leading-snug text-fg">{gap.title}</span>
                {gap.actionLabel ? (
                  <span className="shrink-0 text-sm font-medium text-primary-text">{gap.actionLabel}</span>
                ) : null}
                {(gap.href || gap.onClick) && <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />}
              </>
            );
            const cls =
              'flex min-h-13 w-full items-center gap-3 px-4 py-3 text-left sm:px-5 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus';
            return (
              <li key={gap.id} className="border-b border-border last:border-b-0">
                {gap.href ? (
                  <Link href={gap.href} className={cls}>
                    {row}
                  </Link>
                ) : gap.onClick ? (
                  <button type="button" onClick={gap.onClick} className={cls}>
                    {row}
                  </button>
                ) : (
                  <div className={cn(cls, 'hover:bg-transparent')}>{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {action && <div className="border-t border-border/60 px-4 py-2 sm:hidden">{action}</div>}
    </section>
  );
}

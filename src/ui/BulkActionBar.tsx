'use client';

import { MoreHorizontal, X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { DropdownMenu, type DropdownMenuItem } from '@/ui/DropdownMenu';
import { IconButton } from '@/ui/IconButton';

export interface BulkActionBarProps {
  /** Сколько выбрано; при 0 панель не показывается */
  count: number;
  /** Снять выбор */
  onClear: () => void;
  /** 1–2 главные кнопки (Button size="sm") */
  actions?: ReactNode;
  /** Остальные действия — в меню «⋯» */
  moreItems?: DropdownMenuItem[];
  className?: string;
}

/**
 * Панель действий над выбранными строками (клиенты, записи, склад, рассылки). Появляется, когда что-то выбрано:
 * на десктопе — пилюлей по центру у низа видимой области, на телефоне — на всю ширину над нижними вкладками.
 * Ставьте сразу после списка/таблицы — она липкая внутри своего контейнера.
 */
export function BulkActionBar({ count, onClear, actions, moreItems, className }: BulkActionBarProps) {
  const t = useT('ui');
  const ref = useRef<HTMLDivElement>(null);
  const shown = count > 0;

  // Высота панели → --bulk-bar-h: тосты встают выше неё, а не ложатся сверху
  useEffect(() => {
    const el = ref.current;
    if (!shown || !el) return;
    const root = document.documentElement;
    const ro = new ResizeObserver(() => root.style.setProperty('--bulk-bar-h', `${Math.round(el.offsetHeight + 12)}px`));
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--bulk-bar-h');
    };
  }, [shown]);

  if (!shown) return null;
  return (
    <div
      ref={ref}
      role="region"
      aria-label={t('table.selected', { count })}
      data-bulk-action-bar=""
      className={cn(
        'sticky z-20 mx-auto flex w-full animate-slide-up-soft items-center gap-2 rounded-2xl bg-fg py-2 pr-2 pl-4 text-bg shadow-xl',
        'bottom-[calc(env(safe-area-inset-bottom,0px)+var(--app-bottom-inset)+var(--sticky-bar-h)+0.75rem)] md:bottom-4 md:w-fit md:max-w-full',
        className,
      )}
    >
      <p
        aria-live="polite"
        className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold tabular-nums md:flex-none md:pr-2"
      >
        {t('table.selected', { count })}
      </p>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
      {moreItems && moreItems.length > 0 && (
        <DropdownMenu
          items={moreItems}
          label={t('bulk.more')}
          trigger={(p) => (
            <IconButton
              {...p}
              icon={<MoreHorizontal aria-hidden />}
              label={t('bulk.more')}
              className="text-bg hover:bg-bg/15 active:bg-bg/25"
            />
          )}
        />
      )}
      <span aria-hidden className="mx-0.5 h-6 w-px bg-bg/25" />
      <IconButton
        icon={<X aria-hidden />}
        label={t('bulk.clear')}
        onClick={onClear}
        className="text-bg hover:bg-bg/15 active:bg-bg/25"
      />
    </div>
  );
}

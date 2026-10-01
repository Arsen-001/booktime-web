'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Portal } from '@/ui/Portal';
import { useIsClient } from '@/ui/hooks/useIsClient';
import { useIsMobile } from '@/ui/hooks/useMediaQuery';

export type StickyActionBarDesktop = 'inline' | 'sticky' | 'hidden';

export interface StickyActionBarProps {
  /** Кнопки: одна primary (главное действие) и, если нужно, одна secondary слева от неё */
  children: ReactNode;
  /** Итог слева: «1 услуга · 45 мин · 6 000 ֏» (до двух строк) */
  summary?: ReactNode;
  /**
   * Десктоп: inline — обычный ряд справа в конце содержимого (по умолчанию); sticky — прилипает к низу видимой области
   * карточкой; hidden — не показывать (экран сам ставит кнопку в колонку).
   */
  desktop?: StickyActionBarDesktop;
  className?: string;
  /** Подпись области для скринридера */
  'aria-label'?: string;
}

/**
 * Главное действие внизу у большого пальца (§0).
 *
 * Телефон: панель прижата к низу ОКНА всегда (и когда содержимого меньше экрана), над нижними вкладками клиента и
 * «чёлкой»; содержимому страницы сама добавляет нижний отступ под свою высоту. Кнопки тянутся: главная — шире.
 * Десктоп — см. `desktop`.
 *
 *   <StickyActionBar summary={<>1 услуга · 45 мин · <b>6 000 ֏</b></>}>
 *     <Button>Продолжить</Button>
 *   </StickyActionBar>
 */
export function StickyActionBar({
  children,
  summary,
  desktop = 'inline',
  className,
  'aria-label': ariaLabel,
}: StickyActionBarProps) {
  const isMobile = useIsMobile();
  const isClient = useIsClient();
  // Панель пришла в HTML с сервера (первый кадр) — после гидрации она переезжает в Portal без анимации появления:
  // для человека это та же панель на том же месте. Появилась позже (переход, шаг мастера) — выезжает как обычно
  const [fromServer] = useState(() => !isClient);
  const barRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  // Высота панели → отступ под ней в содержимом и --sticky-bar-h для тостов и плавающей кнопки
  useEffect(() => {
    const el = barRef.current;
    if (!isMobile || !el) return;
    const root = document.documentElement;
    const ro = new ResizeObserver(() => {
      const h = Math.round(el.getBoundingClientRect().height);
      setHeight(h);
      root.style.setProperty('--sticky-bar-h', `${h}px`);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--sticky-bar-h');
    };
  }, [isMobile]);

  const body = (
    <>
      {summary && (
        <div className="min-w-0 flex-1 text-sm leading-snug text-muted [&_b]:font-semibold [&_b]:text-fg [&_strong]:font-semibold [&_strong]:text-fg">
          <div className="line-clamp-2">{summary}</div>
        </div>
      )}
      <div
        className={cn(
          // Длинная подпись (армянский, немецкий) переносится внутри кнопки, а не выталкивает её за край экрана
          'flex min-w-0 items-center gap-2 [&>*]:min-w-0 [&>*]:whitespace-normal [&>*]:text-center [&>*]:leading-tight',
          'max-md:[&>*]:h-auto max-md:[&>*]:min-h-11 max-md:[&>*]:py-1.5',
          summary ? 'md:shrink-0' : 'flex-1',
          // Телефон без итога: кнопки делят строку, главная (последняя) — вдвое шире
          !summary && 'max-md:[&>*]:flex-1 max-md:[&>*:last-child:not(:first-child)]:flex-[2]',
          desktop !== 'hidden' && 'md:flex-none',
        )}
      >
        {children}
      </div>
    </>
  );

  if (isMobile) {
    const bar = (
      <div
        ref={barRef}
        role="region"
        aria-label={ariaLabel}
        data-sticky-action-bar=""
        className={cn(
          'fixed inset-x-0 z-30 flex items-center gap-3 border-t border-border bg-surface/95 px-4 pt-3 shadow-[0_-8px_24px_-12px_var(--overlay)] backdrop-blur-lg',
          !fromServer && 'animate-slide-up-soft',
          'bottom-[var(--app-bottom-inset)] pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]',
          className,
        )}
      >
        {body}
      </div>
    );
    return (
      <>
        {/* Место под панелью, чтобы последняя строка содержимого не пряталась под ней */}
        <div aria-hidden style={{ height }} />
        {/* Сервер Portal не рисует — там панель прямо на месте (fixed, предков с transform у страниц нет): она видна
            с первого кадра, а не появляется после загрузки скриптов (DESIGN.md → «The skeleton IS the page») */}
        {isClient ? <Portal>{bar}</Portal> : bar}
      </>
    );
  }

  if (desktop === 'hidden') return null;

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-sticky-action-bar=""
      className={cn(
        'flex items-center justify-end gap-4',
        desktop === 'sticky' &&
          'sticky bottom-4 z-20 rounded-2xl border border-border bg-surface/95 px-5 py-3 shadow-lg backdrop-blur-lg',
        desktop === 'inline' && 'pt-2',
        className,
      )}
    >
      {body}
    </div>
  );
}

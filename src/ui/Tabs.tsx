'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useControllableState } from '@/ui/hooks/useControllableState';
import { scrollEdgeClass, useScrollEdges } from '@/ui/hooks/useScrollEdges';
import { useSlidingIndicator } from '@/ui/hooks/useSlidingIndicator';

// Маска края под стрелкой (полные имена — чтобы Tailwind их нашёл)
const ARROW_FADE: Record<string, string> = {
  'fade-x-start': 'fade-x-arrow-start',
  'fade-x-end': 'fade-x-arrow-end',
  'fade-x-both': 'fade-x-arrow-both',
};

export interface TabItem {
  value: string;
  label: ReactNode;
  /** Число или любой элемент справа от подписи */
  badge?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export type TabsVariant = 'line' | 'pill';

const LIST: Record<TabsVariant, string> = {
  line: 'gap-1 border-b border-border',
  pill: 'gap-2',
};

const TAB: Record<TabsVariant, { base: string; on: string; off: string }> = {
  line: {
    base: 'min-h-11 px-3 -mb-px border-b-2 rounded-t-lg',
    // Полоску выбранной рисует скользящий индикатор; своя рамка — только до гидратации (data-slide ещё нет)
    on: 'border-primary text-fg group-data-[slide]/tabs:border-transparent',
    off: 'border-transparent text-muted hover:border-border-strong/50 hover:bg-surface-2/60 hover:text-fg',
  },
  pill: {
    base: 'min-h-10 px-4 rounded-full',
    on: 'bg-primary-soft text-primary-text group-data-[slide]/tabs:bg-transparent',
    off: 'text-muted hover:bg-surface-2 hover:text-fg active:bg-surface-3',
  },
};

export interface TabsProps {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Содержимое вкладок по value; можно не передавать и рисовать панель самому */
  panels?: Record<string, ReactNode>;
  /**
   * Панели, которые уже открывали, остаются в дереве (скрыты через hidden): возврат на вкладку показывает её
   * сразу, без пересборки таблицы и без скелетона. По умолчанию — нет (невыбранная панель не в DOM).
   */
  keepMounted?: boolean;
  variant?: TabsVariant;
  className?: string;
  classNames?: { list?: string; tab?: string; panel?: string };
  'aria-label'?: string;
}

/** Индикатор выбранной вкладки: полоска снизу (line) или подложка (pill); переезжает WAAPI-анимацией */
const INDICATOR: Record<TabsVariant, string> = {
  line: 'bottom-0 h-0.5 rounded-full bg-primary',
  pill: 'inset-y-0 rounded-full bg-primary-soft',
};

/** Вкладки. На телефоне список прокручивается по горизонтали; индикатор выбранной скользит к новой */
export function Tabs({
  items,
  value,
  defaultValue,
  onValueChange,
  panels,
  keepMounted = false,
  variant = 'line',
  className,
  classNames,
  ...aria
}: TabsProps) {
  const id = useId();
  const [current, setCurrent] = useControllableState(value, defaultValue ?? items[0]?.value ?? '', onValueChange);
  // keepMounted: какие панели уже показывали (запоминаем в рендере — без лишнего кадра с пустой панелью)
  const [visited, setVisited] = useState<readonly string[]>([current]);
  if (keepMounted && !visited.includes(current)) setVisited([...visited, current]);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  // Не влезли — затухающий край показывает, что вкладки листаются
  const edges = useScrollEdges(listRef);

  // Выбранная вкладка — в середине полосы (соседи видны с обеих сторон, край не режет её посреди слова).
  // Двигаем только саму полосу — страницу не прокручиваем.
  const currentIndex = items.findIndex((it) => it.value === current);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  useSlidingIndicator(listRef, indicatorRef, refs, currentIndex, items.map((it) => it.value).join('|'));
  useEffect(() => {
    const list = listRef.current;
    const el = refs.current[currentIndex];
    if (!list || !el || list.scrollWidth <= list.clientWidth) return;
    const lr = list.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    list.scrollLeft += er.left + er.width / 2 - (lr.left + lr.width / 2);
  }, [currentIndex]);

  // Стрелка у края: листает на 70 % ширины (на десктопе мышью полосу иначе не пролистать)
  const scrollList = (dir: 1 | -1) => {
    const list = listRef.current;
    list?.scrollBy({ left: dir * list.clientWidth * 0.7, behavior: 'smooth' });
  };
  const tabId = (v: string) => `${id}-tab-${v}`;
  const panelId = (v: string) => `${id}-panel-${v}`;

  const select = (i: number) => {
    setCurrent(items[i].value);
    const el = refs.current[i];
    el?.focus({ preventScroll: true });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const start = items.findIndex((it) => it.value === current);
    let next = -1;
    if (e.key === 'Home') next = items.findIndex((it) => !it.disabled);
    else if (e.key === 'End') next = items.map((it) => !it.disabled).lastIndexOf(true);
    else {
      const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!dir) return;
      for (let step = 1; step <= items.length; step++) {
        const i = (start + dir * step + items.length) % items.length;
        if (!items[i].disabled) {
          next = i;
          break;
        }
      }
    }
    if (next >= 0) {
      e.preventDefault();
      select(next);
    }
  };

  const style = TAB[variant];

  const arrow = (dir: 1 | -1) => {
    const visible = dir === 1 ? edges.end : edges.start;
    const Icon = dir === 1 ? ChevronRight : ChevronLeft;
    return (
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={() => scrollList(dir)}
        className={cn(
          'absolute top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-surface text-muted shadow-sm transition-opacity duration-150 hover:text-fg active:scale-95',
          dir === 1 ? 'right-0' : 'left-0',
          variant === 'line' && '-mt-px',
          visible ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        <Icon className="size-4" />
      </button>
    );
  };

  return (
    <div className={className}>
      <div className="relative">
        <div
          ref={listRef}
          role="tablist"
          onKeyDown={onKeyDown}
          className={cn(
            'group/tabs no-scrollbar relative flex scroll-px-12 overflow-x-auto scroll-smooth',
            LIST[variant],
            // Под круглой стрелкой текст уже погашен, дальше проявляется плавно — без «иента» на краю круга
            ARROW_FADE[scrollEdgeClass(edges) ?? ''],
            // Стрелка (size-10, absolute) не двигает поток — без своего отступа она ложится поверх подписи
            // соседней вкладки, а не только затемняет её фейдом. Резервируем под неё место с той стороны,
            // где она сейчас показана, чтобы под кругом не оставалось кликабельного/читаемого текста.
            edges.start && 'pl-11',
            edges.end && 'pr-11',
            classNames?.list,
          )}
          {...aria}
        >
          {items.map((it, i) => {
            const selected = it.value === current;
            return (
              <button
                key={it.value}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                id={tabId(it.value)}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panels ? panelId(it.value) : undefined}
                tabIndex={selected ? 0 : -1}
                disabled={it.disabled}
                onClick={() => select(i)}
                className={cn(
                  'relative z-[1] inline-flex shrink-0 items-center gap-2 text-base font-medium whitespace-nowrap transition-colors duration-150 disabled:opacity-50 [&_svg]:size-5',
                  style.base,
                  selected ? style.on : style.off,
                  classNames?.tab,
                )}
              >
                {it.icon}
                {it.label}
                {it.badge !== undefined && it.badge !== null && (
                  <span
                    className={cn(
                      'inline-flex min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold leading-6',
                      selected ? 'bg-primary text-primary-contrast' : 'bg-surface-3 text-fg',
                    )}
                  >
                    {it.badge}
                  </span>
                )}
              </button>
            );
          })}
          <span
            ref={indicatorRef}
            aria-hidden
            className={cn('pointer-events-none absolute left-0 origin-left opacity-0', INDICATOR[variant])}
          />
        </div>
        {arrow(-1)}
        {arrow(1)}
      </div>
      {panels &&
        items.map((it) =>
          it.value === current || (keepMounted && visited.includes(it.value)) ? (
            <div
              key={it.value}
              id={panelId(it.value)}
              role="tabpanel"
              aria-labelledby={tabId(it.value)}
              hidden={it.value !== current}
              tabIndex={0}
              className={cn('pt-4 focus-visible:outline-offset-4', classNames?.panel)}
            >
              {panels[it.value]}
            </div>
          ) : null,
        )}
    </div>
  );
}

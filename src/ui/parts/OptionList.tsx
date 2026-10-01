'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Check, SearchX } from 'lucide-react';
import { cn } from '@/lib/cn';
import { normalizeSearch } from '@/lib/text';
import { useT } from '@/i18n/useT';
import { SearchInput } from '@/ui/SearchInput';

export interface OptionListItem {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface OptionListProps {
  options: OptionListItem[];
  selected: string;
  onSelect: (value: string) => void;
  /** Поле поиска над списком (длинные списки) */
  searchable: boolean;
  /** Подпись списка для скринридера */
  label?: string;
  /** Внутри нижней шторки на телефоне: строки крупнее, фокус не прыгает в поиск (не выскакивает клавиатура) */
  inSheet: boolean;
}

/** Сколько ждать между буквами, чтобы «ан» искало «Анна», а не два раза «а» */
const TYPEAHEAD_MS = 600;

/**
 * Список вариантов для Select: роль listbox, стрелки ↑↓, Home/End, Enter/Пробел, поиск по первым буквам,
 * поле поиска для длинных списков. Выбранный вариант — галочкой и цветом.
 */
export function OptionList({ options, selected, onSelect, searchable, label, inSheet }: OptionListProps) {
  const t = useT('ui');
  const baseId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const [query, setQuery] = useState('');

  const q = normalizeSearch(query);
  const filtered = q ? options.filter((o) => normalizeSearch(o.label).includes(q)) : options;
  const [active, setActive] = useState(() => Math.max(0, options.findIndex((o) => o.value === selected)));
  const optionId = (i: number) => `${baseId}-o${i}`;

  // При открытии: фокус в поиск (десктоп) или на список; выбранный вариант — в видимой области
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const input = searchRef.current?.querySelector('input');
      if (input && !inSheet) input.focus({ preventScroll: true });
      else listRef.current?.focus({ preventScroll: true });
      listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'center' });
    });
    return () => cancelAnimationFrame(frame);
  }, [inSheet]);

  // Активный вариант держим в видимой области при движении стрелками
  useEffect(() => {
    document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' });
    // optionId стабилен в пределах компонента
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const step = (from: number, dir: 1 | -1) => {
    const n = filtered.length;
    for (let k = 1; k <= n; k++) {
      const i = (from + dir * k + n * k) % n;
      if (!filtered[i]?.disabled) return i;
    }
    return from;
  };

  const choose = (i: number) => {
    const o = filtered[i];
    if (!o || o.disabled) return;
    onSelect(o.value);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const inSearch = (e.target as HTMLElement).tagName === 'INPUT';
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => step(i, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => step(i, -1));
    } else if (e.key === 'Home' && !inSearch) {
      e.preventDefault();
      setActive(step(-1, 1));
    } else if (e.key === 'End' && !inSearch) {
      e.preventDefault();
      setActive(step(filtered.length, -1));
    } else if (e.key === 'Enter' || (e.key === ' ' && !inSearch)) {
      e.preventDefault();
      choose(active);
    } else if (!inSearch && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      // Поиск по первым буквам, как у системного списка
      const now = e.timeStamp;
      const text = (now - typed.current.at < TYPEAHEAD_MS ? typed.current.text : '') + e.key.toLowerCase();
      typed.current = { text, at: now };
      const i = filtered.findIndex((o) => !o.disabled && normalizeSearch(o.label).startsWith(normalizeSearch(text)));
      if (i >= 0) setActive(i);
    }
  };

  return (
    <div onKeyDown={onKeyDown} className="flex min-h-0 flex-1 flex-col">
      {searchable && (
        <div ref={searchRef} data-option-search="" className={cn('shrink-0', inSheet ? 'sticky top-0 z-[1] bg-surface pb-3' : 'p-1 pb-2')}>
          <SearchInput
            size={inSheet ? 'md' : 'sm'}
            value={query}
            onValueChange={(v) => {
              setQuery(v);
              setActive(0);
            }}
            placeholder={t('select.searchPlaceholder')}
            aria-label={t('select.searchPlaceholder')}
            aria-controls={`${baseId}-list`}
            aria-activedescendant={filtered.length ? optionId(active) : undefined}
            autoComplete="off"
          />
        </div>
      )}
      <ul
        ref={listRef}
        id={`${baseId}-list`}
        role="listbox"
        aria-label={label}
        tabIndex={-1}
        aria-activedescendant={filtered.length ? optionId(active) : undefined}
        className={cn(
          'min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none scrollbar-thin',
          inSheet ? 'flex flex-col gap-0.5' : 'max-h-72 p-0.5',
        )}
      >
        {filtered.map((o, i) => {
          const isSelected = o.value === selected;
          return (
            <li
              key={o.value}
              id={optionId(i)}
              role="option"
              aria-selected={isSelected}
              aria-disabled={o.disabled || undefined}
              onMouseDown={(e) => e.preventDefault()}
              onPointerMove={() => !o.disabled && active !== i && setActive(i)}
              onClick={() => choose(i)}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg px-3 text-left transition-colors duration-100',
                inSheet ? 'min-h-12 py-2.5 text-base' : 'min-h-10 py-2 text-[0.9375rem]',
                // В шторке палец выбирает сразу — «активную» строку не подсвечиваем, только выбранную
                inSheet ? isSelected && 'bg-primary-soft' : i === active && 'bg-surface-2',
                inSheet && 'active:bg-surface-2',
                isSelected ? 'font-medium text-primary-text' : 'text-fg',
                o.disabled && 'cursor-not-allowed opacity-45',
              )}
            >
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              <Check
                aria-hidden
                strokeWidth={2.5}
                className={cn('size-4 shrink-0 text-primary-text', !isSelected && 'invisible')}
              />
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li role="presentation" className="flex flex-col items-center gap-2 px-3 py-6 text-center text-sm text-muted">
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-surface-2">
              <SearchX aria-hidden className="size-5" />
            </span>
            {query ? t('select.noOptions') : t('select.empty')}
          </li>
        )}
      </ul>
    </div>
  );
}

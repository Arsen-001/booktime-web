'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Check, Plus } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { cn } from '@/lib/cn';
import { normalizeSearch } from '@/lib/text';
import { useT } from '@/i18n/useT';
import { FIELD_BASE, FIELD_BORDER, FIELD_HEIGHT, type FieldSize } from '@/ui/Input';
import { DropdownChevron } from '@/ui/DropdownChevron';
import { EmptyState } from '@/ui/EmptyState';
import { PRESETS, useMotionPreset } from '@/ui/motion';
import { Spinner } from '@/ui/Spinner';
import { useControllableState } from '@/ui/hooks/useControllableState';

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null, option: ComboboxOption | null) => void;
  /** Текст в поле меняется (для поиска на сервере) */
  onInputChange?: (text: string) => void;
  placeholder?: string;
  /** Показать «Добавить «…»», если точного совпадения нет */
  allowCreate?: boolean;
  onCreate?: (text: string) => void;
  loading?: boolean;
  emptyText?: string;
  /** Своя фильтрация; по умолчанию — вхождение без учёта регистра и ё/е в label и description */
  filter?: (option: ComboboxOption, query: string) => boolean;
  invalid?: boolean;
  disabled?: boolean;
  size?: FieldSize;
  id?: string;
  name?: string;
  className?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-label'?: string;
}

function defaultFilter(option: ComboboxOption, query: string): boolean {
  const q = normalizeSearch(query);
  return normalizeSearch(option.label).includes(q) || normalizeSearch(option.description ?? '').includes(q);
}

/** Поле с поиском по мере ввода и списком вариантов под ним */
export function Combobox({
  options,
  value,
  defaultValue = null,
  onValueChange,
  onInputChange,
  placeholder,
  allowCreate = false,
  onCreate,
  loading = false,
  emptyText,
  filter = defaultFilter,
  invalid = false,
  disabled = false,
  size = 'md',
  id,
  name,
  className,
  ...aria
}: ComboboxProps) {
  const t = useT('ui');
  const autoId = useId();
  const inputId = id ?? `${autoId}-input`;
  const listId = `${autoId}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [selected, setSelected] = useControllableState<string | null>(value, defaultValue, (v) =>
    onValueChange?.(v, options.find((o) => o.value === v) ?? null),
  );
  const [open, setOpen] = useState(false);
  const listMotion = useMotionPreset(PRESETS.popover);
  /** null — пользователь не печатает, в поле показывается выбранный вариант */
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  const selectedOption = options.find((o) => o.value === selected) ?? null;
  const text = query ?? selectedOption?.label ?? '';
  const filtered = query ? options.filter((o) => filter(o, query)) : options;
  const trimmed = (query ?? '').trim();
  const canCreate =
    allowCreate && trimmed !== '' && !options.some((o) => normalizeSearch(o.label) === normalizeSearch(trimmed));
  const itemCount = filtered.length + (canCreate ? 1 : 0);
  const optionId = (i: number) => `${autoId}-opt-${i}`;

  // Клик вне — закрыть
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  // Держать активный вариант в видимой области списка
  useEffect(() => {
    if (open) document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' });
    // optionId стабилен в пределах компонента
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open]);

  const choose = (option: ComboboxOption) => {
    setSelected(option.value);
    setQuery(null);
    setOpen(false);
  };

  const create = () => {
    onCreate?.(trimmed);
    setQuery(null);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((i) => (itemCount ? (i + 1) % itemCount : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((i) => (itemCount ? (i - 1 + itemCount) % itemCount : 0));
    } else if (e.key === 'Enter') {
      if (!open) return;
      e.preventDefault();
      if (active < filtered.length) choose(filtered[active]);
      else if (canCreate) create();
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setQuery(null);
      }
    }
  };

  return (
    <div ref={rootRef} className={cn('relative w-full', className)}>
      <input
        ref={inputRef}
        id={inputId}
        name={name}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && itemCount ? optionId(active) : undefined}
        aria-invalid={invalid || aria['aria-invalid'] || undefined}
        aria-describedby={aria['aria-describedby']}
        aria-label={aria['aria-label']}
        disabled={disabled}
        placeholder={placeholder ?? t('combobox.placeholder')}
        value={text}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
          onInputChange?.(e.target.value);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={cn(FIELD_BASE, FIELD_BORDER[invalid ? 'invalid' : 'normal'], FIELD_HEIGHT[size], 'pl-3.5 pr-11')}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-muted">
        {loading ? <Spinner size="sm" /> : <DropdownChevron open={open} />}
      </span>

      <AnimatePresence>
        {open && (
          <m.ul
            {...listMotion}
            id={listId}
            role="listbox"
            className="absolute left-0 right-0 top-full z-[60] mt-1.5 max-h-72 origin-top overflow-auto rounded-xl border border-border bg-surface p-1 shadow-lg scrollbar-thin"
          >
            {filtered.map((o, i) => {
              const isSelected = o.value === selected;
              return (
                <li
                  key={o.value}
                  id={optionId(i)}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(o)}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-base',
                    i === active && 'bg-surface-2',
                  )}
                >
                  {o.icon && <span className="shrink-0 text-muted [&_svg]:size-5">{o.icon}</span>}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-fg">{o.label}</span>
                    {o.description && <span className="block truncate text-sm text-muted">{o.description}</span>}
                  </span>
                  {isSelected && <Check aria-hidden className="size-5 shrink-0 text-primary-text" />}
                </li>
              );
            })}
            {canCreate && (
              <li
                id={optionId(filtered.length)}
                role="option"
                aria-selected={false}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(filtered.length)}
                onClick={create}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-base text-primary-text',
                  active === filtered.length && 'bg-surface-2',
                )}
              >
                <Plus aria-hidden className="size-5 shrink-0" />
                <span className="truncate">{t('combobox.create', { value: trimmed })}</span>
              </li>
            )}
            {itemCount === 0 && !loading && (
              <li role="presentation">
                <EmptyState variant="inline" kind="search" title={emptyText ?? t('combobox.empty')} />
              </li>
            )}
            {itemCount === 0 && loading && (
              <li className="flex items-center gap-2 px-3 py-3 text-base text-muted" role="presentation">
                <Spinner size="sm" /> {t('loading')}
              </li>
            )}
          </m.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

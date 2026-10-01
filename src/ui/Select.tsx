'use client';

import {
  useRef,
  useState,
  type ChangeEvent,
  type ComponentPropsWithRef,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
} from 'react';
import { cn } from '@/lib/cn';
import { DropdownChevron } from '@/ui/DropdownChevron';
import { useT } from '@/i18n/useT';
import { FIELD_BASE, FIELD_BORDER, FIELD_HEIGHT, type FieldSize } from '@/ui/Input';
import { Popover } from '@/ui/Popover';
import { OptionList } from '@/ui/parts/OptionList';
import { useControllableState } from '@/ui/hooks/useControllableState';
import { useIsMobile } from '@/ui/hooks/useMediaQuery';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<
  ComponentPropsWithRef<'select'>,
  'size' | 'value' | 'defaultValue' | 'children'
> {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Подсказка, пока ничего не выбрано (значение '') */
  placeholder?: string;
  invalid?: boolean;
  size?: FieldSize;
  /** className — на обёртку; classNames.select — на само поле (кнопку) */
  classNames?: { root?: string; select?: string };
  /** Поле поиска в списке; по умолчанию — когда вариантов больше 8 */
  searchable?: boolean;
}

/** С какого числа вариантов в списке появляется поиск */
const SEARCH_FROM = 8;

/**
 * Выпадающий список — НАШ, не системный: на десктопе — панель у поля (с поиском, если вариантов больше 8),
 * на телефоне — нижняя шторка с крупными строками 48 px. Клавиатура: ↑↓ / Enter / Пробел открывают, в списке —
 * стрелки, Home/End, Enter, Esc, поиск по первым буквам.
 *
 * Для форм и старого кода рядом лежит скрытый системный `<select>` с тем же значением: `ref`, `name`, `form`
 * и `onChange(event)` работают как раньше (event.target.value — новое значение).
 */
export function Select({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  invalid = false,
  size = 'md',
  className,
  classNames,
  searchable,
  onChange,
  ref,
  name,
  form,
  required,
  disabled,
  autoComplete,
  ...rest
}: SelectProps) {
  const t = useT('ui');
  const isMobile = useIsMobile();
  const [current, setCurrent] = useControllableState(value, defaultValue ?? '', onValueChange);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const nativeRef = useRef<HTMLSelectElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const selectedOption = options.find((o) => o.value === current);
  const empty = !selectedOption;
  const shownPlaceholder = placeholder ?? t('select.placeholder');

  // Выбор из нашего списка: значение → скрытый select → onChange раздела с «настоящим» target
  const commit = (next: string) => {
    setCurrent(next);
    const el = nativeRef.current;
    if (el && onChange) {
      el.value = next;
      onChange({ target: el, currentTarget: el } as ChangeEvent<HTMLSelectElement>);
    }
  };

  // Подпись поля (FormField / aria-label) — заголовок шторки на телефоне
  const findTitle = () => {
    const btn = buttonRef.current;
    const fromLabel = btn?.id ? document.querySelector(`label[for="${CSS.escape(btn.id)}"]`)?.textContent : null;
    return (fromLabel || rest['aria-label'] || shownPlaceholder).replace(/\s*\*\s*$/, '').trim();
  };

  // Кнопке достаются aria-*, data-*, id, обработчики фокуса и клавиш; типы — от select, поведение то же
  const buttonRest = rest as unknown as ComponentPropsWithoutRef<'button'>;

  return (
    <div className={cn('relative w-full', className, classNames?.root)}>
      {/* Носитель значения для форм и старого кода; невидим, не в порядке Tab, скринридеру не виден */}
      <select
        ref={(el) => {
          nativeRef.current = el;
          if (typeof ref === 'function') ref(el);
          else if (ref) ref.current = el;
        }}
        name={name}
        form={form}
        autoComplete={autoComplete}
        disabled={disabled}
        value={current}
        onChange={(e) => {
          // Автоматизация (Playwright selectOption) и автозаполнение браузера меняют скрытый select
          setCurrent(e.target.value);
          onChange?.(e);
        }}
        aria-hidden
        tabIndex={-1}
        className="sr-only"
      >
        <option value="">{shownPlaceholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>

      <Popover
        open={open}
        onOpenChange={(next) => {
          if (next) setTitle(findTitle());
          setOpen(next);
        }}
        role="listbox"
        mobile="sheet"
        matchWidth
        align="start"
        label={title || undefined}
        className="flex max-w-[min(28rem,calc(100vw-2rem))] flex-col overflow-hidden p-1.5"
        trigger={(p) => (
          <button
            type="button"
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={p['aria-expanded']}
            aria-controls={p['aria-controls']}
            aria-invalid={invalid || undefined}
            aria-required={required || undefined}
            disabled={disabled}
            data-select=""
            data-placeholder={empty ? '' : undefined}
            {...buttonRest}
            ref={(el) => {
              p.ref(el);
              buttonRef.current = el;
            }}
            onClick={(e) => {
              p.onClick();
              buttonRest.onClick?.(e);
            }}
            onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
              buttonRest.onKeyDown?.(e);
              if (e.defaultPrevented || open) return;
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                p.onClick();
              }
            }}
            className={cn(
              FIELD_BASE,
              FIELD_BORDER[invalid ? 'invalid' : 'normal'],
              FIELD_HEIGHT[size],
              'relative flex cursor-pointer items-center pr-11 pl-3.5 text-left',
              'focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-focus/15',
              open && !invalid && 'border-primary ring-4 ring-focus/15',
              empty && 'text-muted',
              classNames?.select,
            )}
          >
            <span className="block min-w-0 flex-1 truncate">{selectedOption?.label ?? shownPlaceholder}</span>
            <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center">
              <DropdownChevron open={open} className={cn(open && 'text-primary-text')} />
            </span>
          </button>
        )}
      >
        {({ close }) => (
          <OptionList
            options={options}
            selected={current}
            searchable={searchable ?? options.length > SEARCH_FROM}
            label={title || shownPlaceholder}
            inSheet={isMobile}
            onSelect={(next) => {
              commit(next);
              close();
              // Фокус — назад на поле, чтобы Tab шёл дальше по форме
              requestAnimationFrame(() => buttonRef.current?.focus({ preventScroll: true }));
            }}
          />
        )}
      </Popover>
    </div>
  );
}

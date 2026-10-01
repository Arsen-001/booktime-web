'use client';

/**
 * F-04-111: поле «Категория» в форме клиента. Раньше подсказки шли через нативные `<input
 * list>`/`<datalist>` (см. `@/ui/TagInput`) — не в теме оформления, в части браузеров/автоматизации
 * список не кликается мышью, а опечатка создавала «сырой» тег без всякой обратной связи. Здесь —
 * своя выпадашка (как у `@/ui/Combobox`), но с добавлением МНОЖЕСТВА меток вместо одного выбора: клик
 * или Enter по варианту добавляет тег и держит поле открытым для следующего, Enter по свободному тексту
 * создаёт новую категорию (F-04-110 «категорию можно создать прямо в форме»).
 *
 * Не трогает `src/ui/TagInput.tsx` — это компонент фундамента, которым пользуются другие разделы
 * (online, platform); правка общего файла — по правилам CONVENTIONS.md через qa/requests/*, не отсюда.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { normalizeSearch } from '@/lib/text';
import { useT } from '@/i18n/useT';

export interface CategoryTagInputProps {
  value: string[];
  onValueChange: (tags: string[]) => void;
  suggestions: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function CategoryTagInput({ value, onValueChange, suggestions, placeholder, disabled = false, className }: CategoryTagInputProps) {
  const t = useT('ui');
  const autoId = useId();
  const listId = `${autoId}-suggestions`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const add = (raw: string) => {
    const tag = raw.trim().replace(/,$/, '').trim();
    setText('');
    if (!tag) return;
    if (!value.some((v) => v.toLowerCase() === tag.toLowerCase())) onValueChange([...value, tag]);
  };
  const remove = (tag: string) => onValueChange(value.filter((v) => v !== tag));

  const query = normalizeSearch(text.trim());
  const filtered = suggestions.filter((s) => !value.includes(s) && (query === '' || normalizeSearch(s).includes(query)));
  const canCreate = text.trim() !== '' && !suggestions.some((s) => normalizeSearch(s) === query);
  const itemCount = filtered.length + (canCreate ? 1 : 0);
  const optionId = (i: number) => `${autoId}-opt-${i}`;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

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
      e.preventDefault();
      if (open && active < filtered.length) add(filtered[active]);
      else if (text.trim()) add(text);
    } else if (e.key === ',') {
      if (text.trim()) {
        e.preventDefault();
        add(text);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    } else if (e.key === 'Backspace' && text === '' && value.length) {
      remove(value[value.length - 1]);
    }
  };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <div
        className={cn(
          'flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-xl border border-border-strong bg-surface px-1.5 py-1 shadow-xs transition-[border-color,box-shadow] duration-150',
          'focus-within:border-primary focus-within:shadow-none focus-within:ring-4 focus-within:ring-focus/15',
          disabled && 'bg-surface-2 opacity-70',
        )}
      >
        {value.map((tag) => (
          <span key={tag} className="inline-flex min-h-10 max-w-full items-center rounded-lg bg-primary-soft pl-3 text-sm font-medium text-primary-text">
            <span className="truncate">{tag}</span>
            <button
              type="button"
              disabled={disabled}
              aria-label={t('tags.remove', { tag })}
              onClick={() => remove(tag)}
              className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg hover:bg-primary/15"
            >
              <X aria-hidden className="size-4" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && itemCount ? optionId(active) : undefined}
          value={text}
          disabled={disabled}
          placeholder={value.length ? undefined : (placeholder ?? t('tags.placeholder'))}
          onChange={(e) => {
            setText(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
          onBlur={() => add(text)}
          className="h-10 min-w-32 flex-1 bg-transparent px-2 text-base text-fg placeholder:text-muted/80 focus-visible:outline-none"
        />
      </div>

      {open && itemCount > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-[60] mt-1.5 max-h-60 overflow-auto rounded-xl border border-border bg-surface p-1 shadow-lg scrollbar-thin animate-fade-in"
        >
          {filtered.map((s, i) => (
            <li
              key={s}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => {
                add(s);
                inputRef.current?.focus();
              }}
              className={cn('flex min-h-11 cursor-pointer items-center rounded-lg px-3 py-2 text-base text-fg', i === active && 'bg-surface-2')}
            >
              {s}
            </li>
          ))}
          {canCreate && (
            <li
              id={optionId(filtered.length)}
              role="option"
              aria-selected={active === filtered.length}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(filtered.length)}
              onClick={() => {
                add(text);
                inputRef.current?.focus();
              }}
              className={cn(
                'flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-base text-primary-text',
                active === filtered.length && 'bg-surface-2',
              )}
            >
              <Plus aria-hidden className="size-4 shrink-0" />
              <span className="truncate">{t('combobox.create', { value: text.trim() })}</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

'use client';

import { useId, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n/useT';

export interface TagInputProps {
  value: string[];
  onValueChange: (tags: string[]) => void;
  /** Подсказки для ввода (готовые метки) */
  suggestions?: string[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  className?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

/** Метки: Enter или запятая добавляет, Backspace в пустом поле убирает последнюю */
export function TagInput({
  value,
  onValueChange,
  suggestions,
  placeholder,
  disabled = false,
  invalid = false,
  id,
  className,
  ...aria
}: TagInputProps) {
  const t = useT('ui');
  const autoId = useId();
  const inputId = id ?? autoId;
  const listId = `${inputId}-suggestions`;
  const [text, setText] = useState('');

  const add = (raw: string) => {
    const tag = raw.trim().replace(/,$/, '').trim();
    if (!tag) return;
    if (!value.some((v) => v.toLowerCase() === tag.toLowerCase())) onValueChange([...value, tag]);
    setText('');
  };

  const remove = (tag: string) => onValueChange(value.filter((v) => v !== tag));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      if (text.trim()) {
        e.preventDefault();
        add(text);
      }
    } else if (e.key === 'Backspace' && text === '' && value.length) {
      remove(value[value.length - 1]);
    }
  };

  const isInvalid = invalid || aria['aria-invalid'];

  return (
    <div
      className={cn(
        'flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-xl border bg-surface px-1.5 py-1 shadow-xs transition-[border-color,box-shadow] duration-150',
        'focus-within:border-primary focus-within:shadow-none focus-within:ring-4 focus-within:ring-focus/15',
        isInvalid ? 'border-danger' : 'border-border-strong',
        disabled && 'bg-surface-2 opacity-70',
        className,
      )}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex min-h-10 max-w-full items-center rounded-lg bg-primary-soft pl-3 text-sm font-medium text-primary-text"
        >
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
        id={inputId}
        type="text"
        value={text}
        disabled={disabled}
        list={suggestions?.length ? listId : undefined}
        placeholder={value.length ? undefined : (placeholder ?? t('tags.placeholder'))}
        aria-describedby={aria['aria-describedby']}
        aria-invalid={isInvalid || undefined}
        onChange={(e) => {
          const next = e.target.value;
          if (next.endsWith(',')) add(next);
          else setText(next);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => add(text)}
        className="h-10 min-w-32 flex-1 bg-transparent px-2 text-base text-fg placeholder:text-muted/80 focus-visible:outline-none"
      />
      {suggestions?.length ? (
        <datalist id={listId}>
          {suggestions
            .filter((s) => !value.includes(s))
            .map((s) => (
              <option key={s} value={s} />
            ))}
        </datalist>
      ) : null}
    </div>
  );
}

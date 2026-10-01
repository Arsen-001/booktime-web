'use client';

/**
 * Поле с черновиком (У13): набираемое значение живёт в самом поле, наружу уходит один раз — при уходе из поля
 * или по Enter; Escape возвращает прежнее. Раньше каждая клавиша сохранялась и поле тут же перезаписывалось
 * ответом («75» → «5»). Состояние — в маленьком компоненте поля (CONVENTIONS §18.9), экран не перерисовывается.
 */
import { useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';
import { Input } from '@/ui/Input';
import { MoneyInput } from '@/ui/MoneyInput';

export interface CommitInputProps {
  kind: 'money' | 'minutes';
  value: number | undefined;
  onCommit: (value: number | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** Выделить своё значение (оно отличается от базового) */
  emphasized?: boolean;
  autoFocus?: boolean;
  className?: string;
  'aria-label'?: string;
  size?: 'sm' | 'md';
}

export function CommitInput({
  kind,
  value,
  onCommit,
  placeholder,
  disabled,
  invalid,
  emphasized,
  autoFocus,
  className,
  'aria-label': ariaLabel,
  size = 'md',
}: CommitInputProps) {
  const [draft, setDraft] = useState<number | undefined>(value);
  const [synced, setSynced] = useState<number | undefined>(value);
  const [editing, setEditing] = useState(false);
  // Значение снаружи сменилось (сброс к базовой, чужая правка) — черновик догоняет, если поле не в работе
  if (value !== synced && !editing) {
    setSynced(value);
    setDraft(value);
  }

  const commit = () => {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setDraft(value);
      setEditing(false);
    }
  };
  const emphasis = emphasized && 'font-semibold [&_input]:font-semibold';

  if (kind === 'money') {
    return (
      <MoneyInput
        value={draft}
        onValueChange={(v) => {
          setEditing(true);
          setDraft(v);
        }}
        onBlur={commit}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        invalid={invalid}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        size={size}
        className={cn(emphasis, className)}
      />
    );
  }
  return (
    <Input
      type="text"
      inputMode="numeric"
      value={draft == null ? '' : String(draft)}
      onChange={(e) => {
        setEditing(true);
        const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
        setDraft(digits ? Number(digits) : undefined);
      }}
      onBlur={commit}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      invalid={invalid}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      size={size}
      className={cn(emphasis, className)}
    />
  );
}

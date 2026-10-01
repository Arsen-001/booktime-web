'use client';

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n/useT';
import { useControllableState } from '@/ui/hooks/useControllableState';

export interface CodeInputProps {
  /** Сколько цифр в коде (по умолчанию 4) */
  length?: number;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Введены все цифры — удобно сразу проверять код */
  onComplete?: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

/**
 * Код из сообщения: отдельная клетка на каждую цифру. Переход к следующей клетке сам, Backspace — назад,
 * вставка кода целиком и автоподстановка из SMS (`autocomplete="one-time-code"`) заполняют все клетки.
 */
export function CodeInput({
  length = 4,
  value,
  defaultValue = '',
  onValueChange,
  onComplete,
  invalid = false,
  disabled = false,
  autoFocus = false,
  className,
  id,
  ...aria
}: CodeInputProps) {
  const t = useT('ui');
  const [code, setCode] = useControllableState(value, defaultValue, onValueChange);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => code[i] ?? '');

  // Код не подошёл — курсор в первую пустую клетку, чтобы сразу набрать заново
  const wasInvalid = useRef(invalid);
  useEffect(() => {
    const becameInvalid = invalid && !wasInvalid.current;
    wasInvalid.current = invalid;
    if (!becameInvalid) return;
    const first = refs.current.find((el) => el && !el.value) ?? refs.current[0];
    first?.focus();
  }, [invalid]);

  const focusAt = (i: number) => {
    const el = refs.current[Math.max(0, Math.min(length - 1, i))];
    el?.focus();
    el?.select();
  };

  const commit = (next: string) => {
    const clean = next.replace(/\D/g, '').slice(0, length);
    setCode(clean);
    if (clean.length === length) onComplete?.(clean);
    return clean;
  };

  const handleInput = (i: number, text: string) => {
    const typed = text.replace(/\D/g, '');
    if (!typed) return;
    // Автоподстановка из SMS или быстрый набор: пришло несколько цифр сразу
    const next = (code.slice(0, i) + typed).slice(0, length);
    const clean = commit(next);
    focusAt(Math.min(clean.length, length - 1));
  };

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[i]) commit(code.slice(0, i) + code.slice(i + 1));
      else if (i > 0) {
        commit(code.slice(0, i - 1) + code.slice(i));
        focusAt(i - 1);
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusAt(i - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusAt(i + 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
    if (!pasted) return;
    e.preventDefault();
    const clean = commit(pasted);
    focusAt(Math.min(clean.length, length - 1));
  };

  return (
    <div
      id={id}
      role="group"
      aria-label={aria['aria-label'] ?? t('phoneVerify.codeLabel')}
      aria-describedby={aria['aria-describedby']}
      className={cn('flex gap-2 sm:gap-3', className)}
    >
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          autoFocus={autoFocus && i === 0}
          maxLength={i === 0 ? length : 1}
          value={d}
          disabled={disabled}
          aria-label={t('phoneVerify.digit', { n: i + 1, total: length })}
          aria-invalid={invalid || undefined}
          onChange={(e) => handleInput(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            'h-13 w-full min-w-0 max-w-14 flex-1 rounded-xl border bg-surface text-center text-2xl font-semibold text-fg tabular-nums shadow-xs',
            'transition-[border-color,box-shadow,background-color,transform] duration-150 ease-out',
            'focus-visible:outline-none focus:border-primary focus:ring-4 focus:ring-focus/15',
            'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted',
            invalid
              ? 'border-danger bg-danger-soft/40 focus:border-danger focus:ring-danger/15 motion-safe:animate-shake'
              : d
                ? 'border-primary/60 bg-primary-soft/40'
                : 'border-border-strong hover:border-fg/55',
          )}
        />
      ))}
    </div>
  );
}

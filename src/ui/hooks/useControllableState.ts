'use client';

import { useState } from 'react';

/**
 * Состояние, которое может быть управляемым (value снаружи) и неуправляемым (defaultValue внутри).
 *
 *   const [value, setValue] = useControllableState(props.value, props.defaultValue ?? '', props.onValueChange);
 *
 * Управляемым считается, если value !== undefined. Если undefined — законное значение
 * (например, пустая сумма в MoneyInput), передайте isControlled явно.
 */
export function useControllableState<T>(
  value: T | undefined,
  defaultValue: T,
  onChange?: (next: T) => void,
  isControlled: boolean = value !== undefined,
): [T, (next: T) => void] {
  const [internal, setInternal] = useState<T>(defaultValue);
  const current = isControlled ? (value as T) : internal;
  const setValue = (next: T) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };
  return [current, setValue];
}

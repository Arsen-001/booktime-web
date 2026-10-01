'use client';

import { useEffect, useState } from 'react';

/**
 * М2: значение, которое догоняет исходное через `delay` мс тишины. Поле поиска обновляется на каждую
 * букву сразу, а запрос (ключ useApiQuery) — только когда человек перестал печатать: журнал операций
 * больше не перечитывается на каждую букву. Пустое значение (очистили поиск) применяется сразу.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    if (value === debounced) return;
    const immediate = value === '' || value === undefined || value === null;
    const id = setTimeout(() => setDebounced(value), immediate ? 0 : delay);
    return () => clearTimeout(id);
  }, [value, debounced, delay]);
  return debounced;
}

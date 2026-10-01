'use client';

import { useEffect, useState } from 'react';

/**
 * Флаг, который включается только если `on` держится дольше `ms`: быстрый ответ не мигает индикатором загрузки
 * вовсе, долгий — показывает его (DESIGN.md → «Nothing blinks»). Выключается сразу.
 */
export function useDelayedFlag(on: boolean, ms = 300): boolean {
  const [late, setLate] = useState(false);
  if (!on && late) setLate(false);
  useEffect(() => {
    if (!on) return;
    const id = window.setTimeout(() => setLate(true), ms);
    return () => window.clearTimeout(id);
  }, [on, ms]);
  return on && late;
}

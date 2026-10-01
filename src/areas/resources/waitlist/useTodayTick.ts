'use client';

import { useEffect, useState } from 'react';
import type { ISODate } from '@/domain/core';
import { today } from '@/lib/date';

/** «Сегодня» по Еревану, которое само меняется в полночь: today() прямо в рендере React Compiler запомнил бы до перезагрузки */
export function useTodayTick(): ISODate {
  const [day, setDay] = useState<ISODate>(() => today());
  useEffect(() => {
    const id = setInterval(() => setDay(today()), 60_000);
    return () => clearInterval(id);
  }, []);
  return day;
}

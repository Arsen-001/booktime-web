'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useIsClient } from '@/ui/hooks/useIsClient';

const STORAGE_KEY = 'bp:skeleton-layout';
/** Сколько последних списков помнить — старые вытесняются */
const LIMIT = 300;

type Stored = Record<string, unknown>;

/** Читается из хранилища один раз за вкладку; пишется только при изменении */
let cache: Stored | undefined;

function readAll(): Stored {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as Stored) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function write(key: string, value: unknown): void {
  const all = readAll();
  if (JSON.stringify(all[key]) === JSON.stringify(value)) return;
  delete all[key];
  all[key] = value;
  const keys = Object.keys(all);
  for (const k of keys.slice(0, Math.max(0, keys.length - LIMIT))) delete all[k];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Приватное окно / хранилище выключено — память только до перезагрузки
  }
}

/**
 * Запомненная раскладка списка на этом экране (число строк, ширины колонок): [прошлое значение, сохранить].
 * `id` — имя на экране; адрес страницы добавляется сам. Прошлое значение читается один раз при создании компонента.
 *
 * Первый кадр страницы рисует сервер — он памяти не видит. Чтобы скелетон не перестроился сразу после гидрации
 * (то самое «прыгает»), экземпляр, созданный при гидрации, до конца жизни получает undefined; память работает для
 * списков, которые появились при переходе внутри приложения. Сохранять — в эффекте, когда данные на экране.
 */
export function useRememberedLayout<T>(id: string): [T | undefined, (value: T) => void] {
  const pathname = usePathname();
  const key = `${pathname}|${id}`;
  const isClient = useIsClient();
  const [remembered] = useState(() => (isClient ? (readAll()[key] as T | undefined) : undefined));
  return [remembered, (value: T) => write(key, value)];
}

export interface SkeletonCountOptions {
  /** Идёт первая загрузка — вернуть число строк скелетона */
  loading: boolean;
  /** Сколько элементов сейчас на экране (когда данные есть) — запоминается */
  count: number | undefined;
  /** Сколько строк рисовать, если памяти нет (и в первом кадре с сервера) */
  fallback: number;
  /** Не больше (размер страницы, сколько влезает) */
  max?: number;
}

/**
 * Сколько строк скелетона рисовать: столько, сколько элементов было в этом списке в прошлый раз, иначе fallback
 * (см. useRememberedLayout).
 *   const rows = useSkeletonCount('clients', { loading: q.isLoading, count: q.data?.length, fallback: 10, max: 10 });
 */
export function useSkeletonCount(id: string, { loading, count, fallback, max }: SkeletonCountOptions): number {
  const [remembered, save] = useRememberedLayout<number>(id);
  useEffect(() => {
    if (!loading && count !== undefined) save(count);
  });
  const n = typeof remembered === 'number' ? remembered : fallback;
  return max === undefined ? n : Math.min(n, max);
}

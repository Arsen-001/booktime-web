'use client';

/** Общее для api панели: id среза и проверка «это наша панель» внутри request(). */
import type { RequestOptions } from '@/api/request';
import { readCore } from '@/api/area';
import type { Id } from '@/domain/core';

export const AREA = 'platform' as const;

/** Функции только для нашей панели: без права platform.access сервер ответит forbidden (arch-a1 №10) */
export const PANEL: RequestOptions = { permission: 'platform.access' };

/** Название бизнеса по id — для DTO (экран получает готовое имя, а не id) */
export function businessNameOf(core: ReturnType<typeof readCore>, id: Id | undefined): string | undefined {
  return id ? core.businesses.find((b) => b.id === id)?.name : undefined;
}

import type { CoreData } from '@/domain/core';

/**
 * Срез моковой базы одного раздела. Файл среза — src/mock/slices/<area>.ts (принадлежит разделу).
 *   version — поднимите, когда меняете форму данных: сохранённый в браузере срез пересоздастся из seed;
 *   seed    — начальные данные; получает уже созданное ядро и «сейчас», чтобы ссылаться на id ядра
 *             и считать даты от момента сида.
 */
export interface SliceDef<S> {
  version: number;
  seed: (core: CoreData, now: Date) => S;
}

export function defineSlice<S>(def: SliceDef<S>): SliceDef<S> {
  return def;
}

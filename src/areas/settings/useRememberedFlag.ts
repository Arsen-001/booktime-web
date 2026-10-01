'use client';

import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';

/**
 * Показывать ли блок «при данных» уже во время первой загрузки (DESIGN.md «The skeleton IS the page»): был ли он
 * на экране в прошлый раз, иначе `fallback` (как в демо). После загрузки — само значение.
 *   const showHint = useRememberedFlag('brand-hint', loading, draft ? Boolean(draft.descriptionRu) : undefined, true);
 */
export function useRememberedFlag(id: string, loading: boolean, value: boolean | undefined, fallback: boolean): boolean {
  const remembered = useSkeletonCount(id, { loading, count: value === undefined ? undefined : Number(value), fallback: Number(fallback) }) > 0;
  return loading || value === undefined ? remembered : value;
}

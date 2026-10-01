'use client';

/**
 * Доступ к срезу своего раздела ВНУТРИ функций src/api/<area>.ts (всегда внутри request()).
 *
 *   export const listCards = (clientId: Id) =>
 *     request(() => readArea('loyalty').cards.filter((c) => c.clientId === clientId));
 *
 *   export const addCard = (card: Card) =>
 *     request(() => mutateArea('loyalty', (s) => { s.cards.push(card); }));
 *
 * mutateArea работает с копией среза: меняйте draft как обычный объект.
 * Чужие срезы только читаются (readArea), писать в чужой срез нельзя — через api того раздела.
 */
import type { AreaId } from '@/config/areas';
import type { CoreData } from '@/domain/core';
import { useDb } from '@/mock/db';
import type { AreaStates } from '@/mock/slices';

export function readArea<A extends AreaId>(area: A): AreaStates[A] {
  return useDb.getState().areas[area];
}

export function mutateArea<A extends AreaId>(area: A, recipe: (draft: AreaStates[A]) => void | AreaStates[A]): AreaStates[A] {
  let result!: AreaStates[A];
  useDb.getState().setArea(area, (state) => {
    const draft = structuredClone(state);
    const returned = recipe(draft);
    result = (returned ?? draft) as AreaStates[A];
    return result;
  });
  return result;
}

/** Ядро только для чтения внутри request(); менять ядро — через функции src/api/core.ts */
export function readCore(): CoreData {
  return useDb.getState().core;
}

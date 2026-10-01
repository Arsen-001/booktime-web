/**
 * Прогресс чек-листа «Первые шаги» — чистая функция, чтобы экран, «таблетка» в верхней полосе и подпись
 * «Осталось N шагов» считали одинаково:
 *
 *   const p = checklistProgress(items);
 *   <ChecklistPill done={p.done} total={p.total} … />   // и спрятать, когда p.complete
 *   t('steps.left', { n: p.left })
 *
 * Шаг с `optional: true` показывается, но в «готово» не считается (например, «Добавьте администратора»).
 * Шаг с `waiting: true` не сделан, но и не «следующий»: он ждёт чужого ответа (мастер ещё не принял приглашение).
 */
export interface ChecklistProgressItem {
  done: boolean;
  waiting?: boolean;
  optional?: boolean;
}

export interface ChecklistProgress {
  /** Сделано обязательных шагов */
  done: number;
  /** Всего обязательных шагов */
  total: number;
  /** Осталось обязательных шагов (включая ждущие ответа) */
  left: number;
  /** Все обязательные сделаны */
  complete: boolean;
  /** Индекс следующего шага в исходном массиве (первый не сделанный и не ждущий) или -1 */
  nextIndex: number;
  /** Доля 0…1 — для полоски или кольца */
  ratio: number;
}

export function checklistProgress(items: readonly ChecklistProgressItem[]): ChecklistProgress {
  const required = items.filter((i) => !i.optional);
  const done = required.filter((i) => i.done).length;
  const total = required.length;
  let nextIndex = items.findIndex((i) => !i.done && !i.waiting && !i.optional);
  if (nextIndex < 0) nextIndex = items.findIndex((i) => !i.done && !i.waiting);
  return {
    done,
    total,
    left: total - done,
    complete: total > 0 && done >= total,
    nextIndex,
    ratio: total > 0 ? Math.min(1, done / total) : 0,
  };
}

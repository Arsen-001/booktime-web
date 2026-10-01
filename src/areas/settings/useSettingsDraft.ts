'use client';

/**
 * Черновик формы настроек (Н4, настройки-ревью 27.09.2026): одна модель для «Бренда», «Контактов», «Галереи»,
 * «Реквизитов», «Системных» и вкладок личного кабинета.
 *   - «Сохранить» активна только при НАСТОЯЩЕМ отличии черновика от сохранённого (сравнение значений, а не
 *     «черновик существует»);
 *   - после удачного сохранения `markSaved()` делает сохранённым то, что записали, — кнопка снова неактивна,
 *     перечитывание данных черновик не затирает;
 *   - уход со страницы с несохранённым — наш вопрос «Уйти без сохранения?» (useUnsavedGuard).
 *
 *   const form = useSettingsDraft(q.data && toDraft(q.data), businessId);
 *   form.draft · form.patch({ city }) · form.dirty · form.markSaved()
 */
import { useState } from 'react';
import { useUnsavedGuard } from '@/ui/hooks/useUnsavedGuard';

/** Сравнение значений формы: порядок ключей не важен, undefined и отсутствующий ключ — одно и то же */
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = normalize(v);
    }
    return out;
  }
  return value;
}

export function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

export interface SettingsDraft<T> {
  /** null — данных ещё нет (показывайте скелетон) */
  draft: T | null;
  setDraft: (next: T) => void;
  patch: (part: Partial<T>) => void;
  dirty: boolean;
  /** После удачной записи: записанное становится сохранённым (по умолчанию — текущий черновик) */
  markSaved: (saved?: T) => void;
  /** Вернуть сохранённое */
  reset: () => void;
  confirmLeave: () => Promise<boolean>;
}

/**
 * @param source   сохранённое значение в форме черновика (undefined — ещё грузится)
 * @param sourceKey чьё это значение (id бизнеса/сотрудника): сменился — черновик берётся заново
 */
export function useSettingsDraft<T>(source: T | undefined, sourceKey: string | undefined): SettingsDraft<T> {
  const [saved, setSaved] = useState<T | null>(null);
  const [draft, setDraftState] = useState<T | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (source !== undefined && sourceKey && loadedFor !== sourceKey) {
    setLoadedFor(sourceKey);
    setSaved(source);
    setDraftState(source);
  }

  const dirty = draft !== null && saved !== null && !sameValue(draft, saved);
  const { confirmLeave } = useUnsavedGuard(dirty);

  return {
    draft,
    setDraft: (next) => setDraftState(next),
    patch: (part) => setDraftState((d) => (d ? { ...d, ...part } : d)),
    dirty,
    markSaved: (value) => {
      const next = value ?? draft;
      if (next === null) return;
      setSaved(next);
      setDraftState(next);
    },
    reset: () => setDraftState(saved),
    confirmLeave,
  };
}

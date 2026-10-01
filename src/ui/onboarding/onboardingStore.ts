'use client';

/**
 * Память подсказок «показать один раз» (туры, приветствия, баннеры, чек-листы).
 *
 * Живёт в localStorage браузера под ключом `bp.onb.<персона>:<id>` — у каждой демо-персоны свой «первый вход»,
 * поэтому, переключившись с владельца на мастера, вы снова увидите подсказки мастера.
 *
 *   const hint = useOnce('journal.tour');   // { ready, seen, markSeen, reset }
 *   if (hint.ready && !hint.seen) …          // показать
 *   resetOnboarding()                        // «Показать подсказки снова» для текущей персоны
 *
 * На сервере и в первом рендере гидрации `seen === true`: подсказка не мелькает до того, как стало
 * известно, видел ли её человек.
 */
import { useSyncExternalStore } from 'react';
import { useDemo } from '@/demo/hooks';
import { EMPTY_PERSONAS } from '@/demo/settings';

const PREFIX = 'bp.onb.';
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith(PREFIX)) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function fullKey(scope: string, id: string) {
  return `${PREFIX}${scope}:${id}`;
}

/** Видел ли человек подсказку (без React — например, в обработчике) */
export function isSeen(scope: string, id: string): boolean {
  return storage()?.getItem(fullKey(scope, id)) != null;
}

/** Отметить подсказку показанной */
export function markSeen(scope: string, id: string): void {
  try {
    storage()?.setItem(fullKey(scope, id), new Date().toISOString());
  } catch {
    // переполнено или запрещено — подсказка просто покажется ещё раз
  }
  emit();
}

/** Снова показать одну подсказку */
export function resetSeen(scope: string, id: string): void {
  storage()?.removeItem(fullKey(scope, id));
  emit();
}

/**
 * Снова показать подсказки: все подсказки персоны `scope` (или вообще все, если scope не задан).
 * `idPrefix` — только подсказки раздела, например 'journal.'.
 */
export function resetOnboarding(scope?: string, idPrefix = ''): void {
  const s = storage();
  if (!s) return;
  const start = scope ? `${PREFIX}${scope}:${idPrefix}` : PREFIX;
  const keys: string[] = [];
  for (let i = 0; i < s.length; i += 1) {
    const key = s.key(i);
    if (key?.startsWith(start)) keys.push(key);
  }
  keys.forEach((key) => s.removeItem(key));
  emit();
}

export interface OnceState {
  /** Браузер прочитан: до этого ничего не показывайте */
  ready: boolean;
  /** Подсказку уже видели (или закрыли) */
  seen: boolean;
  markSeen: () => void;
  reset: () => void;
}

export interface OnceOptions {
  /** 'persona' (по умолчанию) — у каждой демо-персоны свой первый вход; 'global' — один на браузер */
  scope?: 'persona' | 'global';
}

/**
 * Текущая область памяти подсказок: id демо-персоны. У пустого бизнеса («Новый салон — пусто», `?empty=1`) — своя
 * область `<персона>-empty`: первый вход нового салона не должен считаться «уже виденным» из-за живого демо-салона.
 */
export function useOnboardingScope(scope: OnceOptions['scope'] = 'persona'): string {
  const { persona, empty } = useDemo();
  if (scope === 'global') return 'all';
  return empty === '1' && EMPTY_PERSONAS.includes(persona) ? `${persona}-empty` : persona;
}

/** «Показать один раз»: состояние подсказки `id` для текущей персоны */
export function useOnce(id: string, options: OnceOptions = {}): OnceState {
  const scope = useOnboardingScope(options.scope);
  const seenValue = useSyncExternalStore(
    subscribe,
    () => isSeen(scope, id),
    () => true,
  );
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return {
    ready,
    seen: seenValue,
    markSeen: () => markSeen(scope, id),
    reset: () => resetSeen(scope, id),
  };
}

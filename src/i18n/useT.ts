'use client';

import { useTranslations } from 'next-intl';
import type { Namespace } from '@/i18n/config';
import { reportIfFallback } from '@/i18n/fallbacks';

/**
 * ЕДИНСТВЕННЫЙ способ брать тексты в клиентских компонентах:
 *   const t = useT('journal');  t('title');  t('count', { n: 3 });  t.rich(...)
 * Ключи проверяются компилятором по messages/ru/<ns>.json. Прямой useTranslations запрещён линтером,
 * потому что только useT сообщает в консоль о непереведённых ключах (для замеров).
 */
export function useT<NS extends Namespace>(namespace: NS) {
  const t = useTranslations(namespace);
  return new Proxy(t, {
    apply(target, thisArg, args: unknown[]) {
      if (typeof args[0] === 'string') reportIfFallback(`${namespace}.${args[0]}`);
      return Reflect.apply(target, thisArg, args);
    },
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function' || prop === 'has') return value;
      return (...args: unknown[]) => {
        if (typeof args[0] === 'string') reportIfFallback(`${namespace}.${args[0]}`);
        return (value as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  }) as typeof t;
}

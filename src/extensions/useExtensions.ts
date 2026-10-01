'use client';

import { useDemo } from '@/demo/hooks';
import { useExtensionStubs } from '@/extensions/ExtensionStubsProvider';
import { extensionsFor } from '@/extensions/registry';
import type { ExtensionEntry, HostId } from '@/extensions/types';

/**
 * Вклады хоста, видимые текущей персоне в текущей сфере (для вкладок/секций хоста).
 * Вклады-заглушки (раздел ещё не построил, файл рисует <ExtensionStub>) на рабочих экранах НЕ возвращаются —
 * вкладки «Здесь будет вклад…» люди не видят. Посмотреть свой вклад в рамке хоста — /dev/ext/<host>/<area>.
 */
export function useExtensions(host: HostId): ExtensionEntry[] {
  const { persona, sphere } = useDemo();
  const stubs = useExtensionStubs();
  return extensionsFor(host).filter(
    (e) =>
      !stubs.has(`${e.host}:${e.area}`) &&
      !e.hiddenInSpheres?.includes(sphere) &&
      (!e.personas || e.personas.includes(persona)),
  );
}

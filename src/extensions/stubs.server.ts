import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EXTENSION_PAIRS } from '@/extensions/pairs';

/**
 * Какие вклады ещё заглушки (ux-journal №6, ux-clients №9): файл src/areas/<area>/extensions/<Host>.tsx рисует
 * <ExtensionStub>. Такие вклады рабочие экраны НЕ показывают (useExtensions их отбрасывает) — человек не видит
 * вкладку «Здесь будет вклад раздела…». На /dev/ext/<host>/<area> заглушка видна как раньше.
 * Раздел заменил заглушку своим содержимым — вкладка появится сама (после перезагрузки страницы).
 * Читается на сервере в layout кабинета и приложения клиента; на сборке без исходников — пусто (показываем всё).
 */
export function listStubPairs(): string[] {
  const out: string[] = [];
  for (const { host, area } of EXTENSION_PAIRS) {
    const file = join(process.cwd(), 'src', 'areas', area, 'extensions', `${host[0].toUpperCase()}${host.slice(1)}.tsx`);
    try {
      if (readFileSync(file, 'utf8').includes('<ExtensionStub')) out.push(`${host}:${area}`);
    } catch {
      // Нет исходников (собранное приложение) — считаем вклад настоящим
    }
  }
  return out;
}

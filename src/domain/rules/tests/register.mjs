// Загрузчик для юнит-тестов правил ядра на встроенном node:test (без новых пакетов).
// Node 23+ сам снимает типы с .ts; здесь — только разрешение путей '@/…' и импортов без расширения:
// '@/x' → src/x(.ts|.tsx|/index.ts), './x' → './x.ts', 'dayjs/plugin/x' → 'dayjs/plugin/x.js'.
// Запуск всех тестов: node src/domain/rules/tests/run.mjs
import { existsSync, statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

const SRC = new URL('../../../', import.meta.url); // …/src/
const EXT = ['', '.ts', '.tsx', '.mjs', '.js', '/index.ts'];

function tryFile(url) {
  for (const ext of EXT) {
    const candidate = new URL(url.href + ext);
    const path = fileURLToPath(candidate);
    if (existsSync(path) && statSync(path).isFile()) return candidate.href;
  }
  return undefined;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      const found = tryFile(new URL(specifier.slice(2), SRC));
      if (found) return { url: found, shortCircuit: true };
    }
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
      const found = tryFile(new URL(specifier, context.parentURL));
      if (found) return { url: found, shortCircuit: true };
    }
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (!specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.endsWith('.js')) {
        return nextResolve(specifier + '.js', context);
      }
      throw error;
    }
  },
});

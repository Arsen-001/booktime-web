// Прогон юнит-тестов правил ядра и моковой базы: node src/domain/rules/tests/run.mjs [--watch]
// Без зависимостей: node:test + снятие типов Node 23+ + register.mjs (пути '@/…').
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '../../../..');
// + тесты моковой базы (src/mock/tests): размер в localStorage и упаковка (демо, 20.11.2026)
const files = [dir, join(root, 'src/mock/tests')].flatMap((d) =>
  readdirSync(d)
    .filter((f) => f.endsWith('.test.ts'))
    .map((f) => relative(root, join(d, f))),
);
const result = spawnSync(
  process.execPath,
  [
    '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
    '--disable-warning=ExperimentalWarning',
    '--import',
    './' + relative(root, join(dir, 'register.mjs')),
    '--test',
    ...process.argv.slice(2),
    ...files,
  ],
  { cwd: root, stdio: 'inherit', env: { ...process.env, TZ: process.env.TZ ?? 'Asia/Yerevan' } },
);
process.exit(result.status ?? 1);

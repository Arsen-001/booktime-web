// Прогон юнит-тестов движка уведомлений (F-05-043): node src/areas/notify/lib/run-tests.mjs
// Тот же загрузчик путей '@/…', что у тестов ядра (src/domain/rules/tests/register.mjs) — не дублируем.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '../../../..');
const register = join(root, 'src/domain/rules/tests/register.mjs');
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.test.ts'))
  .map((f) => relative(root, join(dir, f)));
const result = spawnSync(
  process.execPath,
  [
    '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
    '--disable-warning=ExperimentalWarning',
    '--import',
    './' + relative(root, register),
    '--test',
    ...process.argv.slice(2),
    ...files,
  ],
  { cwd: root, stdio: 'inherit', env: { ...process.env, TZ: process.env.TZ ?? 'Asia/Yerevan' } },
);
process.exit(result.status ?? 1);

# Платформа записи (Армения) — интерфейс на моковых данных

**Перед любой работой прочитайте [CONVENTIONS.md](CONVENTIONS.md)** (правила для разделов: свои пути,
UI только из `src/ui` и токенов, данные через `src/api`, i18n, `data-f`, демо-персоны, замеры) и
[AREAS.md](AREAS.md) (18 разделов: пути, ТЗ, меню, точки расширения).

- Дев-сервер: только `bash scripts/ensure-dev.sh` (порт 3710). Замеры: `node scripts/measure.mjs --help`.
- Коммит: `node scripts/commit.mjs "сообщение"` (системный git заблокирован лицензией Xcode). Разделы не коммитят.
- ТЗ: `/Users/arsen/WebstormProjects/booking-research/functional-map/` (00 — наши решения, приоритет).
- **«Чем мы лучше Altegio» — всегда актуально** (владелец, 29.09.2026). Сделали то, чего у Altegio нет или что у нас
  удобнее (⭐ в ТЗ, решение владельца в `docs/design/DESIGN.md`), — в той же работе допишите пункт в
  `docs/better-than-altegio.md` с меткой «новое, ДД.ММ.ГГГГ» (формат — в начале `scripts/better-than-altegio.mjs`);
  убрали или урезали — поправьте пункт. Сессия, которая говорит с владельцем, после этого собирает страницу
  `node scripts/better-than-altegio.mjs` и публикует `.artifacts/better-than-altegio.html` в тот же артефакт:
  https://claude.ai/artifact/SiGPW3DsedjFs1AozjJzRT (параметр `url`). Это презентация проекта: пока сравниваем с Altegio («У Altegio: …»),
  потом добавим других конкурентов («У <Имя>: …» + имя в `COMPETITORS` в скрипте).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

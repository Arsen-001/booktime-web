# Как продолжить сборку интерфейса после паузы

Пауза 26.09.2026 ~00:00 (пользователь выключал компьютер). Прогон wf_74ad0252-a62 остановлен вручную,
лимит не кончался. Готово 1665/2896 функций, 55/73 пачек.

## Правило пользователя (25.09.2026)
Только ОДИН workflow за раз; следующий — после окончания текущего. Сборщики и измерители — Sonnet medium.

## Шаги
0. 🔴 26.09 «быстрый результат UI/UX, тесты после бэкенда»: NO_TESTS в шаблоне — без замеров и браузера, 1 круг пропусков. Экономия (26.09, «чтобы токены бессмысленно не тратились»): пропуски — Sonnet high, максимум 2 круга, 1 починка на замер; проверка раз в 3 часа.
1. `bash scripts/ensure-dev.sh` — дев-сервер на :3710.
2. `node scripts/resume/make-resume.mjs` — соберёт `scripts/resume/build-resume.js` из журналов
   (что готово — пропустит). Если с прошлой паузы был новый прогон — сначала допиши его journal.jsonl в JOURNALS
   в `make-resume.mjs` и в `scripts/progress.mjs`.
3. Workflow({ scriptPath: '<абсолютный путь>/scripts/resume/build-resume.js' }).
   Новый run id и путь к его журналу записать в JOURNALS обоих скриптов.
4. Часовая проверка (cron :27): progress.mjs → таблица; упал на лимите → разовый перезапуск на время сброса + 2 мин;
   `node scripts/commit.mjs "…"`.

## Проверки — только после бэкенда, на 100 %: docs/TESTING-AFTER-BACKEND.md

## Очередь после сборки
1. Исправители `booking-ux-fix` по одному разделу (сделаны: platform, clients, client; schedule запускался 25.09 14:47 —
   проверить итог). Скрипт: `scripts/resume/ux-fix.js` (копия из
   `~/.claude/projects/-Users-arsen-WebstormProjects-lucky-ticket/a8dc06a4-7c3a-429b-aeb3-71de5e42264f/workflows/scripts/booking-ux-fix-wf_1a4fc436-83f.js`), args `{areas:[id]}`.
2. Переделки по ответам владельца — список «Что переделать сборщикам» в
   `~/WebstormProjects/booking-research/functional-map/ANSWERS.md` (7 пунктов).

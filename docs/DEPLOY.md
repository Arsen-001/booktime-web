# Выкладка BookTime (с 02.10.2026)

## Где что живёт

| | staging (ветка `develop`) | production (ветка `main`) |
|---|---|---|
| Сайт (Vercel, проект `booktime-web`) | https://staging.booktime.am — закрыт входом Vercel | https://booktime.am (www → booktime.am) |
| Сервер (Railway, проект `booktime`, сервис `api`) | https://api-staging.booktime.am | https://api.booktime.am |
| База и Redis | свои в окружении `staging`, демо-данные из сида | свои в окружении `production`, настоящие салоны |

**Демо для показа клиентам — https://demo.booktime.am** (Vercel, отдельный проект `booktime-demo`, ветка `main`,
`NEXT_PUBLIC_DATA=mock`): весь интерфейс на демо-данных в браузере посетителя, переключатель персон, вход кодом
0000 — сервер не нужен, поэтому открыт всем. На booktime.am и staging кода 0000 нет (настоящий сервер,
`NODE_ENV=production`) — вход только по коду из Telegram Gateway.

- Репозитории (публичные): https://github.com/Arsen-001/booktime-web, https://github.com/Arsen-001/booktime-api.
- Каждый push в `develop` / `main` выкладывается сам (GitHub-приложения Vercel и Railway).
- В production попадает только слиянием `develop` → `main` (fast-forward) — по слову владельца.
- Регион Railway — `europe-west4` (Нидерланды), записан в `railway.json` сервера: без этого сервис уезжал в `sfo`
  и каждый запрос к базе шёл через океан (карточка салона — 40 с вместо 0,8 с).
- DNS booktime.am — у Vercel (серверы имён `ns1/ns2.vercel-dns.com` выставлены у регистратора name.am).
  Записи: `vercel dns ls booktime.am`; `api` и `api-staging` — CNAME на Railway + TXT `_railway-verify.*`.

## Сервер на Railway

- Сборка `npm run build:prod` (prisma generate + tsc), Node 24 (`engines`: `node:crypto` argon2 — с 24.7).
- Запуск `scripts/railway-start.mjs`: сначала `prisma migrate deploy`, потом API и воркер в одном контейнере
  (общий диск `/data` для файлов, `STORAGE_DRIVER=local`). Разнести на два сервиса можно после S3 (Railway Buckets).
- Переменные: `railway variables -s api -e <env> --kv`. Секреты (VAPID, `TELEGRAM_WEBHOOK_SECRET`) у каждого
  окружения свои. `NODE_ENV=production` в обоих: постоянного кода входа 0000 нет, сид не запускается.
- База закрыта от интернета (нет TCP-прокси). Для разовой работы — `railway tcp-proxy create --port 3306 -s MySQL
  -e <env>`, после — `railway tcp-proxy delete`.

## Демо-данные staging

- Сид прогоняется локально на временной базе и переносится дампом (через прокси длинные транзакции сида не
  укладываются в лимит). Перед переносом пароли входов из сида заменены случайными (список — локально в
  `booktime-backend/storage/staging-logins.txt`, не в git), приглашения `dev-invite-*` удалены: код публичный.

## Нужно для настоящего входа

- `TELEGRAM_GATEWAY_TOKEN` (коды входа) — без него код только пишется в лог сервера.
- Бот напоминаний **@booktime_am_bot** подключён к production (03.10.2026): `TELEGRAM_BOT_TOKEN` +
  `TELEGRAM_BOT_USERNAME`, вебхук `https://api.booktime.am/v1/telegram/webhook` с секретом
  `TELEGRAM_WEBHOOK_SECRET` (без секрета — 403). У бота один вебхук, поэтому на staging бота нет — сообщения
  там пишутся в лог. Проверить: `getWebhookInfo` (поле `last_error_message`).
- Vercel Hobby — только некоммерческое использование; для салонов — Vercel Pro.

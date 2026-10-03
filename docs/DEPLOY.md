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
- Каналы кода (03.10.2026): по умолчанию Telegram; не доставил (у номера нет Telegram) — сервер сам шлёт тот же код в
  WhatsApp, потом SMS. На экране кода — «Код отправлен в …» по факту и «Прислать в WhatsApp» / «Прислать SMS» (только
  включённые каналы; повтор — через те же 60 с и лимиты). Канал без переменных выключен и не показывается.
- **WhatsApp** (Meta, WhatsApp Business Cloud API) — что сделать владельцу:
  1. Meta Business аккаунт (business.facebook.com) и подтверждение компании (Business verification) — без него
     лимит 250 получателей в сутки.
  2. developers.facebook.com → My Apps → Create app (тип Business) → добавить продукт **WhatsApp**; привязать к
     Meta Business аккаунту.
  3. WhatsApp Manager → добавить номер отправителя (не занятый в обычном WhatsApp), подтвердить по SMS/звонку,
     отображаемое имя «BookTime»; добавить способ оплаты. Скопировать **Phone number ID** (не сам номер).
  4. Business Settings → Users → System users → создать системного пользователя (Admin), выдать ему приложение и
     WhatsApp-аккаунт, Generate token: срок «Never», права `whatsapp_business_messaging`,
     `whatsapp_business_management` — это постоянный токен.
  5. WhatsApp Manager → Message templates → Create: категория **Authentication**, имя `booktime_login_code`,
     кнопка **Copy code**, срок действия кода 5 минут; языки — русский, английский и армянский, если Meta его
     предлагает. Отправить на одобрение.
  6. Railway (api, нужное окружение): `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME`
     (если имя другое), `WHATSAPP_TEMPLATE_LANGS` — одобренные языки через запятую, первый — для остальных
     (`ru,en` или `ru,hy,en`).
- **SMS** (Twilio Programmable Messaging) — самый дорогой канал, только запасной:
  1. twilio.com — аккаунт, перевести из Trial (в Trial SMS уходят только на подтверждённые номера), пополнить баланс.
  2. Отправитель для Армении: **Alphanumeric Sender ID** «BookTime» (Армения его поддерживает, регистрации не
     требует — проверить в Twilio «SMS Guidelines → Armenia») или купленный номер Twilio.
  3. Messaging → Services → Create Messaging Service, добавить отправителя (Sender ID или номер); включить
     **SMS Pumping Protection**. Messaging → Settings → **Geo permissions** — оставить только Армению.
  4. Console → Account Info: **Account SID** и **Auth Token**.
  5. Railway: `SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`
     (MG…; или `TWILIO_FROM=BookTime`). Защита от накрутки на сервере: `SMS_ALLOWED_PREFIXES=+374` (по умолчанию),
     `SMS_MAX_PER_HOUR=100` на весь сервис, 3 SMS на номер в сутки и 5 с адреса в час — дальше SMS не предлагается.
     Армянский провайдер подключается позже тем же интерфейсом (`booktime-backend/src/adapters/code-sender/sms.ts`).
- Бот напоминаний **@booktime_am_bot** подключён к production (03.10.2026): `TELEGRAM_BOT_TOKEN` +
  `TELEGRAM_BOT_USERNAME`, вебхук `https://api.booktime.am/v1/telegram/webhook` с секретом
  `TELEGRAM_WEBHOOK_SECRET` (без секрета — 403). У бота один вебхук, поэтому на staging бота нет — сообщения
  там пишутся в лог. Проверить: `getWebhookInfo` (поле `last_error_message`).
- Vercel Hobby — только некоммерческое использование; для салонов — Vercel Pro.

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
  Если Railway не подхватил push (03.10.2026 так было: в `railway deployment list -s api -e staging` нет нового коммита,
  а `railway redeploy --from-source` берёт старый), выложить рабочую копию сервера, совпадающую с `origin/develop`:
  `railway up -s api -e staging --detach` из `booktime-backend` (секреты из `.gitignore` не загружаются; сборка — `npm run
  build` с `prebuild: prisma generate`).
- Разовый импорт мест в базу staging: `railway tcp-proxy create --port 3306 -s MySQL -e staging` → `ProspectsService.import`
  с `DATABASE_URL` на прокси (тот же код, что кнопка «Импорт») → `railway tcp-proxy delete <id> -s MySQL -e staging --yes`.
- В production попадает только слиянием `develop` → `main` (fast-forward) — по слову владельца.
- Регион Railway — `europe-west4` (Нидерланды), записан в `railway.json` сервера: без этого сервис уезжал в `sfo`
  и каждый запрос к базе шёл через океан (карточка салона — 40 с вместо 0,8 с).
- DNS booktime.am — у Vercel (серверы имён `ns1/ns2.vercel-dns.com` выставлены у регистратора name.am).
  Записи: `vercel dns ls booktime.am`; `api` и `api-staging` — CNAME на Railway + TXT `_railway-verify.*`.
- Почта info@booktime.am — Google Workspace Business Starter (05.10.2026): один платный ящик info@booktime.am (администратор), arsen@booktime.am — его псевдоним.
  Записи: MX `smtp.google.com` (1), TXT `google-site-verification=VSPt…` (Workspace) и `WagG…` (Search Console),
  SPF `v=spf1 include:_spf.google.com ~all`, DKIM `google._domainkey`, DMARC `_dmarc` (p=none, отчёты на info@).
  Почта с другого сервиса (рассылки, Resend и т. п.) — дописать его в SPF, а не заводить вторую SPF-запись.

## Сервер на Railway

- Сборка `npm run build:prod` (prisma generate + tsc), Node 24 (`engines`: `node:crypto` argon2 — с 24.7).
- Запуск `scripts/railway-start.mjs`: сначала `prisma migrate deploy`, потом API и воркер в одном контейнере
  (общий диск `/data` для файлов, `STORAGE_DRIVER=local`). Разнести на два сервиса можно после S3 (Railway Buckets).
- Переменные: `railway variables -s api -e <env> --kv`. Секреты (VAPID, `TELEGRAM_WEBHOOK_SECRET`) у каждого
  окружения свои. `NODE_ENV=production` в обоих: постоянного кода входа 0000 нет, сид не запускается.
- База закрыта от интернета (нет TCP-прокси). Для разовой работы — `railway tcp-proxy create --port 3306 -s MySQL
  -e <env>`, после — `railway tcp-proxy delete`.

## Бэкапы базы

- Снимки дисков Railway (по расписанию и вручную) — только на тарифе Pro; сейчас Hobby (API отвечает «Not Authorized»).
- Пока — своя выгрузка: воркер в 04:30 по Еревану пишет полную копию базы в `/data/backups/db-ГГГГ-ММ-ДД.sql.gz`
  (`src/jobs/db-backup.ts`, переменные `DB_BACKUP=1`, `DB_BACKUP_DIR=/data/backups`, `DB_BACKUP_KEEP=14` — только
  в production). Папка — вне `STORAGE_DIR`: файлы хранилища раздаются, копия базы — никогда. Проверено 03.10.2026:
  выгрузка → загрузка в пустую базу → все 196 таблиц совпали по контрольным суммам.
- Диск `/data` — у сервиса api, отдельный от диска MySQL: спасает от неудачной миграции и случайного удаления, но не
  от потери проекта. Вторая копия вне Railway — скачать к себе:
  `railway volume -e production files -v api-volume download /backups/db-ГГГГ-ММ-ДД.sql.gz ./`
- Восстановление: `gunzip -c db-….sql.gz | mysql -h… -u… -p… <база>` (через временный `railway tcp-proxy`).

## Мониторинг ошибок (Sentry)

- Организация **BookTime** (`booktime-l0.sentry.io`, данные в ЕС), проекты `booktime-api` и `booktime-web` (03.10.2026).
- Сервер: `@sentry/node`, `src/common/monitoring/sentry.ts` — 500 из `ErrorFilter` и упавшие задачи воркера;
  `SENTRY_DSN` в Railway (staging и production; окружение = имя окружения Railway).
- Сайт: `@sentry/nextjs`, `src/instrumentation-client.ts` (браузер), `src/instrumentation.ts` (сервер Next),
  `error.tsx` и `ExtensionBoundary` шлют пойманные падения; `NEXT_PUBLIC_SENTRY_DSN` в Vercel (`booktime-web`,
  production + preview; для `booktime-demo` — добавить вручную, окружение будет `demo`). Без DSN всё выключено.
- Личные данные не уходят: пользователь, cookie, заголовки, тело и строка запроса вырезаются (`beforeSend`).

## Аналитика (посещения и воронки, 03.10.2026)

Код — `src/lib/analytics.ts` (список событий, источник, очистка адресов) и `src/shell/AnalyticsScripts.tsx`
(подключение); решение — `docs/design/DESIGN.md` «Аналитика». Работает **только на booktime.am** (сборка
`NEXT_PUBLIC_DATA=api` + `NEXT_PUBLIC_VERCEL_ENV=production` — Vercel выставляет её сам). demo, staging, превью и
разработка ничего не грузят и не шлют; браузер с Do Not Track / Global Privacy Control — тоже. Личных данных нет.

**Что включить владельцу:**
1. **Vercel Web Analytics** — vercel.com → проект `booktime-web` → вкладка **Analytics** → **Enable**, затем любая
   новая выкладка `main` (скрипт `/_vercel/insights/script.js` появляется после включения). Видно: посетители, страницы,
   referrer (Google, Instagram…), страны, устройства, UTM. **Свои события** (воронки ниже) Vercel показывает только на
   **Pro** (до 2 свойств на событие; 8 — с Web Analytics Plus) — на Hobby их не видно, поэтому воронки — в PostHog.
2. **PostHog** (воронки, бесплатно до 1 млн событий в месяц) — posthog.com → Sign up → регион **EU Cloud**
   (eu.posthog.com) → создать проект **BookTime** → Settings → Project → **Project API key** (`phc_…`, он публичный) —
   прислать. В настройках проекта: **Discard client IP data** — включить; Session replay, Surveys, Autocapture —
   оставить выключенными (сайт их и так не включает). Дальше ставим в Vercel (`booktime-web`, только **Production**):
   `NEXT_PUBLIC_POSTHOG_KEY=phc_…` (и `NEXT_PUBLIC_POSTHOG_HOST`, только если не EU: по умолчанию
   `https://eu.i.posthog.com`) — переменная сборки, нужна пересборка. Без ключа PostHog не грузится вовсе.
3. Проверить без отправки: `NEXT_PUBLIC_ANALYTICS_DEBUG=1` (локально, перезапуск дев-сервера) — события пишутся
   в консоль браузера `[analytics] …`.

**События** (PostHog → Product analytics → Funnels; в Vercel — Events на Pro):

| Событие | Когда | Свойства |
|---|---|---|
| `$pageview` / просмотр | каждая страница (сам) | адрес без строки запроса (кроме `utm_*`), токены в пути — шаблоном |
| `search` | поиск в каталоге, через 1,5 с после ввода/фильтра | `query_length` (не текст), `results`, `sphere`, `district` |
| `place_viewed` | открыта страница салона/мастера | `businessId`, `sphere`, `district`, `page`: public (`/b/<slug>`) · place · master |
| `booking_started` | открыт путь записи | `businessId`, `sphere`, `source`, `slotPreselected` |
| `slot_selected` | выбрано время | `businessId`, `source` |
| `login_shown` | показана форма входа по номеру | `context`: booking · login |
| `login_completed` | вошёл | `method`: code · google |
| `booking_created` | запись создана | `businessId`, `sphere`, `source`, `prepayment` + источник |
| `business_signup_started` | открыта анкета «Регистрация бизнеса» | — |
| `business_signup_completed` | бизнес создан | `businessId`, `sphere`, `type`: salon · individual + источник |
| `first_service_created`, `first_staff_added` | чек-лист «Первые шаги» впервые отметил шаг | `businessId` |
| `first_booking_created` | — | **TODO сервер** (точно знает только он) |

- `source` записи: `link` — страница салона `/b/<slug>/book`, `widget` — `/embed` на чужом сайте, `catalog` — запись в
  BookTime из каталога, `app` — то же из установленного на телефон приложения (PWA).
- **Источник** к `booking_created` и `business_signup_completed`: `first_*` — первый заход за 90 дней, `session_*` — этот
  визит: `channel` (campaign · search · social · referral · direct), `referrer` (только домен), `landing`, `utm_source`,
  `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`. Ссылки для рекламы — с метками, например
  `https://booktime.am/?utm_source=instagram&utm_medium=story&utm_campaign=october`.
- Воронка клиента: `place_viewed` → `booking_started` → `slot_selected` → `login_shown` → `login_completed` →
  `booking_created` (вошедшему форма входа не показывается — для них шаги входа пропускаются). Воронка салона:
  `business_signup_started` → `business_signup_completed` → `first_service_created` → `first_staff_added`.
- Ограничения: вехи салона — только для бизнеса, зарегистрированного в этом же браузере, и приходят, когда владелец
  открывает «Первые шаги» (`/biz/onboarding`); групповая запись (`GroupBookingFlow`) и подтверждение номера в виджете
  событий входа не шлют.

## Файлы и фото (04.10.2026)

Фото (логотипы, фото салона/мастеров/услуг, сторис, новости, заказы, аватары) больше не хранятся data: URL в базе:
в режиме `api` выбор фото (`src/ui/ImageUpload.tsx`, `UploadButton`, фото сотрудника) отправляет файл на сервер
(`src/api/uploads.ts` → `POST /v1/biz/:businessId/uploads`, `/v1/me/uploads`, `/v1/platform/uploads`, поле `file`),
показывает процент и «Повторить» при ошибке, и кладёт в поле ответ `url`. Мок (demo) — по-прежнему data: URL.
Поля фото на сервере принимают оба вида строк — старые клиенты и старые строки работают.

- Сервер (`booktime-backend/src/modules/uploads`): JPEG/PNG/WebP/GIF до 10 МБ, тип — по первым байтам файла
  (HEIC с iPhone не читается — браузер iPhone обычно сам присылает JPEG); перекодирование `sharp`: поворот по EXIF,
  ≤ 2048 px по длинной стороне, превью 512 px (`…_t.jpg`), EXIF/GPS вырезаются; без прозрачности — JPEG, с
  прозрачностью — WebP. Ответ `{ id, url, thumbUrl, width, height, bytes }`. Таблица `uploads` — владелец и размер.
- Права: кабинет — любой сотрудник бизнеса из адреса; `/v1/me` — вошедший человек; панель — сессия команды.
  Лимит — 60 фото за 10 минут на сессию; квота — `UPLOADS_QUOTA_MB` на бизнес (2048 по умолчанию), 100 МБ человеку.
  Ошибки: `file_required` 422, `file_too_large` 413, `unsupported_image` 415, `upload_quota` 422, `rate_limited` 429.
- Ключ файла — хеш содержимого (`uploads/<бизнес|человек|platform>/<sha256[:32]>.jpg`), поэтому раздача с вечным
  кэшем (`Cache-Control: public, max-age=31536000, immutable`, `ETag`, `X-Content-Type-Options: nosniff`).
  Сайт рисует фото как есть (`images.unoptimized` в `next.config.ts`) — адрес API в `remotePatterns` не нужен.

**Где лежат файлы** — переменные сервера (Railway, сервис `api`):

| Переменная | Что это |
|---|---|
| `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Заданы все четыре — хранилище S3 (AWS S3, Cloudflare R2, Railway Buckets). Старые имена `S3_ACCESS_KEY` / `S3_SECRET_KEY` тоже читаются |
| `S3_REGION` | R2 — `auto` (по умолчанию), AWS — регион бакета |
| `S3_PUBLIC_URL` | Публичный адрес бакета (`https://files.booktime.am`) — ссылки на фото ведут прямо туда, API их не раздаёт. Пусто — фото из бакета раздаёт API (`/v1/files/…`) |
| `S3_FORCE_PATH_STYLE` | `1` (по умолчанию) — адреса `<endpoint>/<bucket>/<key>`; `0` — `<bucket>.<endpoint>` |
| `UPLOADS_DIR` | Без S3 — папка фото на диске: по умолчанию `/data/uploads` в production (диск Railway), `./.uploads` локально |
| `PUBLIC_API_URL` | Адрес API для ссылок на фото (`https://api.booktime.am`, `https://api-staging.booktime.am`). Пусто — из заголовков запроса (за прокси Railway работает, но лучше задать) |
| `UPLOADS_QUOTA_MB` | Предел фото и документов клиентов на бизнес, МБ |
| `PRIVATE_FILES_DIR` | Документы клиентов на диске (закрытые): по умолчанию `/data/private` в production, `./.private` локально |
| `UPLOADS_CLEANUP` | `1` — ночная уборка неиспользуемых файлов удаляет; пусто — только отчёт в лог воркера |

- **Сейчас (диск Railway)** — достаточно для старта: переменные не нужны (по желанию `PUBLIC_API_URL`), фото ложатся
  на тот же диск `/data`, что и бэкапы, раздаёт API. Ограничения: один экземпляр сервиса (диск не делится), раздача
  фото нагружает API, диск надо растить по мере роста (тысяча салонов × ~50 фото × ~0,3 МБ ≈ 15 ГБ), бэкап базы фото
  не включает. Скачать фото к себе: `railway volume -e production files -v api-volume download /uploads ./`.
- **Переезд на Cloudflare R2** (рекомендуем, когда салонов станет больше десятка — 10 ГБ бесплатно, без платы за
  трафик): Cloudflare → R2 → Create bucket `booktime-photos` (регион Eastern Europe) → Settings → Public access →
  Custom domain `files.booktime.am` (CNAME в DNS Vercel) → R2 → Manage API tokens → Create token (Object Read & Write,
  только этот бакет) → в Railway (production): `S3_BUCKET=booktime-photos`,
  `S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
  `S3_PUBLIC_URL=https://files.booktime.am`. Для staging — свой бакет. Уже загруженные на диск фото перенести:
  `rclone copy` папки `/data/uploads/uploads` в бакет под префикс `uploads/` и заменить в базе
  `https://api.booktime.am/v1/files/` на `https://files.booktime.am/` (или оставить старые адреса — пока диск жив,
  они продолжают работать). Бакет с `S3_PUBLIC_URL` открыт на чтение, поэтому выгрузки отчётов тогда остаются на
  диске (`STORAGE_DIR`); без `S3_PUBLIC_URL` они идут в тот же бакет под `private/`.
- **Перенос старых data: URL из базы** — `booktime-backend/scripts/migrate-data-urls.ts`: ищет картинки во всех
  текстовых и JSON-колонках, кладёт в хранилище, заменяет на адрес, переносит `ref_id` модерации на новый адрес.
  Без `--apply` — только отчёт. Запускать по слову владельца, после свежего бэкапа, с `PUBLIC_API_URL` (или
  `S3_PUBLIC_URL`) и `DATABASE_URL` через временный `railway tcp-proxy`. Тот же запуск переносит и документы клиентов
  (`client_files`): файл как есть в закрытое хранилище, `data_url` очищается (`--skip=client_files` — без них,
  `--only=client_files` — только они).
- **Документы клиентов** (вкладка «Файлы» карточки, 04.10.2026): в режиме `api` файл уходит на сервер как есть
  (`POST /v1/biz/:businessId/clients/:id/files/upload`, поле `file` + `name`): PDF, JPEG/PNG/GIF/WebP, Word/Excel,
  текст — до 10 МБ, тип по первым байтам (`unsupported_file` 415), без перекодирования. Это личные данные, поэтому
  хранилище **закрытое**: S3 без `S3_PUBLIC_URL` — тот же бакет под `private/`; с публичным бакетом или без S3 — диск
  `PRIVATE_FILES_DIR` (по умолчанию `/data/private` в production — тот же постоянный диск Railway, `./.private`
  локально). `GET /v1/files/…` их не отдаёт; скачать — `GET /v1/biz/:businessId/clients/:id/files/:fileId/content`
  (cookie сессии, право «Клиенты: просмотр», клиент этого бизнеса; `Content-Disposition: attachment`, `nosniff`,
  `no-store`). Старые строки с data: URL работают как раньше (скачиваются тем же адресом). Мок — без изменений.
- **Уборка неиспользуемых файлов** (воркер, каждую ночь 03:40 по Еревану): строки `uploads` старше 7 дней, ключ
  которых не встречается ни в одной текстовой/JSON-колонке базы (кроме журналов изменений) и ни в одном документе
  клиента, — удаляются вместе с файлами. По умолчанию **пробный режим**: только строка в логе воркера
  `uploads.cleanup (пробный режим…)` со списком того, что удалилось бы. Удалять — `UPLOADS_CLEANUP=1` в Railway
  (сервис `worker`), после того как неделю отчёты выглядят правильно. Файлы моложе 7 дней не трогаются никогда.

## Защита API от нагрузки поисковиков (04.10.2026)

Публичные страницы, которые сайт рисует на сервере (`/b/<slug>`, `/masters/<id>`, `/places/<id>`, картинки соцсетей,
`sitemap.xml`), берут данные с API. Чтобы поисковый робот, листающий сотни страниц, не превращался в сотни запросов:

- **Кэш Next** (`src/lib/seo/publicData.ts`): страница салона/мастера/места — 5 минут, sitemap — 10 минут. Только общие
  для всех данные: запрос к API идёт без cookie посетителя, личное (вошедший человек) читает экран в браузере.
  Главная и поиск на сервере к API не ходят.
- **Лёгкий список для sitemap**: `GET /v1/public/sitemap` (slug, сферы, районы, фото, даты изменения) вместо каталога
  с окнами; ответ кэшируется в памяти сервера и `Cache-Control: public, max-age=600`.
- **Лимиты по IP** на сервере — как были (`@RateLimit`, Redis). Все посетители сайта приходят к API с нескольких адресов
  Vercel, поэтому SSR сайта подписывает запросы секретом: заголовок `X-BT-SSR`. С верным секретом публичные GET-лимиты
  умножаются на `SSR_RATE_MULTIPLIER` (20) и считаются в своей корзине; записи (код, запись, отмена) — как у всех.
  Секрет не задан ни там, ни там — обычные лимиты для всех (ничего не ломается).

| Где | Переменная | Значение |
|---|---|---|
| Vercel `booktime-web` (Production и Preview), только сервер — без `NEXT_PUBLIC_` | `SSR_SHARED_SECRET` | случайная строка: `openssl rand -hex 32` |
| Railway `api` (production и staging) | `SSR_SHARED_SECRET` | то же значение, что в Vercel этого окружения |
| Railway `api` | `SSR_RATE_MULTIPLIER` | по желанию, по умолчанию 20 |
| Railway `api` | `TRUST_PROXY` | `1` — IP для лимитов берётся из `X-Forwarded-For` прокси Railway (без него все запросы для лимитов — с адреса прокси) |

После смены переменной в Vercel — пересборка (Redeploy), в Railway — перезапуск сервиса. Проверка:
`curl -sI https://api.booktime.am/v1/public/sitemap | grep -i cache-control`.

## Автопроверки (GitHub Actions)

- `.github/workflows/ci.yml` в обоих репозиториях, на каждый push в `develop`/`main` и pull request:
  сайт — tsc, eslint, тесты правил (`src/domain/rules/tests/run.mjs`), `check-tokens`; сервер — prisma generate, tsc,
  `npm test`, сверка прав с сайтом (`check-permissions.mjs`), сборка. Выкладку не блокируют (её делают Vercel и
  Railway сами) — красная галочка в GitHub значит «не сливать `develop` → `main`, пока не починим».

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
- **«Войти через Google»** (03.10.2026) — без Client ID кнопки нет, вход по номеру работает как раньше. Что сделать владельцу:
  1. console.cloud.google.com → создать проект **BookTime** (или выбрать существующий).
  2. APIs & Services → **OAuth consent screen** (Google Auth Platform → Branding): User type **External**, имя
     приложения **BookTime**, почта поддержки, логотип (необязательно); Authorized domains — **booktime.am**; ссылки на
     главную (https://booktime.am), **политику конфиденциальности** и условия использования (страницы должны открываться
     без входа). Scopes — только базовые `openid`, `email`, `profile` (проверка Google для них не нужна). Publishing
     status — **In production** (в Testing войти могут только добавленные тестовые аккаунты).
  3. APIs & Services → **Credentials** → Create credentials → **OAuth client ID** → Application type **Web application**,
     имя «BookTime web». **Authorized JavaScript origins**: `https://booktime.am`, `https://staging.booktime.am`,
     `http://localhost:3710` (и `https://demo.booktime.am`, если там нужен настоящий Google). Redirect URIs не нужны.
  4. Прислать **Client ID** (вида `…apps.googleusercontent.com`; секрет не нужен). Дальше ставим:
     Vercel (оба окружения) `NEXT_PUBLIC_GOOGLE_CLIENT_ID=<Client ID>` (переменная сборки — нужна пересборка),
     Railway (api и api-staging) `GOOGLE_CLIENT_ID=<Client ID>`; для Android/iOS-приложений позже — их Client ID
     через запятую в `GOOGLE_CLIENT_ID`.
  5. Миграция `20261003120000_user_identities_google` (таблица `user_identities`) применится сама при выкладке сервера.
  - iOS-приложение: раз в нём есть «Войти через Google», App Store требует ещё **«Войти через Apple»** (правило 4.8) —
    сделано (03.10.2026): сервер `POST /v1/auth/apple`, env Railway `APPLE_CLIENT_IDS=am.booktime.app,am.booktime.business`
    (пусто — вход через Apple выключен).
  - **Войти через Apple: отзыв при удалении аккаунта** (App Store 5.1.1(v), код готов 04.10.2026). Приложение присылает
    вместе с identity token одноразовый `authorizationCode`; сервер меняет его на refresh token Apple и хранит
    зашифрованным (`user_identities.refresh_token_enc`); когда наступает удаление аккаунта (25 дней после запроса),
    воркер отзывает его (`https://appleid.apple.com/auth/revoke`, задача `apple.revoke`, до 6 повторов) — удаление от
    Apple не зависит. Нужно в Railway (api и worker, оба окружения):
    - Apple Developer → Certificates, IDs & Profiles → **Keys** → «+» → включить **Sign in with Apple** → Configure →
      Primary App ID `am.booktime.app` → Register → скачать `.p8` (один раз!), записать **Key ID**; **Team ID** — в
      правом верхнем углу (Membership).
    - `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (содержимое `.p8` целиком; переводы строк можно `\n`).
    - `SECRETS_KEY` — ключ шифрования токенов в базе: `openssl rand -base64 32`, одно значение на окружение, менять
      нельзя (сохранённые токены перестанут расшифровываться). Хранить копию в менеджере паролей.
    Без этих переменных вход через Apple работает как раньше, токены не сохраняются, в логе — предупреждение
    `apple tokens: … skipped — not configured`.
- **Вход проверяющих App Store / Google Play** (код готов 04.10.2026, по умолчанию выключен). Railway, api (окружение,
  где проверяют — обычно production; сначала проверить на staging): `REVIEW_LOGIN_PHONES` — номера через запятую в
  формате `+37400000101,+37400000102`, `REVIEW_LOGIN_CODE` — 4 случайные цифры (не `0000`/`1234`, своё на окружение).
  Оба заданы — эти номера входят постоянным кодом, сообщение не отправляется; лимиты и 5 попыток — как у всех; в журнале
  входов канал `review`, в логе — `review login code used` (без кода). Пусто хотя бы одно — выключено; код не из 4 цифр —
  сервер не стартует. Номера, салон «BookTime Demo» и текст для проверяющих — [store/review-notes.md](store/review-notes.md).
- Приложения iOS/Android (`../booktime-mobile`, README там): диплинки — env Vercel (production) `APPLE_TEAM_ID`,
  `ANDROID_SHA256_CERT`, `ANDROID_BUSINESS_SHA256_CERT` (без них `/.well-known/*` — 404); пуши — env Railway `FCM_*`.
- Vercel Hobby — только некоммерческое использование; для салонов — Vercel Pro.

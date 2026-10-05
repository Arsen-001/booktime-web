# Ответы на анкеты App Privacy (App Store) и Data safety (Google Play)

Ответы собраны 04.10.2026 по коду, а не по догадкам. Откуда брали:
- сервер — `booktime-backend`: `prisma/schema.prisma`, `src/modules/auth/*`, `account-anonymize.ts`, `uploads/*`, `jobs/*`;
- сайт — `src/lib/analytics.ts`, `src/shell/AnalyticsScripts.tsx`, `src/lib/sentry-options.ts`;
- приложения — `booktime-mobile`.

Текст для людей лежит в https://booktime.am/privacy (`src/areas/client/legal/privacy.ts`). Поменялась обработка
данных — правьте оба места.

Приложение — это WebView с booktime.am. Apple и Google считают «собранным приложением» и то, что собирает сайт
внутри него. Поэтому ответы описывают сайт + сервер + нативный слой (пуш-токен).

## Факты, на которых держатся ответы

| Вопрос | Ответ | Где в коде |
|---|---|---|
| Отслеживание (tracking) между приложениями и сайтами других компаний | **Нет**. Рекламных SDK, IDFA/AAID и брокеров данных нет. App Tracking Transparency не нужен. | зависимости сайта и приложений |
| Реклама третьих лиц | Нет | — |
| Продажа данных | Нет | — |
| Шифрование при передаче | Да, только HTTPS | Vercel, Railway |
| Можно ли удалить данные | Да, в приложении (25 дней) и по почте; страница https://booktime.am/account-deletion | `ACCOUNT_DELETION_DAYS`, `auth-housekeeping.ts` |
| Можно ли получить копию своих данных | Да, сразу, файлом JSON: клиент — «Профиль» → «Скачать мои данные», сотрудник — «Личный кабинет» → «Конфиденциальность»; кто не может войти — по почте info@booktime.am (30 дней) | `GET /v1/me/data-export` (`account-data-export.ts`), `ProfileScreen.tsx`, `PrivacyTab.tsx` |
| Контакты телефона | **Не читаем** | нет такого кода |
| Местоположение | Только по разрешению; координаты уходят в запрос поиска и **не сохраняются** | `catalog.controller.ts` (lat/lng) |
| Платёжные данные | **Не собираем**. Платёжного провайдера нет, предоплата — перевод на реквизиты мастера. | `adapters/payments` (Fake) |
| Аналитика | Vercel Web Analytics + PostHog EU: без cookie, без имён и телефонов, IP не хранится, DNT/GPC уважаются | `analytics.ts` |
| Ошибки | Sentry EU: пользователь, cookie, заголовки и тело запроса вырезаются | `sentry-options.ts`, `common/monitoring/sentry.ts` |
| Пуш-токен | FCM-токен устройства → `push_tokens` (привязан к аккаунту) | `/v1/me/push-tokens` |
| IP-адрес | Хранится с сеансами, журналом входов (1 год) и кодами (1 день) — для безопасности | `sessions`, `login_events`, `otp_requests` |

---

## App Store → App Privacy — «BookTime» (am.booktime.app)

**Do you or your third-party partners collect data from this app?** — Yes.

Для всех типов ниже **Used for tracking — No**.

| Тип данных (Apple) | Собираем | Связаны с человеком (Linked) | Зачем (Purposes) |
|---|---|---|---|
| Contact Info → **Name** | Да | Да | App Functionality |
| Contact Info → **Phone Number** | Да | Да | App Functionality |
| Contact Info → **Email Address** | Да, только при входе через Google или Apple | Да | App Functionality |
| User Content → **Photos or Videos** | Да: фото профиля (по желанию) | Да | App Functionality |
| User Content → **Other User Content** | Да: отзывы, комментарий к записи, дневник | Да | App Functionality |
| User Content → **Customer Support** | Да: обращения в поддержку | Да | App Functionality |
| Identifiers → **User ID** | Да: id аккаунта, id Google/Apple | Да | App Functionality |
| Identifiers → **Device ID** | Да: пуш-токен устройства (FCM) | Да | App Functionality |
| Usage Data → **Product Interaction** | Да: обезличенные просмотры страниц и шаги записи | **Нет** | Analytics |
| Diagnostics → **Crash Data** | Да: отчёты об ошибках Sentry без личных данных | **Нет** | App Functionality |
| Location → **Precise Location** | По разрешению, для «рядом». Не сохраняется. | **Нет** | App Functionality |
| Other Data → **Other Data Types** | Пол, дата рождения, район (по желанию, в профиле) | Да | App Functionality |

**Не собираем:**
- Health & Fitness, Financial Info, Sensitive Info;
- Contacts, Browsing History, Search History (текст поиска не уходит в аналитику);
- Purchases, Audio, Gameplay;
- Advertising Data, Performance Data (`tracesSampleRate: 0`).

> Location по правилам Apple можно не указывать: данные, которые обрабатываются только в момент запроса и не
> хранятся, не считаются «собранными». Мы указываем их с запасом — так безопаснее при проверке.

## App Store → App Privacy — «BookTime Business» (am.booktime.business)

Всё, что у «BookTime», и ещё данные, которые салон вводит о своих клиентах и сотрудниках. Tracking — No.

| Тип данных | Linked | Purposes |
|---|---|---|
| Contact Info → Name, Phone Number, Email Address (сотрудника и клиентов салона) | Да | App Functionality |
| Contact Info → **Physical Address** (адрес салона/места работы) | Да | App Functionality |
| **Health & Fitness → Health** — медицинские карты и записи визитов в клиниках | Да | App Functionality |
| User Content → Photos or Videos (фото работ, салона, документы клиентов), Other User Content (заметки, комментарии, переписка с клиентами), Customer Support | Да | App Functionality |
| Identifiers → User ID, Device ID (пуш-токен) | Да | App Functionality |
| Usage Data → Product Interaction | Нет | Analytics |
| Diagnostics → Crash Data | Нет | App Functionality |
| Location → Precise Location («Я сейчас на месте работы» — сохраняется как точка салона, не человека) | Да | App Functionality |
| Financial Info → **Other Financial Info** — оплаты визитов, касса, зарплата, введённые салоном (не карты) | Да | App Functionality |
| Sensitive Info — национальный ID клиента (поле карточки, по желанию салона) | Да | App Functionality |
| Other Data Types — пол, дата рождения клиентов | Да | App Functionality |

---

## Google Play → Data safety

Ответы общие для обоих приложений; отличия для Business отмечены.

**Сбор и передача:**
- Does your app collect or share any of the required user data types? — **Yes**.
- Is all of the user data collected by your app encrypted in transit? — **Yes**.
- Do you provide a way for users to request that their data is deleted? — **Yes**: в приложении и по ссылке https://booktime.am/account-deletion.

**Передача (Shared):**
- Data shared with third parties: **No**. Передача салону, к которому человек записался, — это то, о чём он сам просит.
  Подрядчики, которые обрабатывают данные от нашего имени, тоже не считаются «sharing» по правилам Google: Telegram,
  Twilio и Meta доставляют коды, Firebase — пуши, Sentry — ошибки, PostHog — аналитика.
- Если салон-получатель вызывает сомнения, отметьте Name и Phone как Shared → App functionality. Это допустимо и безопаснее.

| Категория → тип | Collected | Обязательно / по желанию | Ephemeral | Зачем |
|---|---|---|---|---|
| Personal info → **Name** | Да | Обязательно | Нет | App functionality, Account management |
| Personal info → **Email address** | Да | По желанию (Google/Apple) | Нет | Account management |
| Personal info → **Phone number** | Да | Обязательно | Нет | App functionality, Account management, Fraud prevention & security |
| Personal info → **User IDs** | Да | Обязательно | Нет | Account management |
| Personal info → **Other info** (пол, дата рождения, район) | Да | По желанию | Нет | App functionality |
| Personal info → **Address** — *только Business* (адрес салона) | Да | По желанию | Нет | App functionality |
| Health and fitness → **Health info** — *только Business* (карты клиник) | Да | По желанию | Нет | App functionality |
| Financial info → **Other financial info** — *только Business* (касса, оплаты) | Да | По желанию | Нет | App functionality |
| Location → **Approximate** и **Precise location** | Да | По желанию | **Да** (клиент) / Нет (Business) | App functionality |
| Photos and videos → **Photos** | Да | По желанию | Нет | App functionality |
| Files and docs — *только Business* (документы клиентов) | Да | По желанию | Нет | App functionality |
| Messages → **Other in-app messages** (комментарии, отзывы, переписка салона с клиентом) | Да | По желанию | Нет | App functionality |
| App activity → **App interactions** (обезличенные просмотры и шаги) | Да | Обязательно* | Нет | Analytics |
| App activity → **Other user-generated content** (отзывы) | Да | По желанию | Нет | App functionality |
| App info and performance → **Crash logs**, **Diagnostics** | Да | Обязательно* | Нет | App functionality |
| Device or other IDs → **Device or other IDs** (FCM-токен) | Да | По желанию (разрешение на уведомления) | Нет | App functionality |

\* Статистику и отчёты об ошибках нельзя выключить настройкой в приложении: она отключается сигналом Do Not Track / GPC
браузера, а в WebView такого сигнала нет. Поэтому — «обязательно».

**Не собираем:**
- Financial (карты и счета), Contacts, Calendar;
- Audio, Music, Web browsing history;
- Installed apps, SMS/Call logs;
- Race, religion, sexual orientation, political views.

## Что поменять, если появится

- Онлайн-оплата картой (ArCa / Idram / Telcell) → Financial info → Payment info / Purchase history, раздел «Кому передаём» в /privacy.
- Почта (рассылки), SMS-провайдер Армении, Cloudflare R2 для файлов → дописать подрядчика в /privacy (раздел «Кому мы передаём данные»).
- Session replay / heatmaps в PostHog → Usage Data → Other Usage Data, App activity → Other actions.
- Реклама или IDFA → Tracking = Yes и App Tracking Transparency (сейчас этого нет и не планируется).

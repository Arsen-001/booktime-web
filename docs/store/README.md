# Выпуск в App Store и Google Play — что сделать владельцу

Два приложения из `../booktime-mobile` (Capacitor, обёртка над booktime.am):

| | Название | Bundle ID / applicationId | Открывает |
|---|---|---|---|
| Клиенты | BookTime | `am.booktime.app` | https://booktime.am/ |
| Салоны | BookTime Business | `am.booktime.business` | https://booktime.am/biz |

Версия 1.0.0, сборка 1 (Android `versionName 1.0.0` / `versionCode 1`; iOS `MARKETING_VERSION 1.0.0` /
`CURRENT_PROJECT_VERSION 1`). Перед каждой следующей загрузкой номер сборки увеличивается.

## Что лежит в этой папке

| Файл | Что это |
|---|---|
| [listing-client.md](listing-client.md) | Тексты «BookTime»: название, подзаголовок, ключевые слова, описание, «что нового», категории, возрастной рейтинг, URL — hy/ru/en |
| [listing-business.md](listing-business.md) | То же для «BookTime Business» |
| [privacy-answers.md](privacy-answers.md) | Ответы на App Privacy (Apple) и Data safety (Google) по типам данных |
| [review-notes.md](review-notes.md) | Заметки проверяющим, предложение демо-входа (номер + постоянный код через env), App access для Play |
| `assets/` | Иконка App Store 1024×1024 без прозрачности, иконка Play 512×512, баннеры Play 1024×500 (client/business × ru/hy/en). Пересобрать: `npm run store-assets` в booktime-mobile |
| `screenshots/` | Скриншоты, **в git не попадают** (13 МБ, см. .gitignore). Пересобрать: `node docs/store/make-screenshots.mjs` |
| `make-screenshots.mjs` | Скриншоты с дев-сервера или `BASE=https://demo.booktime.am` (демо-данные) |
| `check-limits.mjs` | Проверка длины полей в listing-*.md |

Скриншоты: `screenshots/<client|business>/<ru|hy>/<устройство>/NN-<экран>.png`.

| Устройство | Размер | Что это |
|---|---|---|
| `iphone69` | 1320×2868 | iPhone 6.9″ — обязательный размер, 6.5″ Apple построит из него |
| `android` | 1080×1920 | Телефон Google Play |
| `ipad13` | 2064×2752 | iPad 13″, только ru — нужен, если приложение остаётся универсальным |

Экраны BookTime: главная, поиск, страница салона, выбор времени, мои записи.
Экраны Business: журнал, клиенты, окно записи, заказы, онлайн-запись.

Публичные страницы, которые требуют магазины (работают без входа, на трёх языках):
- политика конфиденциальности — https://booktime.am/privacy (`/hy/privacy`, `/en/privacy`);
- пользовательское соглашение — https://booktime.am/terms;
- удаление аккаунта — https://booktime.am/account-deletion.

Тексты лежат в `src/areas/client/legal/`, реквизиты — в `src/areas/client/legal/operator.ts`.

---

## 🔴 Блокеры — закрыть до отправки на проверку

1. **Реквизиты оператора** в `src/areas/client/legal/operator.ts`: `[Юридическое лицо]`, `[Адрес]`,
   `[Email для обращений]` (на ru/hy/en). Сейчас на /privacy, /terms и /account-deletion — заглушки.
2. **Демо-вход для проверяющих** — код на сервере готов и выключен (04.10.2026). Владелец задаёт env `REVIEW_LOGIN_PHONES`
   и `REVIEW_LOGIN_CODE` (сначала staging) и заводит салон «BookTime Demo» ([review-notes.md](review-notes.md)).
   Без этого Apple отклонит по 2.1.
3. **Почта поддержки и страница помощи.** Apple требует Support URL с контактами. Пока это `https://booktime.am/terms#contacts`
   (там появится почта из пункта 1), лучше отдельная страница.

**Закрыто 04.10.2026:**
- **3.1.1, оплата в приложении.** В приложениях iOS и Android нет «Подписки», «Монет», продвижения и сторис за монеты:
  - нет пунктов меню, плиток и полосы «продлите»;
  - по прямому адресу — строка «Оплата в приложении недоступна» без ссылки;
  - код: `useHideDigitalPurchases()` в `src/lib/native/useNativeApp.ts`, `src/areas/settings/NativePurchaseGate.tsx`.

  В браузере всё как раньше.
- **Ссылки на документы.** Ссылки на /terms и /privacy (`LegalDocLink`) есть:
  - на входе и во входе при записи;
  - в согласии онлайн-записи салона;
  - при регистрации бизнеса;
  - в кабинете → Конфиденциальность → «Документы».
- **Удаление у клиента.** Окно говорит «удалится через 25 дней». После запроса в профиле видна дата и кнопка «Отменить
  удаление» (`POST /v1/me/account/delete/cancel`).
- **«Мои данные».** Кнопка «Скачать мои данные» сразу отдаёт JSON-файл: `GET /v1/me/data-export` — профиль, записи,
  входы, свои карточки сотрудника, без секретов.

---

## Шаги, когда аккаунты готовы

### 0. Один раз — общее (Firebase, Apple, Google)
1. **Firebase** (console.firebase.google.com) — проект BookTime, в нём 4 приложения:
   - iOS `am.booktime.app`, iOS `am.booktime.business`;
   - Android `am.booktime.app`, Android `am.booktime.business`.
2. Скачайте `GoogleService-Info.plist` и `google-services.json` в `booktime-mobile/config/client/` и `config/business/`.
3. Ключ сервиса Firebase → env Railway (api и worker, production): `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`.
4. **APNs-ключ:** developer.apple.com → Keys → «+» → Apple Push Notifications service → `.p8`.
   Загрузите его в Firebase → Project settings → Cloud Messaging (Key ID, Team ID).
5. **Ключ Sign in with Apple:** Keys → «+» → Sign in with Apple → Primary App ID `am.booktime.app` → `.p8`.
   Env Railway (api и worker):
   - `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (содержимое .p8);
   - `SECRETS_KEY` — `openssl rand -base64 32`, сохранить в менеджере паролей;
   - `APPLE_CLIENT_IDS=am.booktime.app,am.booktime.business`.

   Подробно — docs/DEPLOY.md «Войти через Apple».
6. **Google OAuth Client ID** для iOS (оба bundle id) и Android (оба applicationId, SHA-1 ключа подписи Play и debug).
   Все Client ID — через запятую в `GOOGLE_CLIENT_ID` на Railway.
7. Env Vercel (production) для диплинков:
   - `APPLE_TEAM_ID`;
   - `ANDROID_SHA256_CERT` — SHA-256 ключа подписи Play для BookTime, после шага 2.4;
   - `ANDROID_BUSINESS_SHA256_CERT` — то же для Business.

   Проверьте `https://booktime.am/.well-known/apple-app-site-association` и `/assetlinks.json`.
8. В booktime-mobile: `APPLE_TEAM_ID=XXXXXXXXXX npm run sync`. Файлы Firebase и Team ID попадут в проекты.

### 1. App Store (оба приложения)
1. developer.apple.com → Identifiers → «+» App IDs: `am.booktime.app` и `am.booktime.business`.
   Capabilities: Push Notifications, Associated Domains, Sign in with Apple.
2. App Store Connect → Apps → «+» New App:
   - Platform iOS, имя из listing-*.md (если «BookTime» занято — запасное имя оттуда);
   - Primary language **English (U.S.)**, Bundle ID, SKU `booktime-app` / `booktime-business`.
3. **Подпись** — автоматическая в Xcode:
   - `npm run open:ios -w apps/client`;
   - Target App → Signing & Capabilities → Team → «Automatically manage signing».

   Сертификаты и профили Xcode создаст сам.
4. Product → Archive → Distribute App → App Store Connect → Upload. Повторите для `apps/business`.
5. **TestFlight:** через 10–30 минут сборка появится. Internal Testing работает сразу — проверьте на своём iPhone вход,
   пуш, диплинк, камеру, удаление аккаунта.
6. **App Information:**
   - категории, Content Rights («не содержит чужого контента»);
   - Age Rating — ответы в listing-*.md;
   - Privacy Policy URL.
7. **App Privacy** — по [privacy-answers.md](privacy-answers.md).
8. **Страница версии 1.0.0:**
   - English (U.S.) и Russian (Add Language): тексты из listing-*.md;
   - скриншоты `iphone69` (и `ipad13`, если оставляете iPad);
   - Support/Marketing URL, Copyright;
   - App Review Information — из review-notes.md.
9. Pricing and Availability: Free. Страны — все или начать с Армении.
10. Add for Review → Submit.

**iPad.** Приложения универсальные (`TARGETED_DEVICE_FAMILY = "1,2"`), поэтому нужны скриншоты iPad 13″.
Чтобы выпустить только для iPhone, в Xcode → General → Supported Destinations уберите iPad до первой загрузки
(потом убрать iPad нельзя).

### 2. Google Play (оба приложения)
1. Play Console → Create app:
   - имя, язык по умолчанию **Armenian (hy-AM)** (или ru-RU);
   - App, Free;
   - согласия.
2. **Ключ загрузки** — один на приложение, хранить вне git:
   ```bash
   keytool -genkeypair -v -keystore booktime-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```
   Положите `apps/<app>/android/keystore.properties` (storeFile, storePassword, keyAlias, keyPassword) и выполните
   `npm run sync`. Подпись подхватится сама.
3. Сборка: `cd apps/client/android && ./gradlew bundleRelease` → `app/build/outputs/bundle/release/app-release.aab`.
4. **Play App Signing** включается при первой загрузке.
   App integrity → App signing key certificate → SHA-256 → env Vercel `ANDROID_SHA256_CERT`
   (для Business — `ANDROID_BUSINESS_SHA256_CERT`). SHA-1 → Android OAuth client в Google Cloud.
5. Testing → **Internal testing** → Create release → `.aab` → тестировщики по почте → проверка на телефоне.
   Новый личный аккаунт разработчика сначала требует **Closed testing**: 12 тестировщиков 14 дней подряд.
   У аккаунта организации этого требования нет.
6. **App content:**
   - Privacy policy — https://booktime.am/privacy;
   - App access — review-notes.md;
   - Ads — «No ads»;
   - Content rating — анкета IARC из listing-*.md;
   - Target audience — Business: 18+; BookTime: 13–15, 16–17, 18+ (без «до 13», см. listing-client.md);
   - Data safety — privacy-answers.md, ссылка на удаление https://booktime.am/account-deletion;
   - Government apps — нет; Financial features — нет; Health — нет (client) / «Health apps → нет», это CRM.
7. **Main store listing:**
   - hy-AM, ru-RU, en-US — тексты из listing-*.md;
   - иконка `assets/icon-google-play-512.png`;
   - баннер `assets/feature-graphic-<app>-<lang>.png`;
   - скриншоты телефона `screenshots/<app>/<lang>/android` (для en — ru или пересобрать `--lang en`).
8. Production → Create release → тот же `.aab` → Countries → Review.

### 3. После одобрения
- Если «BookTime Demo» публиковали в каталоге на время проверки — снимите его с публикации (вход проверяющих оставьте: они вернутся на каждое обновление).
- Номер сборки — +1 на каждую загрузку.
- Сайт обновляется сам, и приложение сразу показывает новое. Новая сборка нужна, только если меняется нативная часть
  (плагины, разрешения, иконки).

## Env — сводка

| Где | Переменная | Зачем |
|---|---|---|
| booktime-mobile `config/<app>/` | `GoogleService-Info.plist`, `google-services.json` | Пуши FCM, Google Sign-In |
| booktime-mobile при `npm run sync` | `APPLE_TEAM_ID` | Подпись Xcode |
| booktime-mobile `apps/<app>/android/keystore.properties` | storeFile, storePassword, keyAlias, keyPassword | Подпись релиза Android |
| Railway api + worker | `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` | Отправка пушей |
| Railway api | `APPLE_CLIENT_IDS`, `GOOGLE_CLIENT_ID` (web + iOS + Android через запятую) | Вход Apple и Google из приложений |
| Railway api + worker | `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `SECRETS_KEY` | Отзыв входа Apple при удалении аккаунта |
| Railway api | `REVIEW_LOGIN_PHONES`, `REVIEW_LOGIN_CODE` | Вход проверяющих (пусто — выключен) |
| Vercel production | `APPLE_TEAM_ID`, `ANDROID_SHA256_CERT`, `ANDROID_BUSINESS_SHA256_CERT` | Диплинки `/.well-known/*` |

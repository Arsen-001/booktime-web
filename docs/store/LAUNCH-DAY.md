# День запуска: пришёл D-U-N-S → приложения в App Store и Google Play

Всё остальное уже готово (06.10.2026): сборки, подпись «одной настройкой», тексты, скриншоты, fastlane.
Идите сверху вниз. `booktime-mobile` — папка `~/WebstormProjects/booktime-mobile`.
Секреты держим только в `~/.booktime-secrets/` (и копию — в менеджере паролей), в git и в чаты — никогда.

Подробности по шагам: [README.md](README.md) (магазины), [review-notes.md](review-notes.md) (проверяющие),
[../DEPLOY.md](../DEPLOY.md) (env сервера), `booktime-mobile/README.md` (сборки).

---

## Apple (≈1 час + ожидание одобрения аккаунта, обычно 1–2 дня)

1. **Apple Developer Program как организация.** developer.apple.com/programs/enroll → Organization →
   D-U-N-S, юрлицо AI Switch LLC, сайт booktime.am, рабочая почта **info@booktime.am** (Apple ID на неё). $99/год.
2. Когда одобрят: developer.apple.com → Membership → **Team ID** (10 символов). Его — в три места:
   - `booktime-mobile/config/signing.xcconfig` → `DEVELOPMENT_TEAM = XXXXXXXXXX`
     (или `APPLE_TEAM_ID=XXXXXXXXXX npm run sync`). Это вся настройка подписи обоих приложений;
   - Vercel → Production → `APPLE_TEAM_ID` (universal links, файл `/.well-known/apple-app-site-association`);
   - Railway api + worker (production и staging) → `APPLE_TEAM_ID`.
3. **Identifiers** → «+» App IDs: `am.booktime.app` и `am.booktime.business`. Capabilities у обоих:
   Push Notifications, Associated Domains, Sign in with Apple.
4. **Ключ APNs:** Keys → «+» → Apple Push Notifications service → скачать `.p8` (один раз!) → в `~/.booktime-secrets/`.
   Firebase (проект `booktime-47539`) → Project settings → Cloud Messaging → у обоих iOS-приложений загрузить `.p8`,
   Key ID, Team ID.
5. **Ключ Sign in with Apple:** Keys → «+» → Sign in with Apple → Primary App ID `am.booktime.app` → `.p8`.
   Railway api + worker (оба окружения), как в DEPLOY.md «Войти через Apple»:
   `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (содержимое .p8), `SECRETS_KEY` (`openssl rand -base64 32`, сохранить),
   `APPLE_CLIENT_IDS=am.booktime.app,am.booktime.business`.
6. **App Store Connect → Apps → «+» ×2:** iOS, «BookTime» / `am.booktime.app` / SKU `booktime-app` и
   «BookTime Business» / `am.booktime.business` / SKU `booktime-business`. Основной язык **English (U.S.)**.
   Если имя «BookTime» занято — запасное из listing-client.md.
7. **Ключ для fastlane:** App Store Connect → Users and Access → Integrations → App Store Connect API → «+», роль
   App Manager → скачать `AuthKey_XXXX.p8` в `~/.booktime-secrets/` и создать `~/.booktime-secrets/asc-api-key.json`:
   ```json
   {"key_id": "XXXX", "issuer_id": "…", "key_filepath": "/Users/arsen/.booktime-secrets/AuthKey_XXXX.p8"}
   ```
8. Xcode → Settings → Accounts → войти Apple ID команды (Xcode сам заведёт сертификат и профили).

## Google (≈30 минут + проверка аккаунта Google)

9. **Play Console как организация** (play.google.com/console, $25): тип «Organization», D-U-N-S, почта
   info@booktime.am, сайт booktime.am. У аккаунта организации нет требования «12 тестировщиков 14 дней».
10. **Ключ загрузки** — один раз, сами в Терминале (агентам не поручать):
    ```bash
    cd ~/WebstormProjects/booktime-mobile && npm run upload-key
    ```
    Скрипт кладёт `booktime-upload.jks` и `android-upload.properties` в `~/.booktime-secrets/` и печатает SHA-1/SHA-256.
    **Сразу** сохраните оба файла в менеджер паролей.
11. Play Console → Create app ×2: «BookTime» и «BookTime Business», язык по умолчанию **hy-AM**, App, Free.
12. **Сервисный аккаунт для fastlane:** Google Cloud (проект `booktime-47539`) → IAM → Service accounts → создать →
    Keys → JSON → `~/.booktime-secrets/play-service-account.json`. Play Console → Users and permissions → Invite →
    почта сервисного аккаунта → права Release + Store presence для обоих приложений.

## Сборки и загрузка

13. Номера версий: 1.0.0 (1) уже стоят. Соберите:
    ```bash
    cd ~/WebstormProjects/booktime-mobile
    npm run sync                    # Team ID и файлы Firebase → проекты
    npm run build:android-release   # оба AAB, должно быть «подписан ключом загрузки»
    npm run build:ios-archive       # оба App.ipa (подпись автоматическая)
    ```
14. Первая загрузка AAB — **вручную** в Play Console (API не принимает первую сборку нового приложения):
    Test and release → Testing → Internal testing → Create release → `apps/<app>/android/app/build/outputs/bundle/release/app-release.aab`.
    Play App Signing включится сам.
15. **Отпечатки для App Links:** Play Console → приложение → Test and release → App integrity → App signing →
    скачать сертификат (`deployment_cert.der`) и выполнить
    ```bash
    node scripts/android-sha256.mjs client   ~/Downloads/deployment_cert.der
    node scripts/android-sha256.mjs business ~/Downloads/deployment_cert.der   # файл от BookTime Business
    ```
    Скрипт печатает строки для Vercel → Production: `ANDROID_SHA256_CERT=…` и `ANDROID_BUSINESS_SHA256_CERT=…`.
    SHA-1 оттуда же → Google Cloud → Credentials → Android OAuth client (вход через Google в приложении).
    Затем Redeploy в Vercel и проверка: https://booktime.am/.well-known/assetlinks.json и `/apple-app-site-association`.
16. **Вход через Google в приложениях:** Firebase → Authentication → Sign-in method → Google → Enable; скачать заново
    `GoogleService-Info.plist` обоих iOS-приложений в `booktime-mobile/config/<app>/` (появится `CLIENT_ID`),
    `npm run sync`, пересобрать. Все Client ID (web, iOS ×2, Android ×2) — через запятую в Railway `GOOGLE_CLIENT_ID`.
    Без этого в приложениях есть только кнопка Apple (так и проверено 06.10).
17. iOS: `fastlane ios upload app:client` и `app:business` → через 10–30 мин сборки в TestFlight. Поставьте на свой
    iPhone (Internal Testing) и проверьте: вход, пуш, ссылку `https://booktime.am/b/booktime-demo` из Заметок, камеру.

## Проверяющие

18. `REVIEW_LOGIN_PHONES` и `REVIEW_LOGIN_CODE` на Railway production уже заданы; код лежит в
    `~/.booktime-secrets/review-login.env`. Демо-салон: `node scripts/seed-review-demo.mjs … --production` в
    booktime-backend (review-notes.md).
19. **Бесплатные дни «BookTime Demo»** — иначе через 10 дней `/b/booktime-demo` отдаёт 404 посреди проверки:
    панель платформы → бесплатные месяцы (`POST /v1/platform/free-months`) на 12 месяцев.
20. Контакт для звонка проверяющего — `~/.booktime-secrets/review-contact.env`:
    ```
    REVIEW_CONTACT_FIRST_NAME=…
    REVIEW_CONTACT_LAST_NAME=…
    REVIEW_CONTACT_PHONE=+374…
    ```

## Карточки и отправка

21. Тексты, скриншоты, иконки и баннеры (fastlane сам пересоберёт их из `docs/store`):
    ```bash
    fastlane ios metadata app:client      && fastlane ios metadata app:business
    fastlane android metadata app:client  && fastlane android metadata app:business
    ```
22. Руками в консолях (у API этого нет):
    - App Store Connect: App Privacy — [privacy-answers.md](privacy-answers.md); Age Rating — listing-*.md;
      Pricing → Free; Content Rights.
    - Play Console → App content: Privacy policy, App access (review-notes.md), Ads — нет, Content rating (IARC),
      Target audience, Data safety (privacy-answers.md, удаление — https://booktime.am/account-deletion);
      Store settings → категория и почта info@booktime.am.
    - **iPad:** приложения универсальные, скриншоты iPad 13″ загружаются. Если решите «только iPhone» — до первой
      загрузки уберите iPad в Xcode (Supported Destinations) и запускайте `npm run store-metadata -- --no-ipad`.
23. **Отправка:**
    - App Store: `fastlane ios submit app:client build:1` и `app:business build:1` (или кнопка Add for Review).
    - Google Play: Internal testing проверен → Production → Create release → тот же AAB → Countries → Send for review.
24. После одобрения: если «BookTime Demo» публиковали в каталоге — снимите; вход проверяющих оставьте.

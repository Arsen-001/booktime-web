# Нативные приложения iOS и Android

Решение владельца 09.10.2026: приложения — **чистый нативный код, отдельно iOS и отдельно Android**, без сайта внутри
(Capacitor-обёртка `../booktime-mobile` в магазины не идёт; из неё переносим иконки, заставки, тексты магазинов,
настройки Firebase). Первым — клиентское «BookTime», потом «BookTime Business».

| | iOS | Android |
|---|---|---|
| Папка | `../booktime-ios` | `../booktime-android` |
| Язык, UI | Swift 6, SwiftUI, iOS 17+ | Kotlin, Jetpack Compose (Material 3 под наши токены), minSdk 26 |
| Проект | `project.yml` → `xcodegen generate` (`.xcodeproj` не в git) | Gradle (Kotlin DSL), version catalog |
| Сеть | URLSession + async/await, Codable | OkHttp + Retrofit + kotlinx.serialization, корутины |
| Картинки | AsyncImage + свой кеш | Coil |
| Идентификатор | `am.booktime.app` | `am.booktime.app` |

Те же идентификаторы, что у обёртки, — приложение в магазинах одно и то же, нативная версия приходит обновлением.

## Сервер

Тот же `booktime-api`, ничего не меняем. Адрес: release — `https://api.booktime.am`, debug — переключатель
(локальный `http://localhost:4010` с демо-данными и кодом входа `0000`, staging `https://api-staging.booktime.am`, production).
Android-эмулятор ходит на локальный сервер через `adb reverse tcp:4010 tcp:4010`.

- Описание всех запросов — `../booktime-backend/openapi/openapi.json`. Клиенту нужны `/v1/public/*`, `/v1/me/*`,
  `/v1/auth/*` (session, channels, code, verify, google, apple, logout).
- Вход: `POST /v1/auth/code {phone, channel}` → `POST /v1/auth/verify {phone, code, app:'client', consent, locale}`.
  Сессия — httpOnly cookie `bt_session` (`bt_session_stg` на staging): хранить в cookie-хранилище (HTTPCookieStorage /
  OkHttp CookieJar с сохранением на диск), отдавать на каждый запрос. Выход — `POST /v1/auth/logout`.
- Ошибки — `{ code, message }`; язык ответов — заголовок `Accept-Language` (hy/ru/en).
- Какой экран сайта каким запросом пользуется — `src/api/client*.ts`, `src/api/*` сайта (это эталон поведения).

## Экраны клиента (эталон — сайт, `src/app/(client)/**`, `src/areas/client/**`)

Нижние вкладки как на сайте (`src/shell/client/ClientTabBar.tsx`): Главная, Поиск, Мои записи, Избранное, Профиль.

1. Главная: сторис, ближайшая запись, каталог мест и мастеров (`/v1/public/catalog`, `/v1/public/stories/home`).
2. Поиск: строка, сферы, быстрые чипы («Свободно сегодня» и др.), карточки.
3. Место (`/places/{id}`): шапка, услуги, мастера, отзывы, контакты, кешбэк, подписка ❤.
4. Мастер (`/masters/{id}`): услуги, дни и слоты, отзывы, звёздочка.
5. Запись (`/book`): услуга → (оттенок, доп. услуги) → мастер → день и время → подтверждение → гость входит по коду
   → «Готово». Окно «мастер принимает не всех», лист ожидания.
6. Мои записи: предстоящие и прошедшие, карточка записи, отмена (окно отмены), перенос, повтор, предоплата, отзыв.
7. Избранное, уведомления (входящие), профиль (имя, язык, тема, уведомления, приглашения, удаление аккаунта, выход).
8. Сертификаты, абонементы, карты лояльности, дневник, поддержка, документы (privacy, terms, account-deletion).
9. Вход: телефон → код (Telegram / WhatsApp / SMS из `/v1/auth/channels`) → согласие; Apple (iOS), Google.
10. Нативное: пуши FCM (`POST /v1/me/push-tokens`), диплинки `booktime.am/b/*`, `/s/*`, `/bookings*`, «Поделиться».

## Дизайн и тексты

- Цвета, радиусы, тени — из `src/styles/tokens.css` (светлая и тёмная тема), шрифты — Noto Sans + Noto Sans Armenian,
  заголовки Manrope. Выглядит как сайт, но по-нативному: системная навигация, жесты «назад», шторки, haptics.
- Тексты — только из `messages/{hy,ru,en}/client.json` и `common.json` сайта: скрипт в каждом репозитории
  (`scripts/sync-strings.mjs`) собирает из них `Localizable.xcstrings` / `values-*/strings.xml`. Язык — системный,
  с выбором в профиле; по умолчанию hy.
- Проверка — каждый экран на симуляторе iPhone и эмуляторе Android рядом со снимком сайта на 390 px.

## Сборка на этом Mac

16 ГБ памяти: тяжёлые шаги (xcodebuild, gradle, симулятор, эмулятор) — по одному, через общий замок
`until mkdir /tmp/booktime-build.lock 2>/dev/null; do sleep 5; done` … `rmdir /tmp/booktime-build.lock`.
JDK — `~/Library/Java/temurin-21/Contents/Home`, Android SDK — `~/Library/Android/sdk`.

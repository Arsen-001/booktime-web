# Заметки для проверяющих (App Review / Google Play) и демо-доступ

Apple требует рабочий вход (правило 2.1): проверяющий должен попасть в приложение без нашей помощи. Google Play
спрашивает то же в Policy → App content → App access. Сейчас на production **такого входа нет**:
- постоянный код `DEV_LOGIN_CODE` работает только при `NODE_ENV=development` (`booktime-backend/src/modules/auth/otp.service.ts`, `makeCode`);
- армянский номер проверяющий получить не может, коды приходят только на +374.

Поэтому есть вход проверяющих: **реализован в коде сервера (04.10.2026), выключен по умолчанию.** Включает владелец
env на Railway — сначала на staging, потом на production.

## Номера для проверки с постоянным кодом

**Сервер** (`booktime-backend`, сделано):
1. env `REVIEW_LOGIN_PHONES` — номера через запятую в формате `+374XXXXXXXX`, например `+37400000101,+37400000102`
   (зона, которую не выдают абонентам), и env `REVIEW_LOGIN_CODE` — 4 цифры, свои на каждое окружение, не `0000` и не `1234`.
2. `OtpService.send()`: номер в `REVIEW_LOGIN_PHONES` — код = `REVIEW_LOGIN_CODE`, никуда не отправляется. В ответе
   `channel: 'telegram'`, экран выглядит как обычно. Запись в `otp_requests`, 60 с между кодами, лимиты на номер и
   адрес, 5 попыток — как у всех; канал `review` в `otp_requests` и журнале входов — входы проверяющих видно.
   В лог — `review login code used` (info, номер с маской, без кода).
3. `verify()` не менялся: неверный код отклоняется (`wrong_code`), чужой номер с этим кодом — тоже.
4. Пусто хотя бы одно — механизм выключен (по умолчанию). Код не из 4 цифр или номер не в формате — сервер не стартует.
5. Тесты — `src/modules/auth/otp.service.test.ts` («вход проверяющих: …»).

**Данные на production** (после выкладки):
- **Клиент** `+37400000101`, имя «App Review».
  - Чтобы проверяющий мог записаться, нужен салон, который не путает настоящих клиентов. Заведите «BookTime Demo»
    (сфера «Маникюр», 2 мастера, 5 услуг, окна на 2 недели вперёд), владелец — `+37400000102`.
  - **Не публикуйте его в каталоге.** Ссылка для проверяющего — `https://booktime.am/b/booktime-demo`. В приложении:
    Search / Поиск, или откройте ссылку (диплинк).
  - Если поиск без опубликованных салонов пустой, на время проверки опубликуйте «BookTime Demo» с районом
    «Кентрон» и снимите после одобрения.
- **Business** `+37400000102` — владелец «BookTime Demo». Чтобы журнал не был пустым, нужны 20–30 клиентов и
  записи на неделю (импорт из Excel: `/biz/clients` → «Перенести клиентов»).
- **Запасной путь без правки сервера (только Business).** В кабинете уже есть вход по логину и паролю
  (`POST /v1/auth/password`, `staff_logins`). Создайте сотруднику «BookTime Demo» логин `appreview` с паролем и
  снимите `mustChangePassword` (по умолчанию `true`, иначе проверяющего попросят сменить пароль). Для клиентского
  приложения такого пути нет: вход только по номеру.

**Env** (Railway, api, production и staging):

| Переменная | Пример | Где |
|---|---|---|
| `REVIEW_LOGIN_PHONES` | `+37400000101,+37400000102` | api |
| `REVIEW_LOGIN_CODE` | 4 случайные цифры | api |

После одобрения обеих версий код можно оставить: проверяющие возвращаются при каждом обновлении. Держите код вне
публичных мест и меняйте его, если он утёк.

---

## Текст для App Store Connect → App Review Information

**Sign-in required:** Yes. User name: `+374 00 000 101` (клиент) / `+374 00 000 102` (Business), Password: `<REVIEW_LOGIN_CODE>`.

**Notes (BookTime)** — на английском, его читают проверяющие:
```text
BookTime is an online booking service for salons and professionals in Armenia (booktime.am).

Sign in: tap "Profile" → enter phone +374 00 000 101 → the app asks for a 4-digit code → enter <CODE>. This review number does not receive real messages; the code is fixed for review.

To make a test booking: open https://booktime.am/b/booktime-demo (or Search → "BookTime Demo") → pick a service → "Any master" → a time → confirm.

Native features: push notifications (booking reminders and status changes), universal links to booktime.am/b/* and /bookings, native share sheet, Sign in with Apple and Sign in with Google.

Sign in with Apple is offered next to Sign in with Google on the sign-in screen (iOS only). New users confirm their phone number once, because bookings are tied to a phone number that the salon sees.

Account deletion: Profile → "Delete account" (bottom of the screen). The account is erased 25 days after the request, and the Apple refresh token is revoked at that moment (POST https://appleid.apple.com/auth/revoke). Public instructions: https://booktime.am/en/account-deletion

The app does not sell digital goods. Prepayments for salon services (a physical service) are transferred by the client directly to the salon's bank details outside the app.
```

**Notes (BookTime Business):**
```text
BookTime Business is a booking calendar and client base for salons, clinics, independent professionals and workshops in Armenia.

Sign in: enter phone +374 00 000 102 → code <CODE> (fixed review number, no real messages are sent). You will see the demo salon "BookTime Demo" with staff, services, clients and bookings.

Try: Calendar → tap a booking (booking window: status, payment, client); "+ Booking" to create one; Clients; More → Orders.

Native features: push notifications for new, moved and cancelled bookings, universal links to booktime.am/biz, camera for photos of work and the inventory barcode scanner, share sheet, Sign in with Apple / Google.

Account deletion: Settings → Personal account → Account management → "Delete my account". It happens 25 days after the request (the owner can transfer the salon first and can cancel during this time). The Apple token is revoked on deletion. Instructions: https://booktime.am/en/account-deletion

No digital goods are sold in the app. Business subscriptions are invoiced to companies outside the app, and the app has no purchase buttons or links to them on iOS.
```
> Так и есть с 04.10.2026: в приложениях iOS и Android нет «Подписки», «Монет», продвижения и сторис за монеты — вместо экрана строка без ссылки (`NativePurchaseGate`).

**Contact information:** имя, телефон и почта владельца — для звонка проверяющего (поля Contact First/Last Name, Phone, Email).

## Google Play → App content → App access

- Выберите «All or some functionality is restricted».
- Instructions: тот же номер и код, что выше, и шаги из Notes на английском.
- Отметьте «No other information is required to access my app».

## Частые причины отказа — что уже закрыто

| Правило | Как у нас |
|---|---|
| 4.2 Minimum functionality («просто сайт») | Пуши, universal links и App Links, нативный вход Apple/Google, «Поделиться», офлайн-экран, системные полосы, «Назад» Android |
| 4.8 Sign in with Apple | Есть рядом с Google, только в iOS |
| 5.1.1(v) удаление аккаунта | В приложении; отзыв токена Apple на сервере (код готов, нужны env `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `SECRETS_KEY`) |
| 5.1.1 подписи разрешений | Камера, фото, место — en/ru/hy (`scripts/native.mjs`, 04.10.2026) |
| 2.3.10 другие платформы в тексте | В текстах iOS нет Android и Google Play |
| 3.1.1 встроенные покупки | В приложениях (iOS и Android) нет оплаты подписки, монет и покупок за монеты, нет ссылок на оплату снаружи (`src/lib/native/useNativeApp.ts`, `src/areas/settings/NativePurchaseGate.tsx`) |
| 5.1.2 / ATT | Отслеживания нет, ATT не нужен |

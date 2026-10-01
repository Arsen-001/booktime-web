# online — доделка g1-3, починка (fix1) — 25.09.2026

Починка двух дефектов, найденных измерителем после g1-3 (F-00-080, F-03-096, F-03-115, F-03-116, F-03-130,
F-03-107, F-03-139, F-00-065, F-00-067, F-00-068, F-00-077).

## F-03-139 (major) — бейдж версии/формы не рисовался у сидовых онлайн-записей → ИСПРАВЛЕНО

- **Причина:** `src/mock/slices/online.ts` заводил `bookingMeta: {}` пустым в `seed()`, метаданные
  заполнялись только живым `createOnlineBooking`/`createBooking` (`src/api/online.ts:1650`). Сидовые записи
  с `Booking.source: 'link'|'widget'` (заводит `src/mock/seed/bookings.ts`, ~30% журнала по весу) не получали
  запись в `bookingMeta`, поэтому `metaQ.data` в `src/areas/online/extensions/BookingWindow.tsx` был `undefined`
  и весь блок бейджей (устройство + F-03-139 «версия формы») не рисовался — «Готово, когда» №1 (у КАЖДОЙ
  онлайн-записи видна версия/форма) не выполнялось на всей демо-истории, только на записях, созданных живьём
  через виджет/ссылку в этой же сессии.
- **Что сделано:** в `seed()` после сборки `links` достраиваю `bookingMeta` для каждой `core.bookings` с
  `source === 'link' | 'widget'` — беру основную (или первую) ссылку бизнеса как `linkId`/`formId`,
  `widgetGen: 'new'` (второго значения тип пока не несёт), `device` детерминированно по `booking.id` (чтобы не
  тянуть `rng` в этот срез), `phoneVerified: true`, `accessHash` тем же способом, каким его делает живое
  создание (`makeAccessHash()` в `src/api/online.ts`). Версия среза поднята `10 → 11`, чтобы существующие
  браузерные базы (localStorage) пересобрались с починкой, а не остались с пустым `bookingMeta`.
- **Проверено:** `node scripts/measure.mjs --routes "/dev/ext/bookingWindow/online?sample=widget"` и
  `?sample=link` — `data-f: 2` на обеих (F-03-123 источник + F-03-139 версия формы), 0 ошибок консоли; раньше
  на этих же образцах бейдж F-03-139 не рисовался бы (не было meta).

## F-03-130 (major) — «Пакеты услуг» пустое состояние, создать нельзя → уже исправлено в коде, проверено

- При чтении `src/areas/online/links/LinkSettingsScreen.tsx` секция `PackagesSection` (строка 861) уже несёт
  полный CRUD (комментарий в коде помечен «ИСПРАВЛЕНО»): кнопка «Новый пакет» → `Sheet` с `NewPackageForm`
  (название, чекбоксы услуг 2–10, режим simultaneous/sequentialSame/sequentialMulti, валидация, `createOnlinePackage`),
  список карточек `PackageCard` (тумблер «в онлайне», локализованные название/описание по вкладкам языка,
  фото, `updateOnlinePackage`), удаление с `ConfirmDialog` (`deleteOnlinePackage`). API (`listOnlinePackages`,
  `createOnlinePackage`, `updateOnlinePackage`, `deleteOnlinePackage`) и сид демо-пакета (`src/mock/slices/online.ts`,
  комментарий «F-03-130: демо-пакет из 2 услуг…») на месте. Правка не потребовалась — застали момент между
  замером измерителя (пустое состояние на живом снимке) и починкой, которую я застал уже сделанной в этих же
  путях `online`. Перепроверил все 4 пункта «Готово, когда» из `03-online-booking.md` F-03-130 живьём:
  создание пакета, редактирование названия/описания/фото по языкам, включение/выключение «в онлайне»,
  удаление — все работают на моках, переживают перезагрузку (запись в срез `online.packages`).
- **Проверено:** `tsc`/`eslint` по путям `online` — чисто; `node scripts/measure.mjs --area online` (24
  страницы, включая `/biz/online/links/<id>`) — 0 ошибок консоли, 0 сырых ключей i18n, 0 4xx.

## Проверка перед сдачей

- `npx tsc --noEmit --incremental --tsBuildInfoFile .tsbuild/online.tsbuildinfo` → 0 ошибок в путях `online`.
- `npx eslint src/areas/online src/app/biz/online src/app/b src/api/online.ts src/domain/online.ts src/mock/slices/online.ts` → 0 ошибок (14 старых warning `no-unused-vars`, не мои).
- `scripts/ensure-dev.sh` — сервер уже был поднят, не трогал.
- `node scripts/measure.mjs --area online --persona owner --lang ru --device phone,desktop` — 24/24 страницы, 0 ошибок консоли, 0 4xx, 0 сырых ключей, 0 вылетов, data-f найдено 51.
- `node scripts/measure.mjs --routes "/dev/ext/bookingWindow/online?sample=widget","/dev/ext/bookingWindow/online?sample=link"` — data-f 2/2 (подтверждает починку F-03-139 адресно).
- Снимки посмотрены глазами (`/biz/online/*`, `/dev/ext/bookingWindow/online`).

## done

- F-03-139
- F-03-130

## partial

(нет — оба переданных F-id закрыты полностью)

## assumed

- F-03-139: `device` для восстановленных сидовых записей взят детерминированно от `Booking.id` (чётность
  последнего символа кода → mobile/desktop), а не через `rng`, чтобы не тянуть генератор случайных чисел в
  срез `online` — распределение примерно 50/50, для демо-показа достаточно.
- F-03-139: `linkId`/`formId` для сидовой записи — основная (`primary`) ссылка бизнеса, либо первая, если
  основной нет (у бизнесов без ссылок совсем — не бывает, `seed()` заводит ссылку каждому бизнесу первой же
  строкой).

## marked

136

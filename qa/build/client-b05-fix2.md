# client · b05-fix2 — починка дефектов измерителя (сторис, приложения, картинки)

Пачка b05 (продвижение + «Приложения»): измеритель нашёл 7 дефектов на функциях F-00-103, F-00-114,
F-00-121, F-00-155…163, F-00-167, F-14-002/003/032…036/080/082/084/139/140/172. Ниже — что сделано
с каждым.

## Починено

### F-14-035 · bookingCount сторис никогда не считал реальную запись
`recordStoryClick` считал клик по «Записаться», но саму запись — нет: `bookingCount` менялся только в
сиде. Провёл `storyId` через весь поток `/book` (`?story=` в URL) до `bookAppointment`
(`src/api/client.ts`): `BookAppointmentInput.storyId?`, и в той же `mutateArea('client', …)`, где уже
пишутся `bookingShade`/`prepaymentDeadline`, инкрементирую `story.bookingCount` — только когда бронь
реально создалась, не на клике.
- `src/api/client.ts` — поле `storyId` в `BookAppointmentInput`, инкремент в `bookAppointment`.
- `src/areas/client/stories/StoryViewScreen.tsx` — `handleBook` добавляет `story=<id>` в `/book?…`.
- `src/app/(client)/book/page.tsx`, `src/areas/client/book/BookScreen.tsx` — `storyId` протянут через
  `BookScreen` → `BookFlow` → `BusinessBookPicker` (ветка «без мастера», чтобы параметр не терялся) →
  `ConfirmStep` → `book.mutate({ …, storyId })`.

### F-14-034 · Минимальный размер фото (667×375) нигде не проверялся
Подсказка `apps.stories.photoRequirements` обещала проверку, а `ImageUpload` (общий компонент, не мой
путь) её не делал — только MIME и вес. Не трогая `ImageUpload`, добавил измерение в собственном
экране: `handlePhotoChange` в `StoriesGeneratorScreen.tsx` грузит только что выбранный data URL в
`new Image()`, сверяет `naturalWidth/naturalHeight` с `MIN_STORY_PHOTO_WIDTH/HEIGHT` (667×375) и либо
принимает файл, либо показывает тост `apps.stories.photoTooSmall` и не сохраняет его в состояние.
Ключ добавлен в `messages/{ru,en}/client.json` (hy не пишем — правило проекта, пока только ru+en).

### F-00-114 · Новость подписчикам — «негде увидеть» оказалось неверным диагнозом
Измеритель искал по коду тип `NewsPost` и не нашёл его вне кабинета — но `createNewsPost`
(`src/api/client.ts`) уже фан-аутит пост в `NotificationItem { kind: 'broadcast' }` каждому подписчику
(`favorites`, не приглушившему новости), и `NotificationsScreen`/`NotificationRow`
(`src/areas/client/notifications/`) уже показывает `params.text` таких записей как обычную ленту.
Проверил вживую: `node scripts/measure.mjs --routes /notifications --persona client` — на скриншоте
видна запись «Atam Dental» с иконкой рупора (тип `broadcast`) в ленте клиента. Правки не потребовалось,
код уже делает то, что требует «Готово, когда» (новость видна только подписчикам). Изменений нет.

### F-00-156 · Отступ подписи сторис до водяного знака — 80px вместо ≥250px
`generateStoryImage` (`src/domain/client.ts`) рисовала строку `LuckyBooking · <lang>` на `y=1840` из
1920 (80px от низа) — меньше safe-zone Instagram (≥250px). Передвинул на `y=1650` (270px от низа).

### F-00-162 · StatCard «Показы»/«Нажатия» обрезались на телефоне
Три `StatCard` в колонке ~130px (390px/3) с иконкой не помещали подпись в одну строку. Убрал иконки
из этого плотного ряда (`StoriesGeneratorScreen.tsx`, `StoryRow`), сжал отступы карточки
(`className="gap-1 p-2.5"` через `cn()`-мёрж классов, не трогая сам `StatCard`), пометил ряд
`data-f="F-00-162"` (не было).

## Не мой путь — фундамент/другой раздел (не правил сам, просьбы уже поданы)

### F-14-082 / F-14-139 / F-14-140 · `mergeWithFallback` не мёржит массивы
`src/i18n/load.ts:28` — фундамент. Готовый патч уже лежит в `qa/requests/client.md` (запись
«b05-fix1», 2026-09-25) — тот, кто правит `src/i18n/**`, может просто применить его. Ничего нового не
добавлял, дефект подтверждён повторно измерителем — `[i18n:no-en]` на `client.apps.hub.capabilitiesList`
и соседних ключах всё ещё виден в свежем прогоне `measure.mjs` (см. `qa/shots/client-b05-fix2/report.json`).

### F-14-003 · Нет ссылки «Онлайн-запись → Настройки» → материалы приложения
`src/app/biz/online/**` / `src/areas/online/**` — чужой раздел. Просьба с точным местом и текстом уже
записана в `qa/requests/client.md` («b05-fix1»). Не трогал.

## Побочно замеченное (не дефект из списка, не правил)

Свежий `measure.mjs --area client` (лог `qa/shots/client-b05-fix2/report.json`) показал разовую
консольную ошибку "Can't perform a React state update on a component that hasn't mounted yet" на
`/biz/apps/stories` (en) и `/biz/apps/news` (ru) — в разных прогонах на разных языках, не совпадает с
моими правками (`NewsScreen.tsx` я вообще не трогал в этой пачке, а ошибка там тоже есть) — похоже на
существующий флейк в общем хуке запроса (`api/request.ts`, не мой путь) на фоне случайной задержки мока
(400–1200мс). В `assumed`, не чинил — не в списке дефектов и не мой путь.

## Проверка

- `npx tsc --noEmit --incremental --tsBuildInfoFile .tsbuild/client.tsbuildinfo` — 0 ошибок в путях client.
- `npx eslint` по правленым файлам — 0 ошибок (только старые предупреждения `no-img-element` и
  `no-unused-vars` на `_comment`, не мои).
- `scripts/ensure-dev.sh` — сервер уже работал, не трогал.
- `node scripts/measure.mjs --area client --lang ru,en --device phone` — 22 страницы, 0 вылетов, 0
  сырых ключей, 0 i18n нет-ключа; 3 `[i18n:no-en]` — известный чужой дефект (см. выше); 2 консольные
  ошибки — известный флейк (см. выше), не в моих правках.
- Снимки посмотрел глазами: `/`, `/biz/apps/stories`, `/notifications` (client) — вёрстка не сломана,
  запись «Atam Dental» (рупор) в ленте клиента подтверждает F-00-114.

## done

- F-14-035
- F-14-034
- F-00-114
- F-00-156
- F-00-162

## partial

- F-14-082 / F-14-139 / F-14-140 — фундамент (`src/i18n/load.ts`), патч готов в `qa/requests/client.md`, применить не могу.
- F-14-003 — раздел `online`, просьба записана в `qa/requests/client.md`, применить не могу.

## assumed

- Минимальный размер фото сторис проверяю по пикселям загруженной картинки (`naturalWidth/Height`), а
  не по метаданным файла — `ImageUpload` уже уменьшает картинку до `MAX_SIDE=800` перед тем, как отдать
  data URL, так что 667×375 остаётся ниже этого предела и проверка не мешает уменьшению больших фото.
- Порог safe-zone 250px — из рекомендации Instagram, упомянутой в самом дефекте измерителя; точную
  цифру никто не утверждал (вопрос не заведён — 270px с запасом).
- Консольная ошибка "hasn't mounted yet" на stories/news — не мой дефект (существовала до правок,
  видна и на нетронутом `NewsScreen.tsx`), в отчёт как `assumed`/наблюдение, не как `done`.

marked (client): **126**

# Просьбы фундаменту — архитектура (arch-a1, 25.09.2026)

Ревьюер архитектуры, код не правил. Полный отчёт — `qa/arch/report-a1.md`, правила — `docs/ARCHITECTURE.md`,
замечания разделам — `qa/measure/<id>/arch-a1.md` (ссылаются на номера ниже).
Адресаты: **ЯДРО** — хранитель общего ядра (`src/domain/core.ts`, `src/domain/rules/**` (новое), `src/api/core.ts`,
`src/lib/**`, `src/extensions/**`, `src/config/**`); **ДИЗАЙН** — хранитель `src/ui`, `src/shell`, `src/styles`;
**СОСТОЯНИЕ** — архитектор состояния (`src/api/request.ts`, `src/mock/db.ts`, провайдеры).

---

## 1. Синхронные функции ядра для использования внутри `request()` — ЯДРО + СОСТОЯНИЕ · block для атомарности

- Зачем: сейчас любая api-функция раздела, которой надо записать в ядро, зовёт `coreCreate/coreUpdate/createBooking/…` — а это
  **отдельный `request()`**: +150–400 мс каждый (в `?api=slow` +1,5–2,5 с), отдельная точка отказа, и между `await` другой запрос
  успевает поменять базу. Сторож насчитал 27 таких вызовов (A11). Худшие: `platform.finishConnectDraft` — 10 записей подряд
  без отката (ошибка посередине оставляет полсалона), `online.createOnlineBooking` — 4 задержки и гонка «окно заняли».
- Что именно: в `src/api/core.ts` рядом с async-функциями — синхронные двойники, которые можно звать ТОЛЬКО внутри `request()`:
  ```ts
  export const coreTx = {
    list, get, create, update, remove,           // те же сигнатуры, без Promise
    createBooking, updateBooking, linkClientForAppUser, findClientByPhone,
  };
  // использование: request(() => { const c = coreTx.create('clients', …); coreTx.createBooking({ …, clientId: c.id }); … })
  ```
  Публичные async-функции переписать поверх них (`coreCreate = (…) => request(() => coreTx.create(…))`).
  СОСТОЯНИЕ: `request()` выставляет флаг «внутри запроса»; в dev `readCore/readArea/mutateArea/coreTx.*` вне запроса —
  `console.error` со стеком (ловит `bookAppointment`, `createClient`, `writeScheduleOverrides`, которые читают ядро до `dbReady`).
  Ошибка внутри `request()` должна откатывать все записи этого запроса (снимок `core/areas` до `fn()` и возврат при throw) —
  это и есть «транзакция» мока.
- Пока жду: разделам — не добавлять новых вложенных вызовов.
- **Ядро (core-rules, 25.09):** ✅ ядро (частично): `coreTx` в `src/api/core.ts` — синхронные двойники `list/get/create/update/remove/createBooking/updateBooking/linkClientForAppUser/findClientByPhone` + новые `placeBooking/cancelByClient/rescheduleByClient/changeBookingStatus/releaseExpiredPrepayments`; все async-функции ядра переписаны поверх них (сигнатуры те же). ❌ флаг «вне запроса» и откат по снимку — не ядро: это `request()`/`db.ts`, архитектор состояния.

## 2. `src/domain/rules/booking-status.ts` и `busy.ts` — ЯДРО (busy наполняет schedule) · major

- Зачем: «какие записи активны» записано 4 раза (`api/schedule.ts:54`, `api/journal.ts:113`, `api/client.ts:591`,
  `client/BookingDetailScreen.tsx:68`), «часы мастера на дату» — 2 раза и по-разному (schedule: первый график места; journal:
  объединение всех), «занятость/пересечение» — 3 раза (`computeFreeSlots`, `computeOverlap`, `findJoinableBooking`).
  Журнал, окно клиента и виджет отвечают по-разному на вопрос «свободно ли в 15:00».
- Что именно: папка `src/domain/rules/` (чистые функции, без React, без стора, без `'use client'`):
  `booking-status.ts` — `ACTIVE_STATUSES`, `CANCELLED_STATUSES`, `FINAL_STATUSES`, `isActiveBooking(b)`, `isCancelled`, `isUpcoming(b, now)`;
  `busy.ts` — `staffDayHours(core, staffId, date, locationId?)`, `busyIntervals(core, staffId, date)` (с запасом после услуги),
  `overlaps(a, b)`. Хозяин правила занятости — раздел schedule: создайте файлы с сигнатурами, schedule перенесёт туда
  `computeFreeSlots` и помощники интервалов (реэкспорт из `src/api/schedule.ts` сохранит импорты соседей).
- Пока жду: разделы не расширяют свои копии.
- **Ядро (core-rules, 25.09):** ✅ ядро: `src/domain/rules/booking-status.ts` (списки статусов, `isCancelled/occupiesTime/isActiveBooking/isUpcoming/splitClientBookings`, `BOOKING_STATUS_META` — тон, значок, ключ подписи, `bookingStatusTone(status, audience)`, переходы `canTransition/nextStatuses`, `noShowDelta`) и `busy.ts` (`staffDayHours` — объединение графиков, `dayBreaks`, `staffWorkIntervals` с режимом календаря и `openUntil`, `busyIntervals` с запасом после услуги, записями той же персоны по телефону и групповыми событиями, `busyForViewer` — «занято · дома» без имени, `checkSlot/isSlotFree`, `hasBookingOverlap`) + база окон `slots.ts` (`freeSlots/nearestSlots/nearestAvailableDate`). schedule накладывает свои правила слотов поверх — `qa/measure/schedule/core-rules.md`.

## 3. `src/domain/rules/booking-policy.ts` и `pricing.ts` + поля строки услуги — ЯДРО · major

- Зачем: срок бесплатной отмены — три источника (срез client 24 ч, срез online 3 ч, ядро `Business.bookingRules` — не читает
  никто); исход поздней отмены — `no_show` в client и `cancelled_by_client` + счётчик в online; статус новой записи —
  client всегда «ждёт подтверждения», online смотрит `confirmMode` и выезд. Итог строки со скидкой journal восстанавливает
  делением (`BookingWindow.tsx:217`) — теряются драмы, сервер не узнает скидку.
- Что именно:
  `booking-policy.ts` — `effectiveBookingRules(business, staff)`, `canCancelFree(booking, rules, now)`,
  `clientCancelOutcome(booking, rules, now) → { status, noShowIncrement }`, `canReschedule(...)`,
  `newBookingStatus({ staff, workplace, prepayment })`, `canBookOnline({ business, staff, client, date }) → ok | ApiError-код`;
  `pricing.ts` — `lineTotal({ unitPrice, qty, discountPct })`, `visitTotal(lines, goods)`, `bookedDuration(service)` /
  `bookedPrice(service)` для «от–до» (решение: нижняя граница или верхняя — записать в комментарии).
  В ядро: `BookingServiceLine.unitPrice?: Money`, `discountPct?: number` (нет поля — как сейчас, `price` = итог).
  Источник правила отмены — одно поле ядра (`Business.bookingRules`, при необходимости `Staff.bookingRules`); online
  переносит туда `staffRules.cancel/rescheduleWindowHours`, client удаляет `cancelWindowHours`.
- **Ядро (core-rules, 25.09):** ✅ ядро: `booking-policy.ts` (`effectiveBookingRules` — умолчание ← бизнес ← мастер; новое поле `Staff.bookingRules`, в `BookingRules` добавлены `allowCancel/allowReschedule`; `freeCancelUntil/canCancelFree`; `clientCancelOutcome` — позже срока = «Отменил клиент» + `Booking.cancelledLate` + неявка, окно свободно; `canReschedule`, `newBookingStatus`, `rescheduledStatus`, `canBookOnline`, `isPrepaymentExpired`, `masterCancelRefund`) и `pricing.ts` (решение: длительность «от–до» бронирует верх, цена — низ; `makeServiceLine/lineTotal/lineDiscount/visitTotal`, предоплата). В ядре — `BookingServiceLine.unitPrice?/discountPct?`, `Booking.prepayment.holdUntil?`. Дефолт срока — 180 мин (как у хозяина правил online).

## 4. Один поток записи для приложения и виджета — ЯДРО (решение) · major

> ❌ (в) `PhoneVerify` (r3): жду решения (а)/(б) — общий компонент до выбора одного потока станет четвёртой реализацией. Решите — соберу.
> ✅ (в) сделано (r5, после решения (а) ядра): `src/ui/PhoneVerify` — номер (`PhoneInput`) → куда прислать (плитки WhatsApp / Telegram / SMS, один способ — без выбора) → код в клетках (`src/ui/CodeInput`: переход сам, Backspace назад, вставка целиком, автоподстановка из SMS `one-time-code`, неверный — красные клетки, покачивание, курсор в первую) → «Новый код через 0:29» / «Отправить код ещё раз». Сам ничего не шлёт: `onSendCode({ phone, channel })`, `onVerify({ phone, channel, code })` (бросило — «Код не подошёл»), свои поля шага номера (имя, согласие) — `children` + `canSend`; `codeLength`, `resendAfterSec`, `codeHint`, управляемые `phone/channel/step`. Витрина — `/dev/ui/c#phone-verify` (в демо код 1234), сценарий `qa/scenarios/steward-r5-verify.json` (36/36). Переводить `client/login`, `client/book` ConfirmStep и виджет online на него — разделам client и online.

- Зачем: `client/book/BookScreen.tsx` (665 строк) и `online/booking/BookingWizard.tsx` (1003) — два мастера одних и тех же
  шагов; `bookAppointment` (client) и `createOnlineBooking` (online) — две команды создания с разными проверками; подтверждение
  номера кодом — три реализации (`client/login`, `client/book` ConfirmStep, виджет). Каждое новое правило ТЗ чинится дважды.
- Что именно (предлагаю, решать вам с разделами client и online):
  а) одна команда в `src/api/core.ts`: `createClientBooking({ source: 'app' | 'link' | 'widget', … })` на правилах №3
  (online — хозяин правил, client — вызывающий);
  б) шаги мастера — в одном месте: либо новый хост расширения `bookingFlow` (хозяин online, client встраивает), либо общий
  модуль `src/features/booking-flow/**` с хозяином online;
  в) ДИЗАЙН: `src/ui/PhoneVerify` (номер → канал → код → повтор через N с), все три места — на нём.
- **Ядро (core-rules, 25.09):** ✅ ядро (а): одна команда `placeBooking(input)` в `src/api/core.ts` для `source: 'app' | 'link' | 'widget' | 'journal' | 'phone'` на правиле `planBooking` (`src/domain/rules/booking-flow.ts`): окно по «от–до» и запасам; онлайн — часы, прошлое и правила слотов schedule (`isStartOffered`), журнал — только двойная запись; статус по правилам мастера (выезд — всегда подтверждение, предоплата со сроком, «только мои» — заявка); клиент по номеру/приложению; места групп; одна запись в базу. Внутри своей транзакции — `coreTx.placeBooking`. ❌ (б) общий модуль шагов мастера записи — это экраны разделов (хозяин online, client встраивает), не ядро; (в) `ui/PhoneVerify` — дизайн.

## 5. Правило видимости мастера клиентам + публичные DTO — ЯДРО · major

- Зачем: «кого показать клиенту» — `client.listCatalog` (inline), `online.isStaffOnlineVisible`, `online.isListable` — три ответа;
  `Staff.onlineBookingEnabled` (k1) и модерация (`platform.isVisibleToClients`) не учитываются нигде. Клиентским и публичным
  маршрутам уходят `Staff`/`Business` целиком — телефон мастера, `homeAddress` (F-00-077: только после подтверждённой записи), `login`.
- Что именно: `src/domain/rules/visibility.ts` — `isStaffBookableOnline(core, staff, { moderation })`, `visibleServices(...)`;
  в `src/domain/core.ts` — `PublicStaff`, `PublicBusiness`, `PublicService` + функции проекции `toPublicStaff(staff)`.
  Модерацию правило получает параметром (множество скрытых id), чтобы не импортировать api platform.
- **Ядро (core-rules, 25.09):** ✅ ядро: `visibility.ts` — `staffClientVisibility` → `{ catalog, link, bookable, requestOnly, reasons }` (все / по ссылке / только мои, модерация `hiddenIds`, `onlineBookingEnabled`, заморозка бизнеса, пустой профиль), `visibleServices`, `isOwnClient`, `hiddenByModeration`; в api — `moderationHiddenIds()`. DTO — `src/domain/rules/public.ts`: `PublicStaff/PublicBusiness/PublicService/PublicLocation` + `toPublic*` (телефон мастера — только `contacts.phone`, когда мастер открыл звонок/WhatsApp: «скрытие номера» снято в ТЗ; без логина; домашний адрес — `canSeeHomeAddress`), `canCallNow`, `clientForStaff` (маска телефона без `clients.phones`).

## 6. `BookingStatusBadge` в `src/ui` — ДИЗАЙН · minor

> ✅ сделано (r3): см. ux-client №12.

- Зачем: карта «статус → тон + иконка» записи — 4 копии (`journal/lib/status.ts`, `online/BookingConfirmedScreen.tsx:26`,
  `client/BookingCard.tsx:15`, `client/BookingDetailScreen.tsx:24`); тоны уже расходятся (отмена клиентом — neutral/danger).
- Что именно: `<BookingStatusBadge status audience="business" | "client" />` — подписи из `common.bookingStatus.*`
  (кабинет) и словаря client (от лица клиента), тоны — одна карта; витрина в `/dev/ui`.
- **Ядро (core-rules, 25.09):** — не ядро (ДИЗАЙН). Данные для бейджа готовы: `BOOKING_STATUS_META`, `bookingStatusTone(status, 'business' | 'client')` в `@/domain/rules`.

## 7. Мелкие общие помощники — ЯДРО · minor

- `@/lib/clipboard` — `copyText(text): Promise<boolean>` (сейчас 4 копии: online `links/copyText.ts`, client ×3, journal).
- `@/lib/csv` — `toCsv(rows, headers)`, `downloadCsv(name, csv)` с BOM (сейчас clients `lib/export.ts` и platform `BusinessesScreen.tsx:87`).
- `usePickText()` в `src/i18n` — `const pick = usePickText(); pick(service.name)` (50 мест `pickText(x, useLocale())`).
- `addDays(date, n)` в `@/lib/date` (уже просили в `ux-*`), и в комментарии файла — запрет `toISOString()` для дат.
- `@/lib/date`: явный пояс `Asia/Yerevan` для `nowDateTime()/today()` (dayjs `utc`+`timezone`) — сейчас «сейчас» = пояс
  браузера; на сервере (UTC) и у туриста в другом поясе сроки отмены и «свободно сегодня» съедут.
- **Ядро (core-rules, 25.09):** ✅ ядро: `@/lib/clipboard` (`copyText`), `@/lib/csv` (`toCsv`, `downloadCsv` с BOM и `;`), `@/lib/date`: `addDays`, `diffMinutes`, `nowYerevan`; `nowDateTime()/today()` теперь по поясу Asia/Yerevan (dayjs utc+timezone, без новых пакетов); в шапке файла — запрет `toISOString()`. ❌ `usePickText()` — `src/i18n` не зона ядра (просьба хранителю i18n).

## 8. Права — в api, не только в экране — СОСТОЯНИЕ + ЯДРО · major (для бэкенда)

- Зачем: права проверяются только кнопками, и мало: на 31 право — 16 проверок во всех экранах; `clients.phones`,
  `clients.export`, `clients.edit`, `journal.create`, `journal.reschedule` не проверяются нигде; 4 места проверяют `persona ===`.
  На сервере права проверяет эндпоинт; мок должен вести себя так же, чтобы экраны были готовы к `403`.
- Что именно: `request(fn, { permission?: Permission })` — при отсутствии права `ApiError('forbidden')` (текущие права — из
  демо-контекста вне React, как `useDemoStore.getState()`); общий текст `common.states.forbidden`. Маскировка телефона в
  сериализаторе: api клиентов/журнала отдаёт `phone` маскированным без `clients.phones`.
- **Ядро (core-rules, 25.09):** ✅ ядро: `can(persona, permission, { overrides, actorStaffId, targetStaffId })`, `canWith`, `permissionsOf`, `PERMISSION_REQUIRES` (create/reschedule — только с edit; phones/export/edit — с view; чужая запись — `journal.others`) в `src/domain/rules/permissions.ts`; в api — `currentActor()`, `canNow()`, `assertCan()` (`ApiError('forbidden')`, текст `common.states.forbidden`). `placeBooking` проверяет `journal.create`, `changeBookingStatus` — `journal.edit`. Непроверяемые права (`UNCHECKED_PERMISSIONS`: clients.phones, clients.export, clients.edit, journal.create, journal.reschedule) — в core-rules.md разделов clients и journal. ❌ `request(fn, { permission })` — СОСТОЯНИЕ (внутри может звать `assertCan`).

## 9. Договор вкладов окна записи + защита хоста — ЯДРО · major

> ✅ часть ДИЗАЙНА готова: `ErrorState compact` для границы ошибок в `ExtensionSlot` (сама граница — `src/extensions`, ядро).

- Зачем: journal не передаёт вкладам `onDraftChange` (`BookingWindow.tsx:593`), а у новой записи вкладу негде сохранить своё
  (нет `bookingId` до сохранения). Вклады finance/loyalty/stock строятся сейчас — без договора каждый придумает своё.
  `ExtensionSlot` не ловит ошибки: упавший вклад роняет окно записи целиком.
- Что именно: в `BookingWindowExtProps` — `registerBeforeSave(fn: (draft) => Promise<void> | void)` и
  `registerAfterSave(fn: (bookingId) => Promise<void>)` (хост вызывает после своей записи; вклад пишет своими api); journal
  передаёт `onDraftChange`. В `ExtensionSlot` — граница ошибок с компактным `ErrorState` (ДИЗАЙН просили в ux-client №8).
- **Ядро (core-rules, 25.09):** ✅ ядро: в `BookingWindowExtProps` — `registerBeforeSave`, `registerAfterSave` (типы `BeforeSaveStep/AfterSaveStep`), помощники `src/extensions/saveHooks.ts` (`useSaveSteps` — хозяину, `useBeforeSaveStep/useAfterSaveStep` — вкладу); `ExtensionSlot` обёрнут в `ExtensionBoundary`: упавший вклад показывает компактный `ErrorState` с «Повторить» и не роняет хост. Передать `onDraftChange` и вызвать шаги — journal (core-rules.md).

## 10. Разрешить папки `src/api/<area>/` и `src/domain/<area>/` — ЯДРО (CONVENTIONS §1, eslint, arch-check) · minor

- Зачем: `src/api/platform.ts` — 1340 строк (12 подсистем), `src/domain/platform.ts` — 729, `src/api/schedule.ts` — 723,
  `src/api/client.ts` — 782. Один файл на раздел не выдерживает.
- Что именно: владение `src/api/<area>/**` и `src/domain/<area>/**` (с `index.ts`, реэкспортирующим всё — импорты экранов
  не меняются); правило eslint `no-restricted-imports` для `@/mock/*` распространить на папки; `scripts/arch-check.mjs` уже
  считает только файлы `src/api/<id>.ts` — поправлю сам, когда решите.
- **Ядро (core-rules, 25.09):** ✅ ядро: CONVENTIONS §1 — `src/api/<area>/**` и `src/domain/<area>/**` (с `index.ts`); eslint — запрет `@/mock/*` на `src/api/**/*.ts` и новое правило чистоты `src/domain/**` (без React, api, стора, UI). ❌ `scripts/arch-check.mjs` — ревьюер обещал поправить сам.

## 11. Хозяева сущностей, которые уже завели чужие разделы — ЯДРО (решение) · major

- Зачем: loyalty/stock/finance строятся сейчас, а их сущности уже есть у соседей:
  `Certificate`, `Subscription`, `ProductPurchase` — в `src/domain/clients.ts` (+ сид в срезе clients);
  `GoodsCatalogItem` (товар/абонемент/сертификат) — в `src/domain/journal.ts`, каталог без `businessId`;
  `BookingExtras.paidAmount` (journal), `ClientProfile.paidAmount`, `discountPercent` (clients) — это оплаты (finance) и скидка (loyalty).
  Будет два набора сертификатов и три «оплачено».
- Что именно: записать в AREAS.md хозяев (сертификаты/абонементы/депозиты — loyalty; товары и продажи — stock; оплаты — finance)
  и порядок: хозяин заводит тип и функцию чтения → clients/journal переходят на неё и удаляют свои. Имя-двойник
  `CustomFieldDef` (clients — поля клиента, journal — поля записи) → `ClientFieldDef` / `BookingFieldDef`.
- **Ядро (core-rules, 25.09):** ✅ ядро (решение, AREAS.md «Хозяева сущностей»): сертификаты, абонементы, депозит/счёт клиента, скидка клиента — loyalty; товары, остатки, продажи, расходники — stock; оплаты и «оплачено» — finance; ручная скидка строки — поле ядра. Порядок: хозяин заводит тип и функцию чтения → clients/journal переходят и удаляют свои. `CustomFieldDef` → `ClientFieldDef` (clients) / `BookingFieldDef` (journal). Замечания — `qa/measure/{loyalty,stock,finance,clients,journal}/core-rules.md`.

## 12. Решения по ядру, которые ждут разделы — ЯДРО · minor

- `Client.deletedAt` (мягкое удаление): clients удаляет карточку насовсем, записи остаются с висячим `clientId`.
- Поля k1 никто не читает (0 использований `Business.bookingRules`, `Business.socials`, `Service.shadeChoice`, `Staff.prepayment`,
  `Staff.onlineBookingEnabled`, `Staff.hiddenInJournal`, `Location.journalKind`, `Booking.staffAssignment`) — напомнить
  разделам client/online/journal в их очереди (я записал в их arch-a1).
- Лист ожидания (срез client) нужен resources (`/biz/waitlist`) и notify — в ядро или функцией api client.
- Контакты мастера и режим звонка (срез client) — поля `Staff` (хозяин staff).
- **Ядро (core-rules, 25.09):** ✅ ядро: `Client.deletedAt` (мягкое удаление; `placeBooking` удалённых не находит); `Staff.contacts` (каналы + `callMode`, хозяин staff); лист ожидания — хозяин resources (решение; не коллекция ядра: новая коллекция требует правки `db.ts` и сида). Поля k1 теперь читает ядро: `Business.bookingRules`, `Staff.onlineBookingEnabled`, `Staff.prepayment`, `Booking.staffAssignment`. ❌ `Business.socials`, `Service.shadeChoice`, `Staff.hiddenInJournal`, `Location.journalKind` — экранные поля разделов, напомнено в их arch-a1/core-rules.

---

## Архитектору состояния (перевод на TanStack Query)

> ✅ S5 сделано (r3): `LocationSwitcher` и `UserMenu` читают филиалы и сотрудника через `coreList`/`coreGet` + `useApiQuery`, без `useDb`.
> ✅ state-s1 (25.09, архитектор состояния): **S2** — инвалидация по прочитанному автоматически (метки `core.<коллекция>`,
> `areas.<раздел>.<поле>`, `access`; объявлять `touches` не нужно); **S3** — запись черновика будит только чтения этого поля
> среза; **S4** — `useCurrent` подписан строкой контекста; **S6** — смягчено: смена персоны/сферы сбрасывает кэш (ключи чинят
> разделы); **№1** — `request()` помечает «внутри запроса» (`markRequest`), чтение вне него в деве — `[mock-db] обращение к базе вне
> request()`, синхронная `fn` откатывается по снимку при throw; **№8** — `request(fn, { permission })` через `assertCan`.
> ❌ S1 (`coreKeys` — к ядру, `src/api/core.ts`), S7 (не мешает: перечитывание не по ключам), S8 (`?api=flaky` — режим в
> `src/demo/settings.ts`/демо-панели, не мои файлы). Подробно — `docs/STATE.md` §9.
> ✅ **Ядро k2 (25.09): S1 сделано** — `coreKeys.list/get` и хуки `useCoreList(collection, filter, opts)` / `useCoreGet(collection, id)` в `src/api/core.ts`: ключ `['core', <коллекция>, 'list', фильтр]`, один на всё приложение; смена фильтра без показа чужих данных. Разделам — заменить свои ключи для услуг/сотрудников/филиалов (например `['journal','services',b]`, `['schedule','services',b]`) на `useCoreList('services', { businessId })`. S8 (`?api=flaky`) — `src/demo/**`, не мой файл.

**S1. Ключи ядра — общие.** Одни и те же услуги бизнеса сейчас читаются под `['journal','services',b]`,
`['journal','all-services',b]`, `['schedule','services',b]`; сотрудники, клиенты — так же. Предлагаю `coreKeys`
(`['core','services', businessId]` …) и обёртки-хуки в `src/api/core.ts` (`useCoreList('services', { businessId })`), чтобы
разделы не заводили свои ключи для ядра.

**S2. Инвалидация по сущностям.** Запись объявляет, что меняет (`touches: ['core.bookings', 'journal']`), чтение — от чего зависит
(`deps` в `meta`: окна зависят от `core.bookings`, `core.schedules`, `core.calendarMarks`, `core.groupEvents`). После записи
инвалидировать запросы с пересечением. Без этого запись в журнале не обновит окна клиента/виджета (разные разделы, разные ключи),
а префиксная инвалидация `['journal']` их не заденет. Для мока можно вычислять `touches` автоматически в `setCore/setArea`
(какие коллекции/срезы изменились за запрос).

**S3. Черновики не должны будить базу.** `journal.saveDraft` каждые 400 мс набора → `rev++` → перечитываются все запросы
приложения. После S2 это станет «инвалидация `journal`», но всё равно лишняя запись; просьба journal — перенести черновик в
клиентское состояние (у них в arch-a1 №2). До перехода: `setArea` для ключей, помеченных как «локальные», не поднимать `rev`.

**S4. `useCurrent()` подписан на всё ядро** (`src/demo/hooks.ts` `useDb((s) => s.core)`) — любая запись (изменение статуса
записи) пересчитывает контекст и перерисовывает каждый экран, где он вызван (почти все). `usePermissions` так же читает `useDb`.
Нужен узкий селектор (бизнесы/сотрудники/сети — с `shallow`) или контекст из запроса `['demo','context', persona, sphere]`.

**S5. Оболочка читает стор напрямую** — `src/shell/biz/LocationSwitcher.tsx:10`, `src/shell/workspace/UserMenu.tsx:7`
(`useDb`) — сторож A2. На сервере этих данных в браузере не будет: филиалы и имя — через api/запрос (ДИЗАЙН правит файлы
оболочки, СОСТОЯНИЕ даёт функции).

**S6. Ключи без `businessId` для данных бизнеса** (после перехода кэш будет показывать чужой бизнес после смены персоны):
`['journal','prefs']`, `['journal','booking-categories']`, `['journal','custom-field-defs']`, `['journal','goods-catalog']`,
`['clients','columns']`, `['clients','showFullName']`, `['clients','customFieldDefs']`, `['clients','chatAutoSave']`.
Разделам записал; на вашей стороне — при смене персоны/сферы сбрасывать кэш целиком (`queryClient.clear()`), пока не починят.

**S7. Ключи — массивы, не склейки.** `['journal','hours', staffIds.join(','), date]` — инвалидировать по мастеру нельзя;
TanStack хеширует массивы сам. В документе — пример фабрики.

**S8. Частичные записи не видны в демо.** `?api=error` бросает до `fn()` в КАЖДОМ запросе, поэтому цепочка падает на первом
шаге и ничего не пишет — демо не показывает, что будет при сбое на 6-м шаге `finishConnectDraft` или между `createBooking` и
`setBookingExtras`. Предлагаю режим `?api=flaky` (падает случайный запрос из пяти) и откат по снимку в `request()` (№1) —
тогда и настоящие ошибки внутри `fn()` не оставят половину данных.

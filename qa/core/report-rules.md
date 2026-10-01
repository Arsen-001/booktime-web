Ядро готово: общие бизнес-правила вынесены в `src/domain/rules/` и собраны в одну команду записи. В ядре каждое правило теперь одно, но разделы (client, online, journal, schedule) ещё не переведены — пока они не заменят свои копии, журнал, приложение и виджет могут по-разному отвечать на «свободно ли в 15:00».

**Проверки:**
- 72 юнит-теста (`node src/domain/rules/tests/run.mjs`, на встроенном `node:test`, без новых пакетов) — все проходят. Покрыто: окна, статусы, отмена/перенос, цена, видимость, права, поток записи.
- `npx tsc --noEmit` — 0 ошибок во всём проекте на момент последнего прогона.
- eslint по моим файлам чистый.
- `node scripts/arch-check.mjs` — только 2 старые ошибки A2 в оболочке (зона дизайна), в моих файлах ни ошибок, ни предупреждений.
- 12 экранов на телефоне за owner и client (`/`, `/bookings`, `/biz/journal`, `/biz/clients`, `/biz/online/requests`, `/b/nuri-nail-studio`) открываются без ошибок консоли и ответов 4xx.
- Одну вещь в браузере не прогонял: сами команды записи (`placeBooking` и остальные). Экраны их ещё не вызывают, а правила под ними проверены тестами.

**По просьбам** (отметки ✅/❌ стоят под каждой в `qa/requests/arch-a1.md`):
- **№1 — частично.** Сделал `coreTx` — синхронные версии функций ядра для вызова внутри одного `request()`; все async-функции ядра переписаны поверх них, сигнатуры те же. Флаг «вне запроса» и откат при ошибке — у архитектора состояния.
- **№2 ✅** `booking-status.ts` (статусы, тоны и значки, переходы, счётчик неявок) и `busy.ts` (часы, перерывы, занятость с запасом после услуги, запись той же персоны в другом месте, «занято · дома» без имени, `checkSlot`). Плюс `slots.ts` — база расчёта окон.
- **№3 ✅** `booking-policy.ts` и `pricing.ts`. Мои решения по правилам:
  - правило мастера (новое поле `Staff.bookingRules`) важнее правила бизнеса;
  - срок бесплатной отмены по умолчанию 180 мин — как было у online;
  - отмена позже срока даёт статус «Отменил клиент» + неявку (поле `cancelledLate`), окно освобождается. «Не пришёл» до визита не ставится;
  - длительность «от–до» бронирует верхнюю границу, цена берётся по нижней;
  - у строки услуги появились `unitPrice` и `discountPct`, у предоплаты — срок `holdUntil`.
- **№4 ✅** Одна команда `placeBooking` для приложения, виджета и журнала:
  - проверяет окно, ставит начальный статус (выезд — всегда с подтверждением), оформляет предоплату и находит или заводит клиента — всё одной записью в базу;
  - правила слотов schedule подключаются через параметр `isStartOffered`;
  - общий модуль шагов мастера записи и компонент подтверждения кодом — не ядро (online/client и дизайн).
- **№5 ✅** Видимость — `staffClientVisibility`: режимы все / по ссылке / только мои, модерация, выключенная онлайн-запись, пустой профиль. Публичные DTO — `toPublicStaff/Business/Service/Location`: без логина; домашний адрес только после подтверждённой записи. Телефон мастера уходит только через открытый им канал «Позвонить» или WhatsApp — в ТЗ «скрытие номера мастера» снято.
- **№6** — зона дизайна; тоны и значки для бейджа статуса в ядре готовы.
- **№7 — частично.** Сделал `@/lib/clipboard`, `@/lib/csv`, `addDays`, `diffMinutes`, «сейчас» по поясу Еревана. `usePickText` не сделал — `src/i18n` не моя зона.
- **№8 ✅** `can(persona, permission, context)` и в api `assertCan()` / `canNow()` / `currentActor()` (отказ — ApiError `forbidden`). Права, которые нигде не проверяются: `clients.phones`, `clients.export`, `clients.edit`, `journal.create`, `journal.reschedule` — расписал разделам clients и journal.
- **№9 ✅** Договор вкладов окна записи: `registerBeforeSave` / `registerAfterSave` и помощники в `src/extensions/saveHooks.ts`. Упавший вклад больше не роняет окно — `ExtensionSlot` показывает компактную ошибку с «Повторить».
- **№10 ✅** Папки `src/api/<id>/` и `src/domain/<id>/` разрешены в CONVENTIONS. Правил ещё `eslint.config.mjs` — его нет в списке моих файлов, но просьба была адресована ядру: `src/api/**` и новое правило «домен без React/api/стора». `arch-check.mjs` ревьюер обещал поправить сам.
- **№11 ✅** Решение записано в AREAS.md «Хозяева сущностей»: сертификаты, абонементы, депозиты — loyalty; товары и продажи — stock; оплаты и «оплачено» — finance.
- **№12 ✅** Добавил `Client.deletedAt` и `Staff.contacts` (хозяин — staff). Лист ожидания отдан resources: отдельную коллекцию в ядре не завёл, это требует правки `db.ts`.

Всё обратно совместимо: новые поля необязательные, ничего не удалено и не переименовано. `setBookingStatus` и `createBooking` работают как раньше; версии с проверками — отдельные функции.

**Что разделам заменить** (major, с файлами и строками — в `qa/measure/<id>/core-rules.md`):
- **client:**
  - `bookAppointment` → `coreTx.placeBooking`;
  - отмена и перенос → `cancelBookingAsClient` / `rescheduleBookingAsClient`;
  - черновики `cancelWindowHours`, `prepaymentPolicy`, `prepaymentDeadline` удалить;
  - `listCatalog` → `isStaffInCatalog`;
  - отдавать экранам DTO вместо Staff/Business целиком;
  - свои списки статусов → функции ядра.
- **online:**
  - `createOnlineBooking` → `coreTx.placeBooking`;
  - отмена и перенос по ссылке → `coreTx.cancelByClient` / `rescheduleByClient`;
  - сроки из среза → поля ядра `Business/Staff.bookingRules`;
  - `isStaffOnlineVisible` / `isListable` → `staffClientVisibility`;
  - публичные DTO.
- **journal:**
  - сохранение записи → `placeBooking`;
  - `computeOverlap` / `computeStaffHours` → функции ядра;
  - цену перестать восстанавливать делением (`BookingWindow.tsx:219`);
  - передать вкладам `onDraftChange` и шаги сохранения;
  - смена статуса → `changeBookingStatus`.
- **schedule — сделать первым**, до перехода client/online на `placeBooking`:
  - занятость брать из `busyIntervals`, часы — из `staffWorkIntervals`;
  - срок предоплаты — одно поле (`holdUntil`) вместо своего `prepaymentWaitMin`;
  - «сейчас» — только через `@/lib/date`;
  - иначе показанное окно ядро отклонит как «уже заняли».
- **clients:**
  - проверять права телефонов, выгрузки и правки;
  - мягкое удаление через `deletedAt`;
  - выгрузку — через `@/lib/csv`.
- **platform:** держать в модерации `refId` равным id сущности или фото; `finishConnectDraft` собрать одним `request()` на `coreTx`.
- **staff, loyalty, finance, stock, resources:** завести свои сущности и функции чтения; соседи после этого удаляют свои копии.

Одно нарушение с моей стороны: один раз случайно вызвал `git diff --stat` — ничего не вывелось, файлы не менялись.

Файлы (все в `/Users/arsen/WebstormProjects/booking-platform/`):
- новое: `src/domain/rules/` (9 файлов правил + `index.ts`), `src/domain/rules/tests/` (6 тестов, `fixture.ts`, `register.mjs`, `run.mjs`), `src/lib/clipboard.ts`, `src/lib/csv.ts`, `src/extensions/saveHooks.ts`, `src/extensions/ExtensionBoundary.tsx`
- изменено: `src/api/core.ts`, `src/domain/core.ts`, `src/lib/date.ts`, `src/extensions/types.ts`, `src/extensions/ExtensionSlot.tsx`, `messages/{ru,en,hy}/common.json` (`states.forbidden`, `bookingErrors.*`), `eslint.config.mjs`, `CONVENTIONS.md` (§1 и новый §17 «Правила — только из ядра»), `AREAS.md`, `qa/requests/arch-a1.md`
- замечания: `qa/measure/{client,online,journal,schedule,clients,platform,staff,loyalty,finance,stock,resources}/core-rules.md`
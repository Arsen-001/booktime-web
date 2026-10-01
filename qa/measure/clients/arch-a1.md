# Архитектура clients · arch-a1

Дата: 2026-09-25. Ревьюер архитектуры (код не правил). Мерка — docs/ARCHITECTURE.md и CONVENTIONS.md §16.
Сторож: `node scripts/arch-check.mjs --area clients` → 0 error, 9 warn (A11:3, A13:3, A14:2, A8:1).
Номера строк — на момент ревью.

Хорошо: фильтры и сегменты — чистые функции (`lib/filters.ts`), колонки — отдельно, ключи с префиксом `'clients'`,
пагинация есть, валидация номера и дублей — в api, ошибки — `ApiError` с кодами.

## Major

1. **Список клиентов считается в браузере по всей базе** — `ClientsListScreen.tsx:71–92`: грузятся все карточки
   (`listClientRows`), все записи бизнеса (`listClientBookingsIndex`), все сертификаты, абонементы и покупки — 5 полных
   выгрузок, затем поиск, сегмент, конструктор фильтров и страница — в `useMemo`. Для салона с 10 000 клиентов и 100 000 записей
   это не заработает ни на моке, ни на сервере. Как: одна функция `listClients({ businessId, search, segment, filters, page, pageSize, sort })`
   → `{ rows, total, segmentCounts }`; `lib/filters.ts` переезжает внутрь неё как есть (он уже чистый — перенос в
   `src/domain/clients.ts`). Экран держит только состояние фильтров. Выгрузка CSV — отдельной функцией api с теми же фильтрами.
   ✅ исправлено (fix-clients): одна функция api `listClients(query)` → `{ rows, total, baseTotal, ids, pickCounts, page }` (src/api/clients/list.ts): поиск, подборки, конструктор, сортировка и страница — внутри одного `request()`; правила — чистые функции src/domain/clients/filters.ts; выгрузка — `exportClients` по id выборки

2. **Настройки базы «на всех», не на бизнес** — срез `src/mock/slices/clients.ts:29–41`: `columns`, `lostAfterDays`,
   `showFullNameFields`, `customFieldDefs`, `chatAutoSave`; api без `businessId` (`src/api/clients.ts:270, 292, 351, 383, 414`),
   ключи `['clients','columns']`, `['clients','showFullName']`, `['clients','customFieldDefs']`, `['clients','chatAutoSave']`.
   Поля стоматологии появятся у маникюра; при кэше — чужие данные после смены персоны. Как: всё по `businessId`
   (колонки — по `businessId + staffId`), ключи с ними.
   ✅ исправлено (fix-clients): срез: `settings[businessId]` (лиды из чата, порог «давно не были», ФИО, доп. поля) и `columns["businessId|staffId"]`; api и ключи с businessId (версия среза 9)

3. **«Потерянные» считаются по зашитым 60 дням** — `ClientsListScreen.tsx:101` `lostAfterDays: 60`, хотя есть
   `getLostAfterDays/setLostAfterDays`: владелец меняет порог — сегмент не меняется. Уйдёт вместе с п. 1 (порог читает api).
   ✅ исправлено (fix-clients): порог читает `listClients` из настроек бизнеса; меняется во вкладе «Настройки» (30/60/90/180)

4. **Права на телефоны и выгрузку не проверяются** — колонка телефона `lib/columns.tsx:37` `fmt.phone(r.phone)` всегда полный
   номер; выгрузка CSV (`ClientsListScreen.tsx:167`) без `useCan('clients.export')`. Права `clients.phones`,
   `clients.export`, `clients.edit` не используются нигде в проекте. Как: `useCan('clients.phones') ? phone : maskedPhone`,
   кнопка выгрузки — за `PermissionGate permission="clients.export"`, правка — `clients.edit`; и то же в api (просьба `arch-a1` №8).
   ✅ исправлено на экране (b04-fix1, но не мной — уже так на 25.09): `columns.tsx` маскирует по `canSeePhones`,
   `ClientsListScreen`/`ImportExportScreen` держат `useCan('clients.phones'|'clients.edit'|'clients.export')`; я в этой
   пачке довёл выгрузку до F-04-130 «без права пункта нет вовсе» (было disabled+тултип). ⏳ позже — `assertCan(...)`
   в самих api-функциях всё ещё отсутствует (см. `core-rules.md` №1).
   ✅ исправлено (fix-clients): `assertCan` в api: clients.edit (создание, правка, категории, прошлый визит), clients.delete (удаление, массовое), clients.export (`exportClients`), notify.mailings (рассылки)

5. **Чужие сущности живут в срезе clients** — `Certificate`, `Subscription`, `ProductPurchase` (`src/domain/clients.ts:240–270`,
   сид в срезе): это данные loyalty (сертификаты, абонементы) и stock/finance (продажи). Разделы loyalty и stock сейчас
   строятся и заведут свои — будет два набора сертификатов. Как: договориться через просьбу (`arch-a1` №11): хозяин типов —
   loyalty/stock; clients читает их функциями `src/api/loyalty.ts` / `src/api/stock.ts`, свой сид удаляет.
   То же `ClientProfile.discountPercent`, `paidAmount` — скидка клиента (loyalty) и оплачено (finance).
   ⏳ позже — хозяева (loyalty, stock) не отдали функций чтения сертификатов/абонементов/продаж в форме, нужной фильтрам «По продажам»; свои черновики пока остаются, типы вынесены в src/domain/clients/program.ts

6. **Запись карточки — мимо `request()` и не атомарна** — `src/api/clients.ts:121` `createClient`: проверка дубля номера по
   `readCore()` до `dbReady` (на холодном заходе база пуста — дубль пройдёт), затем `coreCreate` (свой запрос) и
   `mutateArea` вне `request()`. Так же `updateClient:177`, `deleteClient:216`. Как: тело целиком в `request()`,
   синхронные функции ядра внутри (просьба №1).
   ✅ исправлено (fix-clients): все записи внутри одного `request()` синхронными `coreTx.*` (create/update/delete/purge/merge/import/категории/прошлый визит с новым клиентом/отметка визита/массовое удаление) — вложенных вызовов ядра (A11) нет

7. **Удаление клиента — жёсткое** — `deleteClient` → `coreRemove`: у записей остаётся `clientId` на несуществующую карточку,
   журнал и отчёты теряют имя. В бэкенд-плане — мягкое удаление. Как: `Client.deletedAt` (просьба в ядро) или хотя бы запрет
   удалять клиента с записями (`ApiError('has_bookings')`).
   ✅ исправлено (b04-fix1): поле `Client.deletedAt` уже было в ядре (никто не просил — уже готово), просто не
   использовалось; `deleteClient`/`mergeClients` теперь пишут его вместо `coreRemove`, чтения фильтруют — см.
   `core-rules.md` №2 для полного списка мест и способа проверки.

## Minor

8. `ClientCardScreen.tsx:427` — удалить комментарий может `persona === 'owner' || 'admin'` → `useCan('clients.edit')` или своё
   право; сейчас индивидуал не может удалить свой же комментарий, если `authorId` не совпал.
   ✅ исправлено (fix-clients): удаление комментариев — тонкие права `deleteOwnComments`/`deleteOthersComments` (без `persona ===`)
9. `CustomFieldDef` — одно имя с другим типом в `src/domain/journal.ts` (поля записи). Переименовать в `ClientFieldDef`, чтобы
   импорт по ошибке не собрался.
   ⏳ позже — переименование типа трогает журнал (одно имя в двух разделах); оставлено до договорённости с journal
10. `ClientCardScreen.tsx` 492 строки, `components/FilterBuilderSheet.tsx` 452 строки / 5 компонентов — разбить по группам фильтров.
   ✅ исправлено (fix-clients): карточка разбита на `components/card/*` (≈260 строк экран), фильтры — на `components/filters/*`, api — папка `src/api/clients/*`, domain — `src/domain/clients/*`
11. `lib/export.ts` `downloadCsv` — такая же у platform (`BusinessesScreen.tsx:87`) → `@/lib/csv` (просьба №7).
   ✅ исправлено (fix-clients): CSV — общий `@/lib/csv` (`toCsv`, `downloadCsv`), своей копии нет
12. Поиск `ClientsListScreen.tsx:108` — `r.phone.includes(q)`: «00 123» с пробелом не найдёт `+37400123…`; в api искать по
    `localDigits` (как `searchClientsForBooking` у journal) — одна функция поиска клиента на оба раздела.
    ✅ исправлено на экране (b04-fix1, дефект F-04-002): поиск теперь сравнивает и по цифрам телефона без
    форматирования. ⏳ позже — вынос в общую api-функцию поиска (`localDigits`, на оба раздела) не делал, это
    отдельная просьба к journal, не только к clients.
   ✅ исправлено (fix-clients): поиск по цифрам телефона (от 3 цифр, и по второму телефону) — `matchesSearch` в src/domain/clients/filters.ts, считается в api. ⏳ общая функция с journal — просьба

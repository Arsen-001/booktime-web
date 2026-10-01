# clients · правила — только из ядра (core-rules, 25.09.2026)

Хранитель ядра. Номера строк — на момент 25.09 ~03:10.

## Major

1. **Права, которые не проверяются нигде** — `clients.phones`, `clients.export`, `clients.edit` (и `clients.delete`).
   Как: в api — `assertCan('clients.export')` внутри `request()` выгрузки, `assertCan('clients.edit')` в записи карточки;
   телефон — отдавать `clientForStaff(client, canNow('clients.phones'))` (маска `+374 00 1•• •56`); в экране — `useCan(...)`
   / `PermissionGate`. Зависимости прав (телефоны/выгрузка/правка — только вместе с `clients.view`) — в `can()` ядра.
   ⏳ позже (b04-fix1) — экран уже гейтит (`useCan('clients.phones'|'clients.edit'|'clients.export')`, пункт выгрузки
   теперь совсем исчезает без права — F-04-130), но `assertCan(...)` внутри самих api-функций (`updateClient`,
   выгрузка) ещё не добавлен: без него прямой вызов api в обход экрана (или чужой компонент) обходит право. Нужна
   правка нескольких функций `api/clients.ts` разом — не влезло в 30% времени пачки, посвящённой другому списку
   дефектов; следующая пачка должна взять этот пункт первым.
   ✅ исправлено (fix-clients): `assertCan` внутри api (см. arch-a1 №4), экран — `useCan`/тонкие права
2. **Мягкое удаление** — в ядре поле `Client.deletedAt`. Удаление карточки: `coreUpdate('clients', id, { deletedAt: nowDateTime() })`
   вместо `coreRemove` (записи остаются со своим `clientId`); списки фильтруют `!c.deletedAt`. Поиск клиента ядром (`placeBooking`)
   удалённых уже не видит.
   ✅ исправлено (b04-fix1): `deleteClient`/`mergeClients` (дубль) теперь пишут `deletedAt` вместо `coreRemove`;
   `listClientRows`, `getClientRow`, `listCategoryOptions`, `listCategories`, дубль-проверка телефона в
   `createClient`/`updateClient`, поиск keep/dup в `mergeClients` — все фильтруют `!c.deletedAt`. Проверено
   Playwright-пробой напрямую (не через measure.mjs — там `goto` без `?demo=...` уводит в чужой бизнес):
   удалённый клиент по прямой ссылке отдаёт ErrorState «Не удалось загрузить», номер освобождается для нового
   клиента. Не трогал: `listClientVisits`/`inviteToApp`/строки-подписи по `clientId` в бронированиях — эти вызовы
   происходят только для уже открытой (не удалённой) карточки или как исторические подписи, где имя удалённого
   клиента намеренно остаётся видно.
3. **Статусы** — `src/areas/clients/components/FilterBuilderSheet.tsx:36` свой список → `BOOKING_STATUSES` / `CANCELLED_STATUSES`
   из `@/domain/rules`, подписи — `common.bookingStatus.*`.
   ✅ исправлено (fix-clients): статусы фильтра — `BOOKING_STATUSES` из `@/domain/rules`, подписи — `useBookingStatusLabel` (common.bookingStatus); в api — `ACTIVE_STATUSES`, `FINAL_STATUSES`, `isCancelled` из ядра вместо своих списков
4. **Чужие сущности** (AREAS.md «Хозяева сущностей»): `Certificate`, `Subscription` (`src/domain/clients.ts:240,251`) — хозяин loyalty,
   `ProductPurchase` (`:264`) — stock, `ClientProfile.paidAmount` — finance, `discountPercent` — loyalty. Когда хозяева дадут функции
   чтения — фильтры «По продажам» и колонки берут данные у них, свои типы и сид удалить. `CustomFieldDef` → `ClientFieldDef`.
   ⏳ позже — см. arch-a1 №5

## Minor

- Выгрузка: `src/areas/clients/lib/export.ts` → `toCsv(rows, headers)` + `downloadCsv(name, csv)` из `@/lib/csv`.
   ✅ исправлено (fix-clients): выгрузка — `toCsv` + `downloadCsv` из `@/lib/csv`
- `ClientCardScreen.tsx:427` `persona === 'owner' || persona === 'admin'` → `useCan('clients.edit')`.
   ✅ исправлено (fix-clients): проверок по персоне в карточке нет
- Неявки клиента меняет только ядро (`changeBookingStatus`, поздняя отмена) — не правьте `noShowCount` руками.
   ✅ исправлено (fix-clients): раздел не пишет `noShowCount`; число неявок считается из записей (`countNoShows`: «Не пришёл» + поздние отмены)

# Состояние и запросы — client (state-s1, 25.09.2026)

Архитектор состояния. Что поменялось — `docs/STATE.md`, правила — CONVENTIONS §18.
Замер `node scripts/renders.mjs --only client-book,catalog-filter`: подтверждение записи — перерисовок 465 → 256, до
«Мои записи» на экране 1066 → 841 мс, до тишины 2356 → 841 мс; фильтр каталога — 172 → 108, без скелетона.

## Замечания

1. **minor — `entry.staff!.id` в `onClick`** (`src/areas/client/notifications/NotificationsScreen.tsx:233`): под React Compiler
   поле из функции-пропа может уйти в рендер и упасть при `entry.staff === undefined`. Посчитать в рендере через `?.`.
   Проверка: `node scripts/renders.mjs --check-compiler`.
2. **minor — каталог при смене фильтра** держит прежний список, пока грузится новый (`resultsQ.isPlaceholderData`):
   приглушите список (`opacity-60`), чтобы было видно, что он обновляется. Скелетон — только `resultsQ.isLoading`.
3. **minor — ключи без id раздела** (`['search', …]`, `['master-card', …]`, `['my-bookings', …]`): правило
   `['client', '<ресурс>', …]` (CONVENTIONS §18 п.1).
4. **major — `bookAppointment` работает с базой вне `request()`** (`src/api/client.ts:417`): `readCore()`, проверка окна
   (`computeFreeSlots`, `slotRulesFor`, `isOnlineUnavailable` раздела schedule) и `mutateArea` идут до/вне `request()` —
   без задержки и режима ошибок «сети», не откатываются при ошибке посередине, до подъёма базы видят пустые данные.
   В деве теперь 7 предупреждений `[mock-db] обращение к базе вне request()` на одну запись (сценарий
   `qa/scenarios/client-book-logged-in.json`). Всё тело — в один синхронный `request(() => { … coreTx.placeBooking … })`
   (команда ядра `placeBooking` уже делает проверку окна, статус и клиента по номеру — CONVENTIONS §17).

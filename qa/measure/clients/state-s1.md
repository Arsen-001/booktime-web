# Состояние и запросы — clients (state-s1, 25.09.2026)

Архитектор состояния. Что поменялось — `docs/STATE.md`, правила — CONVENTIONS §18.
Замер `node scripts/renders.mjs --only clients-type,clients-search,clients-switch`:

| Действие | Перерисовок | Перечитано запросов |
|---|---|---|
| Ввод 5 букв в поиск | 1540 → 895 | 0 |
| «Найти» | 110 → 79 | 0 |
| Переключатель «Лиды из чата» | 3696 → 532 | 13 → 1 |

## Замечания

1. **major — каждая буква в поиске перерисовывает таблицу целиком** (25 строк: `TableCardBody`×25, `Checkbox`×51 на букву,
   179 перерисовок на букву даже под React Compiler). `searchDraft` живёт в `ClientsListScreen` и при каждой букве меняется
   какой-то проп таблицы. Вынесите поле поиска в свой компонент (`ClientsSearchBox` с локальным `useState`, наружу —
   только `onSubmit(text)` по «Найти»/Enter): тогда буква перерисует только поле. То же нужно после «Найти» и переключателя:
   таблица перерисовывается 3 раза на действие.
   ✅ исправлено (fix-clients): текст поиска живёт в `SearchInput` (своё состояние, задержка 250 мс) — экран перерисовывается один раз после паузы; фильтрует api. ⏳ замер `renders.mjs --only clients-type` упал на старом селекторе поля (подсказка стала «Имя, телефон, email или номер карты») — просьба обновить сценарий в qa/requests/clients.md
2. **minor — ключи без `businessId`:** `['clients','columns']`, `['clients','showFullName']`, `['clients','customFieldDefs']`,
   `['clients','chatAutoSave']` (arch-a1 S6). Сейчас при смене персоны кэш сбрасывается целиком, но правильно — в ключе.
   ✅ исправлено (fix-clients): ключи `['clients','columns',businessId,staffId]`, `showFullName`, `customFieldDefs`, `autoSaveChatLeads`, `lostAfterDays` — с businessId
3. **major — `createClient` и `updateClient` работают с базой вне `request()`** (`src/api/clients.ts:140`, `:197`):
   `readCore()` (проверка дубликата номера) и `mutateArea` — до/вне `request()`: без задержки и режима ошибок «сети», не
   откатываются при ошибке посередине. В деве — предупреждения `[mock-db] обращение к базе вне request()` (сценарии
   `clients-b02-create`, `clients-ux-r2-form`). Всё тело — в один синхронный `request()`.
   ✅ исправлено (fix-clients): тело целиком в одном синхронном `request()`, дубль номера проверяется внутри

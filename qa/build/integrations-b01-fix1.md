# Пачка b01 «Интеграции» — починка дефектов (fix1)

25.09.2026. Измеритель нашёл 4 дефекта в пачке b01 (33 функции). Все починены.

## Дефекты — что сделано

### F-13-018 (major) — дедлайн активации сравнивался неправильно
`activationDeadline()` в `src/domain/integrations.ts` считал через `new Date(...).toISOString()` —
UTC-строку с `Z`, а `isActivationOverdue()` сравнивает лексикографически с `nowDateTime()` (Ереван,
без `Z`). На поясе +4 UTC-строка лексикографически почти всегда «в прошлом» → статус улетал в
«Не работает» вместо «Ждём активации партнёром» почти сразу после подключения.
**Правка:** `activationDeadline()` и `extendPaidUntil()` переведены на `addMinutes()` из `@/lib/date`
(тот же формат, что и `nowDateTime()`), убраны миллисекундные константы UTC.
Файлы: `src/domain/integrations.ts:169-183`.

### F-13-015 (major) — филиал с уже установленным приложением оставался выбираемым
`ConnectSheet` получал `availableLocationIds={locationIds}` — все локации бизнеса без исключения тех,
где приложение уже подключено (`connected`/`pendingActivation`).
**Правка:** добавлена `listLiveInstallLocationIds(appId, locationIds)` в `src/api/integrations.ts`
(читает `readArea(AREA).installs`, фильтрует по `isInstallLive` с учётом просрочки активации). В
`AppScreen.tsx` — запрос `liveLocationsQ` и `availableLocationIds = locationIds.filter(id => !live.includes(id))`,
именно он теперь идёт в `ConnectSheet`. Автоинвалидация через общий трекер чтений `readArea` — ручного
`invalidateQueries` не потребовалось.
Файлы: `src/api/integrations.ts`, `src/areas/integrations/AppScreen.tsx`.

### F-13-008 (major) — на карточке приложения не было хлебных крошек с категорией
Единственным способом узнать категорию была кнопка «← Назад»; для скрытых категорий (chatbots, tips)
узнать её с самой карточки было неоткуда.
**Правка:** `PageHeader` уже поддерживал `breadcrumbs` — добавлена цепочка «Интеграции › <категория>»
(ссылки на `/biz/integrations` и `/biz/integrations/category/<id>`), ключ категории — тот же
`category.<id>.title`, что уже используется на `CategoryScreen`.
Файлы: `src/areas/integrations/AppScreen.tsx`.
Проверено снимком `qa/measure/integrations/b01-m1-detail2/biz-integrations-apps-ia-1__…desktop.png` —
крошки «Интеграции › Уведомления» видны над заголовком.

### F-13-009 (minor) — не было ни одной карточки без блока «Цена»
Все строки `AM_ROWS` использовали явную ценовую модель — критерий «без цены — только кнопка
«Подключить»» физически не проверялся.
**Правка:** у «QR-визитка» (`marketing`) `priceModel` заменён на `'none'`; в `AppScreen.tsx` карточка
«Цена» теперь целиком скрывается при `price.model === 'none'` (раньше показывала запасной текст
«Цена уточняется»), остаётся только кнопка «Подключить». На плитке каталога (`AppTile.tsx`) такой
случай уже был обработан (пустая строка), реально не проверялся за отсутствием данных.
Файлы: `src/mock/slices/integrations.ts`, `src/areas/integrations/AppScreen.tsx`.
Проверено снимком `qa/measure/integrations/b01-m1-detail2/biz-integrations-apps-ia-16__…desktop.png`.

## Замечания проверяющих (§0.1)

Прочитаны все файлы `qa/measure/integrations/` кроме исключённых категорий
(`a11y-q2.md`, `a11y-q3.md`, `arch-a1.md`, `ux-best-c1..3.md` — исключены правилом; `b01-m0.md` —
исключён как `b*-m*`). Незакрытых block/major для раздела в разрешённых для чтения файлах не найдено
— нечего было чинить сверх присланных 4 дефектов.

## Проверки перед сдачей

- `npx tsc --noEmit --incremental --tsBuildInfoFile .tsbuild/integrations.tsbuildinfo` — 0 ошибок в
  путях раздела.
- `npx eslint src/domain/integrations.ts src/api/integrations.ts src/areas/integrations/AppScreen.tsx
  src/mock/slices/integrations.ts` — чисто.
- `scripts/ensure-dev.sh` — сервер уже работал на 3710, не трогал.
- `node scripts/measure.mjs --area integrations` (8 стр.) — 0 ошибок консоли, 0 4xx, 0 i18n-дефектов,
  0 сырых ключей. Одно предупреждение на всех страницах — `QuotaExceededError` при записи
  `bp-mock-db` в localStorage (фундамент `src/mock/db.ts`, не путь раздела — не трогал, не мой дефект).
- Точечный замер `/biz/integrations/apps/ia_1` и `/biz/integrations/apps/ia_16` (правильный/QR-визитка)
  — 0 ошибок, снимки просмотрены глазами (см. выше).

## done

Все 33 F-id пачки b01 — интерфейс не ломался, 4 присланных дефекта устранены:
F-13-001, F-13-002, F-13-003, F-13-004, F-13-005, F-13-006, F-13-007, F-13-008, F-13-009, F-13-010,
F-13-011, F-13-012, F-13-013, F-13-014, F-13-015, F-13-016, F-13-017, F-13-018, F-13-020, F-13-021,
F-13-022, F-13-023, F-13-025, F-13-026, F-13-027, F-13-173, F-13-184, F-13-185, F-13-201, F-13-202,
F-13-203, F-13-210, F-13-212

## partial

- Полная построчная сверка каждого пункта «Готово, когда» по всем 33 функциям заново (за пределами
  4 присланных дефектов) не переделывалась с нуля в этом заходе — пачка была собрана и принята
  раньше; в этом заходе точечно перепроверены только задетые правкой экраны (каталог, категория,
  карточка приложения, лист подключения) через `measure.mjs` и снимки. Если нужна полная
  ре-верификация всех 33 — отдельным заходом.

## marked

33 (node scripts/fids.mjs --area integrations, после правки: 213 всего / 33 помечено / 15.5%)

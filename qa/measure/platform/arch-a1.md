# Архитектура platform · arch-a1

Дата: 2026-09-25. Ревьюер архитектуры (код не правил). Мерка — docs/ARCHITECTURE.md и CONVENTIONS.md §16.
Сторож: `node scripts/arch-check.mjs --area platform` → 0 error, 24 warn (A11:10, A14:9, A13:3, A10:2).
Номера строк — на момент ревью.

Хорошо: все ключи `['platform', …]`, 47 записей через `useApiMutation`, монеты и промокоды — журналом событий,
модерация с причинами и возвратом.

## Major

1. **Подключение салона — 10 последовательных записей без отката** — `src/api/platform.ts:294` `finishConnectDraft`:
   `coreCreate` бизнеса, филиала, сотрудников, категорий, услуг, `coreUpdate`… (`:299–381`) — каждый отдельным запросом.
   Ошибка на 6-м шаге (или `?api=error` посередине) оставляет полсалона: бизнес без услуг, сотрудники без графика, черновик
   не закрыт. Это ровно та операция, которую сервер обязан делать одной транзакцией. Как: одно тело в `request()`,
   синхронные функции ядра внутри (просьба `arch-a1` №1), сначала собрать все сущности, потом записать.
   ✅ исправлено (fix-platform): `finishConnectDraft` — один `request()` с синхронными `coreTx.create` (бизнес, филиал, владелец, приглашённые, график, категория, услуги) + срез; упал — откатится всё. Поля последнего шага приходят той же командой.

2. **Модерация ни на что не влияет** — `isVisibleToClients` (`:192`) и `getModerationStatus` не вызывает ни один раздел
   (ваша просьба `qa/requests/platform.md` уже есть). Архитектурно: фильтр «видно клиентам» должен жить в функциях чтения,
   которые отдают данные клиенту (client `listCatalog`/`getMasterCard`, online `getPublicBusinessData`), а не в экранах. Поддерживаю
   просьбу; добавлено в `arch-a1` №5 (общее правило видимости).
   ✅ исправлено (fix-platform): refId элементов очереди = строка фото из `Staff.photos`/`Business.photos`; ядро скрывает неодобренное (`moderationHiddenIds`), «Одобрить» делает фото видимым клиенту (e2e C10.S2–S4 ✅).

3. **`src/api/platform.ts` — 1340 строк, `src/domain/platform.ts` — 729**: 12 подсистем (модерация, подключение, визиты,
   промокоды, поддержка, спрос, «первый», реклама, сторис, копии, план, идеи, заявки на сферы) в одном файле.
   Как: просьба `arch-a1` №10 — разрешить папку `src/api/platform/` (`moderation.ts`, `connect.ts`, `promo.ts` …) с
   `index.ts`, реэкспортирующим всё (импорты экранов не меняются). До ответа — не добавлять новые подсистемы в этот файл.
   ✅ исправлено (fix-platform): `src/api/platform/` (moderation, connect, visits, promo, support, demand, ads, businesses, plan, ideas, sphereRequests, overview, team + index) и `src/domain/platform/` (types/* по подсистемам, rules.ts — чистые правила).

4. **Обзор тянет все записи всех бизнесов** — `OverviewScreen.tsx:28` `listBookings({ from, to })` и считает «записи через
   приложение по дням» в компоненте (`:35`). На сервере — миллионы строк на каждый заход в панель. Как:
   `getAppBookingsStats({ from, to }) → { perDay: number[] }` в api.
   ✅ исправлено (fix-platform): `getOverview()` — один запрос, агрегаты считает api.

## Minor

5. `PlanScreen.tsx:137–145` — расчёт окупаемости (выручка салона/индивидуала со скидкой, точка безубыточности) в компоненте.
   Чистая функция `computePayback(inputs)` в `src/domain/platform.ts` — её же прочитает обзор и, позже, сервер.
   ✅ исправлено (fix-platform): `computePayback` в `src/domain/platform/rules.ts`.
6. `ConnectScreen.tsx` — 457 строк, 6 компонентов; шаг мастера сохраняется на сервер при каждом «Далее»
   (`:152–159` `patch({}, next)`) — лишний запрос и задержка на каждый шаг. Шаг — состояние экрана; сохранять данные шага, а не номер.
   `:247` `markConnectHere` мимо `useApiMutation`, без catch (геолокация прошла, запрос упал — тишина).
   ✅ исправлено (fix-platform): мастер разбит на ConnectWizardBody + файлы шагов; поля шага живут в состоянии экрана и уходят в черновик одним запросом на «Далее»; точка «Я на месте» — в форме, без отдельного запроса.
7. 9 файлов с несколькими компонентами (`PlanScreen` 6, `ConnectScreen` 6, `ModerationScreen` 3, `PromocodesScreen` 3 …).
   ✅ исправлено (fix-platform): `arch-check --area platform` — 0 нарушений.
8. `STATUS_TONE` в 5 экранах (`SupportScreen`, `PromocodesScreen`, `IdeasScreen`, `SphereRequestsScreen`, `VisitsScreen`) —
   каждый свой статус, это нормально; но вынести в `src/areas/platform/lib/statusTones.ts`, чтобы тон одного статуса не разошёлся
   между списком и карточкой.
   ✅ исправлено (fix-platform): `src/areas/platform/lib/tones.ts`.
9. `BusinessesScreen.tsx:87` — своя выгрузка CSV → `@/lib/csv` (просьба №7).
   ✅ исправлено (fix-platform): `toCsv` в api, `downloadCsv` в экране.
10. Права внутри панели — только проверка персоны в оболочке (`PlatformShell`), в api ничего. Для сервера: `platform.access`
    проверяет каждая функция `src/api/platform.ts` (просьба №8).
   ✅ исправлено (fix-platform): функции панели — `request(fn, PANEL)` = право `platform.access`; функции для других разделов (submitForModeration, getActiveAds, createIdea…) — без него.

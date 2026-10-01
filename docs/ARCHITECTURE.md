# ARCHITECTURE — как устроен интерфейс и как в него ложится бэкенд

Снимок 25.09.2026 (ревью arch-a1, отчёт — `qa/arch/report-a1.md`). Правила работы разделов — [CONVENTIONS.md](../CONVENTIONS.md),
карта разделов — [AREAS.md](../AREAS.md), план сервера — [docs/backend/](backend/README.md).
Сторож зависимостей — `node scripts/arch-check.mjs [--area <id>]` (правила A1…A16 — в конце этого файла).

Состояние перехода: слой запросов переводится на TanStack Query с точечной инвалидацией (архитектор состояния,
`src/api/request.ts`). Контракт для разделов (`useApiQuery` / `useApiMutation`, функции `src/api/<area>.ts`) остаётся тем же;
ниже описано, что от раздела требуется, чтобы переход и потом бэкенд прошли без правки экранов.

---

## 1. Слои

```
 src/app/**            маршрут: тонкая обёртка, await params → <XxxScreen/>            (без логики, без данных)
     │
 src/areas/<area>/**   экраны и компоненты раздела: состояние формы, вёрстка, useT, useFormat
     │   хуки раздела (src/areas/<area>/hooks/use*.ts): useApiQuery/useApiMutation + ключи
     ▼
 src/api/<area>.ts     КОНТРАКТ С СЕРВЕРОМ: одна функция = один будущий эндпоинт; вход/выход — сериализуемые DTO;
     │                 ошибки — ApiError(code); ровно один request() на функцию
     ▼
 src/api/request.ts    сеть (сейчас — задержка + режимы демо; потом — fetch), кэш, инвалидация
 src/api/core.ts       ядро: сущности src/domain/core.ts
 src/api/area.ts       readArea/readCore/mutateArea — ТОЛЬКО внутри request() в src/api/<area>.ts
     │
     ▼
 src/mock/db.ts        моковая база (zustand + localStorage) — уйдёт целиком, когда будет сервер
 src/mock/slices/<area>.ts, src/mock/seed/**

 сбоку, без зависимостей вверх:
 src/domain/**         типы + ЧИСТЫЕ правила (без React, без стора, без 'use client') — переносятся на сервер как есть
 src/lib/**            чистые помощники: cn, date, money, phone, text, id
 src/ui/**             UI-кит (не знает про api и стор)
 src/i18n/**           useT, useFormat
 src/demo/**           «кто я»: useCurrent, useCan, useSphere, useTerms (потом — сессия с сервера)
 src/extensions/**     хосты и вклады (единственный законный вход одного раздела в экран другого)
 src/shell/**          каркасы кабинета/клиента/панели/публичной страницы
 src/config/**         разделы, меню, права, сферы, районы
```

## 2. Правила зависимостей (кто кого может импортировать)

| Кто \ кого | app | areas/<свой> | areas/<чужой> | api/<area> | api/core | api/area | mock/** | domain | lib, i18n, ui, demo/hooks, config | extensions |
|---|---|---|---|---|---|---|---|---|---|---|
| `src/app/**` | — | ✅ экран | ❌ | ❌ | ❌ | ❌ | ❌ | типы | ✅ | — |
| `src/areas/<a>/**` | ❌ | ✅ | ❌ (A1) | ✅ свой и публичные функции чужих¹ | ✅ | ❌ (A3) | ❌ (A2) | ✅ | ✅ | `useExtensions`, `ExtensionSlot` |
| `src/api/<a>.ts` | ❌ | ❌ | ❌ | чистые функции чужих¹ | ✅ | ✅ свой срез пишет, чужой — только читает (A4/A5) | ❌ | ✅ | `lib` | ❌ |
| `src/domain/**` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | `lib` (без React) | ❌ |
| `src/ui/**` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | типы | `lib`, `i18n` | ❌ |
| `src/shell/**` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ (A2) | ✅ | ✅ | ✅ |

¹ Чужой раздел — только его экспортированные функции `src/api/<b>.ts` (например, `getFreeSlots` раздела schedule),
никогда его компоненты, хуки, `lib/`. Писать в чужие данные — только вызовом api того раздела.

Направление строго сверху вниз. `domain` и `lib` не знают ни о React, ни о сторе, ни о запросах — это то, что поедет на сервер.

## 3. Где живёт бизнес-логика

| Что | Где | Почему |
|---|---|---|
| Правила, которые проверит сервер: окна, пересечения, цена/скидка/итог, срок отмены, статус новой записи, видимость мастера клиентам, права на действие | **чистые функции** в `src/domain/rules/*.ts` (общие, фундамент) или в `src/domain/<area>.ts` (правило одного раздела) | переносятся на сервер копированием; тестируются без браузера |
| Сборка ответа (фильтр, сортировка, пагинация, агрегаты для отчёта/обзора) | `src/api/<area>.ts`, внутри одного `request()` | это и есть будущий эндпоинт; экран получает готовое |
| Команда «сделай» из нескольких шагов (создать запись + клиента + визит + доп. поля) | одна функция `src/api/<area>.ts` = одна транзакция | сервер сделает её атомарно; UI делает один вызов |
| Состояние формы, шаги мастера, раскрытые панели | `src/areas/<area>/**` (useState/useReducer, react-hook-form) | не данные сервера |
| Черновики форм, выбранные вкладки, свёрнутые панели | клиентское состояние (useState / `useDemoStore` / sessionStorage), **не** моковая база | запись в базу = инвалидация и перечитывание у всех |
| Форматирование для показа | `useFormat()`, `pickText()` | одно место на все языки |
| Подписи статусов, тоны бейджей | общий компонент в `src/ui` (запрошен: `BookingStatusBadge`) | одинаково во всех разделах |

Нельзя: считать в компоненте окна, цены со скидкой, «можно ли отменить», «пересекается ли»; проверять права по `persona ===`;
вызывать подряд несколько api-функций в обработчике кнопки, чтобы собрать одну бизнес-операцию.

## 4. Контракт функции `src/api/<area>.ts`

1. **Один `request()` на функцию.** Внутри — только синхронные чтения (`readCore`, `readArea`) и синхронные записи
   (`mutateArea`, синхронные функции ядра — просьба к хранителю ядра `qa/requests/arch-a1.md` №1). `await coreCreate(...)`
   внутри своей функции — это вторая «сетевая» поездка с отдельной задержкой и без атомарности (A11).
2. **Вход и выход — сериализуемые DTO**: строки, числа, массивы, объекты; даты — `ISODate`/`ISODateTime` строками;
   никаких `Date`, функций, классов, `Map`. Клиентским и публичным маршрутам не отдавать сущности ядра целиком —
   только нужные поля (`PublicStaff` без телефона и домашнего адреса, см. docs/backend/03-access-privacy.md).
3. **Ошибки — `ApiError(code)`** со стабильным кодом (`slot_taken`, `not_found`, `forbidden`, `too_late`…); экран
   показывает текст по коду из словаря. `throw new Error('…')` — нельзя: код теряется.
4. **Права проверяет функция api**, не только экран: `forbidden`, если у текущего пользователя нет права
   (просьба к архитектору состояния: `request(fn, { permission })`). Экран дополнительно прячет кнопку (`useCan`).
5. **Всё, что зависит от бизнеса, принимает `businessId`** (и ключ запроса его содержит). «Глобальных» настроек
   бизнеса в срезе быть не должно: у каждого салона свои категории, поля, колонки, пороги.
6. **Время — Ереван.** «Сейчас» и «сегодня» — только из `@/lib/date` (`nowDateTime()`, `today()`); `toISOString()`
   даёт UTC и сдвигает дату на 4 часа (A9). На сервере `@/lib/date` получит явный пояс `Asia/Yerevan`.
7. **Ключи запросов** — фабрика рядом с функциями раздела:
   ```ts
   // src/api/loyalty.ts (или src/areas/loyalty/hooks/keys.ts, пока нет просьбы о папке)
   export const loyaltyKeys = {
     all: ['loyalty'] as const,
     cards: (businessId: Id) => ['loyalty', 'cards', businessId] as const,
     card: (businessId: Id, cardId: Id) => ['loyalty', 'cards', businessId, cardId] as const,
   };
   ```
   Первый элемент — id раздела (A12), затем сущность, затем параметры. Данные ядра читаются под ключами ядра
   (`['core', 'services', businessId]` — просьба к архитектору состояния), а не каждый раздел под своим: сейчас одни и те же
   услуги бизнеса лежат под `['journal','services']`, `['journal','all-services']`, `['schedule','services']`.
8. **Запись объявляет, что она меняет** (сущности ядра/срез) — по этому списку инвалидируются ключи. Ручной
   `q.refetch()` после записи не нужен и после перехода на точечную инвалидацию станет лишним запросом.

## 5. Как раздел добавляет экран, данные и API

1. **Данные.** Тип — `src/domain/<area>.ts`; начальные данные — `src/mock/slices/<area>.ts` (`seed(core, now)`, ключ по id
   ядра **и по `businessId`**); поменяли форму — подняли `version`. Поле, нужное нескольким разделам, — просьба в ядро,
   а не черновик в своём срезе. Появилось поле в ядре — перенесите черновик и удалите его из среза.
2. **Правило.** Чистая функция в `src/domain/<area>.ts` (своё) или просьба в `src/domain/rules/` (общее: запись, окна,
   статусы, видимость, отмена).
3. **API.** Функция в `src/api/<area>.ts` по контракту §4 + ключи в фабрике `<area>Keys`.
4. **Хук раздела** (желательно): `src/areas/<area>/hooks/useXxx.ts` — `useApiQuery(<area>Keys.xxx(...), () => getXxx(...), { enabled })`;
   экраны зовут хуки, а не собирают ключи сами.
5. **Экран.** `src/areas/<area>/<part>/XxxScreen.tsx`: три состояния (Skeleton / EmptyState / ErrorState), запись — только
   `useApiMutation` + try/catch + toast; права — `useCan`. Один компонент — один файл; файл > 300 строк — разбить.
6. **Маршрут.** `src/app/.../page.tsx` — только `return <XxxScreen/>`.
7. **Вклад в чужой экран** — `src/areas/<area>/extensions/<Host>.tsx` с пропсами хоста.
8. **Проверка:** `npx tsc --noEmit`, `npx eslint …`, `node scripts/check-tokens.mjs --area <id>`, `node scripts/arch-check.mjs --area <id>`.

## 6. Как подключится бэкенд

- `request(fn)` заменяется на `http(method, path, body)`; сигнатуры функций `src/api/<area>.ts` не меняются — экраны
  не правятся. Соответствие функций и эндпоинтов — `docs/backend/02-api.md`.
- Тело каждой функции (фильтры, правила, запись) переезжает на сервер; чистые правила из `src/domain/rules` и
  `src/domain/<area>.ts` копируются как есть — поэтому в них нет React, стора и `'use client'`.
- `src/mock/**` и `src/api/area.ts` удаляются. `useCurrent()` берёт «кто я» из сессии, `useCan()` — права из ответа сервера.
- Кэш и инвалидация остаются на клиенте (TanStack Query), ключи — те же фабрики.
- Что сейчас держится только на моке и обязано переехать на сервер — `docs/backend/07-mock-only.md`;
  расхождения мока с ТЗ — там же. Список этого ревью — `qa/arch/report-a1.md` §4.

## 7. Общие модули (что брать, а не писать своё)

| Нужно | Брать | Статус |
|---|---|---|
| Компоненты экрана | `src/ui/*` (витрина `/dev/ui`) | есть |
| Склейка классов | `cn` из `@/lib/cn` | есть |
| Даты, «сегодня», сдвиг дней | `@/lib/date` (`today`, `nowDateTime`, `parse`, `toISODate`, `addMinutes`, `eachDay`, `weekStart`) | есть; `addDays` — просьба |
| Деньги, телефон, текст | `@/lib/money`, `@/lib/phone` (`normalizePhone`, `maskPhone`, `waLink`, `telLink`), `@/lib/text` (`pickText`, `initials`, `normalizeSearch`) | есть |
| Показ чисел/дат/длительностей | `useFormat()` | есть |
| Тексты | `useT(ns)`, `useTDynamic` | есть |
| Кто я, права, сфера, слова сферы | `useCurrent`, `useCan`, `PermissionGate`, `useSphere`, `useTerms` | есть |
| Сущности ядра | `src/api/core.ts` (`coreList/Get/Create/Update/Remove`, `listBookings`, `createBooking`, …) | есть |
| Свободные окна | `getFreeSlots`, `getNearestSlots` из `src/api/schedule.ts` | есть (правило → `domain/rules/slots`, просьба) |
| Экран из нескольких разделов | `useExtensions` + `ExtensionSlot` | есть |
| Мобильный режим | `useIsMobile` из `@/ui/hooks/useMediaQuery` | есть |
| Статус записи: активна/отменена/итоговая, бейдж статуса | `domain/rules/booking-status.ts`, `ui/BookingStatusBadge` | **просьба** |
| Занятость мастера, часы дня, пересечение | `domain/rules/busy.ts` | **просьба** |
| Видимость мастера клиентам | `domain/rules/visibility.ts` | **просьба** |
| Срок отмены/переноса, статус новой записи | `domain/rules/booking-policy.ts` | **просьба** |
| Итог строки/визита со скидкой | `domain/rules/pricing.ts` | **просьба** |
| Копировать в буфер, выгрузить CSV | `@/lib/clipboard`, `@/lib/csv` | **просьба** (сейчас 4 и 2 своих копии) |
| Текст на языке пользователя одной строкой | `usePickText()` | **просьба** (50 вызовов `pickText(x, useLocale())`) |
| Подтверждение номера кодом | `ui/PhoneVerify` | **просьба** (сейчас 3 разные реализации) |

Просьбы с деталями — `qa/requests/arch-a1.md`.

## 8. Сторож (`scripts/arch-check.mjs`)

| Id | Уровень | Что ловит |
|---|---|---|
| A1 | error | импорт внутренностей чужого раздела (`@/areas/<другой>/…`); фундамент — только через `src/extensions` и `nav.ts` |
| A2 | error | `@/mock/**` мимо `src/api` (разрешено: `src/mock`, `src/api/{core,area,request}`, `src/demo`, `src/dev`, `src/shell/demo`) |
| A3 | error | `@/api/area` (readArea/mutateArea/readCore) вне `src/api` |
| A4 | error | `mutateArea('<чужой>')` в `src/api/<area>.ts` |
| A5 | warn | `readArea('<чужой>')` — лучше функцией api того раздела |
| A6 | error | `any` (исключение — строка с `eslint-disable-next-line @typescript-eslint/no-explicit-any` над ней или `arch-ok`) |
| A7 | warn | `as unknown as` |
| A8 | warn | `persona ===` вместо `useCan` |
| A9 | warn | `toISOString()`, `new Date(…)`, `Date.now()` в разделе или его api |
| A10 | warn | `await <функция @/api/*>(` в компоненте — запись мимо `useApiMutation` |
| A11 | warn | вложенный сетевой вызов ядра внутри api раздела |
| A12 | warn | ключ `useApiQuery` не начинается с id раздела |
| A13 | warn | файл раздела > 400 строк (> 700 — major) |
| A14 | warn | больше одного компонента в `.tsx` |
| A15 | warn | `.catch(() => {})`, пустой `catch` |
| A16 | warn | свой список отменённых статусов |

Строка с комментарием `arch-ok` пропускается (ставить только с объяснением рядом).

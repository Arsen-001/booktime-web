# Раздел «Зарплата» — пачка b01, починка дефектов #2

Починка дефектов, найденных измерителем в пачке b01 (F-09-001…-062 группа «Каркас раздела, Основные
настройки, схема сотрудника, базовый движок, Расчёт за день/период»).

## Что сделано

### F-09-011 · block — мастер мог редактировать чужую ставку
`SchemeEditor.tsx` показывал шесть блоков и поля ставок всем, кто открыл `/biz/payroll/staff/[id]`,
без учёта права `payroll.manage`. Кнопки «Сохранить»/«Скопировать» уже были скрыты для `!canManage`,
но сами поля (Input/Switch/SegmentedControl внутри блоков) принимали ввод — мастер видел, что его
правки «применились» (в локальном черновике), хотя сохранить их не мог (`saveScheme` уже проверял
`assertCan('payroll.manage')` на сервере).
Правка: шесть блоков обёрнуты в `<fieldset disabled={!canManage}>` — HTML-каскад отключает все
вложенные `<input>/<button>`, независимо от того, какой компонент их рендерит, без правки шести
файлов блоков. Плюс подпись «Только просмотр — изменение схемы недоступно для вашей роли» вместо
обычной подсказки, когда `!canManage`. Проверено сценарием `qa/scenarios/payroll/b01-master-edit-check.json`
(персона master): шаг `fill` больше не находит доступное поле — таймаут вместо успешной правки;
скриншот `qa/shots/payroll-fix2d/…fail-1.png`.
`src/areas/payroll/scheme/SchemeEditor.tsx`

### F-09-058 · block — межбизнесовая утечка схемы сотрудника
`StaffSchemeScreen.tsx` открывал схему любого `staffId` из URL, не проверяя его `businessId` против
текущего бизнеса. Персона `owner-empty` видела и могла открыть полный редактор схемы сотрудника
Nuri Nail Studio по прямому адресу.
Правка: `useCurrent()` даёт `businessId` текущего пользователя; если `staff.businessId !== businessId`
(или сотрудник не найден), экран рендерит `EmptyState` «Сотрудник не найден» вместо редактора.
Добавлен ключ `scheme.notFound` (ru/en). Проверено `--routes /biz/payroll/staff/st_nuri_ani --persona owner-empty`:
экран показывает «Сотрудник не найден», `data-f` = 0 (редактор не смонтирован) — скриншот
`qa/shots/payroll-fix2e/…png`.
`src/areas/payroll/StaffSchemeScreen.tsx`, `messages/{ru,en}/payroll.json`

### F-09-013, F-09-004 · block — не сохраняется после перезагрузки
Причина — фундаментальный баг `src/mock/db.ts` (`bp-mock-db` превышает квоту `localStorage` уже на
сиде, до всякой правки пользователем; UI показывает ложно-успешный тост, ошибка молча уходит в
консоль). Файл не мой (общее/фундамент, CONVENTIONS §1) — уже описан в `qa/requests/payroll.md`
предыдущей пачкой (запись от 2026-09-25), сам не правил. Остаётся ⚠️ partial до починки `mock/db.ts`.

### F-09-031 · major — «Оплата за продажу товаров» ни на что не влияет
Блок настраивается и переживает сохранение (когда не упирается в баг db.ts выше), но
`productsAmount` был захардкожен в 0 и в `computeDay`, и в `computePeriod`. Причина —
`QuickSaleRecord` (владелец `journal`) не хранит `staffId`/`locationId`, поэтому применить ставку
блока физически не к чему (движок `applyPayout`/`payoutForTarget` уже готов и используется для услуг).
Задокументировано в `src/domain/payroll.ts` ещё до этой пачки; добавил отдельную запись в
`qa/requests/payroll.md` с точным путём (`src/domain/journal.ts:128`) и что нужно раздела `journal`.
Остаётся ⚠️ partial — правка вне моих путей.

### F-09-062 · major — колонка «Стоимость услуг» на самом деле показывала выплату
`servicesAmount` в «Расчёте за период» был суммой `op.amount` (payout мастеру после ставки и
расходников), а не фактической ценой услуги клиенту — у Ани Саргсян (расходники 60% > ставки 40%)
колонка показывала 0 ֏ при 45 реальных визитах.
Правка: `PayoutLine`/`DayOperation` (`src/domain/payroll.ts`) получили поле `revenue` — фактическая
сумма строки (`lineTotal`), отдельно от `amount` (payout). `computePeriod` (`src/api/payroll.ts`)
теперь считает `servicesRevenue` (→ колонка «Стоимость услуг», `totalAmount`) отдельно от
`servicesPayoutAmount` (→ идёт только в `salary`). «Расчёт за день» (`computeDay`/`DailyScreen`) не
трогал — там `amount` показывается намеренно (F-09-058 пример из ТЗ: «12:00 → 93.6» — это и есть
payout, а не цена визита). Проверено скриншотом `qa/shots/payroll-fix2f/…period…png`: у Ани Саргсян
«Стоимость услуг» = 279 000 ֏ (было 0).
`src/domain/payroll.ts`, `src/api/payroll.ts`

### F-09-014 · minor — переключатель «%»/«դր» уже зоны нажатия
Контейнер `flex items-stretch` не растягивал `SegmentedControl` — сегменты держали содержимое (36px
для «%»). Первая попытка (`min-w` на контейнер) не сработала, т.к. кнопки внутри `shrink-0`; вторая —
`fullWidth` (делит контейнер поровну) + `min-w-[100px]` на контроле, и `flex-wrap` на строке, чтобы
число не схлопывалось до 30px в узких контейнерах (вкладка карточки сотрудника). Замерено
`scripts/measure.mjs`: `мелких целей` по разделу упало до 0.
`src/areas/payroll/scheme/PayoutValueField.tsx`

### F-09-016 · minor — ссылка с именем мастера 24px
Найдена не в `OverridesEditor.tsx` (в нём нет ссылок на мастеров — там только цели «услуга/категория»
для индивидуальных значений), а в `extensions/ServiceCard.tsx` (тоже помечен `F-09-016` в коде) — вклад
раздела payroll в карточку услуги: список мастеров со ставкой и ссылкой на их схему. `<Link>` оборачивал
только текст имени (высота строки ~24px), `py-3` был на `<li>`, не на самой ссылке. Растянул `<Link>`
на всю строку `flex min-h-11 flex-1 items-center`.
`src/areas/payroll/extensions/ServiceCard.tsx`

## Требуется правка чужого/общего (не мои пути)

Записано в `qa/requests/payroll.md`:
1. `src/mock/db.ts` — `bp-mock-db` превышает квоту `localStorage` уже на сиде (F-09-004, F-09-013 и,
   вероятно, «после перезагрузки» по всем разделам, не только payroll) — запись прошлой пачки, ещё не
   починена.
2. `src/domain/journal.ts` `QuickSaleRecord` — нет `staffId`/`locationId`, поэтому F-09-031 (оплата за
   продажу товаров) не может посчитать сумму; новая запись этой пачки.

## Проверка

- `npx tsc --noEmit --incremental --tsBuildInfoFile .tsbuild/payroll.tsbuildinfo` — 0 ошибок в
  `src/areas/payroll/**`, `src/api/payroll.ts`, `src/domain/payroll.ts` (ошибки есть в `client`/`network`
  — не мои пути, не трогал).
- `npx eslint src/areas/payroll src/api/payroll.ts src/domain/payroll.ts` — 0 ошибок.
- `scripts/ensure-dev.sh` — сервер уже был поднят, не трогал.
- `scripts/measure.mjs --area payroll --persona owner,master --device phone,desktop` (36 страниц) — 0
  ошибок консоли, 0 4xx, 0 i18n, 0 мелких целей, 0 вылетов (после исправления F-09-014).
- Сценарий `b01-master-edit-check.json` (master) — поле недоступно (таймаут `fill`, ожидаемо).
- Прямой заход `owner-empty` на `/biz/payroll/staff/st_nuri_ani` — «Сотрудник не найден».
- Снимки посмотрены глазами: `qa/shots/payroll-fix2d`, `-2e`, `-2f`.

## 0.1 Проверено по прошлым замечаниям
`qa/measure/payroll/` — все присутствующие файлы (`a11y-q2/q3`, `arch-a1`, `b01-m0/m1`, `b01-report.json`,
`e2e-q1/q3/q4`, `onboarding-k1`, `text-q2`, `ux-best-c1/c2/c3`) попадают под исключения п. 0.1
(a11y-\*, arch-\*, b\*-m\*, e2e-\*, onboarding-\*, text-\*, ux-best-\*) — новых own-area block/major вне
их не нашлось.

## done
F-09-011, F-09-058, F-09-062, F-09-014, F-09-016

## partial
- F-09-013 — блок/поле сохраняются в API и в черновике корректно; переживает перезагрузку только когда
  `localStorage` не переполнен — блокирует фундаментальный баг `src/mock/db.ts` (запрошено, не мой путь).
- F-09-004 — та же причина (localStorage), настройки сами по себе сохраняются правильно.
- F-09-031 — блок настраивается, сохраняется, переживает перезагрузку (когда не упирается в db.ts); на
  расчёт не влияет — нет входных данных (`QuickSaleRecord.staffId`), запрошено в `journal`.
- F-09-012, F-09-017, F-09-026, F-09-032, F-09-036, F-09-039, F-09-042, F-09-043, F-09-059, F-09-061,
  F-09-106, F-09-111, F-09-112 — не были дефектами этой пачки (измеритель их не заводил как block/major
  в b01-fix2); не трогал специально, кроме сопутствующих правок выше (`revenue` в `PayoutLine`/
  `DayOperation` — аддитивная правка, не меняет их поведение).

## assumed
- F-09-058 not-found экран: использован общий `EmptyState`, а не отдельный «403»/«404» компонент —
  в UI-ките нет `NotFoundState`, паттерн взят из `MembershipTypeFormScreen.tsx` (loyalty).
- F-09-014 фикс: выбран `fullWidth` вместо фиксированной ширины кнопок, т.к. `SegmentedControl` (общий
  компонент) не даёт per-option ширину — решение локальное, в своих путях.
- `revenue` в `PayoutLine`/`DayOperation` — обязательное поле (не опциональное), т.к. единственное место
  конструирования этих типов — `computeServicesForDay` в этом же файле; проверено `grep` по всему
  репозиторию.

## marked
25 (после `node scripts/fids.mjs --area payroll`)

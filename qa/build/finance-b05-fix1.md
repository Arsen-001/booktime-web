# Финансы — b05-fix1: починка дефектов пачки «Политика оплаты» (b05)

Измеритель пачки b05 нашёл 11 дефектов (все major, ни одного block) на функциях F-07-101…123/126/129/130/135-137.
Починены все, кроме трёх, которые требуют экранов у соседних разделов (журнал, приложение клиента) — не мои пути.

## done

Все пункты «Готово, когда» выполнены (проверено кодом + `measure.mjs` на `/biz/finance/policy`,
`/biz/finance/adyen`, персона owner, ru/en, телефон/десктоп — 0 ошибок консоли, 0 сырых ключей, 0 4xx):

- **F-07-101** — карточка «Activated» на `?lang=en` больше не показывает русские «24 ч»/«15 мин»: заменил
  литералы кириллицей на `format.duration()` (`src/areas/finance/PolicyScreen.tsx`).
- **F-07-105** — бесплатная услуга (`priceMin <= 0`) теперь помечена бейджем «Бесплатная — вне политики»,
  чекбокс отключён и принудительно снят, карандаш «своя политика» недоступен; `listServicesBrief()` отдаёт
  флаг `free` (`src/api/finance.ts`, `src/areas/finance/PolicyScreen.tsx`). Доменная логика (`policyApplies` /
  `freeServiceIds`) уже исключала бесплатные услуги — чинил только видимость в UI.
- **F-07-107, F-07-108, F-07-109** — переизмерены вместе с F-07-105 (тот же блок «Conditions and limitations»,
  своих отдельных дефектов не было) — работают.
- **F-07-112** — счёт «Payment Policy» в карточке клиента: `accountBalance/accountAvailable/accountTopUps/
  accountDebits/accountFees` переведены на русский (были английские заглушки).
- **F-07-121** — статусы решения по штрафу (`statusClientAccepted`, `statusConfirmedAtCheckout`,
  `statusCreditedToBalance`, `statusAppliedCharged`, `statusAppliedWaived`, `statusExpired`) переведены на русский
  в `messages/ru/finance.json`.
- **F-07-129** — у удержанного депозита теперь своя статья `depositRetained` («Удержанный депозит»), отдельная
  от «Списание штрафа»: добавил ключ в `SYSTEM_ITEM_KEYS` (`src/domain/finance.ts`), в сид статей
  (`src/mock/slices/finance.ts`) и новую функцию `chargeClientDepositRetainedOperation()`, которая пишет
  финансовую операцию при `resolvePolicyDecision(..., 'charge', ...)` для режима «Депозит» — раньше это решение
  вообще не попадало в «Финансовые операции» (был только `pushPolicyEntry` на счёт политики, без строки в общем
  отчёте). Зачёт депозита в оплату визита при обычном закрытии (`applyPolicyDepositAtCheckout`) по-прежнему идёт
  по статье «Оказание услуг» — это выручка, не удержанный депозит, и отдельная строка тут была бы неверной.
- **F-07-135, F-07-136** — Adyen Dashboard и подключение: `connectStart` («Connect»→«Подключить»),
  `connectedTitle`, `changeRegistration`, `changeOnboarding`, `dashboardTitle`, `totalIncoming/totalOutgoing/
  availableBalance/periodResult`, `transactionsTab/insightsTab`, `filterType`, `colDate/colMethod/colType/
  colNet/colGross`, `refund`, `type.*` (Payment/Refund/Transfer/Chargeback/Correction/ATM/Capital/Other) —
  всё переведено в `messages/ru/finance.json`. Экран сам уже был на `t()` целиком — правка чисто в переводах.

## partial

- **F-07-116** (разделение/объединение/копирование визита с депозитом), **F-07-119** (перенос записи
  администратором с политикой), **F-07-120** (отмена/перенос записи клиентом онлайн) — API готов и стабилен
  (`evaluatePolicyForBooking`, `resolvePolicyDecision`, `getBookingPolicySnapshot`, `createBookingPolicySnapshot`
  в `src/api/finance.ts`), но вызывающих экранов нет: F-116/119 — в журнале (`src/areas/journal/**`), F-120 — в
  приложении клиента (`src/app/(client)/**`). Не мои пути — просьба записана в `qa/requests/finance.md`
  (запись от 2026-09-25, продублирована подтверждением по итогам этой пачки). Не помечены `data-f`, чтобы не
  подделывать готовность.

## assumed

- Бесплатная услуга определяется по `priceMin <= 0` (`Service.priceMin` в `src/domain/core.ts`) — в ТЗ явно не
  сказано, какое поле считать ценой при цене-диапазоне; `priceMin` совпадает с «от» в карточке услуги.
- Для удержанного депозита взял `kind: 'income'`, как у «Списания штрафа» — деньги остаются у бизнеса как доход,
  а не как компенсация расхода.
- «PSP reference» и «Shopper statement» оставил как есть (не в списке дефектов измерителя, это термины Adyen,
  которые в интерфейсах платёжных систем обычно не переводят).
- Составные/групповые услуги в охвате политики (⚠ из ТЗ F-07-105) — вне рамок этой пачки, не трогал.

## Замечания проверяющих (§0.1)

Прочитал все файлы `qa/measure/finance/`, кроме исключённых по правилу (`b*-m*`, `ux-*`, `speed-*`, `arch-*`,
`core-rules*`, `decision-*`, `e2e-*`, `text-*`, `a11y-*`, `build-*`, `onboarding-*`, `ux-best-*`) — под фильтр
попал только `empty-d1.md`, и там единственный пункт уже отмечен `✅ исправлено (b03)`. Новых открытых
block/major не нашёл — нечего было чинить сверху.

## Проверка

- `npx tsc --noEmit --incremental --tsBuildInfoFile .tsbuild/finance.tsbuildinfo` — 0 ошибок в путях finance
  (есть предсуществующие ошибки в `src/areas/network/**`, не мои).
- `npx eslint` по путям finance — чисто.
- `scripts/ensure-dev.sh` — сервер уже работал, не трогал.
- `node scripts/measure.mjs --routes /biz/finance/policy,/biz/finance/adyen --persona owner --lang ru,en --device phone,desktop` —
  8 страниц, 0 ошибок консоли, 0 сырых ключей, 0 4xx, data-f найден на всех. Единственное предупреждение —
  известный `QuotaExceededError` из `src/mock/db.ts` (не мой путь, задокументирован в `qa/requests/finance.md`).
- Снимки `qa/shots/custom/biz-finance-policy__owner-nails-en-light-desktop.png` (карточка Activated на
  английском) и `…ru-light-desktop__full.png` (полный охват услуг/сотрудников) просмотрены глазами.

## marked

`node scripts/fids.mjs --area finance` после работы: **122** из 185 (65.9%).

# Финансы — b05-fix2: починка дефектов пачки «Политика оплаты» (b05, второй заход)

Измеритель дал 6 дефектов на F-07-101…123/126/129/130/135-137: 1 major (F-07-101), 3 block
(F-07-116/119/120), 1 minor (F-07-136, подсветка меню), 1 minor фундамента (localStorage). Починил всё, что
в моих путях; F-07-119/120 и localStorage-квота требуют соседей — объяснено ниже и в `qa/requests/finance.md`.

## done

Проверено кодом (`tsc`/`eslint` без ошибок по путям раздела) + `measure.mjs` на `/biz/finance/policy`,
`/biz/finance/adyen`, `/biz/finance/online`, персоны owner/owner-empty/admin/master, ru, телефон/десктоп —
0 ошибок консоли, 0 4xx, 0 сырых ключей на всех 24 прогонах.

- **F-07-101** — режим «Депозит» больше нельзя сохранить без подключённой платёжной системы. Добавлен
  `isAnyPaymentSystemConnectedSync` (Adyen ИЛИ любой подключённый онлайн-провайдер способа оплаты,
  `src/api/finance.ts`), гейт в `savePaymentPolicy`. `PolicyScreen.tsx`: опция «Депозит» дизейблится наравне
  с «Гарантией картой», отдельная подсказка «Депозит недоступен без подключённой платёжной системы» со
  ссылкой на «Онлайн-платежи» (не путается с подсказкой про Adyen). Сид `bizIndex===0` (уже активный
  «Депозит» в демо) получил демо-провайдера `stripe` на способ предоплаты, чтобы карточка не расходилась со
  своим же новым правилом. Снимками подтверждено: owner (подключено) — «Депозит» включён и выбран;
  owner-empty (ничего не подключено) — «Депозит» и «Гарантия картой» серые, подсказка видна.
  Новые ключи `policy.needsPaymentSystem`/`connectPaymentSystem`/`paymentSystemConnected` — ru и en.
- **F-07-116** (особые случаи депозита при разделении/объединении/копировании визита; роль «система», по ТЗ
  без своего экрана) — реализовано в `src/api/finance.ts`, отмечено `data-f="F-07-116"`:
  `onBookingSplit(businessId, sourceBookingId, retainedShare)` (доля меньше депозита → разница на доступный
  баланс клиента); `assertBookingMergeAllowed`/`onBookingMerge(businessId, bookingIds, targetBookingId)`
  (2+ активных снимка политики → `ApiError('validation', …)`; ровно один — снимок переезжает на итоговую
  запись); `onBookingCopy(...)` — документирующая защита (копия физически не наследует снимок, ключ —
  bookingId). Общее ядро решения по штрафу вынесено в `applyPolicyPenaltyDecisionSync` и переиспользуется
  также F-07-119/F-07-120 (ниже) и старым `resolvePolicyDecision`.

## partial

- **F-07-119** (перенос администратором записи с депозитом) — API-ядро готово в `src/api/finance.ts`:
  `resolvePolicyReschedule(businessId, bookingId, newBookingStart, decision?: 'charge'|'forgive')` — в окне
  бесплатной отмены сдвигает `freeCancellationDeadline` без денег; после окна требует `decision` и
  списывает/прощает как `resolvePolicyDecision`, затем снимок уходит в терминальный статус («без политики»
  дальше). **Не отмечено `data-f`** и не в `done` — кнопка/модалка «Reschedule» живёт в окне визита журнала
  (`src/areas/journal/**`), не в моих путях; без вызывающего экрана функция не работает для реального
  пользователя. Просьба и сигнатура — `qa/requests/finance.md` (запись 2026-09-26).
- **F-07-120** (отмена/перенос записи клиентом онлайн) — то же самое: `clientCancelBookingWithPolicy` и
  `clientRescheduleBookingWithPolicy(businessId, bookingId, newBookingStart)` готовы и корректны (окно —
  депозит на баланс клиента без движения карты; после окна — автосписание без права выбора), но экран
  отмены/переноса в приложении клиента (`src/app/(client)/**`) — не мой путь. Тот же статус: `data-f` не
  проставлен сознательно, просьба в `qa/requests/finance.md`.
- **F-07-136** (Adyen Dashboard, minor: левое меню на `/biz/finance/adyen` подсвечивает «Операции») —
  причина найдена: `useActiveNav.ts` (фундамент) берёт самое длинное совпадение префикса среди
  `item.href`/`child.href`; у вложенного адреса без своего пункта меню совпадает только `/biz/finance`
  (= href «Операции»). Нужна правка `NavChild`/`useActiveNav` в `src/config/nav-types.ts` +
  `src/shell/workspace/useActiveNav.ts` — не мои файлы. Просьба с предложенным API (`activeAliasHrefs`) —
  `qa/requests/finance.md`.
- **finance/foundation** (localStorage quota) — не мой файл (`src/mock/db.ts`), уже эскалирован до BLOCK
  раньше (`qa/requests/finance.md`, запись 2026-09-25/26); в этой пачке снова ловил то же предупреждение на
  каждой странице `/biz/finance/**` (см. `qa/shots/custom/report.json`), не воспроизводил живым F5 повторно
  (уже подтверждено действием в b03-m1) — только подтвердил, что предупреждение не исчезло.

## Проверки

- `tsc --noEmit --incremental` — 0 ошибок в `src/api/finance.ts`, `src/areas/finance/**`,
  `src/domain/finance.ts`, `src/mock/slices/finance.ts`, `src/app/biz/finance/**`.
- `eslint` — 0 ошибок/предупреждений на тех же путях.
- `scripts/ensure-dev.sh` — сервер уже работал (порт 3710), не трогал.
- `scripts/measure.mjs` — 24 страницы (owner/owner-empty/admin/master × policy/adyen/online × телефон/десктоп):
  0 ошибок консоли, 0 4xx, 0 сырых ключей, 0 «висит загрузка»; единственное предупреждение — известная
  localStorage-квота (см. `partial`).
- Снимки просмотрены глазами: `biz-finance-policy__owner-nails-ru-light-phone.png` (Депозит включён и
  выбран — граница фиолетовая, не серая) и `biz-finance-policy__owner-empty-nails-ru-light-phone.png`
  (Депозит и Гарантия картой серые, «Без политики» выбрана по умолчанию).
- `qa/measure/finance/b05-m1.md` — дефекты D1 (F-07-101) и D2 (F-07-116/119/120) отмечены
  `✅ исправлено (b05-fix2)` / `⏳ позже — частично (b05-fix2)` под самими находками.
- Прочитаны все файлы `qa/measure/finance/` вне `b*-m*`/`g*-m*` и исключённых префиксов
  (`empty-d1.md`, `onboarding-k1.md`, `onboarding-k4.md`, `b01-report.json`) — открытых block/major не
  нашёл; `empty-d1.md` уже отмечен `✅ исправлено (b03)`.

## assumed

- «Любая подключённая платёжная система» для депозита (F-07-101) = Adyen ИЛИ хотя бы один онлайн-провайдер
  выбран на любой способ оплаты (`providerByWay`) — провайдеры в проекте все `availableHere: false`
  (реальных подключений в Армении нет), но выбор провайдера в «Онлайн-платежах» уже демо-имитация подключения
  по конвенции b04, так что использую её как признак «система подключена».
- F-07-116 (объединение): при «ровно один активный снимок из нескольких объединяемых записей» — переношу
  снимок на итоговую запись (сумма депозита будет вычтена из общей суммы визита при `applyPolicyDepositAtCheckout`,
  как и раньше — эта функция уже не делит депозит, что соответствует ТЗ «закрытие визита с депозитом целиком»).
- F-07-119/F-07-120 «within window»/«late» решаю по текущему `snap.freeCancellationDeadline` в момент
  вызова — совпадает с логикой, уже принятой в `createBookingPolicySnapshot`/`resolvePolicyDecision`.

## requests

- `qa/requests/finance.md`: 4 новые записи (2026-09-26, пачка b05-fix2) — API для F-07-116/119/120 расширен
  и задокументирован для journal/client; `useActiveNav`/`NavChild` не умеет alias-путей без своего пункта
  меню (F-07-136); повторное подтверждение localStorage-квоты (BLOCK, не мой файл).

## marked

`node scripts/fids.mjs --area finance` после работы: **123 / 185 (66.5%)** — было 122 до пачки, +1
(F-07-116). F-07-119/120 сознательно не помечены (см. `partial`).

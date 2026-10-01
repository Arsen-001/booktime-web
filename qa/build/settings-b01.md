# Пачка settings b01 — Каркас раздела: хаб настроек, подписка, счета, монеты, модель цены, чек-лист старта

Собрано 25.09.2026.

## Что построено

Новые/изменённые файлы:
- `src/domain/settings.ts` — типы: Subscription, SubscriptionPayment, Invoice, CoinPackage, LegalInfo,
  OnboardingStep, CompanyProfileSummary, SeatLine, PriceBreakdownLine, PriceQuote, SubscriptionWarning.
- `src/mock/slices/settings.ts` — подписки, история оплат, счета, реквизиты по businessId (variety: заморозка,
  «заканчивается», бесплатный месяц на трёх демо-бизнесах).
- `src/api/settings.ts` — движок цены (`quotePrice`, `getBillingSeats`, `previewPriceChange`), подписка
  (`getSubscription`, `toggleAutoRenew`, `grantFreeMonth`, `isBusinessVisible`, `subscriptionWarnings`),
  оплаты/счета (`listPayments`, `listInvoices`), монеты (`listCoinPackages`, `purchaseCoinPackage`,
  `spendCoins`, `refundCoins` — поверх `coreTx.chargeCoins/grantCoins` ядра), профиль и чек-лист
  (`getCompanyProfile`, `getOnboardingChecklist`).
- `src/areas/settings/nav.ts` — подпункты «Настройки» (хаб, компания/системные/категории/аккаунт — soon)
  и «Подписка» (подписка, счета).
- `src/areas/settings/SettingsHubScreen.tsx` — хаб /biz/settings: группы «Компания», «Аккаунт», «Подписка и
  монеты» + секции остальных 14 разделов через `useExtensions('settingsHub')`/`ExtensionSlot`.
- `src/areas/settings/SubscriptionScreen.tsx` — /biz/billing: срок, автопродление, тариф с разбивкой, «кто в
  плате», что входит, ссылка на монеты, история оплат.
- `src/areas/settings/InvoicesScreen.tsx` — /biz/billing/invoices: таблица счетов, фильтр по назначению.
- `src/areas/settings/CoinsScreen.tsx` — /biz/coins: баланс (из ядра), на что тратятся, история движений
  (из ядра), покупка пакета в Sheet.
- `src/areas/settings/OnboardingScreen.tsx` — /biz/onboarding: чек-лист (ChecklistCard/ProgressRing из
  `src/ui/onboarding`) + «Профиль заполнен на N%».
- `src/areas/settings/SettingsBillingAccessGate.tsx` + `src/app/biz/billing/layout.tsx` +
  `src/app/biz/coins/layout.tsx` — закрывают `/biz/billing/**` и `/biz/coins/**` по прямому адресу без
  `billing.manage` (по образцу `finance`/`loyalty`).
- Заглушки `src/app/biz/settings/{company,system,categories,account}/page.tsx` (через `AreaPlaceholder`) —
  чтобы хаб не вёл на 404 до b04/b05/b06.
- `messages/ru/settings.json`, `messages/en/settings.json` — полностью заполнены (hy не трогал — правило проекта).
- `qa/requests/settings.md` — что понадобится следующим пачкам (b02 доступ guest к регистрации, полоса
  предупреждений в каркасе, значок срока у пункта меню и т.д.); фундамент не правил.

## Как проверено

- `npx tsc --noEmit` по своим путям — 0 ошибок (посторонние ошибки в `client`/`clients` — чужие, не мои).
- `npx eslint` по своим путям — 0 ошибок.
- `node scripts/measure.mjs` по всем 5 маршрутам, phone+desktop, ru — 0 ошибок консоли, 0 сырых ключей,
  0 вылетов, 0 «висит загрузка», `data-f` находится на всех экранах.
- Персоны: owner (соло/сеть), individual (5000 ֏ flat), network (per-location), admin (AccessDenied на
  `/biz/billing` и `/biz/coins` — 0 data-f, только заглушка «нет прав»), owner-empty (пустые состояния счетов
  и монет, чек-лист 0/6).
- Сценарии Playwright (через `scripts/measure.mjs --scenario`): покупка пакета монет (баланс 0→1650,
  история движений, тост «Монеты начислены») — 8/8 шагов; переключение автопродления и сохранение после
  перехода на другую страницу и обратно — 7/7 шагов.
- Снимки глазами (Read png): хаб (десктоп/телефон), подписка (заканчивается / бесплатный месяц / индивидуал),
  монеты (пусто и после покупки), быстрый старт (пусто 0/6 и всё готово 6/6, реквизиты не хватает → 5/6).

## Готово, когда — покрытие по F-id

Все 31 F-id пачки помечены `data-f` на РАБОТАЮЩИХ узлах (проверено `grep`, не заглушки):
F-15-001, F-15-097, F-15-120, F-15-098, F-15-069, F-15-070, F-15-071, F-15-072, F-15-087, F-15-091,
F-15-058, F-15-033, F-15-034, F-15-036, F-15-037, F-15-041, F-15-044, F-15-045, F-15-047,
F-00-011, F-00-012, F-00-013, F-00-014, F-00-016, F-00-017, F-00-018, F-00-026, F-00-027,
F-15-094, F-15-022, F-15-023.

Замечания измерителей по разделу settings в `qa/measure/settings/` — все существующие файлы относятся к
исключённым категориям (a11y-, arch-, core-, decision-, e2e-, onboarding-, speed-, ux-best-) по правилу
CONVENTIONS §0.1; пачек `b*-m*`/`g*-m*` для settings ещё не было (это первая пачка) — фиксировать было нечего.

## assumed (додумано)

- Сумма разбивки в «Тарифе» строится **движком в коде** (`computeSeats` в `src/api/settings.ts`), не хранится
  в срезе — источник истины: роль сотрудника + `Service.staffIds`. `staff/pricing.ts` не трогал (чужой файл),
  задокументировал миграцию в `qa/requests/settings.md`.
- F-15-044 (своя подписка на филиал сети): подписка ключуется по `businessId` (у сети каждый филиал = свой
  `Business`), поэтому механизм уже работает без доп. полей — на экране показан значок «У каждого филиала своя
  подписка» персоне network.
- F-15-058/F-00-019 «бесплатный месяц от подключения на визите»: `grantFreeMonth(businessId)` готов и
  задокументирован для platform в `qa/requests/settings.md` — сама кнопка «Подключить на визите» строит
  раздел platform.
- Пороги предупреждений (7/3/1 день) взял по F-00-023 из ТЗ; полоса в каркасе — не подключена (это
  фундамент, см. requests п.2), но `subscriptionWarnings()` уже отдаёт данные и покрыт кодом.
- Цены пакетов монет (500/1500/4000, бонусы 10%/20%) — предложены, на экране пометка «цены пакетов пока не
  утверждены» (`coins.pricesNotFinal`), как и было в замечании владельца по ТЗ раздела.
- Реквизиты компании (`LegalInfo`) — черновичный тип в своём срезе (Business ядра пока не хранит юр.
  реквизиты); полный экран редактирования — b04, здесь только для расчёта «профиль заполнен на N%».
- «Услуги мастерам» и «онлайн-запись» в чек-листе быстрого старта я вывел из `Service.staffIds`/`onlineBookable`
  — других сигналов в ядре для этого нет.

## done

Все 31 F-id из плана b01 (список — раздел «Готово, когда» выше).

## partial

Нет незакрытых пунктов внутри списка пачки b01. Не входит в b01 (по плану — другие пачки, ссылки/заглушки
уже подготовлены): регистрация/вход (b02), полное управление оплатой и «Кто в плате» (b03), редактирование
профиля компании/системных/категорий (b04), личный кабинет и помощь (b05), заморозка/права/журнал (b06).

## requests

См. `qa/requests/settings.md` — 6 пунктов для b02/b05/b06 и соседних разделов (staff, journal, client/online,
notify); ничего не блокирует сдачу b01.

## marked

`node scripts/fids.mjs --area settings` после работы: **34** (34/214, 15.9%).

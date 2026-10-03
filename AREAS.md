# AREAS — карта 18 разделов

Сгенерировано из `docs/areas.json`, `src/config/nav.ts`, `src/areas/*/nav.ts`, `src/extensions/pairs.ts`. 
Правила работы — в [CONVENTIONS.md](CONVENTIONS.md). ТЗ лежит в `/Users/arsen/WebstormProjects/booking-research/functional-map/`.

Каждому разделу, кроме путей из таблицы, всегда принадлежат: `src/areas/<id>/**`, `src/domain/<id>.ts`, `src/mock/slices/<id>.ts`, `src/api/<id>.ts`, `messages/{ru,en,hy}/<id>.json`, `qa/**/<id>*`.

## Сводка

| id | Раздел | Пути (src/app) | ТЗ | Наши решения (00) |
|---|---|---|---|---|
| **client** | Приложение клиента (каталог, поиск, запись, мои записи, избранное, сторис, вход) + всё из «Altegio.me» | `src/app/(client)/**`<br>`src/app/biz/apps/**` | 14-apps-altegio-me.md | 00 §1 (F-00-001…010), §3 (F-00-031…036), §9 (F-00-092…107), §10 (F-00-108…125), §14 (F-00-155…167), §16 (F-00-172…175) |
| **platform** | Наша панель платформы (модерация, подключение салона на визите, учёт визитов, промокоды, реклама и баннеры, спрос без предложения, заявки на сферы) | `src/app/platform/**` | — | 00 §15 (F-00-168…171), §17 (F-00-176…183), §19 (F-00-202…208), рекламная часть §14 |
| **journal** | Журнал записей и окно записи | `src/app/biz/journal/**`<br>`src/app/biz/records/**` | 01-journal-records.md | — |
| **schedule** | График работы и свободные окна | `src/app/biz/schedule/**` | 02-slots-schedule.md | 00 §5 (F-00-051…064) |
| **online** | Онлайн-запись: ссылки, виджет, публичная страница салона/мастера, видимость, места работы, выезд | `src/app/biz/online/**`<br>`src/app/b/**` | 03-online-booking.md | 00 §6 (F-00-065…072), §7 (F-00-073…081) |
| **clients** | Клиенты и CRM | `src/app/biz/clients/**` | 04-clients-crm.md | 00 §11 (F-00-126…132) |
| **notify** | Уведомления | `src/app/biz/notifications/**` | 05-notifications.md | — |
| **loyalty** | Лояльность: карты, акции, сертификаты, абонементы, депозиты, рефералы | `src/app/biz/loyalty/**` | 06-loyalty.md | — |
| **finance** | Финансы и оплаты | `src/app/biz/finance/**` | 07-finance-payments.md | — |
| **stock** | Склад, препараты, оборудование | `src/app/biz/stock/**` | 08-stock.md | 00 §12 (F-00-133…144) |
| **payroll** | Зарплата | `src/app/biz/payroll/**` | 09-payroll.md | — |
| **staff** | Сотрудники, роли, права, безопасность | `src/app/biz/staff/**` | 10-staff-roles-security.md | 00 §4 (F-00-037…050) |
| **network** | Сеть и филиалы | `src/app/biz/network/**` | 11-network-branches.md | — |
| **reports** | Отчёты и аналитика | `src/app/biz/reports/**` | 12-reports.md | — |
| **integrations** | Интеграции, маркетплейс приложений, API (только интерфейс, без настоящих подключений) | `src/app/biz/integrations/**` | 13-integrations-api.md | — |
| **settings** | Регистрация бизнеса, быстрый старт, сферы, подписка, промокоды, монеты, биллинг, настройки компании | `src/app/biz/settings/**`<br>`src/app/biz/billing/**`<br>`src/app/biz/onboarding/**`<br>`src/app/biz/coins/**` | 15-billing-onboarding-settings.md | 00 §2 (F-00-011…030), §13 (F-00-145…154) |
| **resources** | Ресурсы, групповые события, пакеты, ассистенты, лист ожидания | `src/app/biz/resources/**`<br>`src/app/biz/groups/**`<br>`src/app/biz/waitlist/**` | 16-resources-groups-waitlist.md | — |
| **services** | Услуги: каталог, категории, карточка услуги, цены от–до, длительность, фото (6 мест), дипломы, материалы | `src/app/biz/services/**` | — | 00 §8 (F-00-082…091); плюс все функции каталога услуг, которые в других разделах описаны как «Настройки → Услуги» |
| **orders** | Заказы: приём вещей и техники (ателье, ремонт, химчистка, детейлинг), статусы, «Готово» клиенту и публичная ссылка статуса | `src/app/biz/orders/**`<br>`src/app/o/**` | — | решение владельца 03.10.2026 (DESIGN.md «Заказы») |

## Меню, хосты и вклады по разделам

### client — Приложение клиента

**Пункты меню:**
- Приложения — `/biz/apps`
- Главная — `/`
- Поиск — `/search`
- Мои записи — `/bookings`
- Избранное — `/favorites`
- Профиль — `/profile`

**Хозяин хоста:** Профиль клиента (`clientProfile`) ← loyalty, finance

### platform — Панель платформы

**Пункты меню:**
- Обзор — `/platform`
- Модерация — `/platform/moderation`
- Подключить салон — `/platform/connect`
- Визиты — `/platform/visits`
- Промокоды — `/platform/promocodes`
- Реклама и сторис — `/platform/ads`
- Спрос — `/platform/demand`
- Заявки на сферы — `/platform/sphere-requests`
- Идеи — `/platform/ideas`
- Поддержка — `/platform/support`

### journal — Журнал записей

**Пункты меню:**
- Журнал — `/biz/journal`
- Записи — `/biz/records`

**Хозяин хоста:** Окно записи (`bookingWindow`) ← clients, finance, loyalty, stock, resources, notify, online

**Вклады в чужие хосты:** Карточка клиента → `src/areas/journal/extensions/ClientCard.tsx` (смотреть: `/dev/ext/clientCard/journal`), Настройки → `src/areas/journal/extensions/SettingsHub.tsx` (смотреть: `/dev/ext/settingsHub/journal`)

### schedule — График работы

**Пункты меню:**
- График работы — `/biz/schedule`

**Вклады в чужие хосты:** Карточка сотрудника → `src/areas/schedule/extensions/StaffCard.tsx` (смотреть: `/dev/ext/staffCard/schedule`), Настройки → `src/areas/schedule/extensions/SettingsHub.tsx` (смотреть: `/dev/ext/settingsHub/schedule`)

### online — Онлайн-запись

**Пункты меню:**
- Онлайн-запись — `/biz/online`
  - подпункты (файл `src/areas/online/nav.ts`): Ссылки на запись `/biz/online`, Страница для клиентов `/biz/online/page`, Виджет для сайта `/biz/online/widget`, Правила записи `/biz/online/settings`

**Вклады в чужие хосты:** Окно записи → `src/areas/online/extensions/BookingWindow.tsx` (смотреть: `/dev/ext/bookingWindow/online`), Карточка клиента → `src/areas/online/extensions/ClientCard.tsx` (смотреть: `/dev/ext/clientCard/online`), Карточка сотрудника → `src/areas/online/extensions/StaffCard.tsx` (смотреть: `/dev/ext/staffCard/online`), Карточка услуги → `src/areas/online/extensions/ServiceCard.tsx` (смотреть: `/dev/ext/serviceCard/online`), Настройки → `src/areas/online/extensions/SettingsHub.tsx` (смотреть: `/dev/ext/settingsHub/online`)

### clients — Клиенты и CRM

**Пункты меню:**
- Клиенты — `/biz/clients`
  - подпункты (файл `src/areas/clients/nav.ts`): Клиентская база `/biz/clients`, Категории `/biz/clients/categories`, Импорт и выгрузка `/biz/clients/import`

**Хозяин хоста:** Карточка клиента (`clientCard`) ← journal, finance, loyalty, notify, online

**Вклады в чужие хосты:** Окно записи → `src/areas/clients/extensions/BookingWindow.tsx` (смотреть: `/dev/ext/bookingWindow/clients`), Настройки → `src/areas/clients/extensions/SettingsHub.tsx` (смотреть: `/dev/ext/settingsHub/clients`)

### notify — Уведомления

**Пункты меню:**
- Уведомления — `/biz/notifications`
  - подпункты (файл `src/areas/notify/nav.ts`): Шаблоны `/biz/notifications`, Рассылки `/biz/notifications/mailings`, Журнал отправок `/biz/notifications/log`

**Вклады в чужие хосты:** Окно записи → `src/areas/notify/extensions/BookingWindow.tsx` (смотреть: `/dev/ext/bookingWindow/notify`), Карточка клиента → `src/areas/notify/extensions/ClientCard.tsx` (смотреть: `/dev/ext/clientCard/notify`), Настройки → `src/areas/notify/extensions/SettingsHub.tsx` (смотреть: `/dev/ext/settingsHub/notify`)

### loyalty — Лояльность

**Пункты меню:**
- Лояльность — `/biz/loyalty`
  - подпункты (файл `src/areas/loyalty/nav.ts`): Карты лояльности `/biz/loyalty`, Акции `/biz/loyalty/promotions`, Сертификаты `/biz/loyalty/certificates`, Абонементы `/biz/loyalty/memberships`, Счета клиентов `/biz/loyalty/deposits`, Рефералы `/biz/loyalty/referral`

**Вклады в чужие хосты:** Окно записи → `src/areas/loyalty/extensions/BookingWindow.tsx` (смотреть: `/dev/ext/bookingWindow/loyalty`), Карточка клиента → `src/areas/loyalty/extensions/ClientCard.tsx` (смотреть: `/dev/ext/clientCard/loyalty`), Карточка услуги → `src/areas/loyalty/extensions/ServiceCard.tsx` (смотреть: `/dev/ext/serviceCard/loyalty`), Настройки → `src/areas/loyalty/extensions/SettingsHub.tsx` (смотреть: `/dev/ext/settingsHub/loyalty`), Профиль клиента → `src/areas/loyalty/extensions/ClientProfile.tsx` (смотреть: `/dev/ext/clientProfile/loyalty`)

### finance — Финансы

**Пункты меню:**
- Финансы — `/biz/finance`
  - подпункты (файл `src/areas/finance/nav.ts`): Операции `/biz/finance`, Кассы и счета `/biz/finance/accounts`, Статьи платежей `/biz/finance/items`, Контрагенты `/biz/finance/counterparties`, Документы `/biz/finance/documents`, Методы оплаты `/biz/finance/methods`, Взаиморасчёты `/biz/finance/settlements`

**Вклады в чужие хосты:** Окно записи → `src/areas/finance/extensions/BookingWindow.tsx` (смотреть: `/dev/ext/bookingWindow/finance`), Карточка клиента → `src/areas/finance/extensions/ClientCard.tsx` (смотреть: `/dev/ext/clientCard/finance`), Настройки → `src/areas/finance/extensions/SettingsHub.tsx` (смотреть: `/dev/ext/settingsHub/finance`), Профиль клиента → `src/areas/finance/extensions/ClientProfile.tsx` (смотреть: `/dev/ext/clientProfile/finance`)

### stock — Склад

**Пункты меню:**
- Склад — `/biz/stock`
  - подпункты (файл `src/areas/stock/nav.ts`): Товары `/biz/stock`, Склады `/biz/stock/warehouses`, Техкарты `/biz/stock/tech-cards`, Складские операции `/biz/stock/operations`, Инвентаризация `/biz/stock/inventory`, Оборудование `/biz/stock/equipment`

**Вклады в чужие хосты:** Окно записи → `src/areas/stock/extensions/BookingWindow.tsx` (смотреть: `/dev/ext/bookingWindow/stock`), Карточка услуги → `src/areas/stock/extensions/ServiceCard.tsx` (смотреть: `/dev/ext/serviceCard/stock`), Настройки → `src/areas/stock/extensions/SettingsHub.tsx` (смотреть: `/dev/ext/settingsHub/stock`)

### payroll — Зарплата

**Пункты меню:**
- Зарплата — `/biz/payroll`
  - подпункты (файл `src/areas/payroll/nav.ts`): Схемы расчёта `/biz/payroll`, Расчёт за день `/biz/payroll/daily`, Расчёт за период `/biz/payroll/period`, Премии и штрафы `/biz/payroll/bonuses`

**Вклады в чужие хосты:** Карточка сотрудника → `src/areas/payroll/extensions/StaffCard.tsx` (смотреть: `/dev/ext/staffCard/payroll`), Карточка услуги → `src/areas/payroll/extensions/ServiceCard.tsx` (смотреть: `/dev/ext/serviceCard/payroll`), Настройки → `src/areas/payroll/extensions/SettingsHub.tsx` (смотреть: `/dev/ext/settingsHub/payroll`)

### staff — Сотрудники и права

**Пункты меню:**
- Сотрудники — `/biz/staff`
  - подпункты (файл `src/areas/staff/nav.ts`): Сотрудники `/biz/staff`, Должности `/biz/staff/positions`, Роли и права `/biz/staff/roles`, Журнал изменений `/biz/staff/log`

**Хозяин хоста:** Карточка сотрудника (`staffCard`) ← schedule, services, online, payroll, resources

**Вклады в чужие хосты:** Настройки → `src/areas/staff/extensions/SettingsHub.tsx` (смотреть: `/dev/ext/settingsHub/staff`)

### network — Сеть и филиалы

**Пункты меню:**
- Сеть и филиалы — `/biz/network`

**Вклады в чужие хосты:** Настройки → `src/areas/network/extensions/SettingsHub.tsx` (смотреть: `/dev/ext/settingsHub/network`)

### reports — Отчёты

**Пункты меню:**
- Отчёты — `/biz/reports`
  - подпункты (файл `src/areas/reports/nav.ts`): Основные показатели `/biz/reports`, Все отчёты `/biz/reports/all`

### integrations — Интеграции

**Пункты меню:**
- Интеграции — `/biz/integrations`
  - подпункты (файл `src/areas/integrations/nav.ts`): Каталог `/biz/integrations`, API и вебхуки `/biz/integrations/api`

**Вклады в чужие хосты:** Настройки → `src/areas/integrations/extensions/SettingsHub.tsx` (смотреть: `/dev/ext/settingsHub/integrations`)

### settings — Настройки и подписка

**Пункты меню:**
- Настройки — `/biz/settings`
- Быстрый старт — `/biz/onboarding`
- Подписка — `/biz/billing`
- Монеты — `/biz/coins`

**Хозяин хоста:** Настройки (`settingsHub`) ← journal, schedule, online, services, staff, clients, notify, loyalty, finance, payroll, stock, resources, network, integrations

### resources — Ресурсы и групповые

**Пункты меню:**
- Групповые — `/biz/groups`
- Лист ожидания — `/biz/waitlist`
- Ресурсы — `/biz/resources`

**Вклады в чужие хосты:** Окно записи → `src/areas/resources/extensions/BookingWindow.tsx` (смотреть: `/dev/ext/bookingWindow/resources`), Карточка сотрудника → `src/areas/resources/extensions/StaffCard.tsx` (смотреть: `/dev/ext/staffCard/resources`), Карточка услуги → `src/areas/resources/extensions/ServiceCard.tsx` (смотреть: `/dev/ext/serviceCard/resources`), Настройки → `src/areas/resources/extensions/SettingsHub.tsx` (смотреть: `/dev/ext/settingsHub/resources`), Панель «Лист ожидания» журнала → `src/areas/resources/extensions/JournalWaitlist.tsx` (смотреть: `/dev/ext/journalWaitlist/resources`)

### services — Услуги

**Пункты меню:**
- Услуги — `/biz/services`

**Хозяин хоста:** Карточка услуги (`serviceCard`) ← online, stock, payroll, resources, loyalty

**Вклады в чужие хосты:** Карточка сотрудника → `src/areas/services/extensions/StaffCard.tsx` (смотреть: `/dev/ext/staffCard/services`), Настройки → `src/areas/services/extensions/SettingsHub.tsx` (смотреть: `/dev/ext/settingsHub/services`)

### orders — Заказы

**Пункты меню:**
- Заказы — `/biz/orders` (виден, когда у бизнеса включены «Заказы»: по умолчанию у сфер tailor, repair, drycleaning, detailing)
  - подпункты (файл `src/areas/orders/nav.ts`): Все заказы `/biz/orders` (счётчик готовых), Настройки заказов `/biz/orders/settings`
- Публичная страница статуса — `/o/[code]` (без входа)

**Вклады в чужие хосты:** Настройки → `src/areas/orders/extensions/SettingsHub.tsx` (смотреть: `/dev/ext/settingsHub/orders`)

## Хосты расширений

| Хост | Хозяин | Вкладчики (порядок) | Пропсы |
|---|---|---|---|
| Окно записи (`bookingWindow`) | journal | clients, finance, loyalty, stock, resources, notify, online | `BookingWindowExtProps` |
| Карточка клиента (`clientCard`) | clients | journal, finance, loyalty, notify, online | `ClientCardExtProps` |
| Карточка сотрудника (`staffCard`) | staff | schedule, services, online, payroll, resources | `StaffCardExtProps` |
| Карточка услуги (`serviceCard`) | services | online, stock, payroll, resources, loyalty | `ServiceCardExtProps` |
| Настройки (`settingsHub`) | settings | journal, schedule, online, services, staff, clients, notify, loyalty, finance, payroll, stock, resources, network, integrations, orders | `SettingsHubExtProps` |
| Профиль клиента (`clientProfile`) | client | loyalty, finance | `ClientProfileExtProps` |

## Функции ТЗ без хозяина

F-00-184…F-00-201 (список «максимум функционала», 00 §18): почти всё совпадает с разделами Altegio. Итоговая сверка — `node scripts/fids.mjs` (строка unowned).

## Хозяева сущностей (решение ядра, arch-a1 №11–12, 25.09.2026)

Одна сущность — один хозяин: он заводит тип (`src/domain/<id>.ts`) и функции чтения/записи (`src/api/<id>.ts`), остальные
читают через его api или вклады. Порядок перехода: хозяин заводит тип и функцию чтения → соседи переходят на неё и удаляют свои
копии (типы, поля, сид). Замечания — `qa/measure/<id>/core-rules.md`.

| Сущность | Хозяин | Где сейчас лишняя копия |
|---|---|---|
| Сертификаты, абонементы (типы, продажа, остаток, заморозка, возврат), депозит / счёт клиента, скидка клиента по карте | loyalty | `Certificate`, `Subscription` — `src/domain/clients.ts`; `GoodsCatalogItem` kind `subscription`/`certificate` — `src/domain/journal.ts`; `ClientProfile.discountPercent` — clients |
| Товары, остатки, продажа товара, расходники визита | stock | `GoodsCatalogItem` kind `product`, `getGoodsCatalog` — journal; `ProductPurchase` — clients |
| Оплаты (платёж, способ, касса, долг, возврат), «оплачено» | finance | `BookingExtras.paidAmount` — journal; `ClientProfile.paidAmount` — clients |
| Ручная скидка на строку визита | ядро: `BookingServiceLine.unitPrice/discountPct` (правило — `@/domain/rules` pricing) | `BookingExtras.serviceLineExtras.discountPct` — journal |
| Правила записи: срок отмены/переноса, подтверждение, предоплата мастера, онлайн вкл/выкл | online пишет поля ядра `Business/Staff.bookingRules`, `Staff.confirmMode`, `Staff.onlineBookingEnabled`; предоплату — staff (`Staff.prepayment`) | `cancelWindowHours`, `prepaymentPolicy` — срез client; `StaffOnlineRules.*WindowHours` — срез online |
| Контакты мастера и режим звонка (F-00-104/105) | staff: поле ядра `Staff.contacts` + `Staff.callHours` | `contacts` — срез client |
| Лист ожидания — один на бизнес (F-00-102, F-01-156, F-16-149; 30.09–01.10.2026): сотрудник, приложение, виджет | resources: срез `resources.waitlist`, api `waitlistTx` (приложение и виджет пишут через него), вид — `WaitlistBoard` (экран и панель журнала, хост `journalWaitlist`) | нет (с 01.10.2026; старые `client.waitlist`, `online.waitlistRequests`, `journal.waitlistEntries` в сохранённых базах переносятся при первой записи в лист) |
| Окна и правила слотов | schedule (поверх базы ядра `busyIntervals` / `staffWorkIntervals`) | свои циклы занятости в `src/api/schedule.ts`, `src/api/journal.ts` |
| Мягкое удаление клиента | ядро: `Client.deletedAt`; пишет clients | `coreRemove('clients')` |
| Поля записи / поля клиента | journal → `BookingFieldDef`, clients → `ClientFieldDef` (сейчас оба `CustomFieldDef`) | — |


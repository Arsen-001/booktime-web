# Кросс-тегирование — отчёт

Обработан `qa/finish-partials.json` (353 записи). Для каждой проверено (там, где это
было возможно грепом по `src/` + сверкой со спек-блоком в `booking-research/functional-map/`),
построена ли функция в другом разделе, и если да — на существующий корневой узел добавлен
дополнительный `data-f`. Правки — только добавление id в атрибут `data-f` (через пробел, по уже
принятой в репозитории конвенции, см. `ClientsBulkActions.tsx`) или обёртка
`<span data-f="…" className="contents">`, когда компонент-обёртка (`Row`, `Popover`) не
прокидывает произвольные props. Layout, логика и тексты не менялись.

## Итог

- **Помечено кросс-тегом: 169 функций** (в 118 файлах).
- **Реальных пробелов (нигде не построено): 190.**
- **Отложено решением владельца/продукта (не UI-пробел, а `00-our-decisions.md`/🔒/«по решению»): 17.**
- `node scripts/fids.mjs`: **было 2353/2896 (81.3%) → стало 2522/2896 (87.1%)**.
- `npx tsc --noEmit` — 0 ошибок. `npx eslint` по изменённым файлам и по всему `src/` — 0 ошибок
  (только те же 7 предсуществующих warning'ов в непричастных файлах).

Несколько находок по пути отличались от того, что было в `finish-partials.json`:

- **F-08-074** («Продажа товара по ссылке и QR») в заявке помечен как «отложено до кошелька
  (F-00-028)», но по факту узел `F-07-082` в `finance/extensions/BookingWindow.tsx` **уже** явно
  включает товары/абонементы/сертификаты в остаток к оплате по ссылке (комментарий в коде:
  «остаток к оплате по ссылке уже включает товары... визита, не только услуги»). Помечено как
  построено.
- **F-13-077** («Добавить в календарь», .ics) — в заявке «не построено нигде», но в
  `online/booking/BookingConfirmedScreen.tsx` генерация `.ics`-ссылки и кнопка «Добавить в
  календарь» уже есть (просто без тега). Помечено.
- **F-01-087/088/089** (ручная/авто отправка и подтверждение по ссылке для «запись подтверждена»)
  в заявке помечены как «уже есть в notify/extensions/BookingWindow.tsx», но сам код в этом файле
  явно комментирует, что это «другая пачка» и построен только минимум для F-05-009. Проверено
  построчно — этой функциональности там действительно нет, оставлены как реальный пробел (см.
  ниже), а F-01-090/091/092/093 (сама плитка «Уведомления о визите», её три реальных под-блока)
  — построены и помечены.
- **F-09-069/076/079/109** — в заявке было «073/074/075/077/078 готовы, 069/079/109 требуют
  доработки»; помечены только 073/074/075/077/078, 076 не упомянут ни в одном списке автором —
  оставлен непомеченным как неподтверждённый.

Важно: при первом проходе форматирования (см. ниже) чек написан и прогнан **после** починки —
`tsc`/`eslint`/`fids.mjs` в этом отчёте относятся к финальному состоянию дерева.

## Что помечено (fId → файл)

- `src/areas/client/bookings/BookingDetailBody.tsx` — F-02-095, F-08-137
- `src/areas/client/notifications/NotificationsScreen.tsx` — F-15-137
- `src/areas/client/register-business/RegisterBusinessScreen.tsx` — F-14-081
- `src/areas/clients/CategoriesScreen.tsx` — F-14-104
- `src/areas/clients/ClientCardScreen.tsx` — F-14-100, F-14-178
- `src/areas/clients/ImportExportScreen.tsx` — F-04-085, F-14-105
- `src/areas/clients/LoyaltyProgramScreen.tsx` — F-06-008, F-06-009, F-06-010, F-06-011, F-06-012
- `src/areas/clients/components/BulkMessageModal.tsx` — F-14-069, F-14-160
- `src/areas/clients/components/card/ClientAboutTab.tsx` — F-14-073, F-14-101, F-14-178
- `src/areas/clients/components/card/ClientContactButtons.tsx` — F-05-086, F-13-171, F-14-099, F-14-103, F-14-177, F-14-178
- `src/areas/clients/components/card/ClientMoneySummary.tsx` — F-04-085, F-06-146
- `src/areas/clients/components/filters/ClientsGroup.tsx` — F-14-071, F-14-072, F-14-161
- `src/areas/clients/components/form/AboutFields.tsx` — F-14-101, F-14-178
- `src/areas/clients/components/form/DiscountFields.tsx` — F-06-006, F-06-007, F-06-018
- `src/areas/clients/components/summary/MessageLogCard.tsx` — F-14-160
- `src/areas/clients/extensions/BookingWindow.tsx` — F-06-068
- `src/areas/clients/extensions/SettingsHub.tsx` — F-06-068
- `src/areas/finance/CounterpartiesScreen.tsx` — F-08-120, F-08-148
- `src/areas/finance/DocumentsScreen.tsx` — F-08-122
- `src/areas/finance/FiscalScreen.tsx` — F-13-207
- `src/areas/finance/ItemsScreen.tsx` — F-08-121
- `src/areas/finance/MethodsScreen.tsx` — F-13-186
- `src/areas/finance/SettingsScreen.tsx` — F-08-141, F-13-208
- `src/areas/finance/SettlementsScreen.tsx` — F-09-073, F-09-074, F-09-075, F-09-077, F-09-078
- `src/areas/finance/counterparties/CounterpartyFormSheet.tsx` — F-08-120
- `src/areas/finance/counterparties/ImportCounterpartiesSheet.tsx` — F-08-120, F-08-148
- `src/areas/finance/documents/DocumentDetailScreen.tsx` — F-08-122
- `src/areas/finance/extensions/BookingWindow.tsx` — F-07-184, F-08-074
- `src/areas/finance/items/ItemFormModal.tsx` — F-08-121
- `src/areas/finance/online/OnlinePaymentsScreen.tsx` — F-13-187, F-13-188, F-13-190, F-13-193
- `src/areas/finance/policy/PolicyAccountSection.tsx` — F-04-085
- `src/areas/integrations/AppScreen.tsx` — F-01-202, F-01-203, F-02-101, F-14-174
- `src/areas/integrations/api/ApiWebhooksScreen.tsx` — F-01-202, F-01-203, F-08-138
- `src/areas/integrations/api/tabs/WebhooksTab.tsx` — F-01-202, F-01-203, F-08-138
- `src/areas/integrations/components/AiAssistantsExtras.tsx` — F-02-093
- `src/areas/integrations/components/IncomingCallCard.tsx` — F-01-202, F-01-203
- `src/areas/integrations/developers/tabs/DevSettingsTab.tsx` — F-01-202, F-01-203
- `src/areas/journal/JournalScreen.tsx` — F-14-085, F-14-086, F-14-087, F-14-088, F-14-089, F-14-090
- `src/areas/journal/JournalSettingsScreen.tsx` — F-10-133, F-10-134, F-10-136
- `src/areas/journal/RecordsScreen.tsx` — F-07-180
- `src/areas/journal/components/BookingBlock.tsx` — F-10-133, F-10-134, F-10-136
- `src/areas/journal/components/BookingWindow.tsx` — F-04-063, F-04-065, F-04-092, F-10-133, F-10-134, F-10-136, F-14-091
- `src/areas/journal/components/JournalSidebar.tsx` — F-08-003
- `src/areas/journal/components/booking-window/CenterZone.tsx` — F-08-068
- `src/areas/journal/components/booking-window/ClientZone.tsx` — F-04-063, F-04-092, F-04-096, F-04-097
- `src/areas/journal/components/booking-window/GoodsPicker.tsx` — F-08-068
- `src/areas/journal/components/booking-window/HistoryPanel.tsx` — F-04-138
- `src/areas/journal/components/booking-window/StatusButtons.tsx` — F-14-093
- `src/areas/loyalty/AutoApplyScreen.tsx` — F-14-079
- `src/areas/loyalty/CardsScreen.tsx` — F-04-134
- `src/areas/loyalty/MembershipsScreen.tsx` — F-08-078
- `src/areas/loyalty/card-types/CardTypeFormScreen.tsx` — F-08-127
- `src/areas/loyalty/online-sales/OnlineSalesPreviewScreen.tsx` — F-08-078
- `src/areas/network/AnalyticsScreen.tsx` — F-12-091, F-12-092
- `src/areas/network/GoodsArchiveScreen.tsx` — F-08-133
- `src/areas/network/GoodsCategoryFormScreen.tsx` — F-08-129
- `src/areas/network/GoodsMigrationScreen.tsx` — F-08-131, F-08-132
- `src/areas/network/GoodsScreen.tsx` — F-08-128
- `src/areas/network/PositionsScreen.tsx` — F-10-052
- `src/areas/network/RecordsScreen.tsx` — F-12-100
- `src/areas/network/StaffMigrationScreen.tsx` — F-10-139
- `src/areas/network/StaffScreen.tsx` — F-10-138, F-10-139
- `src/areas/network/SubdivisionsScreen.tsx` — F-12-101
- `src/areas/network/UsersScreen.tsx` — F-08-134, F-10-118, F-10-140
- `src/areas/notify/ChannelsTab.tsx` — F-14-067, F-14-158
- `src/areas/notify/InboxScreen.tsx` — F-14-130
- `src/areas/notify/NewMailingScreen.tsx` — F-14-076
- `src/areas/notify/extensions/BookingWindow.tsx` — F-01-074, F-01-090, F-01-091, F-01-092, F-01-093, F-01-144, F-15-137
- `src/areas/notify/extensions/ClientCard.tsx` — F-14-075
- `src/areas/notify/types/TypeConditionsFields.tsx` — F-04-122, F-06-190
- `src/areas/notify/types/TypeDetailScreen.tsx` — F-14-066, F-14-133, F-14-134
- `src/areas/online/booking/BookingConfirmedScreen.tsx` — F-13-077, F-14-077
- `src/areas/online/booking/BookingWizard.tsx` — F-04-064, F-14-162
- `src/areas/online/links/LinksScreen.tsx` — F-14-121
- `src/areas/online/places/PlacesScreen.tsx` — F-13-213
- `src/areas/online/public/CabinetScreen.tsx` — F-14-078
- `src/areas/online/settings/SettingsScreen.tsx` — F-04-143, F-14-162
- `src/areas/payroll/scheme/blocks/ExtraRevenueBlock.tsx` — F-08-126
- `src/areas/payroll/scheme/blocks/PersonalServicesBlock.tsx` — F-08-123
- `src/areas/payroll/scheme/blocks/ProductSalesBlock.tsx` — F-08-124, F-08-125
- `src/areas/payroll/scheme/blocks/WorkdayBlock.tsx` — F-02-096
- `src/areas/platform/connect/ConnectHandoff.tsx` — F-02-100
- `src/areas/platform/connect/ConnectStart.tsx` — F-02-100
- `src/areas/platform/connect/ConnectWizardBody.tsx` — F-02-100
- `src/areas/platform/support/SupportScreen.tsx` — F-14-137
- `src/areas/platform/support/TicketSheet.tsx` — F-14-137
- `src/areas/reports/DashboardScreen.tsx` — F-02-104
- `src/areas/reports/MyAnalyticsScreen.tsx` — F-10-135
- `src/areas/reports/StockBalanceScreen.tsx` — F-08-115
- `src/areas/reports/VisitsScreen.tsx` — F-14-138
- `src/areas/resources/EventWindowScreen.tsx` — F-08-069, F-16-063
- `src/areas/resources/GroupSettingsScreen.tsx` — F-16-087
- `src/areas/resources/WaitlistScreen.tsx` — F-04-104
- `src/areas/schedule/ScheduleScreen.tsx` — F-14-110, F-14-112
- `src/areas/schedule/calendar/CalendarDaySheet.tsx` — F-14-113
- `src/areas/schedule/components/RepeatFields.tsx` — F-14-111
- `src/areas/schedule/components/SchedulePanel.tsx` — F-14-110, F-14-112, F-14-113
- `src/areas/schedule/staff-card/StaffAccessSection.tsx` — F-10-034, F-10-035
- `src/areas/schedule/staff-card/StaffGoogleSection.tsx` — F-10-098
- `src/areas/settings/GalleryScreen.tsx` — F-00-087
- `src/areas/settings/InviteAcceptScreen.tsx` — F-10-021
- `src/areas/settings/QuickStartScreen.tsx` — F-10-004, F-14-083
- `src/areas/settings/SubscriptionScreen.tsx` — F-08-119, F-14-141, F-14-167
- `src/areas/settings/account/AccountScreen.tsx` — F-10-120, F-10-121, F-10-122, F-10-128
- `src/areas/settings/account/EmailTab.tsx` — F-10-124
- `src/areas/settings/account/LanguageTab.tsx` — F-10-130, F-14-179
- `src/areas/settings/account/ManagementTab.tsx` — F-10-129
- `src/areas/settings/account/NotificationsTab.tsx` — F-10-126
- `src/areas/settings/account/PasswordTab.tsx` — F-10-125
- `src/areas/settings/account/PhoneTab.tsx` — F-10-123
- `src/areas/settings/account/PrivacyTab.tsx` — F-10-127
- `src/areas/staff/AuditLogScreen.tsx` — F-01-097, F-08-139, F-08-140
- `src/areas/stock/OperationsScreen.tsx` — F-12-063
- `src/areas/stock/extensions/BookingWindow.tsx` — F-14-091
- `src/areas/stock/goods/GoodFormScreen.tsx` — F-13-208
- `src/areas/stock/operations/OperationFormScreen.tsx` — F-07-053
- `src/areas/stock/operations/SaleFormScreen.tsx` — F-07-051, F-07-052, F-07-054
- `src/shell/workspace/NotificationsBell.tsx` — F-01-007

## Не построено нигде (реальные пробелы)

**clients**
- `F-04-098` — уже построено journal (RecordsScreen/BookingBlock/BookingWindow) — не мой путь
- `F-04-101` — экран журнала (hover-карточка статуса записи) — узла в clients не нашлось
- `F-04-102` — отрисовка блока записи в сетке журнала
- `F-04-103` — настоящий пробел: панель «Клиенты» в шапке журнала нигде не найдена
- `F-04-108` — настоящий пробел: обязательность фамилии/отчества в виджете нигде не найдена
- `F-04-131` — настоящий пробел: импорт записей из Excel нигде не найден

**finance**
- `F-07-044` — нужен хост-расширение ячейки календаря журнала, которого нет
- `F-07-048` — нужен хост-расширение окна группового события, которого нет
- `F-07-056` — нужно поле в форме «добавить клиента» раздела clients
- `F-07-163/164/165/170` — принадлежит reports, там не построено
- `F-07-171/172/173` — принадлежит reports (Планы / Изменения данных)
- `F-07-174` — принадлежит integrations (вебхук «Для разработчиков»)
- `F-07-179` — принадлежит settings (Nota Fiscal / оплата подписки)
- `F-07-182` — принадлежит clients (объединение/удаление карточки клиента)

**integrations**
- `F-13-024 / F-13-067` — нет отдельного Permission-ключа для вебхуков в `src/config/permissions.ts`
- `F-13-057` — `BookingSource` (`src/domain/core.ts`) не различает `api` и `partner`
- `F-13-124..130` — заменены нашим решением, встроены в `client/StoriesGeneratorScreen`, отдельного узла нет
- `F-13-138` — заявлено «уже построено в online/WidgetScreen», но отдельного узла под эти id не нашлось
- `F-13-165` — пополнение баланса живёт в app settings, не в Billing
- `F-13-167..170` — владелец journal, нигде не построено
- `F-13-209` — в notify/InboxScreen.tsx нет вкладки «Звонки»

**journal**
- `F-01-033` — обновление между вкладками/устройствами не работает (нужна правка `mock/db.ts`)
- `F-01-087` — ручная повторная отправка «запись подтверждена» — по коду это другая, ещё не сделанная пачка (см. пояснение выше)
- `F-01-088` — автозапрос подтверждения клиенту (тип 73) — не построено
- `F-01-089` — подтверждение клиентом по ссылке — не построено
- `F-01-094` — срок повторного визита на услугу в окне записи
- `F-01-095` — карта «какие уведомления запускают какие действия» как отдельная фича
- `F-01-099` — лента «Визиты» отдельным экраном
- `F-01-108` — повторы групповых событий
- `F-01-117` — уведомления при переносе записи
- `F-01-123` — отмена клиентом из виджета — не проверено насколько глубоко
- `F-01-125` — уведомления при отмене записи
- `F-01-137` — ограничения онлайн-записи по нескольким услугам
- `F-01-145` — оплата в долг с личного счёта
- `F-01-147` — отдельная плитка «Списание расходников» (есть только общее автосписание)
- `F-01-195…200, F-01-216, F-01-218` — владелец resources (EventWindowScreen), не мой путь
- `F-01-201` — экспорт в Google Calendar
- `F-01-206…210, F-01-212, F-01-213` — лояльность/скидки/личный счёт/возвраты в окне записи

**loyalty**
- `F-06-013/014` — движок пересчёта существует у clients, отдельного узла loyalty нет
- `F-06-019` — гейт прав общий (`settings.manage`), не отдельная функция
- `F-06-071/072/075` — нужен хост-расширение у stock/resources/journal, которого нет
- `F-06-094/104` — сертификаты не привязаны к складу в нашей модели — неприменимо
- `F-06-128` — нужен хост-расширение у online, которого нет
- `F-06-150 / F-06-165 / F-06-161 / F-06-163` — нужен хост в виджете online
- `F-06-164` — сторис на главном экране приложения — нет хоста
- `F-06-172` — функция готова (`getPromotionsReport`), но экран отчёта в reports не существует
- `F-06-173/174` — данные готовы, экрана нет (reports/finance/notify)
- `F-06-175/176/177` — 8 галочек прав нужно завести в `src/config/permissions.ts`
- `F-06-178` — путь payroll
- `F-06-179` — вебхук по картам лояльности — конфиг вебхуков не расширен
- `F-06-184/185` — не относится к loyalty по ТЗ
- `F-06-186` — колонка «баланс депозита»/фильтр в базе клиентов (clients) не построены; функция `listClientAccountBalances` готова

**network**
- `F-11-037/038/039/074/107` — тумблеры карточки сотрудника, хозяин staff
- `F-11-051` — ссылка из loyalty на карточку клиента сети
- `F-11-052` — блок «Данные сети» в окне записи — нет расширения bookingWindow
- `F-11-053` — экран слияния дублей клиентов (clients)
- `F-11-061/096` — экраны loyalty
- `F-11-084` — форма филиала (services)
- `F-11-110` — проверка пересечений в journal/ядре
- `F-11-115/119` — экран склада (stock)
- `F-11-121/122/123/124` — «Ссылки на онлайн-запись» (online)

**notify**
- `F-05-041` — экран resources/journal
- `F-05-064` — маршрута `/personal_account/notifications` нет вообще
- `F-05-078` — лента уведомлений клиента построена в area `client`, не `notify`
- `F-05-083` — `reminderMinutesBefore` не долетает от online до `Booking`
- `F-05-085` — кнопка в отчёте «Визиты» (reports почти пустой)
- `F-05-114` — права «показывать телефон клиента» нет в `permissions.ts`
- `F-05-129` — `sendFiscalReceiptEmail()` готова, но `finance/FiscalScreen.tsx` её не вызывает
- `F-05-131` — `sendDataExportEmail()` готова, но `reports/ExportExcelButton.tsx` не вызывает
- `F-05-134` — `sendPlanReportEmail()` готова, но у network нет планировщика
- `F-05-137` — публичная страница `/b/[slug]` не показывает мессенджеры бизнеса

**payroll**
- `F-09-006` — предупреждение: подсветка ведомости может не сработать при отмене оплаты (не проверено)
- `F-09-069 / F-09-076 / F-09-079 / F-09-109` — «Взаиморасчёты» требуют доработки сверх готовых 073-078; 076 не подтверждён
- `F-09-044/045/046/048` — сетап ассистентов (staff/journal/resources)
- `F-09-080/084` — предупреждение при увольнении, шаблон роли «Бухгалтер» (`permissions.ts`)
- `F-09-090/091/095` — отчёты (reports), движок готов
- `F-09-096/097` — «Расчёт зарплат» кабинета сети (network)

**reports**
- `F-12-008/043` — хост staff/journal, экрана нет
- `F-12-027` — потребует правки текста в 10+ экранах — не делали
- `F-12-081/082` — хосты network/settings
- `F-12-083/089` — сама спека помечает вопросом (❓), UI не придумывали
- `F-12-090` — поведение уже корректно через общий `defaultReportsPermissions`, отдельного узла нет
- `F-12-093…099` — заявлено «уже построено в network», но подтверждающего узла под эти id не нашлось
- `F-12-102/103/104` — раздача прав/валюты сети живёт в `/biz/network/**`
- `F-12-116` — своего права `clients.viewFullName` нет, временный обход

**resources**
- `F-16-010/015/016/018/019/020/021/022/023/024/025/027/029/031/032/042` — экраны journal/staff/reports/online/network/integrations, не построены resources
- `F-16-062` — настройка живёт в services/loyalty
- `F-16-084…094` — виджет и аналитика online, не построено
- `F-16-102…106` — отчёт «События» (reports)
- `F-16-123…132` — пакеты в сети/журнале/онлайн-записи
- `F-16-145/146/147/148` — хозяева payroll/journal
- `F-16-161` — нет режима «клик по слоту журнала» в JournalScreen.tsx
- `F-16-162` — `closeWaitlistEntry` готов, но journal не вызывает после сохранения записи

**schedule**
- `F-02-011,018,022,024,025,026,028,029,031,036,037,038,040,061,062,063,067,068,074,075,076,077,084,088,091,092` — принадлежат другим разделам, экраны которых там не построены

**settings**
- `F-00-147` — `useSphere()` (`src/demo/hooks.ts`) не объединяет функции по сферам
- `F-00-149/150` — экран в resources/clients-clients-journal
- `F-15-002/003/004/006/007/008` — чужой файл (`client` area), шаг подтверждения кодом отсутствует
- `F-15-010` — нет отдельного мобильного приложения
- `F-15-011` — заявлено «1:1 в LoginScreen.tsx», но тот экран — вход клиента по телефону+коду (persona: client), не вход владельца бизнеса; соответствия не нашли
- `F-15-014` — нужен переключатель филиалов в общем каркасе
- `F-15-015` — по сути закрыта `InviteAcceptScreen`, отдельно не заводили
- `F-15-016` — требует связку с реальным `StaffInvite`
- `F-15-050/051` — экран/форма staff area
- `F-15-092` — тип уведомления (notify)
- `F-15-125…131` — категории (journal/online/resources/clients/reports)
- `F-15-138…140/143` — языки виджета и согласие на ПДн (online)

**staff**
- `F-10-114/116` — справочные пункты ТЗ, не экраны — тег не нужен

**stock**
- `F-08-149` — экран временно в `/biz/stock/settings/access`, не на карточке сотрудника
- `F-08-150` — импорт визитов из Excel — принадлежит journal/reports, не начат
- `F-08-151` — колонка «Продано» в базе клиентов — строит journal/clients

## Отложено решением владельца/продукта

- `F-00-107` (client) — «Готово, когда» = «решение принято»; в QUESTIONS.md решение «позже, в прототипе не строим»
- `F-06-154 / F-06-155` (loyalty) — ТЗ само помечает 🔒/«по решению» (F-00-022/028 ещё не приняты)
- `F-06-166…171` (loyalty) — внешние интеграции лояльности, партнёр не выбран, ТЗ помечает 🔒
- `F-06-181` (loyalty) — слияние дублей клиента ждёт подтверждения владельца clients
- `F-06-182` (loyalty) — фискальный документ Бразилии — не наша страна
- `F-06-192` (loyalty) — партнёр для Армении не определён
- `F-09-098` (payroll) — карточка AutoPayroll не обязательна по нашему решению (функционал уже встроен)
- `F-12-107/108/109/110` (reports) — сознательно остаются 🔒-демо карточками («только интерфейс»)
- `F-02-094` (schedule) — решения «строить ли у себя» нет в `00-our-decisions.md`
- `F-00-028/029/030/154` (settings) — статьи-решения самого ТЗ, не UI-критерии
- `F-15-095` (settings) — «Готово-когда» требует решения, которого нет
- `F-15-182/183` (settings) — вопрос решён лишь частично (тема кабинета / кнопка карт)
- `F-08-108` (stock) — ждёт решения владельца об источнике отчётов

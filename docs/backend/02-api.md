# 02 · API по разделам

Цель — чтобы бэкенд заменил моковую базу, **не трогая экраны**: каждая функция `src/api/<area>.ts` сейчас
возвращает `Promise` поверх `request()`; на сервере она становится одним HTTP-вызовом с тем же входом и
выходом. Поэтому в таблицах есть колонка «Фасад» — какая функция мока этим вызовом заменяется.

---

## 0. Общие правила API

| Правило | Как |
|---|---|
| Префиксы | `/v1/auth/*` вход · `/v1/public/*` без входа (каталог, страница по ссылке) · `/v1/me/*` клиент приложения · `/v1/biz/{businessId}/*` кабинет · `/v1/net/{networkId}/*` сеть · `/v1/platform/*` наша панель |
| Формат | JSON; даты и время — как в моке: `'YYYY-MM-DD'`, `'YYYY-MM-DDTHH:mm'` в поясе филиала; деньги — целые драмы; `LocalizedText` целиком, язык выбирает экран (`pickText`) |
| Ошибки | `{ code, message }` с HTTP-статусом. Коды мока сохраняем: `not_found`, `slot_taken`, `invalid_phone`, `wrong_code`, `consent_required`, `staff_not_found`, `service_not_found`; добавляем `forbidden`, `conflict` (чужая правка, поле `version`), `frozen`, `insufficient_coins`, `promo_used`/`promo_expired`/`promo_revoked`/`promo_personal`, `rate_limited`, `validation` (с полями) |
| Права | колонка «Кто» — роль или право из `src/config/permissions.ts` (`journal.edit` …); подробно — `03` |
| Списки | курсор `?cursor=…&limit=…`; фильтры — параметрами; для конструктора фильтров клиентов — `POST …/search` с телом |
| Идемпотентность | создание записи, оплата, покупка монет, отправка новости — заголовок `Idempotency-Key`; повтор с тем же ключом возвращает первый результат |
| Оптимистичная блокировка | ответы несут `version`; правка шлёт `If-Match: <version>`; чужая правка между чтением и записью → `409 conflict` (F-01-033 «побеждает первое») |
| «Отменить» 5 секунд | опасные обратимые действия (удалить/перенести запись, удалить дни графика) возвращают `undoToken`; `POST /v1/undo/{token}` в течение 10 с откатывает (F-00-061). Сейчас это `snapshotCells/restoreCells` в браузере |
| Живые изменения | WebSocket (или SSE) `/v1/live`: подписка на `biz:{id}:day:{date}`, `staff:{id}`, `me`; события `booking.changed`, `schedule.changed`, `mark.changed`, `slots.changed`, `inbox.new` — экран перечитывает свои запросы (сейчас это `meta.rev`, F-01-033) |

---

## 1. Вход и аккаунт — `/v1/auth`, `/v1/me/account`

| Метод и путь | Вход → выход | Кто | Фасад / F |
|---|---|---|---|
| `POST /v1/auth/code` | `{phone, channel, purpose}` → `204` | все | `sendLoginCode` · F-00-032/033 |
| `POST /v1/auth/verify` | `{phone, code, name?, consent?}` → `{tokens, user, memberships[]}` | все | `verifyLoginCode` · F-14-007/008 |
| `POST /v1/auth/password` | `{login, password}` → `{tokens, mustChangePassword}` | администратор | F-00-034 |
| `POST /v1/auth/password/change` | `{old, new}` | администратор | F-00-034 |
| `POST /v1/auth/refresh` · `POST /v1/auth/logout` · `POST /v1/auth/logout-all` | | все | F-10-125 |
| `GET /v1/me/account` · `PATCH` | профиль, язык, крупный шрифт | клиент | F-00-124 |
| `POST /v1/me/account/delete` · `…/delete/cancel` | удаление через 25 дней | все | F-10-129 |
| `GET /v1/me/consent` | принято ли соглашение | клиент | `hasLoginConsent` |
| `POST /v1/me/push-tokens` | `{app, platform, token}` | все | `05` |

---

## 2. Приложение клиента — `client` (`/v1/public`, `/v1/me`)

### 2.1 Каталог и карточки (без входа)

| Метод и путь | Вход → выход | Фасад / F |
|---|---|---|
| `GET /v1/public/catalog` | `?search, sphere, district, workplace, accepts, material, freeToday, lat, lng, limit, cursor` → `CatalogEntry[]` (мастер, бизнес, место, услуги, ближайшие окна) | `listCatalog` · F-00-108…112 |
| `GET /v1/public/masters/{staffId}` | → `MasterCard` (всё с карточки F-00-123; только одобренное проверкой; адрес дома — только район, P6) | `getMasterCard` |
| `GET /v1/public/places/{businessId}` | → `PlaceCard` | `getPlaceCard` · F-14-028/030 |
| `GET /v1/public/masters/{staffId}/days` | `?serviceId, days=14` → `BookingSlotDay[]` | `getBookingDays` · F-00-092 |
| `GET /v1/public/masters/{staffId}/slots` | `?serviceId, date, workplace?` → `FreeSlot[]` | `getFreeSlots` (клиентский режим, `04` §5) |
| `GET /v1/public/services/{serviceId}/shades` | → варианты оттенка (со склада, только остаток > 0, F-00-143) | `getShadeOptions` · F-00-094…096 |
| `GET /v1/public/masters/{staffId}/cancel-window` | → часы бесплатной отмены | `getCancelWindowHours` · F-00-098 |
| `POST /v1/public/demand` | `{query, sphere?, district}` → `204` (пишет спрос; вход не нужен, считать «разных людей» — по устройству) | `reportSearchDemand` (сейчас никто не зовёт) · F-00-112, F-00-180 |
| `POST /v1/public/callback` | `{staffId, phone, name?}` → `204` (пуш мастеру/админу) | `requestCallback` · F-00-106 |

### 2.2 Записи клиента (после входа)

| Метод и путь | Вход → выход | Правила сервера | Фасад / F |
|---|---|---|---|
| `POST /v1/me/bookings` | `BookAppointmentInput` (+ `workplace`, `clientAddress?` для выезда) → `Booking` | повторная проверка окна **под блокировкой** (`busy_blocks`), `accepts` (F-00-069), чёрный список (F-00-189), статус по `confirm_mode` (выезд — всегда подтверждение, F-00-079), предоплата → `awaiting_prepayment` с `hold_until`, длительность — верхняя граница, цена — из прайса мастера | `bookAppointment` |
| `GET /v1/me/bookings` | → `{upcoming, past, cancelled}` — **только записи, сделанные этим пользователем через приложение/веб** (P1) | | `listMyBookings` · F-14-011 |
| `GET /v1/me/bookings?businessId=` | → записи в одной компании | | `listMyBookingsInBusiness` · F-14-026 |
| `GET /v1/me/bookings/{id}` | → `BookingDetail` (адрес дома — после подтверждения, P6) | только своя, иначе `404` | `getBooking` |
| `POST /v1/me/bookings/{id}/confirm` | → `Booking` | только своя | `confirmBookingByClient` · F-14-057 |
| `POST /v1/me/bookings/{id}/paid` | «Я оплатил» → `Booking` | только своя, только `awaiting_prepayment` | `markPrepaymentPaid` · F-00-097 |
| `POST /v1/me/bookings/{id}/cancel` | → `Booking` | позже срока → запись отменена **и** засчитана неявкой (`late_cancel`, `no_show_count += 1`) — см. `07` про нынешний мок | `cancelBookingByClient` · F-00-098 |
| `POST /v1/me/bookings/{id}/reschedule` | `{start}` → `Booking` | окно того же мастера и услуги; тот же срок, что для отмены? — открыто (F-00-099) | `rescheduleBookingByClient` |
| `POST /v1/me/bookings/{id}/repeat` | → черновик новой записи (та же услуга и мастер) | | «Повторить» F-00-118 |
| `GET/POST/DELETE /v1/me/waitlist` | `WaitlistInput` → `WaitlistEntry` | | `addToWaitlist`, `listMyWaitlist`, `removeFromWaitlist` · F-00-102 |
| `GET /v1/me/masters` | «Мои мастера» — только после визита через приложение | | `listBookedMasters` · F-00-118 |
| `GET/POST/DELETE /v1/me/favorites` · `PATCH …/{id}` `{newsMuted}` | подписка ❤ = избранное + новости; приглушить | | F-00-113, F-00-115 |
| `PUT/DELETE /v1/me/ratings/{staffId}` | звёздочка — только после визита «пришёл» у этого мастера | одна на человека на мастера | F-00-116 |
| `GET/POST/DELETE /v1/me/diary` | дневник расходов; записи из приложения попадают сами | | F-00-122 |
| `GET /v1/me/inbox` · `POST …/{id}/read` | лента уведомлений | | F-14-055 |
| `GET /v1/me/stories` | сторис на главной: места на сегодня, случайный порядок | | F-00-159, F-00-161 |
| `POST /v1/me/support` | обращение к нам | | F-00-182 (сейчас из приложения не заводится) |

---

## 3. Онлайн-запись и страница по ссылке — `online`

| Метод и путь | Вход → выход | Кто | Фасад / F |
|---|---|---|---|
| `GET /v1/public/b/{slug}` · `…/f/{formId}` | → `PublicBusinessData` (только видимое онлайн, без чужих сторис и рекламы — P12) | все | `getPublicBusinessData` · F-03-134, F-00-006 |
| `GET /v1/public/b/{slug}/slots` | `?staffId, date, serviceIds[]` → `FreeSlot[]` | все | `getWidgetFreeSlots` |
| `GET /v1/public/b/{slug}/nearest-date` · `…/month` | ближайший день с окнами; дни месяца с окнами | все | `getNearestAvailableDate`, `getMonthAvailability` · F-03-084/085 |
| `POST /v1/public/b/{slug}/bookings` | `CreateOnlineBookingInput` + **код входа** (F-00-007: запись без установки, код так же в WhatsApp/Telegram) → `{booking, accessHash}` | все | `createOnlineBooking` · F-03-093 |
| `GET /v1/public/bookings/{id}?h=` | запись по ссылке без входа | владелец ссылки | `getOnlineBooking` · F-03-098 |
| `POST /v1/public/bookings/{id}/cancel?h=` | отмена по ссылке (с правилом срока) | владелец ссылки | `cancelOnlineBooking` |
| `GET/POST /v1/biz/{b}/links` · `PATCH/DELETE …/{id}` · `POST …/{id}/primary` | ссылки на запись | `online.manage` | `listLinks`, `createLink`, `updateLink`, `deleteLink`, `setPrimaryLink` · F-03-003…010 |
| `GET /v1/biz/{b}/bookings/{id}/online-meta` | источник, форма, устройство | `journal.view` | `getBookingMeta` · F-03-123 |
| `GET/PUT /v1/biz/{b}/online/rules` · `…/staff/{s}/rules` | онлайн-правила слотов, недоступные дни | `online.manage` | F-02-041…055 (не построено) |
| `GET/PUT /v1/biz/{b}/staff/{s}/client-rules` | правила мастера: подтверждение, предоплата и реквизиты, срок отмены, кого принимает, видимость, часы звонков, каналы связи — **на одном экране** (F-00-066) | сам мастер; владелец | сейчас черновики в срезе client (`qa/requests/client.md`) |

---

## 4. Журнал и записи — `journal`

| Метод и путь | Вход → выход | Кто | Фасад / F |
|---|---|---|---|
| `GET /v1/biz/{b}/journal/day` | `?locationId, date, groupBy=staff\|resource` → колонки, часы работы, записи своего бизнеса, **чужая занятость мастеров «дома/занято» без деталей** (P3), групповые события, перерывы | `journal.view` (+ `journal.others` для чужих колонок) | `listBookings` + `getStaffHoursMap` + … · F-01-019…035, F-00-046 |
| `GET /v1/biz/{b}/journal/week` | `?staffId\|resourceId, weekStart` | `journal.view` | `getWeekHours` · F-01-013 |
| `GET /v1/biz/{b}/journal/load` | `?from, to, staffIds[]` → загрузка дней | `journal.view` | `getRangeLoad` · F-01-003/004 |
| `GET /v1/biz/{b}/bookings` | `BookingQuery` → `Booking[]` | `journal.view` | `listBookings` |
| `POST /v1/biz/{b}/bookings` | `BookingInput` → `Booking` (проверка пересечений человека и ресурсов; «занятое или нерабочее время» — предупреждение с флагом `force`, F-01-215; поверх занятости в другом бизнесе — нельзя) | `journal.edit` (`journal.create`) | `createBooking` · F-01-024, F-00-060 |
| `PATCH /v1/biz/{b}/bookings/{id}` | патч (время, мастер, услуги, клиент, комментарий, категории, цвет, доп. поля) → `Booking` + `undoToken` при переносе | `journal.edit` (`journal.move`); оплаченные и «пришёл» — отдельное право (F-01-085) | `updateBooking` · F-01-109…117 |
| `POST /v1/biz/{b}/bookings/{id}/status` | `{status, amount?}` («пришёл · сумма», F-00-127) → `Booking` | `journal.edit` | `setBookingStatus` · F-01-075…084 |
| `DELETE /v1/biz/{b}/bookings/{id}` | мягкое удаление → `undoToken` | `journal.edit` + право удаления | `deleteBooking` · F-01-118/119 |
| `POST /v1/biz/{b}/bookings/{id}/confirm` · `…/decline` | подтвердить / отклонить заявку (из пуша тоже) | мастер записи; админ | F-00-067 |
| `POST /v1/biz/{b}/bookings/{id}/prepayment-received` · `…/refund-done` | ручная предоплата получена; возвращена | мастер записи | F-00-097, F-00-100 |
| `POST /v1/biz/{b}/bookings/{id}/finished-early` | «Закончил раньше» → остаток становится окном | мастер | F-00-058 |
| `POST /v1/biz/{b}/staff/{s}/running-late` | `{minutes}` → пуш следующему клиенту | мастер | F-00-059 |
| `GET /v1/biz/{b}/bookings/{id}/remind-text` | готовый текст и ссылка `wa.me` для клиента без приложения | мастер | F-00-121 |
| `POST /v1/biz/{b}/series` · `PATCH/DELETE …/{id}` | повторяющиеся записи: правило, создание вперёд, отмена одной не трогает серию | `journal.edit` | F-00-064, F-01-100…107 |
| `GET /v1/biz/{b}/bookings/{id}/history` | история изменений записи | `journal.view` | F-01-096 |
| `GET/PUT /v1/biz/{b}/journal/prefs` · `…/staff-markup` · `…/bookings/{id}/break` | шаг сетки, скрытые статусы, разметка, перерыв под записью | `journal.view` (свои) / `settings.manage` | `getJournalPrefs`, `setJournalZoom`, `setJournalHiddenStatuses`, `setStaffMarkup`, `setBookingBreakOverride` |
| `GET/POST/PATCH/DELETE /v1/biz/{b}/booking-categories` · `…/booking-fields` | категории записи, свои поля записи | `settings.manage` | срез `journal` · F-01-051/053, F-15-121…125 |
| `GET/PUT /v1/biz/{b}/bookings/{id}/extras` | товары в визите, скидки строк, доп. поля | `journal.edit` | срез `journal.extras` · F-01-058/060 |
| `GET/PUT /v1/biz/{b}/drafts/{key}` | черновик окна записи | сам сотрудник | срез `journal.drafts` · F-01-040 (можно оставить в браузере — это не общие данные) |
| `POST /v1/biz/{b}/bookings/export` · `POST …/import` | выгрузка / загрузка записей | `clients.export` / `settings.manage` | F-01-182/183 |
| `POST /v1/undo/{token}` | откат последнего действия | автор действия | F-00-061 |

---

## 5. График и окна — `schedule`

| Метод и путь | Вход → выход | Кто | Фасад / F |
|---|---|---|---|
| `GET /v1/biz/{b}/schedule/table` | `ScheduleTableInput` → `ScheduleRow[]` | `staff.view` | `getScheduleTable` · F-02-002/003 |
| `PUT /v1/biz/{b}/schedule/cells` | `SetCellsInput` → `SetCellsResult` + `undoToken`; ответ несёт `affectedBookings` (F-02-106) | `schedule.edit` (свой — мастер) | `setCells`, `findAffectedBookings` |
| `DELETE /v1/biz/{b}/schedule/cells` | `DeleteCellsInput` | `schedule.edit` | `deleteCells` · F-02-014 |
| `POST /v1/biz/{b}/schedule/copy` · `…/copy-last-week` | копирование графика | `schedule.edit` | `copySchedule`, `copyFromLastWeek` · F-02-015, F-00-054 |
| `GET/POST/PATCH/DELETE /v1/biz/{b}/schedule/templates` | шаблоны | `schedule.edit` | `getTemplates`… · F-02-006…009 |
| `GET/PUT /v1/biz/{b}/schedule/view` · `…/filters` | вид и фильтры таблицы | сам сотрудник | `getViewConfig`, `getFilters` (можно держать в браузере) |
| `GET/PUT /v1/biz/{b}/staff/{s}/calendar-mode` | режим календаря | сам мастер | `getCalendarMode`, `setCalendarMode` · F-00-051 |
| `GET /v1/biz/{b}/staff/{s}/marks` · `POST` · `DELETE …/{id}` | отметки | сам мастер; `schedule.edit` | `getCalendarMarks`, `addMark`, `removeMark` |
| `POST /v1/biz/{b}/staff/{s}/marks/whole-day` · `…/range` · `…/copy-last-week` · `…/vacation` | быстрые инструменты | сам мастер | `openWholeDay`, `markCalendarRange`, `copyMarksFromLastWeek`, `setVacationUntil` · F-00-054 |
| `GET /v1/biz/{b}/staff/{s}/hours` | `?date\|from,to, locationId` → часы, рабочие дни, минуты, конец графика | `journal.view` | `getDayHours`, `getWorkDays`, `getScheduledMinutes`, `getScheduleEnd` |
| `GET /v1/biz/{b}/staff/{s}/slots` | `SlotQuery` → `FreeSlot[]` (режим сотрудника) | `journal.view` | `getFreeSlots` · `04` |
| `GET /v1/biz/{b}/staff/{s}/nearest-slots` | → ближайшие окна | `journal.view` | `getNearestSlots` |
| `GET /v1/biz/{b}/schedule/history` | история правок графика и правил слотов | `staff.view` | `getHistory` · F-02-102 |

Напоминание «пустая неделя» (`hasEmptyNextWeek`) — не маршрут, а воскресная задача сервера (`05`).

---

## 6. Клиенты и CRM — `clients`

| Метод и путь | Вход → выход | Кто | Фасад / F |
|---|---|---|---|
| `POST /v1/biz/{b}/clients/search` | `ClientListQuery` (поиск, сегмент, фильтры «И/Или», сортировка, страница) → `{rows: ClientRow[], total}` — **фильтрует и считает сервер** (сейчас `listClientRows` отдаёт всех, фильтры на экране) | `clients.view`; телефоны — `clients.phones`; «только свои» — F-10-095 | `listClientRows` · F-04-001…036 |
| `GET /v1/biz/{b}/clients/{id}` | → `ClientRow` | `clients.view` | `getClientRow` · F-04-066 |
| `POST /v1/biz/{b}/clients` | `CreateClientInput` → `Client`; тот же номер → `409` с id существующей карточки (F-00-128) | `clients.edit` | `createClient` · F-04-044…061 |
| `PATCH /v1/biz/{b}/clients/{id}` | `UpdateClientInput` | `clients.edit` (телефон — ещё `clients.phones`) | `updateClient` · F-04-062 |
| `DELETE /v1/biz/{b}/clients/{id}` | мягкое удаление | владелец (F-04-074) | `deleteClient` |
| `POST /v1/biz/{b}/clients/merge` | `{keepId, mergeId}` — перенос визитов, карт, счетов | `clients.edit` | F-04-135 (наш вывод) |
| `POST /v1/biz/{b}/clients/{id}/anonymize` | просьба клиента удалить данные | владелец | P11 |
| `GET/POST/DELETE /v1/biz/{b}/clients/{id}/comments` | история комментариев | `clients.view` / `clients.edit` | `listComments`, `addComment`, `deleteComment` · F-04-070 |
| `GET /v1/biz/{b}/clients/{id}/app` | есть ли приложение, платформа, последний заход (да/нет — без данных другого бизнеса) | `clients.view` | `getAppActivity` · F-04-072 |
| `GET/POST /v1/biz/{b}/client-fields` · `GET/PUT …/clients/{id}/fields` | доп. поля | `settings.manage` / `clients.edit` | `listCustomFieldDefs`, `addCustomFieldDef`, `getCustomFieldValues` · F-04-139…145 |
| `GET/POST/PATCH/DELETE /v1/biz/{b}/client-categories` | справочник категорий | `settings.manage` | `listCategoryOptions` · F-04-109…113 |
| `POST /v1/biz/{b}/clients/bulk` | `{ids \| query, action: addCategory\|delete\|push}` | по действию | F-04-037…043 |
| `POST /v1/biz/{b}/clients/import` · `…/export` | импорт без дублей по номеру; выгрузка — **закрыта по умолчанию** (P4) | `settings.manage` / `clients.export` | F-04-126…130, F-00-190 |
| `POST /v1/biz/{b}/clients/{id}/invite` | пригласить клиента из CRM в приложение (ссылка для WhatsApp мастера) | `clients.view` | F-00-130 |
| `GET/PUT /v1/biz/{b}/clients/settings` | колонки, ФИО, период потери, автосохранение лидов | `settings.manage` (колонки — свои) | `getColumnsPrefs`, `setVisibleColumns`, `togglePinnedColumn`, `getShowFullNameFields`, `getLostAfterDays`, `getAutoSaveChatLeads` |
| `GET /v1/biz/{b}/clients/index/bookings` | срез записей для фильтров «По визитам» | — | `listClientBookingsIndex` — **на сервере не нужен**: фильтры считает сервер |

Черновые списки «По продажам» (`listCertificates`, `listSubscriptions`, `listProductPurchases`) уходят в
разделы loyalty и stock.

---

## 7. Сотрудники, права — `staff`

| Метод и путь | Вход → выход | Кто | F |
|---|---|---|---|
| `GET /v1/biz/{b}/staff` · `GET …/{s}` | список с фильтрами (должность, специализация, уволенные) | `staff.view` | F-10-005…014 |
| `POST /v1/biz/{b}/staff` | добавить сотрудника (без входа или с приглашением) | `staff.manage` | F-10-015…023 |
| `PATCH /v1/biz/{b}/staff/{s}` | профиль, места работы, услуги мастера (длительность/цена у мастера) | `staff.manage`; свой профиль — сам мастер | F-10-024…038 |
| `POST /v1/biz/{b}/staff/{s}/fire` · `…/restore` · `DELETE` | уволить, восстановить, удалить (слово-подтверждение) | `staff.manage`; владелец | F-10-040…045 |
| `POST /v1/biz/{b}/staff/{s}/disable` | отключить администратора одним нажатием — сессии гаснут | владелец | F-00-040 |
| `POST /v1/biz/{b}/invites` · `DELETE …/{id}` · `POST /v1/me/invites/{token}/accept\|decline` | приглашение мастера в салон с согласием | `staff.manage` / приглашённый | F-00-042, F-00-043 |
| `POST /v1/biz/{b}/admins` | создать администратора с логином и паролем | владелец | F-00-038 |
| `GET/PUT /v1/biz/{b}/staff/{s}/permissions` | права галочками | владелец | `getStaffPermissions`, `setStaffPermissions` · F-00-039 |
| `GET /v1/biz/{b}/staff/{s}/permissions/history` | история прав | владелец | F-10-070 |
| `GET/POST/PATCH/DELETE /v1/biz/{b}/positions` | должности | `staff.manage` | F-10-046…052 |
| `GET /v1/biz/{b}/audit` | журнал изменений: фильтры по сотруднику, сущности, действию, дате | владелец; право журнала | F-00-040, F-10-100 |
| `GET /v1/biz/{b}/exports-log` | журнал выгрузок | владелец | F-10-102 |
| `PUT /v1/biz/{b}/staff/{s}/portfolio` | фото работ (6 мест + купленные) — каждое на проверку | сам мастер | F-00-085/086 |
| `POST /v1/biz/{b}/staff/{s}/diplomas` | диплом на проверку | сам мастер | F-00-088 |
| `POST /v1/biz/{b}/staff/{s}/here` | «Я сейчас на месте работы» `{workplaceId, lat, lng}` | сам мастер | F-00-075 |

---

## 8. Услуги — `services`

| Метод и путь | Вход → выход | Кто | F |
|---|---|---|---|
| `GET /v1/biz/{b}/services` · `…/categories` | каталог с категориями | `services.view` | 00 §8 |
| `POST/PATCH/DELETE /v1/biz/{b}/services/{id}` | услуга: длительность и цена от–до, запас, интервал «пора снова», фото, материалы, мастера, онлайн, окно «ограниченное время»; новая и изменённая — на проверку для витрины | `services.edit` | F-00-082…091 |
| `GET /v1/public/sphere-templates/{sphere}` · `POST /v1/biz/{b}/services/from-templates` | готовые услуги сферы на 3 языках | `services.edit` | F-00-083, F-00-173 |
| `POST/PATCH/DELETE /v1/biz/{b}/categories/{id}` · `PUT …/order` | категории и порядок | `services.edit` | |
| `POST/PATCH/DELETE /v1/biz/{b}/packages/{id}` | пакеты «Комплекс» | `services.edit` | F-16-107…135 |
| `PUT /v1/biz/{b}/page-photos` | 6 фото страницы салона | `settings.manage` | F-00-087 |

---

## 9. Ресурсы, групповые, лист ожидания — `resources`

| Метод и путь | Кто | F |
|---|---|---|
| `GET/POST/PATCH/DELETE /v1/biz/{b}/resources` (+ экземпляры, связи с услугами) | `resources.manage` | F-16-001…026, F-00-149 |
| `GET/POST/PATCH/DELETE /v1/biz/{b}/events` · `POST …/{id}/participants` · `DELETE …/participants/{pid}` | `journal.edit` | F-16-036…063 (сейчас в ядре есть `GroupEvent`, но API нет — `qa/requests/journal.md`) |
| `POST /v1/biz/{b}/event-series` · `PATCH/DELETE …/{id}` | `journal.edit` | F-16-064…080 |
| `GET /v1/biz/{b}/waitlist` · `POST` · `PATCH/DELETE …/{id}` · `POST …/{id}/book` | `journal.view` / `journal.edit` | F-16-148…169 |
| `GET /v1/public/b/{slug}/events` · `POST …/events/{id}/book` `{seats}` | все / клиент | F-16-084…092, F-00-185 |

---

## 10. Уведомления — `notify`

| Метод и путь | Кто | F |
|---|---|---|
| `GET/PUT /v1/biz/{b}/notify/types` | включение типов для клиентов/сотрудников | `notify.manage` | F-05-001…012 |
| `GET/PUT /v1/biz/{b}/notify/templates/{type}` · `POST …/preview` | тексты на 3 языках | `notify.manage` | F-05-013…023 |
| `GET /v1/biz/{b}/notify/log` | журнал отправок (телефоны по праву) | `notify.manage` | F-05-107…109 |
| `POST /v1/biz/{b}/news` · `GET /v1/biz/{b}/news` · `GET …/news/quota` | новость подписчикам; сколько осталось на неделе | `notify.manage` | F-00-114 |
| `GET /v1/biz/{b}/news/suggestions` | поводы для новости (новый товар «показывать клиентам», услуга, мастер, диплом, горящее окно) | `notify.manage` | F-00-114 (предл.) |
| `GET/PUT /v1/biz/{b}/staff/{s}/notify` | что приходит сотруднику | сам / `staff.manage` | F-05-055…060 |
| `GET /v1/biz/{b}/inbox` · `POST …/{id}/read` | колокольчик | все сотрудники | F-05-061 |
| `GET/PUT /v1/biz/{b}/clients/{id}/notify` | настройки уведомлений на клиента, отказ от маркетинга | `clients.edit` | F-04-087…090 |
| `GET …/notify/chat/unread` · `POST …/chat/unread/clear` · `GET/POST …/notify/chat/messages` · `POST …/chat/simulate-incoming` | чат с клиентом через бота-партнёра (построено, этап 21 попытка 6; Р19 — входящие пока демо-кнопкой вместо вебхука партнёра, новый собеседник — «Лид из чата») | `clients.view` | F-05-087, F-05-088 |
| `POST …/notify/chat/simulate-partner-confirm` · `…/whatsapp/test-message` · `…/agent/simulate-booking` | демо-кнопки: партнёр подтверждает запись (тем же путём, что сотрудник), тест WhatsApp, запись внешним агентом — строка в журнале отправок | `notify.manage` | F-05-071, F-05-076, F-05-121 |

---

## 11. Лояльность — `loyalty`

Владелец данных — **сеть** (у одиночного бизнеса — сам бизнес), поэтому пути `/v1/org/{orgId}/…`, где `orgId` —
`networkId` или `businessId` (предл.).

| Группа | Маршруты (все CRUD, если не сказано иное) | Кто | F |
|---|---|---|---|
| Программа локации | `…/loyalty/program` (правила автоскидок, классов, категорий), `POST …/program/recalculate` | `loyalty.manage` | F-06-006…019 |
| Типы карт, акции | `…/card-types`, `…/promotions` (мастер из 5 шагов — один `POST`) | `loyalty.manage` | F-06-020…050 |
| Карты клиентов | `…/clients/{id}/cards`, `POST …/cards/{cid}/bonuses` (ручное начисление/списание) | `loyalty.manage`; в окне записи — `journal.edit` | F-06-051…060 |
| Применение при оплате | `POST /v1/biz/{b}/bookings/{id}/loyalty/apply` → строки оплаты «лояльностью» | `finance.edit` | F-06-061…075 |
| Транзакции | `GET …/loyalty/transactions` | `loyalty.manage` | F-06-076/077 |
| Рефералы | `…/referral` | `loyalty.manage` | F-06-081…085 |
| Сертификаты | `…/certificate-types`, `…/certificates` (продажа, баланс, срок, возврат) | `loyalty.manage` / `finance.edit` | F-06-086…104 |
| Абонементы | `…/membership-types`, `…/memberships` (продажа, заморозка, автосписание, возврат) | `loyalty.manage` / `finance.edit` | F-06-105…134 |
| Счета клиентов | `…/account-types`, `…/clients/{id}/accounts`, `POST …/accounts/{aid}/topup\|refund` | `finance.edit` | F-06-135…146 |
| Клиенту | `GET /v1/me/loyalty?businessId=` — карты, абонементы, сертификаты, баланс **этого бизнеса** (вклад в `clientProfile`) | клиент | F-06-156…163 |

Открыто: видит ли клиент в приложении свою персональную скидку и абонементы, если его карточку завёл мастер
(это CRM-данные, P1) — предлагаю: только то, что куплено или выдано **через приложение** либо после того, как
клиент сам записался к этому бизнесу.

---

## 12. Финансы — `finance`

| Группа | Маршруты | Кто | F |
|---|---|---|---|
| Кассы | `…/cash-registers` (+ `POST …/transfer`) | `finance.edit` | F-07-001…006 |
| Статьи | `…/payment-items` | `finance.edit` | F-07-007…009 |
| Операции | `GET …/fin-ops` (фильтры), `POST` «Новый платёж», `POST …/{id}/cancel`, `…/export`, `…/import` | `finance.view` / `finance.edit` | F-07-010…018 |
| Контрагенты, документы | `…/counterparties`, `…/documents` | `finance.edit` | F-07-019…024 |
| Методы оплаты | `…/payment-methods` | `finance.edit` | F-07-025…035 |
| Оплата визита | `POST /v1/biz/{b}/bookings/{id}/payments` (быстрая или раздельная), `DELETE …/payments/{pid}` | `finance.edit` | F-07-036…050 |
| Продажи вне визита | `POST …/sales` | `finance.edit` | F-07-051…054 |
| Возвраты, штрафы | `POST …/refunds`, `POST …/fines` | `finance.edit` | F-07-066…075 |
| Взаиморасчёты с сотрудниками | `GET …/staff/{s}/settlements`, `POST …/payouts` | `payroll.manage` | F-07-159…162 |
| Отчёты | `GET …/reports/finance`, `…/pnl`, `…/cash-day` | `finance.view` | F-07-163…165 |

Онлайн-платежи клиентов, политика оплаты (депозит, гарантия картой), чаевые — **не строим сейчас**: «деньги
через CRM не принимаем, только записываем» (F-00-126, предл.), кошелёк отложен (F-00-028). Маршруты только
записывают факт оплаты.

---

## 13. Склад — `stock`

| Группа | Маршруты | Кто | F |
|---|---|---|---|
| Склады | `…/warehouses` | `stock.edit` | F-08-004…009 |
| Категории, товары | `…/product-categories`, `…/products` (архив, Excel, штрихкод, «показывать клиентам», срок годности) | `stock.edit` | F-08-010…035, F-00-134 |
| Операции | `…/stock-ops` (приход, списание, перемещение, продажа), `POST …/{id}/cancel` | `stock.edit` | F-08-046…078 |
| Техкарты | `…/tech-cards`, `PUT …/staff/{s}/services/{sv}/tech-card` | `stock.edit` | F-08-036…045 |
| Автосписание по «пришёл» и откат | не маршрут — часть `POST …/bookings/{id}/status` | — | F-08-041/042, F-00-136 |
| Инвентаризация | `…/inventories` | `stock.edit` | F-08-079…089 |
| Остатки и «заказать» | `GET …/stock/balances`, `GET …/stock/to-order`, `GET …/stock/to-order/whatsapp-text` | `stock.view` | F-00-137 |
| Оборудование, напоминания | `…/equipment`, `…/reminders` | `stock.edit` | F-00-141, F-00-142 |
| Отчёты склада | `GET …/reports/stock/*` | `stock.view` | F-08-101…108 |

---

## 14. Зарплата — `payroll`

| Группа | Маршруты | Кто | F |
|---|---|---|---|
| Основные настройки | `…/payroll/settings` | `payroll.manage` | F-09-004…009 |
| Схема сотрудника (упрощённая) | `GET/PUT …/staff/{s}/payroll-scheme`, `POST …/copy-from/{other}` | `payroll.manage` | F-09-010…048 |
| Классическая модель | `…/payroll/rules`, `…/criteria`, `…/schemes`, `…/assignments` | `payroll.manage` | F-09-049…057 |
| Расчёт | `GET …/payroll/day?date`, `GET …/payroll/period?from,to` | `payroll.view` (свой — мастер) | F-09-058…065 |
| Ведомости | `…/payroll/statements` (черновик / начислить), `…/bonuses-fines` | `payroll.manage` | F-09-066…076 |
| Выплата | `POST …/payroll/payouts` → операция в финансах | `payroll.manage` | F-09-077…080 |

---

## 15. Сеть — `network`

| Группа | Маршруты | Кто | F |
|---|---|---|---|
| Сеть и филиалы | `POST /v1/net`, `GET/PATCH /v1/net/{n}`, `…/locations` (добавить, главная, выход филиала) | владелец сети | F-11-001…023 |
| Пользователи сети | `…/users`, `…/users/{u}/permissions` | `network.manage` | F-11-024…039 |
| Общая база клиентов | `POST /v1/net/{n}/clients/search`, `GET …/clients/{id}` (сводка по филиалам) | право сети «Клиенты» | F-11-040…053 |
| Рассылки по сети | `POST /v1/net/{n}/news` (лимит — на каждый салон? открыто) | право сети | F-11-054…061 |
| Аналитика и планы | `GET /v1/net/{n}/reports/*`, `…/plans` | право сети «Аналитика» | F-11-062…078 |
| Сетевые услуги, сотрудники, товары, поля | `…/services`, `…/staff`, `…/positions`, `…/products`, `…/fields` | `network.manage` | F-11-079…134 |

---

## 16. Отчёты — `reports`

`GET /v1/biz/{b}/reports/{name}?from,to,staffIds,locationId…` — один маршрут на отчёт; `name`: `overview`
(основные показатели, F-12-009…018), `retention`, `visits`, `records`, `events`, `load`, `by-staff`, `by-service`,
`by-client`, `promotions`, `messages` (F-12-019…073). Выгрузка — `POST …/reports/{name}/export` (в журнал
выгрузок). Право — `reports.view`; деньги в отчётах — `finance.view` (кто в салоне видит деньги — открыто,
F-00-132). Считаются по записям с отметкой «пришёл · сумма» (F-00-131) из `daily_stats` + живых таблиц.

---

## 17. Интеграции — `integrations`

Чужие приложения — без настоящего обмена (Р19): сервер хранит «подключено/нет» и настройки. Своё — настоящее:
`…/api-keys`, `…/webhooks` (+ журнал доставок, подпись, повтор) — право `integrations.manage` (F-13-001…070).

Построено (этап 17 + этап 21, сдача, попытка 6 — маркетплейс целиком на сервере):

| Метод и путь | Что | Кто |
|---|---|---|
| `GET /v1/integrations/catalog?categoryId&q&country&channel&capability&appKind` · `…/all` · `…/featured` · `…/category-counts` · `…/apps/{id}` · `…/by-code/{code}` · `…/apps/{id}/reviews` | каталог приложений (таблица `integration_catalog_apps`, сид — каталог мока, id те же), отзывы | любой вошедший |
| `GET/POST /v1/biz/{b}/integrations/installs…` (`/one`, `/count`, `/live-locations`, `/system-users`, `/{id}/activate`, `/{id}/disconnect`, `/{id}/test`) | подключение к филиалам; «только владелец», «скоро» и «встроенное = сразу» сервер берёт из своего каталога | `integrations.manage` на запись |
| `POST /v1/biz/{b}/integrations/installs/{id}/action` | настройки и демо-кнопки конкретного приложения (b03/b04/b05): ключ и имя отправителя SMS, баланс сообщений, номер WhatsApp, каскад чат-бота, перехват отзывов, возврат «уснувших», штамп-карта, GA-потоки, Kommo, FastSign, оплата/возврат подписки партнёра — одна команда `{action,…}` | `integrations.manage` |
| `POST …/integrations/reviews` · `GET/POST …/category-subscriptions` · `GET/POST …/partner-applications` | отзыв (только с живым подключением), «сообщить, когда появится», заявка партнёру | бизнес |
| `…/integrations/promo-blocks` (список, создать, изменить, вкл/выкл, удалить) | промоблоки виджета записи (F-13-172) | `integrations.manage` |
| `…/integrations/developer` · `…/dev-apps` (список, `/{id}`, `/by-code/{code}`, создать, `/{id}/action`) | кабинет разработчика (F-13-028…048), только свои приложения (по сотруднику) | `integrations.manage` на запись |
| `GET …/integrations/demo-incoming-call` · `…/who-to-call?locationId` · `…/identifiers` | «проверить звонок» АТС, «кого позвать», id для внешних систем | бизнес |

---

## 18. Регистрация, настройки, подписка, монеты — `settings`

| Метод и путь | Вход → выход | Кто | F |
|---|---|---|---|
| `POST /v1/biz` | `{kind, name, sphereIds, promoCode?, calendarMode (индивидуал обязан выбрать)}` → `Business` + кабинет под сферу | вошедший по коду | F-00-035, F-00-052, F-00-020 |
| `GET/PATCH /v1/biz/{b}` | название, описание, логотип, контакты, соцсети, часы, адреса филиалов | `settings.manage` | F-15-097…120 |
| `GET /v1/biz/{b}/onboarding` · `POST …/step` | быстрый старт | владелец | F-15-017…028 |
| `GET /v1/biz/{b}/billing` | подписка: статус, период, бесплатно до, скидка по коду, следующий платёж и его расчёт (мастера × цена, админы) | `billing.manage` | F-00-012…025 (сейчас наш бесплатный период и промокод в подписке не видны — `qa/requests/platform.md`) |
| `POST /v1/biz/{b}/billing/pay` · `PUT …/autorenew` · `PUT …/card` | оплатить, автопродление, карта | `billing.manage` | F-00-022, F-00-023 |
| `GET /v1/biz/{b}/billing/charges` · `…/{id}/receipt` | история оплат и документы | `billing.manage` | F-00-025 |
| `GET /v1/biz/{b}/coins` · `POST …/coins/buy` · `GET …/coins/entries` | баланс, покупка пакета, движения | `billing.manage` | F-00-026, F-00-027 |
| `POST /v1/biz/{b}/photo-slots` | купить место под фото за монеты | сам мастер / владелец | F-00-086 |
| `GET/POST /v1/biz/{b}/promo/stories` · `GET /v1/public/stories/slots` | сторис кабинета и покупка за монеты (построено, этап 21 попытка 6: 1 500 за 24 ч, в очереди 2 500, мест — `StoryConfig.places`; строка в `story_bookings`, которую видит доска панели) | `billing.manage` на покупку | F-00-159, F-00-160 |
| `GET /v1/public/stories/home` · `…/business/{b}` · `…/{id}` · `POST …/{id}/view\|click` | сторис в приложении клиента (подписки первыми), счётчики | все | F-00-159…162 |
| — | картинка 1080×1920 собирается на фронте (`generateStoryImage`) из окон, которые считает сервер (`GET /v1/public/masters/{id}/slots`) | мастер | F-00-155…158 |
| `GET/POST /v1/biz/{b}/promo/news` · `GET …/news/week` | новость подписчикам из кабинета: 3 бесплатно за 7 дней, дальше 300 монет, рассылка после одобрения панелью | `billing.manage` на создание | F-00-114 |
| `GET /v1/biz/{b}/promo/settings` · `PUT …/hot-slot` · `POST …/boost` | скидка на горящее окно, «выше в поиске»/«на главной» за монеты | `online.manage` / `billing.manage` | F-00-103, F-00-167 |
| `GET/PUT /v1/biz/{b}/settings/{area}` | настройки разделов (хаб `settingsHub`) | `settings.manage` | |
| `POST /v1/biz/{b}/ideas` · `GET /v1/ideas` · `POST …/{id}/vote` | идеи и голоса | любой бизнес | F-00-009 |
| `POST /v1/biz/{b}/sphere-requests` | «моей сферы нет» / новая сфера на год | владелец | F-00-151, F-00-152 |
| `PUT /v1/biz/{b}/ads-opt-in` | получать ли предложения поставщиков | владелец | F-00-164 (сейчас флаг ставит наша панель — `qa/requests/platform.md`) |
| `POST /v1/biz/{b}/export` | выгрузка клиентов и записей при уходе | владелец | F-00-183 |

---

## 19. Наша панель — `platform`

Все маршруты — `/v1/platform/*`, право `platform.access`.

| Группа | Маршруты | Фасад / F |
|---|---|---|
| Проверка | `…/moderation` (список, карточка, `approve`, `reject`), `…/reject-reasons` | `listModerationItems`, `approveModerationItem`, `rejectModerationItem`, `saveRejectReason` · F-00-168…171, F-00-179 |
| Подключение на визите | `…/connect-drafts` (создать, сохранить шаг, «я на месте», приглашения, услуги из шаблона, `finish`, удалить) | `startConnectDraft` … `finishConnectDraft` · F-00-176 — `finish` создаёт бизнес, филиал, мастеров (приглашения), услуги, часы, фото `auto`, бесплатный месяц, промокод — **одной транзакцией** |
| Наши визиты | `…/visits`, `…/visits/callbacks-today`, `POST …/{id}/callback-done` | `listVisits` … · F-00-177 |
| Промокоды, бесплатные месяцы | `…/promo-codes` (создать, выдать, отозвать), `POST …/free-months` | `createPromoCode`, `revokePromoCode`, `grantFreeMonth` · F-00-178 |
| Бизнесы | `…/businesses` (обзор, наши сведения, «ушёл», выгрузка, копии) | `listBusinessesOverview`, `markBusinessLeft`, `exportBusinessData`, `makeBackupCopy` · F-00-183 |
| Поддержка | `…/support` (список, ответ, закрыть, открыть) | `listSupportTickets` … · F-00-182 |
| Спрос и «первый» | `GET …/demand?period`, `GET …/first-candidates`, `POST …/first-awards` | `getDemandReport`, `listFirstCandidates`, `grantFirstAward` · F-00-180, F-00-181 |
| Реклама | `…/ad-placements`, `…/ads` (создать, пауза), `GET …/ads/{id}/report` (только показы и нажатия по дням) | `listAds`… · F-00-163…166 |
| Показ рекламы | `GET /v1/public/ads?placement&district&sphere` · `POST /v1/public/ads/{id}/impression\|click` (сервер считает, защищает от накрутки) | `getActiveAds`, `trackAdImpression`, `trackAdClick`, `getStockOffer` |
| Сторис | `GET/PUT …/story-config`, `GET …/story-board` | `getStoryConfig`, `saveStoryConfig`, `getStoryBoard`, `getStoryPlaces` · F-00-160 |
| Идеи, заявки на сферы | `…/ideas` (статус «сделано» → уведомление автору), `…/sphere-requests` | F-00-009, F-00-151…153 |
| План запуска, окупаемость, имя | `…/notes` (одним документом) | `listWaveItems`, `getPaybackInputs`, `listNameCandidates`… — рабочие заметки, см. `01` §8 |

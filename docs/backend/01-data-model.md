# 01 · Модель данных

Бэкенд на бумаге: что сервер хранит, как сущности связаны, какие нужны индексы, кто чем владеет, как
удаляем и как ведём журнал изменений. Опора — типы `src/domain/**`, срезы `src/mock/**`, фасад `src/api/**`
(снимок кода от 25.09.2026) и ТЗ `booking-research/functional-map/` (у `00-our-decisions.md` приоритет).

> **Написано под PostgreSQL, построено на MySQL.** Таблицы, поля, связи и индексы ниже остаются моделью
> данных как есть; типы и два приёма, которые MySQL не умеет (`EXCLUDE`, `tstzrange`, `jsonb`, `citext`,
> частичный индекс), переведены в `PLAN.md` §4 (§4.1 — таблица типов, §4.2 — «замок на мастера» вместо
> `EXCLUDE`). Где этот файл говорит `jsonb` — на сервере `JSON`; где `tstzrange`/`EXCLUDE` на
> `busy_blocks`/`resource_busy` — две колонки `start_at`/`end_at` + таблицы-локи `person_locks`/
> `resource_locks`. Что из этого реально легло в `prisma/schema.prisma`, этап за этапом, включая
> расхождения с этим файлом, — `docs/PROGRESS.md` в `booktime-backend`. Оставлено ненормализованным
> намеренно: переписывать 01–08 под MySQL построчно значило бы вести две копии одной модели — авторитет
> остаётся за PLAN §4 + фактической схемой, этот файл читается вместе с ним, а не вместо (этап 21, PLAN §6
> строка 21).

Метки в тексте:

- **[ядро]** — уже есть в `src/domain/core.ts`, переносим как есть;
- **[срез]** — сейчас живёт в срезе раздела (`src/mock/slices/<area>.ts`), на сервере становится таблицей;
- **[новое]** — в моке нет, нужно по ТЗ;
- **(предл.)** — моё предложение, решения пользователя нет.

---

## 0. Общие соглашения

| Что | Как на сервере | Почему |
|---|---|---|
| Идентификаторы | строка `<префикс>_<ULID>` (`bk_01J…`, `cl_01J…`), те же префиксы, что в `ID_PREFIX` (`src/api/core.ts`) | экраны уже работают со строками с префиксом; ULID сортируется по времени и не выдаёт количество записей |
| Деньги | целые драмы (`bigint`), тип `Money` | как в моке; копеек у драма в обиходе нет |
| Время | в базе `timestamptz` (UTC); в API — местное `'YYYY-MM-DDTHH:mm'` и `'YYYY-MM-DD'`, как сейчас | экраны не меняются. Пояс хранится у филиала (`locations.tz`, по умолчанию `Asia/Yerevan`, F-02-074) |
| Тексты мастера | `jsonb LocalizedText {ru, hy?, en?}` + пометка автоперевода `{hy_auto?: true}` и правка перевода мастером | F-00-172…174 |
| Телефон | `'+374XXXXXXXX'`, нормализуется на входе (как `normalizePhone`) | F-00-002, ключ клиента F-00-128 |
| Служебные поля у всех таблиц | `created_at`, `updated_at`, `created_by`, `updated_by`, `version int` | `version` — защита от одновременной правки: второй получает `409 conflict` (F-01-033: «побеждает первое») |
| Удаление | мягкое там, где есть история (записи, клиенты, сотрудники, услуги, товары); жёсткое — только черновики и настройки. Подробно — §9 | F-01-119, F-04-137, F-10-043 |
| Арендатор | почти каждая таблица кабинета несёт `business_id`; доступ к строке — только если у сессии есть членство в этом бизнесе (§ «Права» в `03`) | F-00-050: у каждого салона всё раздельно |

---

## 1. Люди и вход

Главное решение модели: **человек один, ролей у него несколько.** Мастер может быть клиентом другого
мастера, работать в салоне и одновременно сам по себе (F-00-045), владеть сетью. Поэтому «кто вошёл» и
«в какой роли действует» — разные таблицы.

| Таблица | Поля (главное) | Связи | Откуда |
|---|---|---|---|
| `users` | `id`, `phone` (уникален), `name`, `locale` (`ru/hy/en`), `blocked_at`, `delete_requested_at`, `deleted_at` | 1 : 0..1 `app_profiles`; 1 : N `staff` | [новое]; сейчас роль задаёт демо-персона (`src/demo/settings.ts`) |
| `app_profiles` | `user_id` (PK), `gender`, `birthday`, `district`, `big_font`, `consent_at`, `consent_version` | = `AppUser` | [ядро] `AppUser` + [срез] `client.consents` |
| `staff_logins` | `staff_id`, `login` (уникален), `password_hash` (argon2id), `must_change_password`, `failed_attempts`, `locked_until` | только администраторы (F-00-034) | [новое]; в ядре только `Staff.login` |
| `sessions` | `id`, `user_id`, `staff_id?` (для входа по логину), `app` (`client`/`business`/`platform`), `device`, `ip`, `created_at`, `last_seen_at`, `revoked_at` | «Завершить все сеансы» (F-10-125), отключение админа (F-00-040) | [новое] |
| `otp_requests` | `id`, `phone`, `channel` (`whatsapp`/`telegram`/`sms`), `code_hash`, `expires_at`, `attempts`, `sent_at`, `provider_message_id`, `status`, `ip` | вход по коду, `05` | [новое]; сейчас код всегда `0000` |
| `push_tokens` | `user_id`, `app`, `platform` (`ios`/`android`/`web`), `token`, `locale`, `updated_at`, `invalid_at` | пуши, `05` | [новое] |
| `login_events` | `user_id`/`staff_id`, `at`, `ip`, `device`, `result` | журнал входов (F-10-106) | [новое] |

`AppUser` мока становится `users` + `app_profiles`. Поле `Client.appUserId` остаётся, но смысл уточняется
в §5 и в `03` (правило P1).

---

## 2. Бизнес, сеть, филиал

| Таблица | Поля (главное) | Индексы | Откуда |
|---|---|---|---|
| `networks` | `id`, `name`, `owner_user_id`, `main_business_id` (F-11-017), `deleted_at` (F-11-019/020) | — | [ядро] `Network` |
| `businesses` | `id`, `kind` (`individual`/`salon`), `name`, `slug` (уникален), `sphere_ids[]`, `network_id?`, `owner_staff_id`, `phone`, `description` (LocalizedText), `logo_url`, `status` (`draft`/`moderation`/`active`/`frozen`), `left_at?`, `forbid_home_bookings_during_shift` (F-00-047), `socials jsonb` (F-14-028, сейчас [срез] `client.businessSocials`), `ads_opt_in` (F-00-164, сейчас [срез] `platform.bizMeta`) | `slug` unique; `(status)`; `(network_id)`; GIN по `sphere_ids` | [ядро] `Business` |
| `locations` | `id`, `business_id`, `name`, `address` (LocalizedText), `district`, `yandex_maps_url` (F-00-074, только ссылка), `coords` (из «Я на месте», F-00-075), `coords_at`, `phone`, `open_hours` (WeekTemplate, только витрина), `tz` | `(business_id)`; `(district)`; гео-индекс по `coords` | [ядро] `Location` |
| `business_settings` | `business_id`, `area`, `data jsonb`, `version` | `(business_id, area)` unique | [срез] настройки разделов: `journal.prefs`, `clients.lostAfterDays`, `clients.showFullNameFields`, `schedule.viewConfig` и т. п. |
| `network_settings` (этап 21) | `network_id`, `area`, `data json`, `updated_by` | PK `(network_id, area)` | [срез] `network`: `planEmailSchedule` (F-12-081), `telephony` (F-11-146…152, Р19 — только «подключено»/токен/маршруты/правила, звонков нет), `locationDeletions` (F-11-011), `exportLog` (F-11-044) |

**Почему настройки в одной таблице `jsonb`:** у 18 разделов десятки мелких настроек, которые читаются
целиком и меняются редко. Отдельная таблица на каждую — сотни миграций. Всё, по чему ищут или считают
(например, `forbid_home_bookings_during_shift`), выносим в колонку.

---

## 3. Сотрудники, права, приглашения

| Таблица | Поля (главное) | Откуда |
|---|---|---|
| `staff` | `id`, `business_id`, `user_id?` (пусто — сотрудник без входа: «Сотрудник — не обязательно человек», F-15-032; или приглашён, но не принял), `name`, `phone`, `role` (`owner`/`admin`/`master`), `role_template?` (8 шаблонов Altegio, F-10-053), `status` (`active`/`invited`/`disabled`/`fired`), `position_id?`, `sphere_ids[]`, `avatar_url`, `bio`, `color_index`, `accepts`, `calendar_visibility`, `calendar_mode`, `confirm_mode`, `call_mode` + `call_hours` (F-00-105), `contacts jsonb` (WhatsApp/Telegram/Instagram, F-00-104), `cancel_window_hours` (F-00-098), `prepayment jsonb {amount, timeout_min, requisites}` (F-00-097), `online_booking_enabled` (F-03-134), `show_in_journal` (F-02-082), `count_in_occupancy` (F-02-081), `assistant_available` (F-16-138), `hired_at`, `fired_at`, `deleted_at` | [ядро] `Staff` + [срез] `client.contacts`, `client.cancelWindowHours`, `client.prepaymentPolicy` (сейчас черновики у раздела client, см. `qa/requests/client.md`) |
| `staff_locations` | `staff_id`, `location_id` | [ядро] `Staff.locationIds` |
| `staff_workplaces` | `id`, `staff_id`, `kind` (`salon`/`home`/`visit`/`gym`/`online`), `location_id?`, `address_private` (дом мастера, F-00-077), `entrance_note` (подъезд, этаж, домофон), `district`, `coords?`, `yandex_maps_url`, `visit_districts[]` + `visit_surcharge` + `travel_min` (выезд, F-00-080), `online_url?` | [новое]; в ядре только `workplaces[]`, `homeAddress`, `visitDistricts` |
| `staff_permissions` | `staff_id`, `permission`, `granted` (bool), `set_by`, `set_at` | [ядро-доступ] `db.access.staffPermissions` |
| `positions` | `id`, `business_id` или `network_id`, `name`, `requirements`, `service_ids[]` | [новое] F-10-046…052, F-11-104…107 |
| `staff_invites` | `id`, `business_id`, `phone`, `role`, `token_hash`, `status` (`sent`/`accepted`/`declined`/`revoked`/`expired`), `expires_at` | [новое] F-00-042 «только по приглашению и с согласием мастера», F-10-020 |
| `master_profiles` | `user_id` (PK), `portfolio_photo_ids[]`, `diploma_ids[]`, `materials[]`, `sterilization jsonb` (F-00-090) | [новое] — чтобы фото и дипломы **уходили с мастером** (F-00-044), а не оставались в салоне |

Про `master_profiles`: в моке фото работ (`Staff.photos`) и материалы лежат на записи сотрудника конкретного
бизнеса. Если мастер уходит из салона или переходит из индивидуалов в салон (F-00-043), фото должны
остаться с ним. Поэтому портфолио привязываем к человеку (`user_id`), а `staff` лишь ссылается на него. У
сотрудника без аккаунта (`user_id` пуст) портфолио хранится на `staff` до момента, когда он примет приглашение.

---

## 4. Каталог: услуги, пакеты, ресурсы, фото

| Таблица | Поля (главное) | Откуда |
|---|---|---|
| `service_categories` | `id`, `business_id`, `name`, `online_name?` (F-03-131), `order`, `network_category_id?` | [ядро] |
| `services` | `id`, `business_id`, `category_id`, `sphere_id`, `name`, `online_name?`, `description`, `kind` (`individual`/`group`), `duration_min`, `duration_max?` (F-00-057), `price_min`, `price_max?`, `buffer_after_min?` (`null` = «общий» перерыв бизнеса, `0` = «без перерыва», F-02-060 — различать!), `repeat_interval_days` (F-00-084), `capacity` (групповые), `online_bookable`, `online_window jsonb?` («Доступна ограниченное время», F-02-067), `prepayment jsonb?` (F-07-089…094, если сделаем онлайн-оплату), `shade_requirement` (`off`/`required`/`preferred`, F-00-095, сейчас [срез] `client.shadeRequirement`), `template_id?` (F-00-083), `network_service_id?`, `active`, `archived_at`, `order` | [ядро] `Service` |
| `staff_services` | `staff_id`, `service_id`, `duration_min?`, `duration_max?`, `price_min?`, `price_max?`, `online_bookable` (пара «мастер × услуга», F-03-133) | [ядро] `Staff.serviceIds` / `Service.staffIds` (сейчас связь хранится **дважды** — на сервере одна таблица) |
| `packages`, `package_items` | пакет «Комплекс»: `order_mode` (`parallel`/`seq_one`/`seq_many`), `price_mode` (`sum`/`manual`/`percent`), `price`/`percent`; строки — услуга, порядок | [новое] F-16-107…135 |
| `resources`, `resource_instances`, `service_resources` | ресурс (кресло, кабинет, аппарат) с экземплярами; связь с услугами | [ядро] `Resource` (экземпляры внутри — на сервере отдельная таблица, её держит ограничение занятости) |
| `service_templates` | `id`, `sphere_id`, `name` (все 3 языка сразу, F-00-173), `duration_min`, `price` | [срез] `SPHERE_SERVICE_TEMPLATES` в `src/api/platform.ts` |
| `media` | `id`, `owner_type` (`master`/`business`/`service`/`story`/`ad`), `owner_id`, `slot_no`, `url`, `moderation_status`, `paid_slot_id?` | [новое]; места под фото: 6 на мастера (F-00-085), 6 у страницы салона (F-00-087); сверх — купленные за монеты (F-00-086) |
| `paid_photo_slots` | `id`, `user_id` (мастер), `coin_entry_id`, `bought_at` | [новое] «место покупается один раз» |
| `diplomas` | `id`, `user_id`, `file_url`, `title`, `moderation_status` | [новое] F-00-088 |

---

## 5. Клиенты (CRM бизнеса)

Клиент — **запись в базе конкретного бизнеса**, ключ — телефон в пределах бизнеса (F-00-128). Это не
пользователь приложения: у одного человека может быть 10 карточек в 10 салонах, и ни одна из них ему не видна
(F-00-130).

| Таблица | Поля (главное) | Индексы | Откуда |
|---|---|---|---|
| `clients` | `id`, `business_id`, `phone`, `name`, `last_name?`, `middle_name?`, `gender`, `birthday`, `email`, `note`, `additional_phone`, `avatar_url`, `discount_percent`, `importance_class`, `card_number`, `paid_manual` («Оплачено» старым способом, F-04-166), `blocked` (запрет онлайн-записи, F-04-056 / F-00-189), `no_show_count`, `app_user_id?` (см. ниже), `source`, `created_at`, `deleted_at`, `deleted_by`, `anonymized_at` | `(business_id, phone)` unique среди неудалённых; `(business_id, name)` trigram для поиска; `(business_id, birthday)`; `(app_user_id)` | [ядро] `Client` + [срез] `clients.profiles` |
| `client_categories`, `client_category_links` | справочник категорий бизнеса + связь | `(business_id)`; `(client_id)` | сейчас категории = `Client.tags` (строки); просьба журнала F-01-214 «каталог, не только теги» |
| `client_comments` | `id`, `client_id`, `author_staff_id`, `text`, `created_at`, `deleted_at` | `(client_id, created_at)` | [срез] `clients.comments` |
| `client_field_defs`, `client_field_values` | свои поля клиента (тип, обязательность, «пользователь может редактировать», F-04-139…145) | | [срез] `clients.customFieldDefs/Values` (сейчас только текст) |
| `client_files` | `client_id`, `url`, `name`, `uploaded_by` | | [новое] F-04-086 |
| `client_visitors` | `client_id`, `name`, `kind` (`child`/`pet`/`other`) | | [новое] F-04-091, F-00-125 |
| `client_notify_prefs` | `client_id`, `type`, `enabled`, `marketing_opt_out` | | [новое] F-04-087…090 |
| `client_merges` | `kept_client_id`, `merged_client_id`, `by`, `at`, `moved jsonb` | | [новое] кнопка «Объединить» (F-04-135, наш вывод) |

**`clients.app_user_id` — что значит и кто его ставит.** Сейчас в моке это «у этого номера есть приложение»
(фильтр F-04-027/028). На сервере предлагаю разделить два факта:

1. «У номера есть приложение» — вычисляется на лету сравнением телефонов (`users.phone = clients.phone`) и
   отдаётся бизнесу только как да/нет. Бизнес не узнаёт ничего, кроме этого флага (как у Altegio).
2. «Запись в приложении принадлежит пользователю» — ставится **только** на записи (`bookings.app_user_id`),
   сделанные этим пользователем через приложение или веб после входа по коду. Записи, которые мастер внёс в
   журнал по телефону, пользователю в «Мои записи» не попадают (F-00-130: «не видит этого мастера, пока сам
   не запишется»; снято «мастер сам появится в Моих мастерах по номеру из CRM»).

---

## 6. Графики и отметки календаря

| Таблица | Поля (главное) | Откуда |
|---|---|---|
| `work_schedules` | `id`, `staff_id`, `location_id`, `workplace`, `week jsonb` (WeekTemplate), `open_until?` (F-00-055) | [ядро] `WorkSchedule` |
| `schedule_days` | `staff_id`, `location_id`, `date`, `hours jsonb` (DayHours), `day_type` (`work`/`sick`/`vacation`/…/`custom:<id>`), `vacation_until?` | [ядро] `WorkSchedule.overrides` + [срез] `schedule.days` — **сливаем в одну таблицу**: сейчас часы дня лежат в ядре, а тип дня — в срезе, и их приходится держать согласованными двумя записями |
| `calendar_marks` | `id`, `staff_id`, `date`, `from`, `to`, `kind` (`busy`/`free`), `workplace?`, `note?` | [ядро] `CalendarMark` |
| `schedule_templates` | `id`, `business_id`, `name`, `kind`, `weekdays[]`, `shift_work`, `shift_off`, `hours` | [срез] `schedule.templates` |
| `day_types` | свои нерабочие типы дня сети (F-02-011) | [новое] |
| `online_slot_rules` | `scope` (`location`/`staff`), `scope_id`, `slot_type` (`fixed`/`optimal`/`dynamic`), `start_mode` (`window`/`workday`), `window_from`, `window_to`, `step_min`, `min_lead_min`, `disabled_slots jsonb` (по дням недели), `unavailable_dates[]` | [новое] F-02-041…055; у нас правила — у каждого мастера (F-00-066), локация — значение по умолчанию |

---

## 7. Записи, визиты, занятость

### 7.1 Таблицы

| Таблица | Поля (главное) | Откуда |
|---|---|---|
| `bookings` | все поля `Booking` ядра + `hold_until?` (держит окно, пока ждём предоплату или подтверждение), `confirm_deadline?`, `cancel_reason?`, `cancelled_by` (`client`/`staff`/`system`), `late_cancel` (bool, F-00-098), `category_ids[]`, `color_index?`, `custom_fields jsonb`, `shade jsonb?` (F-00-094, сейчас [срез] `client.bookingShade`), `client_address_private?` (выезд, F-00-080), `travel_before_min`, `travel_after_min`, `link_id?`, `form_id?`, `device?`, `access_hash_sha256?` (F-03-098; сейчас [срез] `online.bookingMeta`), `paid_status` (`none`/`partial`/`full`), `deleted_by?` | [ядро] `Booking` + срезы `journal.extras`, `online.bookingMeta`, `client.bookingShade`, `client.prepaymentDeadline` |
| `booking_lines` | `booking_id`, `service_id`, `staff_id`, `price`, `duration_min`, `qty`, `discount_pct`, `assistant_staff_ids[]` | [ядро] `BookingServiceLine` + [срез] `journal.extras.serviceLineExtras` |
| `booking_goods_lines` | товары/абонементы/сертификаты, проданные в визите | [срез] `journal.extras.goodsLines` |
| `booking_status_history` | `booking_id`, `from`, `to`, `by`, `at`, `reason` | [новое] F-00-068 «смена статуса видна в истории записи» |
| `visits` | `id`, `business_id`, `client_id`, `date` — склейка записей клиента за день по интервалу (F-01-041) | [ядро] `Booking.visitId` |
| `booking_series` | `id`, `rule jsonb` (каждые N дней / по дням недели, F-00-064, F-01-100…107), `created_until`, `ends_at?` | [ядро] `Booking.seriesId` |
| `prepayments` | `booking_id`, `amount`, `requisites_snapshot`, `deadline_at`, `client_marked_paid_at`, `master_confirmed_at`, `refund_due`, `refunded_at` | [ядро] `Booking.prepayment` + [срез] `client.prepaymentDeadline`; «при отмене мастером предоплата возвращается полностью» (F-00-100) |
| `group_events`, `group_event_participants` | событие + участники (`booking_id`, `seats`) | [ядро] `GroupEvent` |
| `waitlist_entries` | `id`, `business_id`, `app_user_id?` (встал сам, F-00-102) или `client_id?` (поставил администратор, F-16-148…), `service_ids[]`, `staff_ids[]` (пусто = любой), `wishes jsonb` (дни и интервалы, F-16-153), `status` (`active`/`expired`/`closed`), `notified_at?`, `closed_booking_id?` | [срез] `client.waitlist` + лист ожидания Altegio — **одна таблица на оба** |
| `callback_requests` | `staff_id`, `phone`, `name?`, `created_at`, `handled_at?` | [срез] `client.callbackRequests` (сейчас не доходит до мастера, `qa/requests/client.md`) |

### 7.2 Занятость человека — ключевая таблица

`busy_blocks` — **[новое]**, проекция всего, что занимает время мастера и ресурсов:

| Поле | Смысл |
|---|---|
| `person_key` | `user_id` мастера, а если аккаунта нет — `staff_id` |
| `staff_id`, `business_id`, `location_id` | где и в какой роли занят |
| `range` | `tstzrange` — начало..конец **с запасом после услуги и дорогой** |
| `source` | `booking` / `group_event` / `mark_busy` / `travel` |
| `source_id` | id записи/события/отметки |
| `visibility_label` | что показать чужому бизнесу: `home` / `salon` / `visit` / `busy` — **без имени и суммы** |

Ограничение базы (PostgreSQL):
`EXCLUDE USING gist (person_key WITH =, range WITH &&) WHERE (active)` — две активные записи одного
человека на пересекающееся время **невозможны физически**, даже при одновременных запросах из салона и
из приложения клиента (F-00-045 «двойная запись невозможна», F-00-092 «окно уже заняли»). Такое же
ограничение — на `resource_busy (resource_instance_id, range)` (F-00-149, F-02-070).

Зачем отдельная проекция, а не запрос по `bookings`:

1. Мастер в салоне и сам по себе — это **две строки `staff` в двух бизнесах** одного человека. Запись в одном
   должна закрывать время в другом (F-00-045). По `bookings` это запрос через два арендатора; по
   `busy_blocks` — один индекс по `person_key`.
2. Администратор салона видит «занято дома» без имени (F-00-046) — ровно `visibility_label`, данных чужой
   записи он не касается вовсе.
3. Расчёт окон (документ `04`) читает одну таблицу.

Блок пишется в той же транзакции, что и запись; отмена, «не пришёл» (если включено «поверх неявок»,
F-02-066) и удаление гасят блок (`active = false`).

---

## 8. Остальные разделы — сущности крупно

Разделы ниже в интерфейсе пока заглушки (`src/domain/<area>.ts` по 5 строк), поэтому модель — по ТЗ Altegio
1:1 с нашими поправками. Подробные поля — в F-блоках, указанных в скобках.

| Раздел | Таблицы | F-опора | Чьё |
|---|---|---|---|
| Уведомления | `notification_settings` (тип × канал × вкл, по бизнесу), `notification_templates`, `notifications` (исходящая очередь: получатель, канал, тип, данные, `send_at`, статус, попытки, ключ дубля), `inbox_items` (колокольчик), `news_posts` (новость подписчикам: текст, фото, `sent_at`, `recipients`, `week_key`) | 05; F-00-114, F-00-120 | бизнес |
| Подписки клиента | `favorites` (`app_user_id`, `target_type` staff/business, `target_id`, `news_muted`, F-00-113/115), `ratings` (звёздочка: `app_user_id`, `staff_id` unique, `booking_id` визита «пришёл», F-00-116), `diary_entries` (F-00-122), `demand_entries` (F-00-112) | 00 §10 | клиент |
| Лояльность | `loyalty_card_types`, `loyalty_cards`, `promotions` (+ правила `jsonb`), `loyalty_tx`, `referral_program`, `certificate_types`, `certificates`, `membership_types`, `memberships` (+ `freezes`), `client_account_types`, `client_accounts`, `client_account_ops` | 06 | **сеть** (F-06-002 «лояльность живёт в сети»), у одиночного салона — сам салон |
| Финансы | `cash_registers`, `payment_items` (статьи), `fin_ops` (операции: дата, статья, касса, контрагент/клиент/сотрудник, сумма, способ, `cancelled_at`), `counterparties`, `documents`, `payment_methods` (+ комиссии), `booking_payments` (связь операции со строкой визита, F-07-181), `refunds`, `fines` | 07 | бизнес |
| Склад | `warehouses` (тип: списание/продажа), `product_categories`, `products` (+ оттенок, `show_to_clients` F-00-144, критичный/желаемый остаток), `stock_batches` (срок годности партии, F-00-140), `stock_ops` + `stock_op_lines`, `stock_balances` (итог по складу × товару), `tech_cards` + строки, `staff_service_tech_cards`, `inventories`, `equipment` (+ обслуживание и замена, F-00-141), `reminders` (F-00-142) | 08; 00 §12 | бизнес (F-00-050) |
| Зарплата | `payroll_schemes` (упрощённая модель — `jsonb` на сотрудника), `payroll_rules`, `payroll_criteria`, `scheme_assignments` (с датой начала), `payroll_statements` + строки, `bonuses_fines`; выплаты — через `fin_ops` | 09 | бизнес |
| Сеть | `network_users` + права сети, `network_services`/категории, `network_products`, `network_positions`, `network_client_fields`, `revenue_plans` | 11 | сеть |
| Отчёты | своих таблиц почти нет; `daily_stats` (бизнес × мастер × день: выручка, визиты, новые, потерянные, минуты графика и записей) — пересчёт по событиям | 12 | бизнес |
| Интеграции | `api_keys`, `webhooks`, `webhook_deliveries`, `integration_connections` — сейчас только интерфейс, настоящих подключений нет (AREAS) | 13 | бизнес |
| Подписка и деньги платформы | `subscriptions`, `subscription_charges`, `saved_cards` (токен у провайдера), `promo_codes`, `promo_redemptions`, `free_period_grants`, `coin_entries`, `coin_packages`, `story_bookings`, `ideas` + `idea_votes` (F-00-009), `sphere_requests` (F-00-151/152) | 00 §2, §14; 15 | бизнес / мы — документ `06` |
| Наша панель | `moderation_items` + `moderation_events`, `reject_reasons`, `platform_team`, `connect_drafts`, `sales_visits` (наши визиты по салонам), `support_tickets` + сообщения, `first_awards`, `ad_placements`, `ads`, `ad_daily_stats`, `story_config`, `backups`, `data_exports` | [срез] `platform` (весь тип `PlatformState`) | мы |

План запуска, окупаемость и выбор имени (`waveItems`, `prelaunchItems`, `paybackInputs`, `nameCandidates`,
`brand` в срезе platform) — рабочие заметки, а не данные продукта. На сервере достаточно одного
`platform_notes jsonb`; можно не переносить вовсе (предл.).

---

## 9. Что чьё: салон, сеть, мастер, клиент

| Владелец | Что хранится | Что с этим при уходе / переходе |
|---|---|---|
| **Клиент (человек)** | профиль приложения, избранное и приглушённые новости, звёздочки, дневник расходов, лист ожидания, свои записи из приложения (ссылка `bookings.app_user_id`), согласия | удаление аккаунта (F-10-129): через 25 дней обезличиваем (`03`, P11) |
| **Мастер (человек)** | портфолио (6 мест + купленные), дипломы, материалы, стерилизация, контакты, часы звонков — `master_profiles` + поля `staff` | уходит из салона — портфолио остаётся с ним (F-00-044, предл.); салон теряет доступ к его фото |
| **Бизнес (салон или индивидуал)** | клиенты и вся CRM, записи, деньги, склад, зарплата, услуги, ресурсы, график, настройки, уведомления, 6 фото страницы салона, подписка, монеты | уход с платформы: выгрузка (F-00-183), хранение по сроку (открытый вопрос), потом обезличивание |
| **Сеть** | общая клиентская база (как объединение баз филиалов), лояльность и счета клиентов, сетевые услуги/товары/должности, планы | филиал уходит из сети (F-11-013): сетевые типы в нём перестают действовать, его клиенты остаются у него |
| **Мы (платформа)** | модерация, промокоды, наши визиты, поддержка, реклама, спрос, копии данных | — |

**Индивидуал и салон одновременно** (F-00-017, F-00-045): у человека две строки `staff` в двух бизнесах, две
независимые подписки, общий `person_key` занятости. Клиенты салона не видны его «индивидуальному» кабинету, и
наоборот; видно только «занято» (`03`, P2–P3).

---

## 10. Удаление

| Сущность | Как удаляем | Что видно после |
|---|---|---|
| Запись | мягко: `deleted_at`, `deleted_by`; строка остаётся (F-01-119); статистика визитов клиента её не считает | в «Записях» — красной строкой; «Отменить» 5 секунд = снять `deleted_at` (F-00-061) |
| Клиент | мягко; телефон освобождается для новой карточки (предл.; у Altegio удалённая карточка «возвращается» с историей по тому же номеру — F-04-137, решить) | записи остаются с именем в снимке; по просьбе клиента — обезличивание (P11) |
| Сотрудник | статусы `fired` / `disabled`, потом `deleted_at`; сессии и приглашения гаснут сразу | записи и статистика остаются (F-10-043) |
| Услуга, товар, тип абонемента | архив (`archived_at`); жёстко — только если ни на что не ссылается | в старых записях — по снимку названия |
| Настройки, шаблоны, черновики подключения | жёстко | — |
| Бизнес | `left_at` → выгрузка → хранение N дней → обезличивание клиентов (срок — открытый вопрос) | F-00-183 |
| Аккаунт человека | запрос → 25 дней на отмену (F-05-064) → обезличивание | — |

Жёсткого удаления записей и денег нет вообще: только отмена обратной операцией (F-07-015).

---

## 11. Журнал изменений

Наше решение шире Altegio: **полная лента «кто, когда, что»**, а не «последнее действие по объекту», и в неё
попадают клиенты, услуги, цены, склад (F-00-040, F-10-100, F-10-101).

| Таблица | Поля | Что пишет |
|---|---|---|
| `audit_events` | `id`, `business_id?`, `network_id?`, `actor_type` (`staff`/`client`/`link_holder`/`system`/`platform`), `actor_id?`, `actor_name` (снимок), `action` (`create`/`update`/`delete`/`restore`/`status`/`login`/`export`…), `entity_type`, `entity_id`, `diff jsonb` (только изменённые поля «было → стало»), `request_id`, `ip`, `device`, `at` | каждая запись ядра и разделов через общий слой сервера; добавление и правка — в той же транзакции |
| `data_exports` | `id`, `business_id`, `staff_id`, `what` (`clients`/`bookings`/`finance`/`stock`/…), `rows`, `filters jsonb`, `at`, `file_expires_at` | каждая выгрузка (F-10-102, F-00-183); сейчас [срез] `platform.exportLog` |
| `permission_changes` | `staff_id`, `by`, `before[]`, `after[]`, `at` | «История изменений прав» (F-10-070) |
| `login_events` | см. §1 | F-10-106 |

Правила журнала:

- Журнал **не правится и не чистится** из интерфейса (F-10-100). Хранение — не меньше срока хранения данных
  бизнеса (открытый вопрос).
- Телефоны в `diff` маскируются так же, как на экранах, для тех, у кого нет права на телефоны (утечка F-10-093
  «История изменений показывает полный телефон» — у нас не повторять).
- Действие по ссылке «моя запись без входа» пишется с `actor_type = link_holder` (у Altegio —
  «Неавторизованный пользователь», F-05-022).
- История графика (сейчас [срез] `schedule.history`, 200 строк) и история модерации
  (`ModerationItem.history`) становятся частными видами того же `audit_events`.

---

## 12. Индексы — сводка

| Таблица | Индекс | Для чего |
|---|---|---|
| `bookings` | `(business_id, start)`, `(staff_id, start)`, `(client_id, start)`, `(app_user_id, start)`, `(location_id, start)`; частичный `WHERE deleted_at IS NULL` | журнал дня, мои записи, история клиента |
| `bookings` | `(status, hold_until)` частичный | фоновая отмена неоплаченных (F-00-097) |
| `busy_blocks` | GiST `(person_key, range)` + EXCLUDE | окна и защита от двойной записи |
| `resource_busy` | GiST `(resource_instance_id, range)` + EXCLUDE | ресурсы |
| `clients` | `(business_id, phone)` unique partial; trigram по имени; `(business_id, last_visit_at)` | поиск, сегмент «потерянные» |
| `schedule_days` | `(staff_id, date)` | окна |
| `staff` | `(business_id, status)`, `(user_id)` | кабинет, «человек в двух бизнесах» |
| `locations` | гео по `coords`, `(district)` | «рядом со мной», район |
| `availability_cache` | `(date, sphere_id, district)`, `(staff_id, date)` | каталог «кто когда свободен», `04` §6 |
| `notifications` | `(status, send_at)` | очередь отправки |
| `audit_events` | `(business_id, at desc)`, `(entity_type, entity_id, at)` | журнал |
| `moderation_items` | `(status, submitted_at)`, `(ref_id)` | очередь проверки |
| `promo_codes` | `code` unique (без учёта регистра) | ввод промокода |

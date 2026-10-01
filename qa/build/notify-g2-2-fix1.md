# Уведомления (notify) — доделка g2-2-fix1

Починка дефектов, найденных измерителем после доделки g2-2.

## Починено (свои пути)

**F-05-061 / F-05-062 (major) — клик по строке центра уведомлений открывал ПУСТОЕ окно записи.**
Причина найдена: она не в `journal` (как предполагал прошлый отчёт в `qa/requests/notify.md`), а в самой
`InboxScreen.tsx` — переход `router.push('/biz/journal?booking=<id>')` не передавал `date`, а
`JournalScreen.tsx` ищет запись только среди бронирований выбранного дня (по умолчанию — сегодня); если
событие не сегодняшнее, `activeBooking` не находится и `BookingWindow` рисуется пустым.
Правка целиком в `src/areas/notify/InboxScreen.tsx`: строка события теперь несёт дату брони
(`b.start.slice(0, 10)`), переход стал `?date=<дата>&booking=<id>`. Проверено живьём (persona owner,
`/biz/notifications/inbox` → клик по строке на 05.10.2026): окно открылось с клиентом «Сона Григорян»,
услугой «Укрепление ногтей гелем», суммой 13 000 ֏ и статусом — вместо пустого.

## Не мои — записано в `qa/requests/notify.md`, не правил чужие пути

**F-05-055 / F-05-056 / F-05-057 / F-05-060 / F-05-063 / F-05-113 (block).** Измеритель отнёс их к notify,
но по собственному плану раздела (`qa/plan/notify.md`, таблица `notOurs`) все шесть — вкладка «Уведомления»
карточки сотрудника, хозяин `staff` (F-10-033, F-10-097, F-10-137, F-10-019/020, F-10-082); в
`docs/areas.json`/`AREAS.md` notify не входит в список вкладчиков хоста `staffCard` (только schedule,
services, online, payroll, resources) — заводить его значит трогать `src/extensions/pairs.ts` (фундамент),
что не мой путь. Проверено живьём: `/biz/staff` (persona owner) — заглушка «Раздел скоро появится», карточки
сотрудника не существует вообще, вкладку «Уведомления» физически некуда встраивать до постройки `staff`.
Записал просьбу разделу `staff`: когда появится карточка сотрудника, добавить пару хост/раздел в `pairs.ts`
и вклад `src/areas/notify/extensions/StaffCard.tsx` — поля уже расписаны в `qa/plan/notify.md` §b03.

**F-05-064 (block).** Тот же план: «Письма пользователю от сервиса» = «Личный кабинет → Уведомления»,
F-15-153 — раздел `settings`, не notify (маршруты notify ограничены `/biz/notifications/**`). Экран
действительно не начат нигде — записал просьбу владельцу `settings`.

## Перепроверено живьём (major/minor)

**F-05-059 / F-05-111 / F-05-112 — гейты по правам.** Коарс-уровень подтверждён живьём в этой пачке:
- persona `admin` (в `PERSONA_PERMISSIONS` нет `notify.mailings`) на `/biz/notifications/mailings` →
  «Нет прав на это действие. Попросите владельца открыть доступ.»
- persona `master` (нет `notify.manage`) на `/biz/notifications/log` → тот же экран отказа.

Тонкая комбинация «есть `notify.manage`, но нет `clients.phones`» живьём не проверяется — редактор прав
конкретного сотрудника живёт в карточке сотрудника (`staff`, см. выше, ещё не построена); по коду
`LogScreen.tsx` (`canPhones = useCan('clients.phones')`, `maskContact`/`maskPhonesInText`) правило уже
реализовано верно (номер маскируется и в колонке «Контакт», и внутри текста сообщения), «Готово, когда»
F-05-112 выполнено. Перепроверю живьём тонкую комбинацию, когда появится редактор прав сотрудника.

**F-05-097 — дедуп по сети, кейс «один клиент в 2 филиалах».** Проверено живьём: persona `network`,
`/biz/notifications/mailings/new` — без «По всей сети» получателей 2, с галочкой — 4 (не механическая
сумма по филиалам, дедуп по телефону в `audienceClients()` уже был в коде — `seenPhones`).

## Постороннее, замеченное, но не тронутое

`measure.mjs` на `/dev/ext/bookingWindow|clientCard|settingsHub/notify` даёт `ReferenceError:
defaultCardTypeNotify is not defined` (5 страниц «висит загрузка») — падает `src/mock/slices/loyalty.ts:108`
(не импортирована `defaultCardTypeNotify` из `@/domain/loyalty`; тот же файл уже красный и в `tsc`).
Это путь `loyalty`, не мой — не правил, просто фиксирую: реальные страницы notify (6 маршрутов
`/biz/notifications/**`) этой ошибки не показывают и загружаются нормально.

## Проверки перед сдачей

- `tsc --noEmit --incremental` по всему проекту (фильтр по своим путям) — 0 ошибок в
  `src/app/biz/notifications/**` и `src/areas/notify/**`; ошибки, что есть в логе — чужие
  (`src/areas/client/notifications/NotificationsScreen.tsx`, `src/mock/slices/loyalty.ts`).
- `eslint` по `src/app/biz/notifications/**` и `src/areas/notify/**` — 0 ошибок.
- `scripts/ensure-dev.sh` — сервер уже работал на :3710, не трогал.
- `scripts/measure.mjs --area notify` — 16 страниц; на 6 настоящих маршрутах notify: 0 ошибок консоли,
  0 4xx, 0 сырых ключей, data-f на месте; 5 `/dev/ext/*` страниц падают из-за чужого бага в `loyalty`
  (см. выше), не notify.
- Снимки посмотрел глазами: `biz-notifications-inbox__owner-nails-ru-light-phone.png` (телефон, центр
  уведомлений — воздух, крупные карточки, красная точка непрочитанного) и
  `biz-notifications-log__owner-nails-ru-light-desktop.png` (десктоп, журнал отправок — таблица читается,
  маска телефона видна) — оба в порядке.

## done

- F-05-061
- F-05-062

## partial

(остальные из списка дефектов — не мои пути, разбор и переадресация в `qa/requests/notify.md`; F-05-059/
F-05-111/F-05-112/F-05-097 — код и коарс-гейт подтверждены, тонкая комбинация ждёт `staff`)

## marked

88 (`node scripts/fids.mjs --area notify` после этой пачки; без изменений — правки не добавляли новых
`data-f`, только чинили навигацию)
